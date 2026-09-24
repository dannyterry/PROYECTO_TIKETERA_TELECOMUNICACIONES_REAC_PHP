const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  const [tables] = await conn.execute(`SHOW TABLES LIKE '%compra%'`);
  console.log('Compra tables:', tables);

  const [tables2] = await conn.execute(`SHOW TABLES LIKE '%liq%'`);
  console.log('Liq tables:', tables2);

  const [tables3] = await conn.execute(`SHOW TABLES LIKE '%despacho%'`);
  console.log('Despacho tables:', tables3);

  await conn.end();
}

main().catch(console.error);
