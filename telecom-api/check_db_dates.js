const pool = require('./db.js');

async function main() {
  const [rows] = await pool.query(
    "SELECT DISTINCT DATE_FORMAT(fecha_visita, '%Y-%m-%d') as fecha, COUNT(*) as count FROM ordenes WHERE fecha_visita >= '2026-08-01' AND fecha_visita <= '2026-08-20 23:59:59' GROUP BY DATE_FORMAT(fecha_visita, '%Y-%m-%d') ORDER BY fecha ASC"
  );
  console.log("Fechas existentes en la BD entre 01/08 y 20/08:", rows);

  const [minMax] = await pool.query(
    "SELECT MIN(fecha_visita) as minF, MAX(fecha_visita) as maxF, COUNT(*) as total FROM ordenes"
  );
  console.log("Rango total en BD:", minMax);

  // Ver si hay órdenes antes del 06 de agosto
  const [antes] = await pool.query(
    "SELECT DISTINCT DATE_FORMAT(fecha_visita, '%Y-%m-%d') as fecha, COUNT(*) as count FROM ordenes WHERE fecha_visita < '2026-08-06' GROUP BY DATE_FORMAT(fecha_visita, '%Y-%m-%d') ORDER BY fecha ASC"
  );
  console.log("Fechas antes del 06 de agosto en BD:", antes);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
