const pool = require('../db');

async function findAugust2Finalizadas() {
  try {
    console.log("==========================================================================");
    console.log("   🔬 INVESTIGACIÓN FORENSE: LAS 2 FINALIZADAS DE AGOSTO EN POSTVENTA");
    console.log("==========================================================================\n");

    // 1. Ver las 109 que ya están en Postventa en Agosto
    const [yaEnPv] = await pool.query(`
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
        AND (cuadrilla IS NULL OR (TRIM(cuadrilla) NOT REGEXP '^[oO][0-9]+' AND TRIM(cuadrilla) NOT REGEXP '^[oO] ' AND TRIM(cuadrilla) NOT LIKE 'ORDENAMIENTO%'))
        AND (cliente IS NULL OR (cliente NOT LIKE '%NORMALIZACI%' AND cliente NOT LIKE '%CONJUNTA PEXT%'))
        AND (tipo_trabajo IS NULL OR tipo_trabajo NOT LIKE '%ORDENAMIENTO%')
        AND (motivo_finalizacion IS NULL OR motivo_finalizacion NOT LIKE '%CONJUNTA PEXT%')
        AND estado != 'Anulada' AND estado NOT LIKE '%Regesti%'
        AND (
          COALESCE(producto, '') LIKE '%POST%VENTA%'
          OR COALESCE(tipo_trabajo, '') LIKE '%TRASLADO%'
          OR COALESCE(tipo_trabajo, '') LIKE '%REUBICA%'
          OR COALESCE(tipo_trabajo, '') LIKE '%MUDANZA%'
          OR (
            COALESCE(motivo_finalizacion, '') LIKE '%POST VENTA%' 
            AND COALESCE(cuadrilla, '') LIKE '%TRASLADO%'
            AND COALESCE(tipo_trabajo_asignado, '') NOT LIKE '%LOS ROJO%'
          )
        )
    `);

    const pvFin = yaEnPv.filter(o => o.estado.includes('Finaliz') || o.estado.includes('Liquid') || o.estado.includes('Termin'));
    const pvNoFin = yaEnPv.filter(o => !pvFin.includes(o));

    console.log(`En Postventa Agosto: Total Asignadas = ${yaEnPv.length}, Finalizadas = ${pvFin.length}, No Finalizadas = ${pvNoFin.length}`);
    console.log("\nÓrdenes NO finalizadas en Postventa Agosto (Canceladas, Agendadas, etc.):");
    console.table(pvNoFin.map(o => ({
      id: o.id_orden,
      ot: o.numero,
      cliente: o.cliente?.slice(0, 20),
      tipo: o.tipo_trabajo,
      motivo: o.motivo_finalizacion?.slice(0, 25),
      estado: o.estado
    })));

    // 2. Revisemos las órdenes en Averías que están finalizadas y que podrían ser de Postventa en WIN
    const [enAverias] = await pool.query(`
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
        AND (cuadrilla IS NULL OR (TRIM(cuadrilla) NOT REGEXP '^[oO][0-9]+' AND TRIM(cuadrilla) NOT REGEXP '^[oO] ' AND TRIM(cuadrilla) NOT LIKE 'ORDENAMIENTO%'))
        AND (cliente IS NULL OR (cliente NOT LIKE '%NORMALIZACI%' AND cliente NOT LIKE '%CONJUNTA PEXT%'))
        AND (tipo_trabajo IS NULL OR tipo_trabajo NOT LIKE '%ORDENAMIENTO%')
        AND (motivo_finalizacion IS NULL OR motivo_finalizacion NOT LIKE '%CONJUNTA PEXT%')
        AND estado != 'Anulada' AND estado NOT LIKE '%Regesti%'
        AND (estado LIKE '%Finaliz%' OR estado LIKE '%Liquid%' OR estado LIKE '%Termin%')
        AND NOT (
          COALESCE(producto, '') LIKE '%POST%VENTA%'
          OR COALESCE(tipo_trabajo, '') LIKE '%TRASLADO%'
          OR COALESCE(tipo_trabajo, '') LIKE '%REUBICA%'
          OR COALESCE(tipo_trabajo, '') LIKE '%MUDANZA%'
          OR (
            COALESCE(motivo_finalizacion, '') LIKE '%POST VENTA%' 
            AND COALESCE(cuadrilla, '') LIKE '%TRASLADO%'
            AND COALESCE(tipo_trabajo_asignado, '') NOT LIKE '%LOS ROJO%'
          )
        )
        AND (
          motivo_finalizacion LIKE '%POSTVENTA%'
          OR motivo_finalizacion LIKE '%CABLEADO MESH%'
          OR motivo_finalizacion LIKE '%ENTREGA%'
          OR motivo_finalizacion LIKE '%APARATO%'
          OR motivo_finalizacion LIKE '%WIFI PRO%'
          OR cuadrilla LIKE '%TRASLADO%'
          OR tipo_trabajo LIKE '%ADICIONAL%'
          OR tipo_trabajo_asignado LIKE '%APARATO%'
        )
    `);

    console.log(`\nCandidatas finalizadas en Averías (${enAverias.length}):`);
    console.table(enAverias.map(a => ({
      id: a.id_orden,
      ot: a.numero,
      cuad: a.cuadrilla?.slice(0, 18),
      tipo: a.tipo_trabajo,
      asig: a.tipo_trabajo_asignado?.slice(0, 20),
      motivo: a.motivo_finalizacion?.slice(0, 28),
      estado: a.estado
    })));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

findAugust2Finalizadas();
