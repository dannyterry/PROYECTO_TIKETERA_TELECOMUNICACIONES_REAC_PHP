const mysql = require('mysql2/promise');

async function test() {
  const pool = mysql.createPool({ host: '127.0.0.1', user: 'root', password: '', database: 'corporacioncespe_cespedes' });
  const query = `
    SELECT 
      o.numero,
      o.cliente,
      o.estado as raw_estado,
      o.motivo_regestion,
      o.motivo_cancelacion,
      o.inicio_visita,
      o.fin_visita,
      CASE 
        WHEN ol.id_liquidacion IS NOT NULL THEN 'Liquidada'
        WHEN o.estado IN ('Finalizada', 'Finalizados', 'Cancelada', 'Cancelado', 'Anulada', 'Anulado', 'Regestion', 'Regestión') THEN o.estado
        WHEN o.motivo_cancelacion IS NOT NULL AND TRIM(o.motivo_cancelacion) != '' THEN 'Cancelada'
        WHEN o.motivo_regestion IS NOT NULL AND TRIM(o.motivo_regestion) != '' AND o.estado != 'Iniciada' THEN 'Regestion'
        WHEN o.fin_visita IS NOT NULL AND o.estado IN ('Iniciada', 'En camino') THEN 'Finalizada'
        WHEN (o.inicio_visita IS NOT NULL OR COALESCE(tc.tareas_finalizadas, 0) > 0) 
             AND o.estado = 'En camino'
             AND (o.motivo_regestion IS NULL OR TRIM(o.motivo_regestion) = '')
             AND (o.motivo_cancelacion IS NULL OR TRIM(o.motivo_cancelacion) = '')
             THEN 'Iniciada'
        ELSE o.estado
      END AS final_estado
    FROM ordenes o
    LEFT JOIN orden_liquidaciones ol ON ol.id_orden = o.id_orden
    LEFT JOIN (SELECT numero_orden, COUNT(*) as tareas_finalizadas FROM orden_tareas_cache GROUP BY numero_orden) tc ON tc.numero_orden = o.numero
    WHERE o.numero = '3519724'
  `;
  const [rows] = await pool.query(query);
  console.log('Resultado en Local:', rows[0]);

  // Now check against production
  try {
    const prodPool = mysql.createPool({ host: 'corporacioncespedes.com', user: 'corporacioncespe_miguel', password: 'corporacioncespe_123', database: 'corporacioncespe_cespedes' });
    const [prodRows] = await prodPool.query(query);
    console.log('Resultado en Producción (con el query nuevo):', prodRows[0]);
    prodPool.end();
  } catch (e) {
    console.error('Error prod:', e.message);
  }
  pool.end();
}

test();
