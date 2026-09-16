const pool = require('../db');

async function findFebreroSingulars() {
  try {
    console.log("=== BUSCANDO LAS ÓRDENES SINGULARES DE FEBRERO ===");

    // 1. Órdenes con motivos de finalización no habituales en Febrero
    const [rows] = await pool.query(`
      SELECT 
        id_orden,
        numero,
        cliente,
        tipo_trabajo,
        producto,
        motivo_finalizacion,
        cuadrilla,
        fecha_visita,
        estado
      FROM ordenes
      WHERE YEAR(fecha_visita) = 2026 AND MONTH(fecha_visita) = 2
        AND estado = 'Finalizada'
        AND (cuadrilla IS NULL OR (TRIM(cuadrilla) NOT REGEXP '^[oO][0-9]+' AND TRIM(cuadrilla) NOT REGEXP '^[oO] ' AND TRIM(cuadrilla) NOT LIKE 'ORDENAMIENTO%'))
        AND (cliente IS NULL OR (cliente NOT LIKE '%NORMALIZACI%' AND cliente NOT LIKE '%CONJUNTA PEXT%'))
        AND (
          motivo_finalizacion LIKE '%CONJUNTA%'
          OR motivo_finalizacion LIKE '%SPLITTER%'
          OR motivo_finalizacion LIKE '%ADICIONAL%'
          OR tipo_trabajo = 'ADICIONAL'
          OR (tipo_trabajo = 'PEX' AND motivo_finalizacion LIKE '%CONJUNTA%')
        )
    `);

    console.table(rows);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

findFebreroSingulars();
