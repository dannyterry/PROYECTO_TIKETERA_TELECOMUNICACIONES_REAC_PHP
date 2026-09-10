const pool = require('./db.js');
const mysql = require('mysql2/promise');

async function migrate() {
  console.log("=== MIGRACIÓN: AGREGAR id_equipo A producto_series ===");

  // 1. Base de datos local
  try {
    const [cols] = await pool.query("SHOW COLUMNS FROM producto_series LIKE 'id_equipo'");
    if (cols.length === 0) {
      console.log("Agregando columna id_equipo en BD local...");
      await pool.query("ALTER TABLE producto_series ADD COLUMN id_equipo VARCHAR(100) DEFAULT NULL AFTER codigo_serie");
      await pool.query("ALTER TABLE producto_series ADD INDEX idx_ps_id_equipo (id_equipo)");
      console.log("✅ Columna id_equipo e índice creados exitosamente en local.");
    } else {
      console.log("ℹ️ La columna id_equipo ya existe en BD local.");
    }
  } catch (err) {
    console.error("❌ Error en migración local:", err.message);
  }

  // 2. Base de datos remota (si está accesible)
  try {
    const remoteConn = await mysql.createConnection({
      host: 'corporacioncespedes.com',
      user: 'corporacioncespe_miguel',
      password: 'corporacioncespe_123',
      database: 'corporacioncespe_cespedes',
      connectTimeout: 5000
    });
    console.log("📡 Conectado a BD remota corporacioncespedes.com...");
    const [remCols] = await remoteConn.query("SHOW COLUMNS FROM producto_series LIKE 'id_equipo'");
    if (remCols.length === 0) {
      await remoteConn.query("ALTER TABLE producto_series ADD COLUMN id_equipo VARCHAR(100) DEFAULT NULL AFTER codigo_serie");
      await remoteConn.query("ALTER TABLE producto_series ADD INDEX idx_ps_id_equipo (id_equipo)");
      console.log("✅ Columna id_equipo e índice creados en BD remota.");
    } else {
      console.log("ℹ️ La columna id_equipo ya existe en BD remota.");
    }
    await remoteConn.end();
  } catch (err) {
    console.log("ℹ️ BD remota no disponible o timeout:", err.message);
  }

  process.exit(0);
}

migrate();
