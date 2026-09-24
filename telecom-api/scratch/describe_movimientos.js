const mysql = require('mysql2/promise');

async function main() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes',
    port: 3306
  });

  const [cols] = await pool.query(`DESCRIBE movimientos`);
  console.log(cols.map(c => c.Field));
  await pool.end();
}

main();
