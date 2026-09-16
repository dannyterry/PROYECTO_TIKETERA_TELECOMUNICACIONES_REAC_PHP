const pool = require('../db');

async function inspectAbril() {
  try {
    console.log("=== INSPECCIÓN A FONDO ABRIL 2026 ===\n");

    const oficial = {
      averias: { asig: 979, fin: 768, canc: 211, ef: 78.45 },
      postventa: { asig: 176, fin: 126, canc: 50, ef: 71.59 },
      total: { asig: 1155, fin: 894, canc: 261 }
    };

    // 1. Conteo total de órdenes en Abril 2026 por estado
    const [totales] = await pool.query(`
      SELECT 
        estado,
        COUNT(*) as total
      FROM ordenes
      WHERE YEAR(fecha_visita) = 2026 AND MONTH(fecha_visita) = 4
        AND (cuadrilla IS NULL OR (TRIM(cuadrilla) NOT REGEXP '^[oO][0-9]+' AND TRIM(cuadrilla) NOT REGEXP '^[oO] ' AND TRIM(cuadrilla) NOT LIKE 'ORDENAMIENTO%'))
        AND (cliente IS NULL OR (cliente NOT LIKE '%NORMALIZACI%' AND cliente NOT LIKE '%CONJUNTA PEXT%'))
        AND (tipo_trabajo IS NULL OR tipo_trabajo NOT LIKE '%ORDENAMIENTO%')
      GROUP BY estado
      ORDER BY total DESC
    `);
    console.log("1. Total de órdenes en Abril por Estado:", totales);

    // 2. Conteo preliminar (excluyendo Regestiones y Anuladas)
    const [statsPrelim] = await pool.query(`
      SELECT 
        -- POSTVENTA
        COUNT(CASE WHEN (
          COALESCE(tipo_trabajo, '') LIKE '%TRASLADO%' 
          OR COALESCE(tipo_trabajo, '') LIKE '%REUBICA%' 
          OR COALESCE(tipo_trabajo, '') LIKE '%MESH%' 
          OR COALESCE(tipo_trabajo, '') LIKE '%WIN BOX%' 
          OR COALESCE(tipo_trabajo, '') LIKE '%WINBOX%' 
          OR COALESCE(tipo_trabajo, '') LIKE '%WIFI%' 
          OR COALESCE(tipo_trabajo, '') LIKE '%TELEFON%' 
          OR COALESCE(tipo_trabajo, '') LIKE '%MUDANZA%' 
          OR COALESCE(producto, '') LIKE '%POST%VENTA%' 
          OR COALESCE(motivo_finalizacion, '') LIKE '%POST%VENTA%'
          OR COALESCE(motivo_finalizacion, '') LIKE '%MESH%'
          OR (COALESCE(tipo_trabajo, '') LIKE '%ADICIONAL%' AND COALESCE(tipo_trabajo_asignado, '') NOT LIKE '%LOS ROJO%')
        ) AND estado != 'Anulada' AND estado NOT LIKE '%Regesti%' THEN 1 END) as pv_asig,

        SUM(CASE WHEN (
          COALESCE(tipo_trabajo, '') LIKE '%TRASLADO%' 
          OR COALESCE(tipo_trabajo, '') LIKE '%REUBICA%' 
          OR COALESCE(tipo_trabajo, '') LIKE '%MESH%' 
          OR COALESCE(tipo_trabajo, '') LIKE '%WIN BOX%' 
          OR COALESCE(tipo_trabajo, '') LIKE '%WINBOX%' 
          OR COALESCE(tipo_trabajo, '') LIKE '%WIFI%' 
          OR COALESCE(tipo_trabajo, '') LIKE '%TELEFON%' 
          OR COALESCE(tipo_trabajo, '') LIKE '%MUDANZA%' 
          OR COALESCE(producto, '') LIKE '%POST%VENTA%' 
          OR COALESCE(motivo_finalizacion, '') LIKE '%POST%VENTA%'
          OR COALESCE(motivo_finalizacion, '') LIKE '%MESH%'
          OR (COALESCE(tipo_trabajo, '') LIKE '%ADICIONAL%' AND COALESCE(tipo_trabajo_asignado, '') NOT LIKE '%LOS ROJO%')
        ) AND (estado LIKE '%Finaliz%' OR estado LIKE '%Liquid%' OR estado LIKE '%Termin%') THEN 1 ELSE 0 END) as pv_fin,

        -- AVERIAS
        COUNT(CASE WHEN NOT (
          COALESCE(tipo_trabajo, '') LIKE '%TRASLADO%' 
          OR COALESCE(tipo_trabajo, '') LIKE '%REUBICA%' 
          OR COALESCE(tipo_trabajo, '') LIKE '%MESH%' 
          OR COALESCE(tipo_trabajo, '') LIKE '%WIN BOX%' 
          OR COALESCE(tipo_trabajo, '') LIKE '%WINBOX%' 
          OR COALESCE(tipo_trabajo, '') LIKE '%WIFI%' 
          OR COALESCE(tipo_trabajo, '') LIKE '%TELEFON%' 
          OR COALESCE(tipo_trabajo, '') LIKE '%MUDANZA%' 
          OR COALESCE(producto, '') LIKE '%POST%VENTA%' 
          OR COALESCE(motivo_finalizacion, '') LIKE '%POST%VENTA%'
          OR COALESCE(motivo_finalizacion, '') LIKE '%MESH%'
          OR (COALESCE(tipo_trabajo, '') LIKE '%ADICIONAL%' AND COALESCE(tipo_trabajo_asignado, '') NOT LIKE '%LOS ROJO%')
        ) AND estado != 'Anulada' AND estado NOT LIKE '%Regesti%' THEN 1 END) as av_asig,

        SUM(CASE WHEN NOT (
          COALESCE(tipo_trabajo, '') LIKE '%TRASLADO%' 
          OR COALESCE(tipo_trabajo, '') LIKE '%REUBICA%' 
          OR COALESCE(tipo_trabajo, '') LIKE '%MESH%' 
          OR COALESCE(tipo_trabajo, '') LIKE '%WIN BOX%' 
          OR COALESCE(tipo_trabajo, '') LIKE '%WINBOX%' 
          OR COALESCE(tipo_trabajo, '') LIKE '%WIFI%' 
          OR COALESCE(tipo_trabajo, '') LIKE '%TELEFON%' 
          OR COALESCE(tipo_trabajo, '') LIKE '%MUDANZA%' 
          OR COALESCE(producto, '') LIKE '%POST%VENTA%' 
          OR COALESCE(motivo_finalizacion, '') LIKE '%POST%VENTA%'
          OR COALESCE(motivo_finalizacion, '') LIKE '%MESH%'
          OR (COALESCE(tipo_trabajo, '') LIKE '%ADICIONAL%' AND COALESCE(tipo_trabajo_asignado, '') NOT LIKE '%LOS ROJO%')
        ) AND (estado LIKE '%Finaliz%' OR estado LIKE '%Liquid%' OR estado LIKE '%Termin%') THEN 1 ELSE 0 END) as av_fin

      FROM ordenes
      WHERE YEAR(fecha_visita) = 2026 AND MONTH(fecha_visita) = 4
        AND (cuadrilla IS NULL OR (TRIM(cuadrilla) NOT REGEXP '^[oO][0-9]+' AND TRIM(cuadrilla) NOT REGEXP '^[oO] ' AND TRIM(cuadrilla) NOT LIKE 'ORDENAMIENTO%'))
        AND (cliente IS NULL OR (cliente NOT LIKE '%NORMALIZACI%' AND cliente NOT LIKE '%CONJUNTA PEXT%'))
        AND (tipo_trabajo IS NULL OR tipo_trabajo NOT LIKE '%ORDENAMIENTO%')
        AND (motivo_finalizacion IS NULL OR motivo_finalizacion NOT LIKE '%CONJUNTA PEXT%')
    `);

    const r = statsPrelim[0];
    console.log("\n2. Comparativa Inicial Abril:");
    console.log(`  AVERÍAS:   Oficial WIN [${oficial.averias.asig} Asig, ${oficial.averias.fin} Fin, ${oficial.averias.ef}%] | BD [${r.av_asig} Asig, ${r.av_fin} Fin, ${((r.av_fin/r.av_asig)*100).toFixed(2)}%]`);
    console.log(`  POSTVENTA: Oficial WIN [${oficial.postventa.asig} Asig, ${oficial.postventa.fin} Fin, ${oficial.postventa.ef}%] | BD [${r.pv_asig} Asig, ${r.pv_fin} Fin, ${((r.pv_fin/r.pv_asig)*100).toFixed(2)}%]`);
    console.log(`  TOTALES:   Oficial WIN [${oficial.total.asig} Asig, ${oficial.total.fin} Fin] | BD [${r.av_asig + r.pv_asig} Asig, ${r.av_fin + r.pv_fin} Fin]`);
    console.log(`  Diferencia Total Asignadas: ${(r.av_asig + r.pv_asig) - oficial.total.asig}`);
    console.log(`  Diferencia Total Finalizadas: ${(r.av_fin + r.pv_fin) - oficial.total.fin}`);

    // 3. Revisar Conjuntas PEXT en Abril
    const [conjuntas] = await pool.query(`
      SELECT 
        id_orden,
        numero,
        codigo_seguimiento,
        cliente,
        tipo_trabajo,
        motivo_finalizacion,
        cuadrilla,
        fecha_visita,
        estado
      FROM ordenes
      WHERE YEAR(fecha_visita) = 2026 AND MONTH(fecha_visita) = 4
        AND motivo_finalizacion LIKE '%CONJUNTA PEXT%'
    `);
    console.log(`\n3. Conjuntas PEXT en Abril (${conjuntas.length}):`);
    console.table(conjuntas.map(c => ({
      id: c.id_orden,
      ot: c.numero,
      ticket: c.codigo_seguimiento,
      cliente: c.cliente?.slice(0, 25),
      motivo: c.motivo_finalizacion,
      fecha: String(c.fecha_visita).slice(0, 10)
    })));

    // 4. Revisar Tickets con múltiples visitas (Reiteradas / Reprogramadas en Abril)
    const [reiteradas] = await pool.query(`
      SELECT 
        codigo_seguimiento,
        cliente,
        COUNT(*) as total_visitas,
        GROUP_CONCAT(numero) as ots,
        GROUP_CONCAT(DATE(fecha_visita)) as fechas,
        GROUP_CONCAT(estado) as estados,
        GROUP_CONCAT(COALESCE(motivo_finalizacion, motivo_cancelacion)) as motivos
      FROM ordenes
      WHERE YEAR(fecha_visita) = 2026 AND MONTH(fecha_visita) = 4
        AND (cuadrilla IS NULL OR (TRIM(cuadrilla) NOT REGEXP '^[oO][0-9]+' AND TRIM(cuadrilla) NOT REGEXP '^[oO] ' AND TRIM(cuadrilla) NOT LIKE 'ORDENAMIENTO%'))
        AND estado != 'Anulada'
        AND estado NOT LIKE '%Regesti%'
      GROUP BY codigo_seguimiento
      HAVING total_visitas > 1
      LIMIT 10
    `);
    console.log(`\n4. Tickets con visitas múltiples en Abril (${reiteradas.length} casos mostrados):`);
    console.table(reiteradas.map(r => ({
      ticket: r.codigo_seguimiento,
      cliente: r.cliente?.slice(0, 25),
      visitas: r.total_visitas,
      ots: r.ots,
      fechas: r.fechas
    })));

    // 5. Órdenes con KIT WIFI PRO o ADICIONAL en Abril
    const [adicionales] = await pool.query(`
      SELECT 
        id_orden,
        numero,
        cliente,
        tipo_trabajo,
        tipo_trabajo_asignado,
        producto,
        motivo_finalizacion,
        cuadrilla,
        fecha_visita,
        estado
      FROM ordenes
      WHERE YEAR(fecha_visita) = 2026 AND MONTH(fecha_visita) = 4
        AND estado = 'Finalizada'
        AND (
          tipo_trabajo LIKE '%ADICIONAL%'
          OR motivo_finalizacion LIKE '%WIFI PRO%'
          OR motivo_finalizacion LIKE '%SPLITTER%'
        )
    `);
    console.log(`\n5. Órdenes con ADICIONAL / WIFI PRO / SPLITTER en Abril (${adicionales.length}):`);
    console.table(adicionales.map(a => ({
      id: a.id_orden,
      ot: a.numero,
      cliente: a.cliente?.slice(0, 25),
      tipo: a.tipo_trabajo,
      tipo_asig: a.tipo_trabajo_asignado,
      motivo: a.motivo_finalizacion,
      fecha: String(a.fecha_visita).slice(0, 10)
    })));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

inspectAbril();
