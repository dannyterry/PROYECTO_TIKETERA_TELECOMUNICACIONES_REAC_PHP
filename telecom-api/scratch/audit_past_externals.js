const pool = require('../db');

async function checkExternalsInDb() {
  try {
    // 1. Contar órdenes marcadas como EXTERNO
    const [externals] = await pool.query(
      `SELECT id_orden, numero, fecha_visita, fecha_solicitud, estado, cuadrilla, tecnico_asignado, usuario_ejecutor_fenix 
       FROM ordenes 
       WHERE tecnico_asignado LIKE '%EXTERNO%' OR usuario_ejecutor_fenix IS NOT NULL`
    );

    console.log(`\n📊 Órdenes que ya tienen registro de EXTERNO o usuario_ejecutor_fenix: ${externals.length}`);
    console.table(externals);

    // 2. Revisar órdenes Finalizadas recientes sin acta que tienen asignado a un técnico de Céspedes (candidatas a ser externas)
    const [candidatas] = await pool.query(
      `SELECT o.id_orden, o.numero, DATE(o.fecha_visita) as fecha, o.estado, o.cuadrilla, o.tecnico_asignado, o.asignacion_manual, o.id_tecnico
       FROM ordenes o
       LEFT JOIN orden_liquidaciones ol ON ol.id_orden = o.id_orden
       WHERE o.estado IN ('Finalizada', 'Liquidada')
         AND ol.id_liquidacion IS NULL
         AND o.id_tecnico IS NOT NULL
         AND o.asignacion_manual = 0
         AND o.fecha_visita >= '2026-09-20'
       ORDER BY o.fecha_visita DESC
       LIMIT 20`
    );

    console.log(`\n🔍 Órdenes finalizadas recientes sin acta (candidatas a auditar en Fénix): ${candidatas.length}`);
    console.table(candidatas);

    process.exit(0);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

checkExternalsInDb();
