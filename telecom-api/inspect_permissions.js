const db = require('./db');

async function inspectPermissions() {
  try {
    const [tables] = await db.query("SHOW TABLES LIKE '%permis%'");
    console.log('Tablas permisos:', tables);

    const [allTables] = await db.query("SHOW TABLES");
    console.log('Todas las tablas:', allTables.map(t => Object.values(t)[0]));

    // Si existe tabla permisos o modulos
    try {
      const [modulos] = await db.query("SELECT * FROM modulos");
      console.log('Módulos:', modulos);
    } catch (e) {
      console.log('No hay tabla modulos:', e.message);
    }

    try {
      const [permisos] = await db.query("SELECT * FROM permisos LIMIT 20");
      console.log('Permisos:', permisos);
    } catch (e) {
      console.log('No hay tabla permisos:', e.message);
    }

    try {
      const [rolPermisos] = await db.query("SELECT * FROM roles_permisos LIMIT 20");
      console.log('Roles permisos:', rolPermisos);
    } catch (e) {
      console.log('No hay tabla roles_permisos:', e.message);
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
}

inspectPermissions();
