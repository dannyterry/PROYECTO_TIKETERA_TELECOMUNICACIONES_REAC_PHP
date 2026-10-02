const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost', user: 'root', password: '', database: 'corporacioncespe_cespedes'
  });

  const [counts] = await conn.query(`
    SELECT estado, count(*) as cantidad 
    FROM ordenes 
    WHERE (
      (fecha_visita >= '2026-09-01 00:00:00' AND fecha_visita <= '2026-09-29 23:59:59')
      OR (fecha_visita IS NULL AND fecha_solicitud >= '2026-09-01 00:00:00' AND fecha_solicitud <= '2026-09-29 23:59:59')
    )
    GROUP BY estado
    ORDER BY cantidad DESC
  `);
  console.log('--- CONTEO POR ESTADO (01 al 29 Sep 2026) ---');
  console.table(counts);

  const [total] = await conn.query(`
    SELECT count(*) as total 
    FROM ordenes 
    WHERE (
      (fecha_visita >= '2026-09-01 00:00:00' AND fecha_visita <= '2026-09-29 23:59:59')
      OR (fecha_visita IS NULL AND fecha_solicitud >= '2026-09-01 00:00:00' AND fecha_solicitud <= '2026-09-29 23:59:59')
    )
  `);
  console.log('TOTAL GLOBAL:', total[0].total);

  // Check if any order has state Finalizada but cancelled motivo
  const [weird] = await conn.query(`
    SELECT id_orden, numero, cliente, cuadrilla, estado, motivo_finalizacion, motivo_cancelacion, motivo_anulacion
    FROM ordenes 
    WHERE (
      (fecha_visita >= '2026-09-01 00:00:00' AND fecha_visita <= '2026-09-29 23:59:59')
      OR (fecha_visita IS NULL AND fecha_solicitud >= '2026-09-01 00:00:00' AND fecha_solicitud <= '2026-09-29 23:59:59')
    )
    AND estado IN ('Finalizada', 'Liquidada')
    AND (
      motivo_finalizacion LIKE '%CANCELAD%' 
      OR motivo_finalizacion LIKE '%NO REALIZAD%'
      OR motivo_cancelacion LIKE '%CANCELAD%'
      OR motivo_finalizacion IS NULL
      OR TRIM(motivo_finalizacion) = ''
    )
  `);
  console.log('FINALIZADAS SOSPECHOSAS O SIN MOTIVO EN SEPTIEMBRE:', weird.length);
  if (weird.length > 0) console.table(weird);

  // Today's orders (30 Sep 2026)
  const [hoy] = await conn.query(`
    SELECT estado, count(*) as cantidad 
    FROM ordenes 
    WHERE (
      (fecha_visita >= '2026-09-30 00:00:00' AND fecha_visita <= '2026-09-30 23:59:59')
      OR (fecha_visita IS NULL AND fecha_solicitud >= '2026-09-30 00:00:00' AND fecha_solicitud <= '2026-09-30 23:59:59')
    )
    GROUP BY estado
  `);
  console.log('\n--- ÓRDENES DE HOY (30 Sep 2026) ---');
  console.table(hoy);

  await conn.end();
}

main().catch(console.error);
