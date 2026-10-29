const mysql = require('mysql2/promise');

async function inspectUsers() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    database: 'corporacioncespe_cespedes'
  });

  const [cols] = await conn.query("SHOW COLUMNS FROM usuarios");
  console.log('Columnas usuarios:', cols.map(c => c.Field));

  const [colsTrab] = await conn.query("SHOW COLUMNS FROM trabajadores");
  console.log('Columnas trabajadores:', colsTrab.map(c => c.Field));

  const [roles] = await conn.query("SELECT DISTINCT rol FROM usuarios");
  console.log('Roles:', roles);

  const [servicios] = await conn.query("SELECT DISTINCT tipo_servicio FROM usuarios WHERE tipo_servicio IS NOT NULL");
  console.log('Tipos de servicio:', servicios);

  await conn.end();
}

inspectUsers();

