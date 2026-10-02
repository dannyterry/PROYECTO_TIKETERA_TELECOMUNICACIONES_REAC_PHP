const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  const [rows] = await conn.query(`
    SELECT id_orden, numero, cliente, cuadrilla, estado, motivo_finalizacion, motivo_cancelacion, fecha_visita
    FROM ordenes 
    WHERE (estado LIKE '%Finaliz%' OR estado LIKE '%Liquid%')
      AND (
        motivo_finalizacion LIKE '%CANCELAD%'
        OR motivo_finalizacion LIKE '%NO REALIZAD%'
        OR motivo_cancelacion LIKE '%CANCELAD%'
      )
  `);
  console.log('Total orders affected across DB:', rows.length);
  console.log(rows);

  await conn.end();
}

main().catch(console.error);
