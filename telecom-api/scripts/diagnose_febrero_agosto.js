const pool = require('../db');

async function diagnoseFebreroAgosto() {
  try {
    console.log("==========================================================================");
    console.log("   🔬 DIAGNÓSTICO PROFUNDO: EXACTAS 6 ÓRDENES DE FEBRERO Y AGOSTO");
    console.log("==========================================================================\n");

    for (const mes of [2, 8]) {
      const nombreMes = mes === 2 ? "FEBRERO" : "AGOSTO";
      console.log(`\n================== ANALIZANDO ${nombreMes} 2026 ==================`);

      // Busquemos todas las órdenes de ese mes que están clasificadas como AVERIAS pero tienen indicios de Postventa/Equipos/Soporte
      const [candidatos] = await pool.query(`
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
        WHERE YEAR(fecha_visita) = 2026 AND MONTH(fecha_visita) = ?
          AND (cuadrilla IS NULL OR (TRIM(cuadrilla) NOT REGEXP '^[oO][0-9]+' AND TRIM(cuadrilla) NOT REGEXP '^[oO] ' AND TRIM(cuadrilla) NOT LIKE 'ORDENAMIENTO%'))
          AND (cliente IS NULL OR (cliente NOT LIKE '%NORMALIZACI%' AND cliente NOT LIKE '%CONJUNTA PEXT%'))
          AND (tipo_trabajo IS NULL OR tipo_trabajo NOT LIKE '%ORDENAMIENTO%')
          AND (motivo_finalizacion IS NULL OR motivo_finalizacion NOT LIKE '%CONJUNTA PEXT%')
          AND estado != 'Anulada' AND estado NOT LIKE '%Regesti%'
          -- Actualmente en Averías (no caen en el filtro estándar de Postventa):
          AND NOT (
            COALESCE(tipo_trabajo, '') LIKE '%TRASLADO%' 
            OR COALESCE(tipo_trabajo, '') LIKE '%REUBICA%' 
            OR COALESCE(tipo_trabajo, '') LIKE '%MESH%' 
            OR COALESCE(tipo_trabajo, '') LIKE '%WIN BOX%' 
            OR COALESCE(tipo_trabajo, '') LIKE '%WINBOX%' 
            OR COALESCE(tipo_trabajo, '') LIKE '%WIFI%' 
            OR COALESCE(tipo_trabajo, '') LIKE '%MUDANZA%' 
            OR COALESCE(producto, '') LIKE '%POST%VENTA%' 
            OR COALESCE(motivo_finalizacion, '') LIKE '%POST%VENTA%'
            OR COALESCE(motivo_finalizacion, '') LIKE '%MESH%'
            OR (COALESCE(tipo_trabajo, '') LIKE '%ADICIONAL%' AND COALESCE(tipo_trabajo_asignado, '') NOT LIKE '%LOS ROJO%')
          )
        ORDER BY fecha_visita ASC
      `, [mes]);

      console.log(`Total órdenes en Averías para ${nombreMes}: ${candidatos.length}`);

      // Filtrar patrones especiales
      const especiales = candidatos.filter(c => {
        const asig = (c.tipo_trabajo_asignado || '').toUpperCase();
        const mot = (c.motivo_finalizacion || '').toUpperCase();
        const cuad = (c.cuadrilla || '').toUpperCase();
        const tipo = (c.tipo_trabajo || '').toUpperCase();

        return (
          asig.includes('WIFI') || asig.includes('MESH') || asig.includes('WINBOX') || asig.includes('TELÉFONO') || asig.includes('TELEFONO') || asig.includes('APARATO') || asig.includes('ADICIONAL') || asig.includes('EQUIPO') || asig.includes('CAMBIO') ||
          mot.includes('WIFI') || mot.includes('MESH') || mot.includes('WINBOX') || mot.includes('PHONOWIN') || mot.includes('TELÉFONO') || mot.includes('TELEFONO') || mot.includes('APARATO') || mot.includes('ADICIONAL') ||
          cuad.includes('TRASLADO') || cuad.includes('POST') || tipo.includes('ADICIONAL')
        );
      });

      console.log(`Órdenes con palabras clave de equipos/postventa en Averías (${especiales.length}):`);
      console.table(especiales.map(e => ({
        id: e.id_orden,
        ot: e.numero,
        cuadrilla: e.cuadrilla?.slice(0, 18),
        tipo: e.tipo_trabajo,
        asig: e.tipo_trabajo_asignado?.slice(0, 25),
        motivo: e.motivo_finalizacion?.slice(0, 30),
        estado: e.estado
      })));
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

diagnoseFebreroAgosto();
