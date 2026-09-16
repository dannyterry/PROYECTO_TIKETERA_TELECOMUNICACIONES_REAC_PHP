const mysql = require('mysql2/promise');

const localConfig = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: '',
  database: 'corporacioncespe_cespedes'
};

async function check() {
  const pool = mysql.createPool(localConfig);
  const [rows] = await pool.query(`
    SELECT 
      SUM(CASE WHEN producto IS NULL THEN 1 ELSE 0 END) as es_null,
      SUM(CASE WHEN producto = '' THEN 1 ELSE 0 END) as es_vacio,
      SUM(CASE WHEN producto IS NOT NULL AND producto != '' THEN 1 ELSE 0 END) as tiene_valor
    FROM ordenes
  `);
  console.table(rows);
  await pool.end();
}

check().catch(console.error);
