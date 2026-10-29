const mysql = require('mysql2/promise');

async function inspectRoles() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    database: 'corporacioncespe_cespedes'
  });

  const [roles] = await conn.query("SELECT * FROM roles");
  console.log('Roles:', roles);

  const [servicios] = await conn.query("SELECT DISTINCT tipo_servicio FROM usuarios WHERE tipo_servicio IS NOT NULL AND tipo_servicio != ''");
  console.log('Tipos de servicio:', servicios);

  await conn.end();
}

inspectRoles();
