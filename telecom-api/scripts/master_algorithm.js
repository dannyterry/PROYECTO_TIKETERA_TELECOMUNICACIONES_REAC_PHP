const pool = require('../db');

/**
 * 🎯 ALGORITMO MAESTRO DE EFECTIVIDAD WIN vs BD
 */
async function runMasterAlgorithm() {
  try {
    const cierresOficialesWin2026 = {
      1: { av_asig: 911, av_fin: 687, av_ef: 75.41, pv_asig: 292, pv_fin: 207, pv_ef: 70.89 },
      2: { av_asig: 1050, av_fin: 701, av_ef: 66.76, pv_asig: 232, pv_fin: 162, pv_ef: 69.83 },
      3: { av_asig: 1026, av_fin: 747, av_ef: 72.81, pv_asig: 301, pv_fin: 222, pv_ef: 73.75 },
      4: { av_asig: 979, av_fin: 768, av_ef: 78.45, pv_asig: 176, pv_fin: 126, pv_ef: 71.59 },
      5: { av_asig: 956, av_fin: 788, av_ef: 82.43, pv_asig: 191, pv_fin: 160, pv_ef: 83.77 },
      6: { av_asig: 964, av_fin: 736, av_ef: 76.35, pv_asig: 183, pv_fin: 143, pv_ef: 78.14 },
      7: { av_asig: 981, av_fin: 741, av_ef: 75.54, pv_asig: 173, pv_fin: 121, pv_ef: 69.94 },
      8: { av_asig: 1129, av_fin: 915, av_ef: 81.05, pv_asig: 137, pv_fin: 111, pv_ef: 81.02 },
    };

    const mesesNombres = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto"
    ];

    let totalOficAvAsig = 0, totalOficAvFin = 0;
    let totalBdAvAsig = 0, totalBdAvFin = 0;
    let totalOficPvAsig = 0, totalOficPvFin = 0;
    let totalBdPvAsig = 0, totalBdPvFin = 0;

    console.log("==========================================================================================");
    console.log("        🚀 EJECUCIÓN DEL ALGORITMO MAESTRO DE AUDITORÍA Y EFECTIVIDAD (2026)");
    console.log("==========================================================================================\n");

    for (let m = 1; m <= 8; m++) {
      const ofic = cierresOficialesWin2026[m];

      const [rows] = await pool.query(`
        SELECT 
          -- POSTVENTA (Traslados, Reubicaciones, Mudanzas, Mesh, Wifi Pro, etc.)
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
        WHERE YEAR(fecha_visita) = 2026 AND MONTH(fecha_visita) = ?
          -- REGLA 1: Excluir cuadrillas de ordenamiento
          AND (cuadrilla IS NULL OR (TRIM(cuadrilla) NOT REGEXP '^[oO][0-9]+' AND TRIM(cuadrilla) NOT REGEXP '^[oO] ' AND TRIM(cuadrilla) NOT LIKE 'ORDENAMIENTO%'))
          -- REGLA 2: Excluir normalizaciones internas y clientes PEXT
          AND (cliente IS NULL OR (cliente NOT LIKE '%NORMALIZACI%' AND cliente NOT LIKE '%CONJUNTA PEXT%'))
          -- REGLA 3: Excluir tipos de trabajo de ordenamiento
          AND (tipo_trabajo IS NULL OR tipo_trabajo NOT LIKE '%ORDENAMIENTO%')
          -- REGLA 4: Excluir conjuntas de planta externa
          AND (motivo_finalizacion IS NULL OR motivo_finalizacion NOT LIKE '%CONJUNTA PEXT%')
      `, [m]);

      const r = rows[0];

      const asigAv = Number(r.av_asig) || 0;
      const finAv = Number(r.av_fin) || 0;
      const asigPv = Number(r.pv_asig) || 0;
      const finPv = Number(r.pv_fin) || 0;

      const efAvOfic = ofic.av_ef;
      const efAvBd = parseFloat(((finAv / asigAv) * 100).toFixed(2));
      const efPvOfic = ofic.pv_ef;
      const efPvBd = parseFloat(((finPv / asigPv) * 100).toFixed(2));

      totalOficAvAsig += ofic.av_asig;
      totalOficAvFin += ofic.av_fin;
      totalBdAvAsig += asigAv;
      totalBdAvFin += finAv;

      totalOficPvAsig += ofic.pv_asig;
      totalOficPvFin += ofic.pv_fin;
      totalBdPvAsig += asigPv;
      totalBdPvFin += finPv;

      console.log(`📌 MES: ${mesesNombres[m - 1].toUpperCase()}`);
      console.log(`   Averías:   WIN Oficial [${ofic.av_asig} Asig, ${ofic.av_fin} Fin, ${efAvOfic}%] | BD [${asigAv} Asig, ${finAv} Fin, ${efAvBd}%] (Dif: ${(efAvBd - efAvOfic).toFixed(2)}%)`);
      console.log(`   Postventa: WIN Oficial [${ofic.pv_asig} Asig, ${ofic.pv_fin} Fin, ${efPvOfic}%] | BD [${asigPv} Asig, ${finPv} Fin, ${efPvBd}%] (Dif: ${(efPvBd - efPvOfic).toFixed(2)}%)`);
      console.log("------------------------------------------------------------------------------------------");
    }

    const totalEfOficAv = ((totalOficAvFin / totalOficAvAsig) * 100).toFixed(2);
    const totalEfBdAv = ((totalBdAvFin / totalBdAvAsig) * 100).toFixed(2);
    const totalEfOficPv = ((totalOficPvFin / totalOficPvAsig) * 100).toFixed(2);
    const totalEfBdPv = ((totalBdPvFin / totalBdPvAsig) * 100).toFixed(2);

    console.log("\n==========================================================================================");
    console.log("🏆 TOTAL ACUMULADO ANUAL (ENERO - AGOSTO 2026):");
    console.log("==========================================================================================");
    console.log(`⚡ AVERÍAS ACUMULADO:   WIN Oficial [${totalOficAvAsig} Asig, ${totalOficAvFin} Fin, ${totalEfOficAv}%]`);
    console.log(`                        Base Datos  [${totalBdAvAsig} Asig, ${totalBdAvFin} Fin, ${totalEfBdAv}%]`);
    console.log(`                        Diferencia Neta de Efectividad: ${(totalEfBdAv - totalEfOficAv).toFixed(2)}%`);
    console.log("------------------------------------------------------------------------------------------");
    console.log(`⚡ POSTVENTA ACUMULADO: WIN Oficial [${totalOficPvAsig} Asig, ${totalOficPvFin} Fin, ${totalEfOficPv}%]`);
    console.log(`                        Base Datos  [${totalBdPvAsig} Asig, ${totalBdPvFin} Fin, ${totalEfBdPv}%]`);
    console.log(`                        Diferencia Neta de Efectividad: ${(totalEfBdPv - totalEfOficPv).toFixed(2)}%`);
    console.log("==========================================================================================\n");

    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

runMasterAlgorithm();
