const db = require('./db');

async function checkOrdersDates() {
  const [rows] = await db.query(`
    SELECT 
      YEAR(fecha_visita) as anio, 
      MONTH(fecha_visita) as mes, 
      COUNT(*) as total,
      MIN(fecha_visita) as min_fecha,
      MAX(fecha_visita) as max_fecha
    FROM ordenes 
    GROUP BY YEAR(fecha_visita), MONTH(fecha_visita)
    ORDER BY anio DESC, mes DESC
  `);
  console.log('Distribución de fechas en órdenes:', rows);

  const [samples] = await db.query(`
    SELECT id_orden, numero, fecha_visita, fecha_creacion, estado 
    FROM ordenes 
    ORDER BY fecha_visita DESC 
    LIMIT 20
  `);
  console.log('Muestra de órdenes más recientes:', samples);

  process.exit();
}

checkOrdersDates().catch(err => {
  console.error(err);
  process.exit(1);
});
