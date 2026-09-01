const pool = require('./db.js');

async function main() {
  const [rows] = await pool.query(
    "SELECT DISTINCT DATE_FORMAT(fecha_visita, '%Y-%m-%d') as fVisita, COUNT(*) as c FROM ordenes WHERE fecha_creacion >= '2026-08-01' AND fecha_creacion < '2026-08-08' GROUP BY DATE_FORMAT(fecha_visita, '%Y-%m-%d') ORDER BY fVisita ASC"
  );
  console.log("Distribución de fecha_visita de esas 368 órdenes:", rows);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
