const mysql = require('mysql2/promise');

async function check() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    database: 'corporacioncespe_cespedes'
  });

  const [t] = await conn.query("SHOW TABLES LIKE '%liq%'");
  console.log('Liq tables:', t);
  await conn.end();
}

check();
