const mysql = require('mysql2/promise');

async function checkSupervisionTable() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  const [cols] = await conn.execute(`DESCRIBE supervisiones_campo`);
  console.log('COLUMNAS DE supervisiones_campo:');
  console.table(cols);

  await conn.end();
}

checkSupervisionTable().catch(console.error);
