const mysql = require('mysql2/promise');

const LOCAL_CONFIG = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: '',
  database: 'corporacioncespe_cespedes'
};

async function getCreateTable() {
  const conn = await mysql.createConnection(LOCAL_CONFIG);
  const [rows] = await conn.query('SHOW CREATE TABLE control_jornadas_personal');
  console.log(rows[0]['Create Table']);
  const [colRows] = await conn.query("SHOW CREATE TABLE orden_liquidaciones");
  console.log('\n--- orden_liquidaciones ---');
  console.log(colRows[0]['Create Table']);
  await conn.end();
}

getCreateTable();

