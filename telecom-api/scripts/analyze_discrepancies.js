const pool = require('../db');

async function analyzeRegestion() {
  try {
    const oficiales = {
      1: { av_asig: 911, av_fin: 687, pv_asig: 292, pv_fin: 207 },
      2: { av_asig: 1050, av_fin: 701, pv_asig: 232, pv_fin: 162 },
      3: { av_asig: 1026, av_fin: 747, pv_asig: 301, pv_fin: 222 },
      4: { av_asig: 979, av_fin: 768, pv_asig: 176, pv_fin: 126 },
      5: { av_asig: 956, av_fin: 788, pv_asig: 191, pv_fin: 160 },
      6: { av_asig: 964, av_fin: 736, pv_asig: 183, pv_fin: 143 },
      7: { av_asig: 981, av_fin: 741, pv_asig: 173, pv_fin: 121 },
      8: { av_asig: 1129, av_fin: 915, pv_asig: 137, pv_fin: 111 },
    };

    console.log("==================================================================================");
    console.log("MES | OFIC TOTAL | BD TOTAL (con Regestión) | DIFERENCIA | REGESTIONES EN BD");
    console.log("==================================================================================");

    for (let m = 1; m <= 8; m++) {
      const oficTot = oficiales[m].av_asig + oficiales[m].pv_asig;
      
      const [rows] = await pool.query(`
        SELECT 
          COUNT(CASE WHEN estado != 'Anulada' THEN 1 END) as total_bd_con_regestion,
          COUNT(CASE WHEN estado != 'Anulada' AND estado NOT LIKE '%Regesti%' THEN 1 END) as total_bd_sin_regestion,
          COUNT(CASE WHEN estado LIKE '%Regesti%' THEN 1 END) as total_regestion,
          SUM(CASE WHEN estado LIKE '%Finaliz%' OR estado LIKE '%Liquid%' OR estado LIKE '%Termin%' THEN 1 END) as finalizadas,
          SUM(CASE WHEN estado = 'Cancelada' THEN 1 END) as canceladas,
          SUM(CASE WHEN estado = 'Anulada' THEN 1 END) as anuladas
        FROM ordenes
        WHERE YEAR(fecha_visita) = 2026 AND MONTH(fecha_visita) = ?
          AND (cuadrilla IS NULL OR (TRIM(cuadrilla) NOT REGEXP '^[oO][0-9]+' AND TRIM(cuadrilla) NOT REGEXP '^[oO] ' AND TRIM(cuadrilla) NOT LIKE 'ORDENAMIENTO%'))
          AND (cliente IS NULL OR (cliente NOT LIKE '%NORMALIZACI%' AND cliente NOT LIKE '%CONJUNTA PEXT%'))
          AND (tipo_trabajo IS NULL OR tipo_trabajo NOT LIKE '%ORDENAMIENTO%')
      `, [m]);

      const r = rows[0];
      const diff = r.total_bd_con_regestion - oficTot;
      const diffSinReg = r.total_bd_sin_regestion - oficTot;

      console.log(
        `Mes ${m} | Ofic: ${oficTot} | BD (con Reg): ${r.total_bd_con_regestion} (Dif: +${diff}) | Regestiones: ${r.total_regestion} | BD (sin Reg): ${r.total_bd_sin_regestion} (Dif: ${diffSinReg >= 0 ? '+' : ''}${diffSinReg})`
      );
    }

    console.log("\n==================================================================================");
    console.log("DESGLOSE AVERÍAS Y POSTVENTA SIN REGESTIONES vs OFICIAL:");
    console.log("==================================================================================");

    for (let m = 1; m <= 8; m++) {
      const [rows] = await pool.query(`
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
          ) AND estado != 'Anulada' AND estado NOT LIKE '%Regesti%' THEN 1 END) as pv_asig_sin_reg,

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
          ) AND estado != 'Anulada' AND estado NOT LIKE '%Regesti%' THEN 1 END) as av_asig_sin_reg,

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
          ) AND (estado LIKE '%Finaliz%' OR estado LIKE '%Liquid%' OR estado LIKE '%Termin%') THEN 1 ELSE 0 END) as av_fin

        FROM ordenes
        WHERE YEAR(fecha_visita) = 2026 AND MONTH(fecha_visita) = ?
          AND (cuadrilla IS NULL OR (TRIM(cuadrilla) NOT REGEXP '^[oO][0-9]+' AND TRIM(cuadrilla) NOT REGEXP '^[oO] ' AND TRIM(cuadrilla) NOT LIKE 'ORDENAMIENTO%'))
          AND (cliente IS NULL OR (cliente NOT LIKE '%NORMALIZACI%' AND cliente NOT LIKE '%CONJUNTA PEXT%'))
          AND (tipo_trabajo IS NULL OR tipo_trabajo NOT LIKE '%ORDENAMIENTO%')
      `, [m]);

      const r = rows[0];
      const o = oficiales[m];
      console.log(`\n--- MES ${m} ---`);
      console.log(`AVERÍAS:   Ofic Asig: ${o.av_asig} | BD Asig (sin reg): ${r.av_asig_sin_reg} (Dif: ${r.av_asig_sin_reg - o.av_asig}) | Ofic Fin: ${o.av_fin} | BD Fin: ${r.av_fin}`);
      console.log(`POSTVENTA: Ofic Asig: ${o.pv_asig} | BD Asig (sin reg): ${r.pv_asig_sin_reg} (Dif: ${r.pv_asig_sin_reg - o.pv_asig}) | Ofic Fin: ${o.pv_fin} | BD Fin: ${r.pv_fin}`);
      const efAv = ((r.av_fin / r.av_asig_sin_reg) * 100).toFixed(2);
      const efPv = ((r.pv_fin / r.pv_asig_sin_reg) * 100).toFixed(2);
      console.log(`EFECTIVIDAD AVERIAS:   Ofic: ${((o.av_fin/o.av_asig)*100).toFixed(2)}% vs BD: ${efAv}%`);
      console.log(`EFECTIVIDAD POSTVENTA: Ofic: ${((o.pv_fin/o.pv_asig)*100).toFixed(2)}% vs BD: ${efPv}%`);
    }

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

analyzeRegestion();
