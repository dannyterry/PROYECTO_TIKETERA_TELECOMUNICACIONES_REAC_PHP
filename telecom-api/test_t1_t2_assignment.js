const http = require('http');

const data = JSON.stringify({
  tecnico: 'BRAYAN JESUS CANELON GONZALES / PAUL ALBERTO CAPCHA RIOS'
});

const req = http.request(
  {
    hostname: 'localhost',
    port: 3000,
    path: '/ordenes/3403353/tecnico',
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  },
  (res) => {
    let body = '';
    res.on('data', (c) => (body += c));
    res.on('end', async () => {
      console.log('📡 API Response:', body);
      const pool = require('./db.js');
      const [rows] = await pool.query(
        "SELECT numero, id_tecnico, id_tecnico_reemplazo, tecnico_asignado FROM ordenes WHERE numero = '3403353'"
      );
      console.log('✅ MySQL Fila actualizada en ordenes:', rows[0]);
      process.exit(0);
    });
  }
);

req.on('error', (err) => {
  console.error('Request error:', err.message);
  process.exit(1);
});

req.write(data);
req.end();
