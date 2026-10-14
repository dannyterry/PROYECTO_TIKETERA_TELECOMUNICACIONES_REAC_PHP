const mysql = require('mysql2/promise');

(async () => {
  try {
    const prodPool = mysql.createPool({ 
      host: 'corporacioncespedes.com', 
      user: 'corporacioncespe_miguel', 
      password: 'corporacioncespe_123', 
      database: 'corporacioncespe_cespedes',
      connectTimeout: 10000 
    });
    
    const [rows] = await prodPool.query("SELECT COUNT(*) as total_ordenes FROM ordenes WHERE fecha_visita >= '2026-10-14'");
    const [statusCount] = await prodPool.query("SELECT estado, COUNT(*) as cant FROM ordenes WHERE fecha_visita >= '2026-10-14' GROUP BY estado");
    const [cacheStats] = await prodPool.query("SELECT COUNT(*) as total_cache, SUM(LENGTH(tareas_json))/(1024*1024) as mb_cache FROM orden_tareas_cache");
    const [base64Count] = await prodPool.query("SELECT COUNT(*) as ordenes_con_base64 FROM orden_tareas_cache WHERE tareas_json LIKE '%data:image%'");
    
    console.log('--- ESTADO EN PRODUCCIÓN ---');
    console.log('Total órdenes hoy:', rows[0].total_ordenes);
    console.table(statusCount);
    console.log('Cache de Tareas en Producción:', cacheStats[0].total_cache, 'registros, ocupando', Number(cacheStats[0].mb_cache).toFixed(2), 'MB');
    console.log('Registros con fotos Base64 pendientes de pasar a S3:', base64Count[0].ordenes_con_base64);
    
    prodPool.end();
  } catch (e) {
    console.error('Error prod:', e.message);
  }
})();
