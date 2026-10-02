const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  const [res] = await conn.query(`
    UPDATE ordenes 
    SET estado = 'Observada'
    WHERE (estado LIKE '%Finaliz%' OR estado LIKE '%Liquid%')
      AND (
        motivo_finalizacion LIKE '%CANCELAD%'
        OR motivo_finalizacion LIKE '%NO REALIZAD%'
        OR motivo_cancelacion LIKE '%CANCELAD%'
      )
  `);
  console.log('Filas actualizadas a Observada:', res.affectedRows);

  // Now verify August counts
  const [counts] = await conn.query(`
    SELECT estado, count(*) as c 
    FROM ordenes 
    WHERE (fecha_visita >= '2026-08-01' AND fecha_visita <= '2026-08-31 23:59:59')
       OR (fecha_visita IS NULL AND fecha_solicitud >= '2026-08-01' AND fecha_solicitud <= '2026-08-31 23:59:59')
    GROUP BY estado
    ORDER BY c DESC
  `);
  console.log('\n--- CONTEO FINAL AGOSTO 2026 ---');
  console.table(counts);

  const [fenixStatusSum] = await conn.query(`
    SELECT 
      SUM(CASE WHEN estado = 'Finalizada' THEN 1 ELSE 0 END) as Finalizadas,
      SUM(CASE WHEN estado = 'Cancelada' THEN 1 ELSE 0 END) as Canceladas,
      SUM(CASE WHEN estado = 'Regestión' THEN 1 ELSE 0 END) as Regestion,
      SUM(CASE WHEN estado = 'Anulada' THEN 1 ELSE 0 END) as Anuladas,
      SUM(CASE WHEN estado = 'Agendada' THEN 1 ELSE 0 END) as Agendadas,
      SUM(CASE WHEN estado = 'Iniciada' THEN 1 ELSE 0 END) as Iniciadas,
      SUM(CASE WHEN estado = 'Observada' THEN 1 ELSE 0 END) as Observadas,
      COUNT(*) as TotalGeneral
    FROM ordenes 
    WHERE (fecha_visita >= '2026-08-01' AND fecha_visita <= '2026-08-31 23:59:59')
       OR (fecha_visita IS NULL AND fecha_solicitud >= '2026-08-01' AND fecha_solicitud <= '2026-08-31 23:59:59')
  `);
  console.log('\n--- COMPARATIVA DIRECTA CON FÉNIX ---');
  console.table(fenixStatusSum);

  await conn.end();
}

main().catch(console.error);
