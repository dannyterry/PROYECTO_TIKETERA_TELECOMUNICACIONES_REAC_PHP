const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  const [dbs] = await conn.query('SHOW DATABASES');
  console.log('DATABASES:', dbs.map(d => Object.values(d)[0]));

  const [tables] = await conn.query('SHOW TABLES');
  console.log('TABLES IN corporacioncespe_cespedes:', tables.map(t => Object.values(t)[0]));

  // Check if there is an ordenes_auditadas_win table or similar
  const hasAudit = tables.some(t => Object.values(t)[0] === 'ordenes_auditadas_win');
  if (hasAudit) {
    const [auditCounts] = await conn.query(`
      SELECT estado, count(*) as c 
      FROM ordenes_auditadas_win 
      WHERE (fecha_visita >= '2026-09-01 00:00:00' AND fecha_visita <= '2026-09-29 23:59:59')
         OR (fecha_visita IS NULL AND fecha_solicitud >= '2026-09-01 00:00:00' AND fecha_solicitud <= '2026-09-29 23:59:59')
      GROUP BY estado
    `);
    console.log('AUDIT WIN COUNTS (Sep 01-29):', auditCounts);
  }

  await conn.end();
}

main().catch(console.error);
