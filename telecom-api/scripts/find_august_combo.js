const pool = require('../db');

async function findAugustCombo() {
  try {
    console.log("=== ENCONTRANDO LA ORDEN EXACTA DE AGOSTO ===\n");

    // Órdenes candidatas en Averías de Agosto que tienen características especiales (cuadrilla traslado, motivo postventa, etc.)
    const [candidatas] = await pool.query(`
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
        -- Órdenes actualmente en Averías
        AND NOT (
          COALESCE(producto, '') LIKE '%POST%VENTA%'
          OR COALESCE(tipo_trabajo, '') LIKE '%TRASLADO%'
          OR COALESCE(tipo_trabajo, '') LIKE '%REUBICA%'
          OR COALESCE(tipo_trabajo, '') LIKE '%MUDANZA%'
        )
    `);

    console.log(`Total candidatas en Averías: ${candidatas.length}`);

    // Veamos cuáles son de cuadrilla TRASLADO o tienen motivo POSTVENTA / MESH / APARATO
    const conDetalle = candidatas.filter(c => {
      const cuad = (c.cuadrilla || '').toUpperCase();
      const asig = (c.tipo_trabajo_asignado || '').toUpperCase();
      const mot = (c.motivo_finalizacion || '').toUpperCase();
      const tipo = (c.tipo_trabajo || '').toUpperCase();

      return (
        cuad.includes('TRASLADO') ||
        mot.includes('POSTVENTA') ||
        mot.includes('APARATO') ||
        asig.includes('APARATO') ||
        tipo.includes('ADICIONAL')
      );
    });

    console.log(`Candidatas clave (${conDetalle.length}):`);
    console.table(conDetalle.map(c => ({
      id: c.id_orden,
      ot: c.numero,
      cuadrilla: c.cuadrilla?.slice(0, 18),
      tipo: c.tipo_trabajo,
      asig: c.tipo_trabajo_asignado?.slice(0, 20),
      motivo: c.motivo_finalizacion?.slice(0, 25),
      estado: c.estado
    })));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

findAugustCombo();
