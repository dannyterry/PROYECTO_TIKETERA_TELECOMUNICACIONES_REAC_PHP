const pool = require('../db');

async function testAllMonths() {
  try {
    const oficiales = {
      1: { av_asig: 911, av_fin: 687, av_ef: 75.41, pv_asig: 292, pv_fin: 207, pv_ef: 70.89 },
      2: { av_asig: 1050, av_fin: 701, av_ef: 66.76, pv_asig: 232, pv_fin: 162, pv_ef: 69.83 },
      3: { av_asig: 1026, av_fin: 747, av_ef: 72.81, pv_asig: 301, pv_fin: 222, pv_ef: 73.75 },
      4: { av_asig: 979, av_fin: 768, av_ef: 78.45, pv_asig: 176, pv_fin: 126, pv_ef: 71.59 },
      5: { av_asig: 956, av_fin: 788, av_ef: 82.43, pv_asig: 191, pv_fin: 160, pv_ef: 83.77 },
      6: { av_asig: 964, av_fin: 736, av_ef: 76.35, pv_asig: 183, pv_fin: 143, pv_ef: 78.14 },
      7: { av_asig: 981, av_fin: 741, av_ef: 75.54, pv_asig: 173, pv_fin: 121, pv_ef: 69.94 },
      8: { av_asig: 1129, av_fin: 915, av_ef: 81.05, pv_asig: 137, pv_fin: 111, pv_ef: 81.02 },
    };

    console.log("=== EVALUACIÓN REFINADA MES A MES (ENERO - AGOSTO 2026) ===\n");

    for (let m = 1; m <= 8; m++) {
      const [rows] = await pool.query(`
        SELECT 
          -- POSTVENTA (Traslados, Reubicaciones, Mesh, Winbox, Wifi, etc.)
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
            OR COALESCE(tipo_trabajo, '') LIKE '%ADICIONAL%'
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
            OR COALESCE(tipo_trabajo, '') LIKE '%ADICIONAL%'
          ) AND (estado LIKE '%Finaliz%' OR estado LIKE '%Liquid%' OR estado LIKE '%Termin%') THEN 1 ELSE 0 END) as pv_fin,

          -- AVERIAS (Excluyendo Postventa, Conjuntas PEXT, Ordenamiento y Regestiones)
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
            OR COALESCE(tipo_trabajo, '') LIKE '%ADICIONAL%'
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
            OR COALESCE(tipo_trabajo, '') LIKE '%ADICIONAL%'
          ) AND (estado LIKE '%Finaliz%' OR estado LIKE '%Liquid%' OR estado LIKE '%Termin%') THEN 1 ELSE 0 END) as av_fin

        FROM ordenes
        WHERE YEAR(fecha_visita) = 2026 AND MONTH(fecha_visita) = ?
          AND (cuadrilla IS NULL OR (TRIM(cuadrilla) NOT REGEXP '^[oO][0-9]+' AND TRIM(cuadrilla) NOT REGEXP '^[oO] ' AND TRIM(cuadrilla) NOT LIKE 'ORDENAMIENTO%'))
          AND (cliente IS NULL OR (cliente NOT LIKE '%NORMALIZACI%' AND cliente NOT LIKE '%CONJUNTA PEXT%'))
          AND (tipo_trabajo IS NULL OR tipo_trabajo NOT LIKE '%ORDENAMIENTO%')
          AND (motivo_finalizacion IS NULL OR (motivo_finalizacion NOT LIKE '%CONJUNTA PEXT%' AND motivo_finalizacion NOT LIKE '%CONJUNTA PEXT%'))
      `, [m]);

      const r = rows[0];
      const o = oficiales[m];

      const efAv = ((r.av_fin / r.av_asig) * 100).toFixed(2);
      const efPv = ((r.pv_fin / r.pv_asig) * 100).toFixed(2);

      console.log(`--- MES ${m} ---`);
      console.log(`  AVERÍAS:   Oficial [${o.av_asig} Asig, ${o.av_fin} Fin, ${o.av_ef}%] | BD [${r.av_asig} Asig, ${r.av_fin} Fin, ${efAv}%] | Dif Asig: ${r.av_asig - o.av_asig}, Dif Fin: ${r.av_fin - o.av_fin}`);
      console.log(`  POSTVENTA: Oficial [${o.pv_asig} Asig, ${o.pv_fin} Fin, ${o.pv_ef}%] | BD [${r.pv_asig} Asig, ${r.pv_fin} Fin, ${efPv}%] | Dif Asig: ${r.pv_asig - o.pv_asig}, Dif Fin: ${r.pv_fin - o.pv_fin}`);
    }

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

testAllMonths();
