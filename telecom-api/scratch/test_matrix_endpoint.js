const db = require('../db');

async function testEndpoint(desde, hasta) {
  const whereClauses = ["o.estado NOT IN ('Cancelada', 'Anulada')"];
  const params = [];

  if (desde && hasta) {
    whereClauses.push("DATE(o.fecha_visita) BETWEEN ? AND ?");
    params.push(desde, hasta);
  } else if (desde) {
    whereClauses.push("DATE(o.fecha_visita) >= ?");
    params.push(desde);
  } else if (hasta) {
    whereClauses.push("DATE(o.fecha_visita) <= ?");
    params.push(hasta);
  }

  const whereSql = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";

  // 1. Obtener listado de técnicos con desglose de órdenes y tipos
  const [rows] = await db.query(`
    SELECT 
      COALESCE(u.id_usuario, o.id_tecnico, 0) AS id_tecnico,
      COALESCE(CONCAT(u.nombres, ' ', u.apellidos), o.tecnico_asignado, o.cuadrilla, 'Sin Asignar') AS tecnico_nombre,
      u.foto_personal,
      COALESCE(u.cuadrilla, o.cuadrilla, '-') AS cuadrilla,
      COUNT(o.id_orden) AS total_ordenes,
      SUM(CASE WHEN UPPER(o.tipo_trabajo) LIKE '%RECABLE%' OR UPPER(COALESCE(ol.tipo_trabajo_acta,'')) LIKE '%RECABLE%' THEN 1 ELSE 0 END) AS cant_recableados,
      SUM(CASE WHEN UPPER(o.tipo_trabajo) LIKE '%TRASLAD%' OR UPPER(COALESCE(ol.tipo_trabajo_acta,'')) LIKE '%TRASLAD%' THEN 1 ELSE 0 END) AS cant_traslados,
      SUM(CASE WHEN UPPER(o.tipo_trabajo) LIKE '%ALTA%' OR UPPER(o.tipo_trabajo) LIKE '%INSTALAC%' OR UPPER(COALESCE(ol.tipo_trabajo_acta,'')) LIKE '%ALTA%' THEN 1 ELSE 0 END) AS cant_altas,
      SUM(CASE WHEN (UPPER(o.tipo_trabajo) NOT LIKE '%RECABLE%' AND UPPER(COALESCE(ol.tipo_trabajo_acta,'')) NOT LIKE '%RECABLE%' AND UPPER(o.tipo_trabajo) NOT LIKE '%TRASLAD%' AND UPPER(COALESCE(ol.tipo_trabajo_acta,'')) NOT LIKE '%TRASLAD%' AND UPPER(o.tipo_trabajo) NOT LIKE '%ALTA%' AND UPPER(o.tipo_trabajo) NOT LIKE '%INSTALAC%') THEN 1 ELSE 0 END) AS cant_otras,
      SUM(COALESCE(ol.drop_total_metros, 0)) AS metros_bobina,
      COUNT(DISTINCT ol.id_liquidacion) AS liquidaciones_con_acta
    FROM ordenes o
    LEFT JOIN usuarios u ON (o.id_tecnico = u.id_usuario OR (o.tecnico_asignado IS NOT NULL AND CONCAT(u.nombres, ' ', u.apellidos) = o.tecnico_asignado))
    LEFT JOIN orden_liquidaciones ol ON o.id_orden = ol.id_orden
    ${whereSql}
    GROUP BY id_tecnico, tecnico_nombre, u.foto_personal, cuadrilla
    HAVING total_ordenes > 0
    ORDER BY cant_recableados DESC, metros_bobina DESC, total_ordenes DESC
  `, params);

  // 2. Obtener los rollos conectorizados usados en el período
  const [conecRows] = await db.query(`
    SELECT 
      ol.id_trabajador,
      t.id_usuario,
      p.nombre AS producto,
      d.cantidad,
      ol.id_orden
    FROM orden_liquidacion_detalle d
    JOIN orden_liquidaciones ol ON d.id_liquidacion = ol.id_liquidacion
    JOIN ordenes o ON ol.id_orden = o.id_orden
    JOIN productos p ON d.id_producto = p.id_producto
    LEFT JOIN trabajadores t ON ol.id_trabajador = t.id_trabajador
    ${whereSql} AND (p.nombre LIKE '%CONECTORIZADO%' OR p.nombre LIKE '%DROP%50%' OR p.nombre LIKE '%DROP%100%' OR p.nombre LIKE '%DROP%150%' OR p.nombre LIKE '%DROP%200%')
  `, params);

  // Mapear conectorizados por técnico
  const conecMap = {};
  for (const c of conecRows) {
    const key = c.id_usuario || c.id_trabajador || 'otro';
    if (!conecMap[key]) {
      conecMap[key] = {
        total_rollos: 0,
        metros_conectorizado: 0,
        rollos_50: 0,
        rollos_100: 0,
        rollos_150: 0,
        rollos_200: 0
      };
    }
    const nom = (c.producto || '').toUpperCase();
    const cant = Number(c.cantidad) || 1;
    conecMap[key].total_rollos += cant;

    let rollMts = 0;
    if (/200\s*(M|MT)?\b|\*200/i.test(nom)) { rollMts = 200; conecMap[key].rollos_200 += cant; }
    else if (/150\s*(M|MT)?\b|\*150/i.test(nom)) { rollMts = 150; conecMap[key].rollos_150 += cant; }
    else if (/100\s*(M|MT)?\b|\*100/i.test(nom)) { rollMts = 100; conecMap[key].rollos_100 += cant; }
    else if (/(?:^|[^\d])50\s*(M|MT)?\b|\*50/i.test(nom)) { rollMts = 50; conecMap[key].rollos_50 += cant; }
    else { rollMts = 100; }

    conecMap[key].metros_conectorizado += rollMts * cant;
  }

  // 3. Fusionar datos y calcular métricas por técnico
  let totalRecableados = 0;
  let totalTraslados = 0;
  let totalAltas = 0;
  let totalOtras = 0;
  let totalMetrosBobina = 0;
  let totalMetrosConectorizado = 0;
  let totalRollosConectorizados = 0;

  const tecnicosMatrix = rows.map(r => {
    const cData = conecMap[r.id_tecnico] || { total_rollos: 0, metros_conectorizado: 0, rollos_50: 0, rollos_100: 0, rollos_150: 0, rollos_200: 0 };
    const recabs = Number(r.cant_recableados) || 0;
    const trasls = Number(r.cant_traslados) || 0;
    const altas = Number(r.cant_altas) || 0;
    const otras = Number(r.cant_otras) || 0;
    const totOrds = Number(r.total_ordenes) || 0;
    const mtsBobina = Number(r.metros_bobina) || 0;
    const mtsConec = cData.metros_conectorizado || 0;
    const totalFibraEfectiva = mtsBobina + mtsConec;

    const ordsConDrop = recabs + trasls + altas;
    const pctRecableado = totOrds > 0 ? ((recabs / totOrds) * 100).toFixed(1) : '0';
    const promDropPorRecableado = recabs > 0 ? (totalFibraEfectiva / recabs).toFixed(1) : (ordsConDrop > 0 ? (totalFibraEfectiva / ordsConDrop).toFixed(1) : '0');

    totalRecableados += recabs;
    totalTraslados += trasls;
    totalAltas += altas;
    totalOtras += otras;
    totalMetrosBobina += mtsBobina;
    totalMetrosConectorizado += mtsConec;
    totalRollosConectorizados += cData.total_rollos;

    return {
      id_tecnico: r.id_tecnico,
      tecnico: r.tecnico_nombre,
      foto_personal: r.foto_personal,
      cuadrilla: r.cuadrilla,
      total_ordenes: totOrds,
      recableados: recabs,
      traslados: trasls,
      altas: altas,
      otras: otras,
      ordenes_con_drop: ordsConDrop,
      pct_recableado: parseFloat(pctRecableado),
      metros_bobina: mtsBobina,
      metros_conectorizado: mtsConec,
      rollos_conectorizados: cData.total_rollos,
      rollos_50: cData.rollos_50,
      rollos_100: cData.rollos_100,
      rollos_150: cData.rollos_150,
      rollos_200: cData.rollos_200,
      total_fibra_efectiva: totalFibraEfectiva,
      prom_drop_por_recableado: parseFloat(promDropPorRecableado),
      nivel_recableado: recabs >= 150 ? 'Alto 🔥' : recabs >= 50 ? 'Medio ⚡' : 'Normal 🟢'
    };
  });

  // 4. Serie temporal para gráficos (Evolución diaria)
  const [timeline] = await db.query(`
    SELECT 
      DATE_FORMAT(o.fecha_visita, '%Y-%m-%d') AS fecha,
      DATE_FORMAT(o.fecha_visita, '%d/%m') AS fecha_corta,
      COUNT(o.id_orden) AS total_ordenes,
      SUM(CASE WHEN UPPER(o.tipo_trabajo) LIKE '%RECABLE%' OR UPPER(COALESCE(ol.tipo_trabajo_acta,'')) LIKE '%RECABLE%' THEN 1 ELSE 0 END) AS recableados,
      SUM(CASE WHEN UPPER(o.tipo_trabajo) LIKE '%TRASLAD%' OR UPPER(COALESCE(ol.tipo_trabajo_acta,'')) LIKE '%TRASLAD%' THEN 1 ELSE 0 END) AS traslados,
      SUM(COALESCE(ol.drop_total_metros, 0)) AS metros_drop
    FROM ordenes o
    LEFT JOIN orden_liquidaciones ol ON o.id_orden = ol.id_orden
    ${whereSql} AND o.fecha_visita IS NOT NULL
    GROUP BY fecha, fecha_corta
    ORDER BY fecha ASC
    LIMIT 60
  `, params);

  const totalGeneralOrds = totalRecableados + totalTraslados + totalAltas + totalOtras;
  const totalGeneralFibra = totalMetrosBobina + totalMetrosConectorizado;

  const resultado = {
    success: true,
    resumen: {
      total_ordenes: totalGeneralOrds,
      total_recableados: totalRecableados,
      total_traslados: totalTraslados,
      total_altas: totalAltas,
      total_otras: totalOtras,
      pct_recableados_general: totalGeneralOrds > 0 ? parseFloat(((totalRecableados / totalGeneralOrds) * 100).toFixed(1)) : 0,
      total_metros_bobina: totalMetrosBobina,
      total_metros_conectorizado: totalMetrosConectorizado,
      total_rollos_conectorizados: totalRollosConectorizados,
      total_fibra_efectiva: totalGeneralFibra,
      prom_metros_por_recableado: totalRecableados > 0 ? parseFloat((totalGeneralFibra / totalRecableados).toFixed(1)) : 0,
      tecnico_lider_recableado: tecnicosMatrix[0] || null
    },
    ranking_tecnicos: tecnicosMatrix,
    top_10_grafico: tecnicosMatrix.slice(0, 10).map(t => ({
      tecnico: t.tecnico.split(' ')[0] + ' ' + (t.tecnico.split(' ')[1] || ''),
      tecnico_completo: t.tecnico,
      recableados: t.recableados,
      traslados: t.traslados,
      total_ordenes: t.total_ordenes,
      metros_fibra: t.total_fibra_efectiva
    })),
    distribucion_tipos: [
      { name: 'Recableados', value: totalRecableados, color: '#f97316' },
      { name: 'Traslados', value: totalTraslados, color: '#3b82f6' },
      { name: 'Altas / Inst.', value: totalAltas, color: '#10b981' },
      { name: 'Otras Averías', value: totalOtras, color: '#94a3b8' }
    ],
    timeline: timeline
  };

  console.log("RESUMEN GENERAL:", resultado.resumen);
  console.log("TOP 5 TECNICOS MATRIX:", resultado.ranking_tecnicos.slice(0, 5));
  process.exit(0);
}

testEndpoint('2026-08-01', '2026-09-24');
