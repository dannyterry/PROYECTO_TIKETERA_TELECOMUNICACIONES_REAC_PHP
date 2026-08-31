const db = require('./db');

async function checkFutureOrders() {
  try {
    const [rows] = await db.query(`
      SELECT 
        id_orden, numero, fecha_solicitud, fecha_visita, estado, YEAR(fecha_solicitud) as anio, MONTH(fecha_solicitud) as mes, DAY(fecha_solicitud) as dia
      FROM ordenes 
      WHERE MONTH(fecha_solicitud) >= 9 OR MONTH(fecha_visita) >= 9
      LIMIT 20
    `);

    console.log(`Total ordenes con mes >= 9 encontradas: ${rows.length}`);
    console.table(rows);

    const [grouped] = await db.query(`
      SELECT 
        YEAR(fecha_solicitud) as anio_sol, 
        MONTH(fecha_solicitud) as mes_sol, 
        COUNT(*) as total,
        MIN(fecha_solicitud) as min_fecha,
        MAX(fecha_solicitud) as max_fecha
      FROM ordenes
      GROUP BY YEAR(fecha_solicitud), MONTH(fecha_solicitud)
      ORDER BY anio_sol ASC, mes_sol ASC
    `);

    console.log('--- Distribución por Año y Mes de fecha_solicitud ---');
    console.table(grouped);

    const [groupedVisita] = await db.query(`
      SELECT 
        YEAR(fecha_visita) as anio_vis, 
        MONTH(fecha_visita) as mes_vis, 
        COUNT(*) as total,
        MIN(fecha_visita) as min_fecha,
        MAX(fecha_visita) as max_fecha
      FROM ordenes
      GROUP BY YEAR(fecha_visita), MONTH(fecha_visita)
      ORDER BY anio_vis ASC, mes_vis ASC
    `);

    console.log('--- Distribución por Año y Mes de fecha_visita ---');
    console.table(groupedVisita);

  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

checkFutureOrders();
