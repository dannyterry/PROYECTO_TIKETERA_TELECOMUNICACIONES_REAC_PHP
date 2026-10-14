const mysql = require('mysql2/promise');

(async () => {
  const prodPool = mysql.createPool({ 
    host: 'corporacioncespedes.com', 
    user: 'corporacioncespe_miguel', 
    password: 'corporacioncespe_123', 
    database: 'corporacioncespe_cespedes',
    connectTimeout: 10000 
  });
  
  const [rows] = await prodPool.query(`
    SELECT 
      table_name, 
      ROUND(data_length/1024/1024, 2) as data_mb, 
      ROUND(index_length/1024/1024, 2) as index_mb, 
      ROUND(data_free/1024/1024, 2) as free_mb 
    FROM information_schema.tables 
    WHERE table_schema = 'corporacioncespe_cespedes' AND table_name = 'orden_tareas_cache'
  `);
  console.table(rows);
  
  prodPool.end();
})();
