const db = require('./db');

async function insertPermiso() {
  try {
    const [existing] = await db.query("SELECT * FROM permisos WHERE clave = 'ordenes.ver_stock'");
    if (existing.length === 0) {
      const [res] = await db.query(`
        INSERT INTO permisos (nombre, clave, modulo, estado, fecha_creacion)
        VALUES ('Ver Stock Órdenes', 'ordenes.ver_stock', 'ordenes', 'Activo', NOW())
      `);
      console.log('Permiso insertado con ID:', res.insertId);
    } else {
      console.log('Permiso ya existe:', existing[0]);
    }
  } catch (e) {
    console.error('Error:', e);
  } finally {
    process.exit(0);
  }
}

insertPermiso();
