const pool = require('./db.js');

async function main() {
  const [rows] = await pool.query("SELECT COUNT(*) as total FROM ordenes WHERE fecha_visita >= '2026-09-01'");
  console.log("Total órdenes hoy en local:", rows[0].total);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
