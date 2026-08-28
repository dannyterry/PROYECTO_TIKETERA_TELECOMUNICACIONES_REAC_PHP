const db = require('./db');

async function listAllPermissions() {
  try {
    const [rows] = await db.query("SELECT id_permiso, nombre, clave, modulo FROM permisos ORDER BY modulo, id_permiso");
    console.log('Total permisos:', rows.length);
    console.table(rows);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

listAllPermissions();
