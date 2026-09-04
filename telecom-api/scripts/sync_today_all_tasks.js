const pool = require('../db');
const { sincronizarTareasOrdenSeguro } = require('../services/taskSyncService');

async function syncAllToday() {
  console.log("🚀 Sincronizando tareas para todas las órdenes de HOY...");
  
  const [rows] = await pool.query(`
    SELECT o.numero, o.id_orden, o.cliente, o.estado
    FROM ordenes o
    LEFT JOIN orden_tareas_cache tc ON o.numero = tc.numero_orden
    WHERE DATE(COALESCE(o.fecha_solicitud, o.fecha_visita, o.inicio_visita, o.fecha_creacion, NOW())) = CURDATE()
      AND tc.numero_orden IS NULL
    ORDER BY o.id_orden DESC
  `);

  console.log(`📦 Encontradas ${rows.length} órdenes de hoy pendientes de cachear tareas...`);

  let count = 0;
  for (const r of rows) {
    try {
      console.log(`[${++count}/${rows.length}] Consultando #${r.numero} (${r.cliente})...`);
      const res = await sincronizarTareasOrdenSeguro(r.numero, r.id_orden, false);
      console.log(`  -> Fuente: ${res.fuente}, Tareas: ${res.total}, Avance: ${res.pct}%`);
    } catch (e) {
      console.error(`  -> Error en #${r.numero}:`, e.message);
    }
    await new Promise(res => setTimeout(res, 1200));
  }

  console.log("🎉 ¡Todas las órdenes de hoy quedaron sincronizadas en orden_tareas_cache!");
  process.exit(0);
}

syncAllToday().catch(err => {
  console.error(err);
  process.exit(1);
});
