const mysql = require('mysql2/promise');

async function check() {
  const local = mysql.createPool({ host: '127.0.0.1', user: 'root', password: '', database: 'corporacioncespe_cespedes' });
  const [rows] = await local.query(`
    SELECT estado, COUNT(*) as c
    FROM ordenes 
    WHERE motivo_regestion IS NOT NULL AND motivo_regestion != ''
    GROUP BY estado
  `);
  console.log(rows);
  await local.end();
}

check();
