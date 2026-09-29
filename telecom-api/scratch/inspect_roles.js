const pool = require('../db');

(async () => {
  const [roles] = await pool.query('SELECT * FROM roles');
  console.log('=== ROLES EN BD ===');
  console.table(roles);

  const [users] = await pool.query(`
    SELECT u.id_usuario, u.documento, u.nombres, u.primer_apellido, u.apellidos, u.id_rol, r.nombre AS rol_nombre, u.estado 
    FROM usuarios u 
    LEFT JOIN roles r ON u.id_rol = r.id_rol
    WHERE r.nombre LIKE '%superv%' OR r.nombre LIKE '%superb%' OR u.nombres LIKE '%yomar%'
  `);
  console.log('\n=== USUARIOS SUPERVISORES ===');
  console.table(users);

  process.exit();
})();
