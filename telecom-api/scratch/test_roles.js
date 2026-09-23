const db = require('../db');

(async () => {
  try {
    const [roles] = await db.query('SELECT * FROM roles');
    console.log('Roles in DB:', roles);

    const [usersWithRol] = await db.query(`
      SELECT u.id_usuario, u.usuario, u.nombres, u.apellidos, u.id_rol, r.nombre as rol_nombre, u.cargo 
      FROM usuarios u
      LEFT JOIN roles r ON r.id_rol = u.id_rol
      WHERE u.estado = 'Activo'
      ORDER BY u.id_rol, u.nombres
    `);
    console.log('Active users with roles:');
    usersWithRol.forEach(u => {
      console.log(`ID: ${u.id_usuario} | RolID: ${u.id_rol} (${u.rol_nombre}) | Cargo: ${u.cargo} | User: ${u.nombres} ${u.apellidos}`);
    });
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
})();
