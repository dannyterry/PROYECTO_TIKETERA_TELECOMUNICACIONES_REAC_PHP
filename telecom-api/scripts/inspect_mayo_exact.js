const pool = require('../db');

async function showMayoTable() {
  try {
    const [rows] = await pool.query(`
      SELECT 
        id_orden,
        numero,
        tipo_trabajo,
        producto,
        motivo_finalizacion,
        cuadrilla,
        fecha_visita,
        estado
      FROM ordenes
      WHERE YEAR(fecha_visita) = 2026 AND MONTH(fecha_visita) = 5
        AND (cuadrilla IS NULL OR (TRIM(cuadrilla) NOT REGEXP '^[oO][0-9]+' AND TRIM(cuadrilla) NOT REGEXP '^[oO] ' AND TRIM(cuadrilla) NOT LIKE 'ORDENAMIENTO%'))
        AND (cliente IS NULL OR (cliente NOT LIKE '%NORMALIZACI%' AND cliente NOT LIKE '%CONJUNTA PEXT%'))
        AND (tipo_trabajo IS NULL OR tipo_trabajo NOT LIKE '%ORDENAMIENTO%')
        AND (motivo_finalizacion IS NULL OR motivo_finalizacion NOT LIKE '%CONJUNTA PEXT%')
        AND estado != 'Anulada'
        AND estado NOT LIKE '%Regesti%'
    `);

    let avFin = 0, avAsig = 0;
    let pvFin = 0, pvAsig = 0;

    rows.forEach(r => {
      const isFin = r.estado === 'Finalizada';
      const cu = (r.cuadrilla || '').toUpperCase();
      const tt = (r.tipo_trabajo || '').toUpperCase();
      const mf = (r.motivo_finalizacion || '').toUpperCase();

      // Postventa: cuadrillas de TRASLADO o tipos directos de traslado / reubicación
      const esPostventa = cu.includes('TRASLADO') || tt.includes('TRASLADO') || tt.includes('REUBICA');

      if (esPostventa) {
        pvAsig++;
        if (isFin) pvFin++;
      } else {
        avAsig++;
        if (isFin) avFin++;
      }
    });

    const efAv = ((avFin / avAsig) * 100).toFixed(2);
    const efPv = ((pvFin / pvAsig) * 100).toFixed(2);

    console.log("=== TABLA COMPARATIVA MAYO 2026 ===");
    console.log("---------------------------------------------------------------------------------------------------------");
    console.log(`AVERÍAS:   OFIC. ASIG: 956 | BD ASIG: ${avAsig} | OFIC. FIN: 788 | BD FIN: ${avFin} | OFIC. %: 82.43% | BD %: ${efAv}%`);
    console.log(`POSTVENTA: OFIC. ASIG: 191 | BD ASIG: ${pvAsig} | OFIC. FIN: 160 | BD FIN: ${pvFin} | OFIC. %: 83.77% | BD %: ${efPv}%`);
    console.log("---------------------------------------------------------------------------------------------------------");
    console.log(`TOTAL:     OFIC. ASIG: 1147 | BD ASIG: ${avAsig + pvAsig} | OFIC. FIN: 948 | BD FIN: ${avFin + pvFin}`);
    console.log("---------------------------------------------------------------------------------------------------------");

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

showMayoTable();
