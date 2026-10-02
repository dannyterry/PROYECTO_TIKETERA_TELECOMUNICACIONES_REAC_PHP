const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  const [diaADia] = await conn.query(`
    SELECT 
      DATE(COALESCE(fecha_visita, fecha_solicitud)) as fecha,
      COUNT(*) as global,
      SUM(CASE WHEN estado IN ('Finalizada', 'Liquidada', 'Finalizada Externa') THEN 1 ELSE 0 END) as concluidas_fenix,
      SUM(CASE WHEN estado = 'Finalizada' THEN 1 ELSE 0 END) as finalizadas_local,
      SUM(CASE WHEN estado = 'Liquidada' THEN 1 ELSE 0 END) as liquidadas_local,
      SUM(CASE WHEN estado = 'Finalizada Externa' THEN 1 ELSE 0 END) as externa_local,
      SUM(CASE WHEN estado = 'Cancelada' THEN 1 ELSE 0 END) as canceladas,
      SUM(CASE WHEN estado = 'Anulada' THEN 1 ELSE 0 END) as anuladas,
      SUM(CASE WHEN estado = 'Regestión' THEN 1 ELSE 0 END) as regestion,
      SUM(CASE WHEN estado = 'Iniciada' THEN 1 ELSE 0 END) as iniciada,
      SUM(CASE WHEN estado = 'Agendada' THEN 1 ELSE 0 END) as agendada
    FROM ordenes 
    WHERE (
      (fecha_visita >= '2026-09-01 00:00:00' AND fecha_visita <= '2026-09-29 23:59:59')
      OR (fecha_visita IS NULL AND fecha_solicitud >= '2026-09-01 00:00:00' AND fecha_solicitud <= '2026-09-29 23:59:59')
    )
    GROUP BY DATE(COALESCE(fecha_visita, fecha_solicitud))
    ORDER BY fecha ASC
  `);

  console.log('--- DÍA A DÍA SEPTIEMBRE (01 al 29 Sep 2026) ---');
  console.table(diaADia);

  await conn.end();
}

main().catch(console.error);
