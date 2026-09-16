const mysql = require('mysql2/promise');

const localConfig = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: '',
  database: 'corporacioncespe_cespedes'
};

async function main() {
  const pool = mysql.createPool(localConfig);
  const [rows] = await pool.query(`
    SELECT 
      MONTH(fecha_visita) as mes,
      COUNT(*) as total_ordenes,
      SUM(CASE WHEN producto IS NULL OR TRIM(producto) = '' THEN 1 ELSE 0 END) as sin_producto,
      SUM(CASE WHEN producto LIKE '%POST%VENTA%' THEN 1 ELSE 0 END) as post_venta,
      SUM(CASE WHEN producto NOT LIKE '%POST%VENTA%' AND producto IS NOT NULL AND TRIM(producto) != '' THEN 1 ELSE 0 END) as otros_con_producto
    FROM ordenes
    WHERE YEAR(fecha_visita) = 2026
    GROUP BY MONTH(fecha_visita)
    ORDER BY mes ASC
  `);
  console.table(rows);
  await pool.end();
}

main().catch(console.error);
