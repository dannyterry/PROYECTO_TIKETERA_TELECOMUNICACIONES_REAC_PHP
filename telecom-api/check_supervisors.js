const pool = require('./db.js');

async function check() {
  try {
    const [roles] = await pool.query('SELECT * FROM roles');
    console.log('--- ROLES EN BD ---');
    console.log(roles);

    const [allUsers] = await pool.query(`
      SELECT u.id_usuario, t.id_trabajador, u.documento, u.nombres, u.primer_apellido, u.id_rol, r.nombre as rol, u.estado
      FROM usuarios u
      LEFT JOIN trabajadores t ON u.id_usuario = t.id_usuario
      LEFT JOIN roles r ON u.id_rol = r.id_rol
      ORDER BY u.id_rol ASC, u.nombres ASC
    `);
    console.log('--- TODOS LOS USUARIOS POR ROL ---');
    console.log(allUsers);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
