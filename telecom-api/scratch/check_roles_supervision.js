const mysql = require('mysql2/promise');

async function checkRoles() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  const [roles] = await conn.execute(`SELECT * FROM roles`);
  console.log('ROLES EN BD:');
  console.table(roles);

  const [supervisores] = await conn.execute(`
    SELECT u.id_usuario, u.nombres, u.primer_apellido, u.cargo, u.id_rol, r.nombre as rol
    FROM usuarios u
    LEFT JOIN roles r ON u.id_rol = r.id_rol
    WHERE u.estado = 'Activo'
  `);
  console.log('\nUSUARIOS Y SUS ROLES:');
  console.table(supervisores);

  await conn.end();
}

checkRoles().catch(console.error);
