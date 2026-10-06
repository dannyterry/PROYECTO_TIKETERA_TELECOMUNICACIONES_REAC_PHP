const mysql = require('mysql2/promise');

const prodConfig = {
  host: 'corporacioncespedes.com',
  port: 3306,
  user: 'corporacioncespe_miguel',
  password: 'corporacioncespe_123',
  database: 'corporacioncespe_cespedes',
  connectTimeout: 15000
};

async function run() {
  const pool = mysql.createPool(prodConfig);

  console.log('--- 1. RESUMEN GENERAL ---');
  const [minMax] = await pool.query(
    'SELECT MIN(fecha_liquidacion) as primera_liq, MAX(fecha_liquidacion) as ultima_liq, COUNT(*) as total_liquidaciones FROM orden_liquidaciones'
  );
  console.log(minMax[0]);

  console.log('\n--- 2. TECNICOS QUE HAN LIQUIDADO (TOTAL HISTÓRICO) ---');
  const [ranking] = await pool.query(`
    SELECT 
      COALESCE(u.id_usuario, ol.id_trabajador) as id_usuario,
      COALESCE(CONCAT(u.nombres, ' ', COALESCE(u.primer_apellido, '')), ol.liquidado_por) as tecnico,
      COUNT(ol.id_liquidacion) as total_liquidadas,
      MIN(ol.fecha_liquidacion) as primera,
      MAX(ol.fecha_liquidacion) as ultima
    FROM orden_liquidaciones ol
    LEFT JOIN trabajadores t ON ol.id_trabajador = t.id_trabajador
    LEFT JOIN usuarios u ON t.id_usuario = u.id_usuario
    GROUP BY id_usuario, tecnico
    ORDER BY total_liquidadas DESC
  `);
  ranking.forEach((r, i) => {
    console.log(`${i+1}. ${r.tecnico} (ID: ${r.id_usuario}) -> ${r.total_liquidadas} liquidaciones (Desde ${r.primera} hasta ${r.ultima})`);
  });

  console.log('\n--- 3. TECNICOS QUE TIENEN ORDENES FINALIZADAS PERO NUNCA HAN LIQUIDADO NADA ---');
  const [nunca] = await pool.query(`
    SELECT 
      u.id_usuario,
      CONCAT(u.nombres, ' ', COALESCE(u.primer_apellido, ''), ' ', COALESCE(u.segundo_apellido, '')) as tecnico,
      u.usuario,
      COUNT(o.id_orden) as finalizadas_sin_liquidar
    FROM ordenes o
    JOIN usuarios u ON o.id_tecnico = u.id_usuario
    WHERE UPPER(COALESCE(o.estado, '')) LIKE '%FINALIZ%'
      AND u.id_usuario NOT IN (
        SELECT DISTINCT t2.id_usuario 
        FROM orden_liquidaciones ol2
        JOIN trabajadores t2 ON ol2.id_trabajador = t2.id_trabajador
        WHERE t2.id_usuario IS NOT NULL
      )
    GROUP BY u.id_usuario, tecnico, u.usuario
    ORDER BY finalizadas_sin_liquidar DESC
  `);
  console.table(nunca);

  console.log('\n--- 4. ULTIMOS 3 DIAS (30 SEPT, 01 OCT, 02 OCT) - QUIENES NO ESTAN LIQUIDANDO ---');
  const [ultimos3] = await pool.query(`
    SELECT 
      COALESCE(CONCAT(u.nombres, ' ', COALESCE(u.primer_apellido, '')), o.cuadrilla, 'Sin Asignar') as tecnico,
      COUNT(DISTINCT o.id_orden) as finalizadas_3dias,
      COUNT(DISTINCT ol.id_liquidacion) as liquidadas_3dias,
      (COUNT(DISTINCT o.id_orden) - COUNT(DISTINCT ol.id_liquidacion)) as pendientes_3dias,
      GROUP_CONCAT(DISTINCT CASE WHEN ol.id_liquidacion IS NULL THEN o.numero ELSE NULL END ORDER BY o.numero SEPARATOR ', ') as ots_pendientes
    FROM ordenes o
    LEFT JOIN usuarios u ON o.id_tecnico = u.id_usuario
    LEFT JOIN orden_liquidaciones ol ON o.id_orden = ol.id_orden
    WHERE o.fecha_visita >= '2026-09-30 00:00:00'
      AND UPPER(COALESCE(o.estado, '')) LIKE '%FINALIZ%'
    GROUP BY tecnico
    ORDER BY pendientes_3dias DESC, finalizadas_3dias DESC
  `);
  console.log('\n=== REPORTE DETALLADO EN JSON ===');
  console.log(JSON.stringify({
    resumen: minMax[0],
    ranking_liquidadores: ranking,
    nunca_han_liquidado: nunca,
    ultimos_3_dias: ultimos3
  }, null, 2));

  await pool.end();
}

run();
