const pool = require('../db');

async function findTheExact1Asig3Fin() {
  try {
    console.log("=== BUSCANDO EXACTAMENTE 1 ASIG Y 3 FIN EN AGOSTO ===\n");

    // Órdenes en Agosto que no son TRASLADO/REUBICA/MUDANZA ni producto POST VENTA pero que son MESH / WIFI PRO / ADICIONAL
    const [rows] = await pool.query(`
      SELECT 
        id_orden,
        numero,
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
        AND NOT (
          COALESCE(producto, '') LIKE '%POST%VENTA%'
          OR COALESCE(tipo_trabajo, '') LIKE '%TRASLADO%'
          OR COALESCE(tipo_trabajo, '') LIKE '%REUBICA%'
          OR COALESCE(tipo_trabajo, '') LIKE '%MUDANZA%'
        )
        AND (
          tipo_trabajo LIKE '%MESH%'
          OR tipo_trabajo LIKE '%WIFI%'
          OR tipo_trabajo LIKE '%ADICIONAL%'
          OR motivo_finalizacion LIKE '%MESH%'
          OR motivo_finalizacion LIKE '%WIFI PRO%'
          OR motivo_finalizacion LIKE '%POSTVENTA%'
        )
    `);

    console.log(`Órdenes encontradas (${rows.length}):`);
    console.table(rows.map(r => ({
      id: r.id_orden,
      ot: r.numero,
      cuadrilla: r.cuadrilla?.slice(0, 15),
      tipo: r.tipo_trabajo,
      motivo: r.motivo_finalizacion?.slice(0, 30),
      estado: r.estado
    })));

    // Cuántas finalizadas hay aquí:
    const fin = rows.filter(r => r.estado.includes('Finaliz'));
    console.log(`Finalizadas en este grupo: ${fin.length}`);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

findTheExact1Asig3Fin();
