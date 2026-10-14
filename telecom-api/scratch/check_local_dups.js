const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });
  const [totalRows] = await conn.query('SELECT COUNT(*) as total FROM ordenes');
  const [uniqueTickets] = await conn.query('SELECT COUNT(DISTINCT numero) as unicos FROM ordenes WHERE numero IS NOT NULL AND TRIM(numero) != ""');
  console.log('Total filas en ordenes:', totalRows[0].total);
  console.log('Tickets unicos:', uniqueTickets[0].unicos);
  console.log('Filas duplicadas estimadas:', totalRows[0].total - uniqueTickets[0].unicos);
  await conn.end();
}

main().catch(console.error);
