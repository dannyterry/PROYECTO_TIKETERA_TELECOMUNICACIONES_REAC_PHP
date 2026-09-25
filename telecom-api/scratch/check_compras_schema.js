const mysql = require('mysql2/promise');

async function checkComprasSchema() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  const [colsCompras] = await conn.execute(`DESCRIBE compras`);
  console.log('COMPRAS COLS:');
  console.table(colsCompras);

  const [anuladas] = await conn.execute(`SELECT * FROM compras WHERE estado = 'ANULADA' OR estado LIKE '%ANUL%'`);
  console.log('\nCOMPRAS ANULADAS:');
  console.table(anuladas);

  await conn.end();
}

checkComprasSchema().catch(console.error);
