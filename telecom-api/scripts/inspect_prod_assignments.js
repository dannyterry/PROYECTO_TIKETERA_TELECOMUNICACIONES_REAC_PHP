const mysql = require('mysql2/promise');

const prodConfig = {
  host: 'corporacioncespedes.com',
  user: 'corporacioncespe_miguel',
  password: 'corporacioncespe_123',
  database: 'corporacioncespe_cespedes',
};

async function run() {
  const conn = await mysql.createConnection(prodConfig);
  console.log("✅ Conectado a BD Producción (corporacioncespedes.com)");

  const [techs] = await conn.query(`
    SELECT 
      t.id_trabajador,
      u.usuario,
      CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.apellidos, '')) AS nombre,
      (SELECT COUNT(*) FROM trabajador_productos WHERE id_trabajador = t.id_trabajador) AS total_materiales_asignados,
      (SELECT COALESCE(SUM(stock), 0) FROM trabajador_productos WHERE id_trabajador = t.id_trabajador) AS cantidad_total_materiales,
      (SELECT COUNT(*) FROM trabajador_series WHERE id_trabajador = t.id_trabajador) AS total_series_asignadas
    FROM trabajadores t
    LEFT JOIN usuarios u ON t.id_usuario = u.id_usuario
    HAVING total_materiales_asignados > 0 OR total_series_asignadas > 0
    ORDER BY total_series_asignadas DESC, total_materiales_asignados DESC
  `);

  console.log("\n📊 Resumen de Técnicos con Asignaciones en Producción:");
  console.table(techs);

  const [totales] = await conn.query(`
    SELECT 
      (SELECT COUNT(*) FROM trabajador_productos) as total_filas_materiales,
      (SELECT COUNT(*) FROM trabajador_series) as total_filas_series,
      (SELECT COUNT(*) FROM producto_series WHERE estado = 'Asignado' OR estado = 'En Técnico' OR estado = 'En Tecnico') as total_series_en_tecnico
  `);
  console.log("\n🔢 Totales globales en Producción:", totales[0]);

  await conn.end();
}

run().catch(console.error);
