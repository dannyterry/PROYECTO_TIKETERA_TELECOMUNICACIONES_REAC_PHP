const pool = require('../db');

async function solveAugustExactOrders() {
  try {
    console.log("==========================================================================");
    console.log("   🎯 BUSCANDO LAS ÓRDENES EXACTAS DE AGOSTO PARA CALCE AL 100%");
    console.log("==========================================================================\n");

    // WIN Oficial en Agosto:
    // Averías: 1129 Asignadas | 915 Finalizadas
    // Postventa: 137 Asignadas | 111 Finalizadas
    // Total Mes: 1266 Asignadas | 1026 Finalizadas

    // Nuestra BD con la regla base:
    // Averías: 1130 Asignadas | 916 Finalizadas
    // Postventa: 136 Asignadas | 108 Finalizadas

    // Esto significa que en WIN:
    // EXACTAMENTE 1 ORDEN Asignada adicional y 3 ÓRDENES Finalizadas adicionales pertenecen a Postventa.
    // (O 3 órdenes pasaron de Averías a Postventa y se cancelaron 2).

    // Veamos todas las órdenes de Agosto en la BD que fueron trabajadas por cuadrillas de Postventa (K 1 TRASLADO, K 5 TRASLADO) o que tienen motivos de Postventa/Equipos:
    const [ordenesAgosto] = await pool.query(`
      SELECT 
        id_orden,
        numero,
        codigo_seguimiento,
        cliente,
        fecha_visita,
        DATE(fecha_visita) as fecha,
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
    `);

    // Separar las que ya son Postventa
    const yaSonPv = ordenesAgosto.filter(o => {
      const prod = (o.producto || '').toUpperCase();
      const tipo = (o.tipo_trabajo || '').toUpperCase();
      return prod.includes('POST') || tipo.includes('TRASLADO') || tipo.includes('REUBICA') || tipo.includes('MUDANZA');
    });

    const estanEnAverias = ordenesAgosto.filter(o => !yaSonPv.includes(o));

    console.log(`Ya en Postventa: ${yaSonPv.length} Asig (${yaSonPv.filter(o => o.estado.includes('Finaliz')).length} Fin)`);
    console.log(`Están en Averías: ${estanEnAverias.length} Asig (${estanEnAverias.filter(o => o.estado.includes('Finaliz')).length} Fin)\n`);

    // Analicemos en "estanEnAverias" cuáles fueron hechas por cuadrillas de TRASLADO o tienen motivo POSTVENTA / MESH / PHONOWIN / WINBOX:
    const candidatas = estanEnAverias.filter(o => {
      const cuad = (o.cuadrilla || '').toUpperCase();
      const asig = (o.tipo_trabajo_asignado || '').toUpperCase();
      const mot = (o.motivo_finalizacion || '').toUpperCase();
      const tipo = (o.tipo_trabajo || '').toUpperCase();

      return (
        cuad.includes('TRASLADO') ||
        mot.includes('POST') ||
        mot.includes('MESH') ||
        mot.includes('APARATO') ||
        mot.includes('PHONOWIN') ||
        mot.includes('WINBOX') ||
        asig.includes('APARATO') ||
        asig.includes('TELÉFONO') ||
        asig.includes('WINBOX') ||
        tipo.includes('ADICIONAL')
      );
    });

    console.log(`Candidatas en Averías con señales de Postventa/Equipos (${candidatas.length}):`);
    console.table(candidatas.map(c => ({
      id: c.id_orden,
      ot: c.numero,
      fecha: String(c.fecha).slice(0, 10),
      cuad: c.cuadrilla?.slice(0, 18),
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

solveAugustExactOrders();
