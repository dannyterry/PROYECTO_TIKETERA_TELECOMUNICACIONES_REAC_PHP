const pool = require('../db');

async function inspectJulyAugust() {
  try {
    console.log("=== INSPECCIÓN JULIO Y AGOSTO ===\n");

    const [julyRows] = await pool.query(`
      SELECT id_orden, numero, cliente, fecha_visita, cuadrilla, tipo_trabajo, tipo_trabajo_asignado, motivo_finalizacion, producto, estado
      FROM ordenes
      WHERE YEAR(fecha_visita) = 2026 AND MONTH(fecha_visita) = 7
        AND (cuadrilla IS NULL OR (TRIM(cuadrilla) NOT REGEXP '^[oO][0-9]+' AND TRIM(cuadrilla) NOT REGEXP '^[oO] ' AND TRIM(cuadrilla) NOT LIKE 'ORDENAMIENTO%'))
        AND (cliente IS NULL OR (cliente NOT LIKE '%NORMALIZACI%' AND cliente NOT LIKE '%CONJUNTA PEXT%'))
        AND (tipo_trabajo IS NULL OR tipo_trabajo NOT LIKE '%ORDENAMIENTO%')
        AND (motivo_finalizacion IS NULL OR motivo_finalizacion NOT LIKE '%CONJUNTA PEXT%')
        AND estado != 'Anulada' AND estado NOT LIKE '%Regesti%'
        AND (
          (COALESCE(motivo_finalizacion, '') LIKE '%POST VENTA%' AND COALESCE(cuadrilla, '') LIKE '%TRASLADO%')
        )
        AND NOT (
          COALESCE(producto, '') LIKE '%POST%VENTA%'
          OR COALESCE(tipo_trabajo, '') LIKE '%TRASLADO%'
          OR COALESCE(tipo_trabajo, '') LIKE '%REUBICA%'
          OR COALESCE(tipo_trabajo, '') LIKE '%MUDANZA%'
        )
    `);

    console.log(`Orden en Julio capturada por la regla:`, julyRows);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

inspectJulyAugust();
