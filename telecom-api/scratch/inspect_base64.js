const mysql = require('mysql2/promise');

(async () => {
  const pool = mysql.createPool({ 
    host: 'corporacioncespedes.com', 
    user: 'corporacioncespe_miguel', 
    password: 'corporacioncespe_123', 
    database: 'corporacioncespe_cespedes',
    connectTimeout: 10000 
  });
  
  const [rows] = await pool.query(`
    SELECT 
      numero_orden, 
      ROUND(OCTET_LENGTH(tareas_json)/1024, 1) as kb, 
      SUBSTRING(tareas_json, LOCATE('base64', tareas_json) - 20, 80) as snippet 
    FROM orden_tareas_cache 
    WHERE tareas_json LIKE '%base64%' 
    LIMIT 3
  `);
  
  console.table(rows);
  pool.end();
})();
