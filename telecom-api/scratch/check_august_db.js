const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  const [counts] = await conn.query(`
    SELECT estado, count(*) as c 
    FROM ordenes 
    WHERE (fecha_visita >= '2026-08-01' AND fecha_visita <= '2026-08-31 23:59:59')
       OR (fecha_visita IS NULL AND fecha_solicitud >= '2026-08-01' AND fecha_solicitud <= '2026-08-31 23:59:59')
    GROUP BY estado
  `);
  console.log('ESTADOS AGOSTO:', counts);

  const [total] = await conn.query(`
    SELECT count(*) as total 
    FROM ordenes 
    WHERE (fecha_visita >= '2026-08-01' AND fecha_visita <= '2026-08-31 23:59:59')
       OR (fecha_visita IS NULL AND fecha_solicitud >= '2026-08-01' AND fecha_solicitud <= '2026-08-31 23:59:59')
  `);
  console.log('TOTAL AGOSTO:', total[0].total);

  // Check the specific orders
  const [ords] = await conn.query(`
    SELECT id_orden, numero, cliente, cuadrilla, estado, motivo_finalizacion, motivo_cancelacion, motivo_anulacion, fecha_visita, fecha_solicitud
    FROM ordenes 
    WHERE numero IN ('3329365', '3349753', '3399647', '3400592')
  `);
  console.log('SPECIFIC ORDERS:', ords);

  // Let's also check all orders with status Finalizada but motivo_finalizacion containing CANCELAD or empty
  const [weird] = await conn.query(`
    SELECT id_orden, numero, cliente, cuadrilla, estado, motivo_finalizacion, motivo_cancelacion, motivo_anulacion, fecha_visita
    FROM ordenes 
    WHERE ((fecha_visita >= '2026-08-01' AND fecha_visita <= '2026-08-31 23:59:59')
       OR (fecha_visita IS NULL AND fecha_solicitud >= '2026-08-01' AND fecha_solicitud <= '2026-08-31 23:59:59'))
       AND estado = 'Finalizada'
       AND (
         motivo_finalizacion LIKE '%CANCELAD%' 
         OR motivo_finalizacion LIKE '%ANULAD%'
         OR motivo_finalizacion IS NULL 
         OR TRIM(motivo_finalizacion) = ''
       )
  `);
  console.log('WEIRD FINALIZADAS EN AGOSTO:', weird);

  await conn.end();
}

main().catch(console.error);
