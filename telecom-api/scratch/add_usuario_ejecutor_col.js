const pool = require('../db');

async function main() {
  try {
    const [cols] = await pool.query("SHOW COLUMNS FROM ordenes LIKE 'usuario_ejecutor_fenix'");
    if (cols.length === 0) {
      await pool.query("ALTER TABLE ordenes ADD COLUMN usuario_ejecutor_fenix VARCHAR(255) DEFAULT NULL");
      console.log("✅ [DB] Columna 'usuario_ejecutor_fenix' agregada exitosamente a la tabla 'ordenes'.");
    } else {
      console.log("ℹ️ [DB] Columna 'usuario_ejecutor_fenix' ya existe.");
    }
    process.exit(0);
  } catch (err) {
    console.error("❌ [DB] Error:", err.message);
    process.exit(1);
  }
}

main();
