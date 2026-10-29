const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const http = require('http');

async function testApi() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    database: 'corporacioncespe_cespedes'
  });

  const [userRow] = await conn.query("SELECT * FROM usuarios WHERE id_usuario = 1");
  const user = userRow[0];
  const token = jwt.sign({ id_usuario: user.id_usuario, id_rol: user.id_rol, email: user.email }, 'cespedes_jwt_secret_key_2026', { expiresIn: '1d' });

  await conn.end();

  const req = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/almacen/cruce-inventario/tecnicos',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      console.log('Status code:', res.statusCode);
      console.log('Response body:', data);
    });
  });

  req.on('error', err => console.error('Error request:', err.message));
  req.end();
}

testApi();
