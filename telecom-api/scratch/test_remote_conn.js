const mysql = require('mysql2/promise');

const REMOTE_CONFIG = {
  host: 'corporacioncespedes.com',
  user: 'corporacioncespe_miguel',
  password: 'corporacioncespe_123',
  database: 'corporacioncespe_cespedes',
  dateStrings: true,
  connectTimeout: 60000
};

async function testRemoteConn() {
  console.log('Probando conexión a base de datos de producción...');
  const conn = await mysql.createConnection(REMOTE_CONFIG);
  const [rows] = await conn.execute('SELECT COUNT(*) as count FROM productos');
  console.log('✅ Conectado a Producción. Total productos en producción:', rows[0].count);
  await conn.end();
}

testRemoteConn().catch(console.error);
