const mysql = require('mysql2/promise');

const localConfig = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: '',
  database: 'corporacioncespe_cespedes'
};

async function inspectProducto() {
  const pool = mysql.createPool(localConfig);
  
  console.log("📊 1. Distribución de columna `producto` en tabla `ordenes` (Local):");
  const [distrib] = await pool.query(`
    SELECT COALESCE(producto, '[NULL/VACIO]') as prod, COUNT(*) as total
    FROM ordenes
    GROUP BY producto
    ORDER BY total DESC
  `);
  console.table(distrib);

  console.log("\n📊 2. Distribución de `producto` por MES en el año 2026:");
  const [porMes] = await pool.query(`
    SELECT 
      MONTH(fecha_visita) as mes,
      COUNT(*) as total_ordenes,
      SUM(CASE WHEN producto IS NULL OR producto = '' THEN 1 ELSE 0 END) as sin_producto,
      SUM(CASE WHEN producto LIKE '%POST%VENTA%' THEN 1 ELSE 0 END) as post_venta,
      SUM(CASE WHEN producto LIKE '%AVERIA%' OR producto LIKE '%INTERNET%' THEN 1 ELSE 0 END) as averias_u_otros,
      GROUP_CONCAT(DISTINCT producto SEPARATOR ' | ') as valores_distintos
    FROM ordenes
    WHERE YEAR(fecha_visita) = 2026
    GROUP BY MONTH(fecha_visita)
    ORDER BY mes ASC
  `);
  console.table(porMes);

  console.log("\n📊 3. Revisar columnas que contienen datos de Fénix (tipo_orden, tipo_trabajo, etc.):");
  const [muestra] = await pool.query(`
    SELECT numero, fecha_visita, producto, tipo_orden, tipo_trabajo, motivo_trabajo, motivo_finalizacion, estado
    FROM ordenes
    WHERE YEAR(fecha_visita) = 2026 AND MONTH(fecha_visita) IN (4, 5, 6, 7)
    LIMIT 10
  `);
  console.table(muestra);

  await pool.end();
}

inspectProducto().catch(console.error);
