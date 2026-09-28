const mysql = require('mysql2/promise');

async function test() {
  const conn = await mysql.createConnection({
    host: 'corporacioncespedes.com',
    user: 'corporacioncespe_miguel',
    password: 'corporacioncespe_123',
    database: 'corporacioncespe_cespedes',
    dateStrings: true
  });
  const [cols] = await conn.query("DESCRIBE ordenes");
  console.log("Columnas ordenes:", cols.map(c => c.Field));
  const [rows] = await conn.query("SELECT * FROM ordenes WHERE numero = '3345235' OR id_orden = 3345235 LIMIT 1");
  console.log("Orden 3345235:", rows);
  await conn.end();
}

test().catch(e => console.error(e));
