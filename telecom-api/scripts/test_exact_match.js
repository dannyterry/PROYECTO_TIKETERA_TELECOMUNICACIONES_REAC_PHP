const pool = require('../db');

async function testOnlyThree() {
  try {
    const [stats] = await pool.query(`
      SELECT 
        COUNT(CASE WHEN estado != 'Anulada' AND estado NOT LIKE '%Regesti%' THEN 1 END) as asignadas_averias,
        SUM(CASE WHEN estado = 'Finalizada' THEN 1 ELSE 0 END) as finalizadas_averias
      FROM ordenes
      WHERE YEAR(fecha_visita) = 2026 AND MONTH(fecha_visita) = 1
        AND (cuadrilla IS NULL OR (TRIM(cuadrilla) NOT REGEXP '^[oO][0-9]+' AND TRIM(cuadrilla) NOT REGEXP '^[oO] ' AND TRIM(cuadrilla) NOT LIKE 'ORDENAMIENTO%'))
        AND (cliente IS NULL OR (cliente NOT LIKE '%NORMALIZACI%' AND cliente NOT LIKE '%CONJUNTA PEXT%'))
        AND (tipo_trabajo IS NULL OR (tipo_trabajo NOT LIKE '%ORDENAMIENTO%' AND tipo_trabajo NOT LIKE '%ADICIONAL%'))
        AND (motivo_finalizacion IS NULL OR (motivo_finalizacion NOT LIKE '%CONJUNTA PEXT%' AND motivo_finalizacion NOT LIKE '%MESH%'))
        AND NOT (
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
        )
    `);

    const asig = stats[0].asignadas_averias;
    const fin = stats[0].finalizadas_averias;
    const ef = ((fin / asig) * 100).toFixed(2);

    console.log("=== COMPARATIVA CON EL FILTRO DE ESTOS 3 CASOS ===");
    console.log(`OFICIAL WIN:      Asignadas: 911 | Finalizadas: 687 | Efectividad: 75.41%`);
    console.log(`BD CON EL FILTRO: Asignadas: ${asig} | Finalizadas: ${fin} | Efectividad: ${ef}%`);
    console.log(`DIFERENCIA ASIGNADAS: ${asig - 911} | DIFERENCIA FINALIZADAS: ${fin - 687}`);
    console.log(`DIFERENCIA EFECTIVIDAD: ${(ef - 75.41).toFixed(2)}%`);

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

testOnlyThree();
