const pool = require('../db');

async function setup() {
  console.log("🛠️ Verificando y creando tabla orden_tareas_cache...");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orden_tareas_cache (
      numero_orden VARCHAR(50) PRIMARY KEY,
      id_orden INT DEFAULT 0,
      cliente VARCHAR(255) NULL,
      cuadrilla VARCHAR(255) NULL,
      estado_orden VARCHAR(50) NULL,
      total_tareas INT DEFAULT 0,
      tareas_finalizadas INT DEFAULT 0,
      progreso_porcentaje INT DEFAULT 0,
      tareas_json LONGTEXT NULL,
      fecha_sincronizacion DATETIME NULL,
      fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_id_orden (id_orden),
      INDEX idx_estado_orden (estado_orden)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  console.log("✅ Tabla orden_tareas_cache creada o existente.");

  // Si hay datos en orden_tareas, migrar a orden_tareas_cache
  const [ordenesEnDetalle] = await pool.query(`
    SELECT DISTINCT numero_orden, id_orden FROM orden_tareas
  `);

  console.log(`📦 Encontradas ${ordenesEnDetalle.length} órdenes en orden_tareas para consolidar en cache...`);

  for (const ord of ordenesEnDetalle) {
    const num = ord.numero_orden;
    const [tasks] = await pool.query(`
      SELECT 
        id_tarea_fenix AS id, index_tarea AS \`index\`,
        titulo, estado, es_obligatorio, tiene_foto, valor_texto, metraje,
        observacion, fecha_inicio, fecha_fin, duracion
      FROM orden_tareas
      WHERE numero_orden = ?
      ORDER BY index_tarea ASC
    `, [num]);

    const total = tasks.length;
    const finalizadas = tasks.filter(t => {
      const e = (t.estado || '').toLowerCase();
      return !e.includes('pend');
    }).length;
    const pct = total > 0 ? Math.round((finalizadas / total) * 100) : 0;

    // Obtener datos de la orden si existen
    const [oRows] = await pool.query(
      "SELECT cliente, cuadrilla, estado FROM ordenes WHERE numero = ? LIMIT 1",
      [num]
    );
    const cliente = oRows[0]?.cliente || null;
    const cuadrilla = oRows[0]?.cuadrilla || null;
    const estado = oRows[0]?.estado || null;

    await pool.query(`
      INSERT INTO orden_tareas_cache (
        numero_orden, id_orden, cliente, cuadrilla, estado_orden,
        total_tareas, tareas_finalizadas, progreso_porcentaje,
        tareas_json, fecha_sincronizacion
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        total_tareas = VALUES(total_tareas),
        tareas_finalizadas = VALUES(tareas_finalizadas),
        progreso_porcentaje = VALUES(progreso_porcentaje),
        tareas_json = VALUES(tareas_json),
        fecha_sincronizacion = NOW()
    `, [
      num, ord.id_orden || 0, cliente, cuadrilla, estado,
      total, finalizadas, pct,
      JSON.stringify(tasks)
    ]);
  }

  console.log("🎉 ¡Migración e inicialización de orden_tareas_cache completada!");
  process.exit(0);
}

setup().catch(err => {
  console.error("❌ Error al configurar orden_tareas_cache:", err);
  process.exit(1);
});
