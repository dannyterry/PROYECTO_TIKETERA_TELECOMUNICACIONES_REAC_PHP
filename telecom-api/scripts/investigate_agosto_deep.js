const pool = require('../db');

async function investigateAgostoDeep() {
  try {
    console.log("==========================================================================");
    console.log("   🕵️ INVESTIGACIÓN DETECTIVE: POSTVENTA AGOSTO 2026 (137 vs 131)");
    console.log("==========================================================================\n");

    // 1. Ver todas las órdenes de Agosto que son claramente Postventa
    const [pvActual] = await pool.query(`
      SELECT 
        id_orden,
        numero,
        codigo_seguimiento,
        cliente,
        fecha_visita,
        DATE(fecha_visita) as fecha,
        cuadrilla,
        tipo_trabajo,
        tipo_trabajo_asignado,
        motivo_finalizacion,
        producto,
        estado
      FROM ordenes
      WHERE YEAR(fecha_visita) = 2026 AND MONTH(fecha_visita) = 8
        AND (cuadrilla IS NULL OR (TRIM(cuadrilla) NOT REGEXP '^[oO][0-9]+' AND TRIM(cuadrilla) NOT REGEXP '^[oO] ' AND TRIM(cuadrilla) NOT LIKE 'ORDENAMIENTO%'))
        AND (cliente IS NULL OR (cliente NOT LIKE '%NORMALIZACI%' AND cliente NOT LIKE '%CONJUNTA PEXT%'))
        AND (tipo_trabajo IS NULL OR tipo_trabajo NOT LIKE '%ORDENAMIENTO%')
        AND (motivo_finalizacion IS NULL OR motivo_finalizacion NOT LIKE '%CONJUNTA PEXT%')
        AND estado != 'Anulada' AND estado NOT LIKE '%Regesti%'
        AND (
          COALESCE(producto, '') LIKE '%POST%VENTA%'
          OR COALESCE(tipo_orden, '') LIKE '%POST%VENTA%'
        )
      ORDER BY fecha_visita ASC
    `);

    console.log(`1. Total con producto = 'POST VENTA' estricto: ${pvActual.length} órdenes`);
    const finEstricto = pvActual.filter(o => o.estado.includes('Finaliz') || o.estado.includes('Liquid') || o.estado.includes('Termin')).length;
    console.log(`   Finalizadas estrictas: ${finEstricto} (Efectividad: ${((finEstricto/pvActual.length)*100).toFixed(2)}%)\n`);

    // 2. Revisar cuadrillas de Traslado / Postventa en Agosto (¿Qué hicieron que NO tenga producto = POST VENTA?)
    const [cuadrillasPV] = await pool.query(`
      SELECT 
        id_orden,
        numero,
        codigo_seguimiento,
        cliente,
        fecha_visita,
        cuadrilla,
        tipo_trabajo,
        tipo_trabajo_asignado,
        motivo_finalizacion,
        producto,
        estado
      FROM ordenes
      WHERE YEAR(fecha_visita) = 2026 AND MONTH(fecha_visita) = 8
        AND (cuadrilla LIKE '%TRASLADO%' OR cuadrilla LIKE '%POST%VENTA%')
        AND (producto IS NULL OR producto NOT LIKE '%POST%VENTA%')
        AND estado != 'Anulada' AND estado NOT LIKE '%Regesti%'
      ORDER BY fecha_visita ASC
    `);

    console.log(`2. Órdenes ejecutadas por cuadrillas de TRASLADO pero etiquetadas con otro producto (${cuadrillasPV.length}):`);
    console.table(cuadrillasPV.map(c => ({
      id: c.id_orden,
      ot: c.numero,
      cuadrilla: c.cuadrilla?.slice(0, 18),
      tipo: c.tipo_trabajo,
      asig: c.tipo_trabajo_asignado?.slice(0, 20),
      motivo: c.motivo_finalizacion?.slice(0, 25),
      producto: c.producto,
      estado: c.estado
    })));

    // 3. Revisar órdenes con tipo de trabajo de Postventa (TRASLADO, REUBICACIÓN, MUDANZA, MESH, WIFI PRO, ADICIONAL)
    const [tipoTrabajoPV] = await pool.query(`
      SELECT 
        id_orden,
        numero,
        codigo_seguimiento,
        cliente,
        fecha_visita,
        cuadrilla,
        tipo_trabajo,
        tipo_trabajo_asignado,
        motivo_finalizacion,
        producto,
        estado
      FROM ordenes
      WHERE YEAR(fecha_visita) = 2026 AND MONTH(fecha_visita) = 8
        AND (
          tipo_trabajo LIKE '%TRASLADO%'
          OR tipo_trabajo LIKE '%REUBICA%'
          OR tipo_trabajo LIKE '%MUDANZA%'
          OR tipo_trabajo LIKE '%MESH%'
          OR tipo_trabajo LIKE '%ADICIONAL%'
          OR motivo_finalizacion LIKE '%POSTVENTA%'
          OR motivo_finalizacion LIKE '%CABLEADO MESH%'
          OR motivo_finalizacion LIKE '%WIFI PRO%'
          OR tipo_trabajo_asignado LIKE '%APARATO%'
        )
        AND (producto IS NULL OR producto NOT LIKE '%POST%VENTA%')
        AND estado != 'Anulada' AND estado NOT LIKE '%Regesti%'
      ORDER BY fecha_visita ASC
    `);

    console.log(`\n3. Órdenes con tipo/motivo de Postventa pero producto != POST VENTA (${tipoTrabajoPV.length}):`);
    console.table(tipoTrabajoPV.map(c => ({
      id: c.id_orden,
      ot: c.numero,
      cuadrilla: c.cuadrilla?.slice(0, 18),
      tipo: c.tipo_trabajo,
      asig: c.tipo_trabajo_asignado?.slice(0, 20),
      motivo: c.motivo_finalizacion?.slice(0, 25),
      producto: c.producto,
      estado: c.estado
    })));

    // 4. Fechas límites (31 Julio - 1 Agosto y 31 Agosto - 1 Septiembre)
    const [fronteras] = await pool.query(`
      SELECT 
        id_orden,
        numero,
        cliente,
        fecha_visita,
        fecha_solicitud,
        fecha_estado,
        cuadrilla,
        tipo_trabajo,
        producto,
        estado
      FROM ordenes
      WHERE (
        (fecha_visita >= '2026-07-31' AND fecha_visita <= '2026-08-01 23:59:59')
        OR (fecha_visita >= '2026-08-31' AND fecha_visita <= '2026-09-01 23:59:59')
      )
      AND (
        producto LIKE '%POST%VENTA%'
        OR tipo_trabajo LIKE '%TRASLADO%'
        OR tipo_trabajo LIKE '%REUBICA%'
      )
      ORDER BY fecha_visita ASC
    `);

    console.log(`\n4. Órdenes de Postventa en días frontera de Agosto (${fronteras.length}):`);
    console.table(fronteras.map(f => ({
      ot: f.numero,
      visita: String(f.fecha_visita).slice(0, 16),
      solicitud: String(f.fecha_solicitud || '').slice(0, 16),
      estado_fecha: String(f.fecha_estado || '').slice(0, 16),
      tipo: f.tipo_trabajo,
      estado: f.estado
    })));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

investigateAgostoDeep();
