const db = require('./db');

async function addLookerConfig() {
  try {
    await db.query(`
      INSERT INTO configuracion (clave, valor, grupo, descripcion, updated_at)
      VALUES ('LOOKER_SESSION', '', 'tiempo_real', 'Sesión / Cookies Google Looker Studio', NOW())
      ON DUPLICATE KEY UPDATE descripcion = VALUES(descripcion)
    `);

    const [rows] = await db.query("SELECT clave, valor, grupo FROM configuracion WHERE grupo = 'tiempo_real'");
    console.log('Configuraciones tiempo_real en MySQL:', rows);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit();
  }
}

addLookerConfig();
