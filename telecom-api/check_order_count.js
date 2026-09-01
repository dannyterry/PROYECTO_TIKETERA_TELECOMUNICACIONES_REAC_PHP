const pool = require('./db.js');

async function main() {
  const [rows] = await pool.query("SELECT COUNT(*) as total FROM ordenes WHERE fecha_visita >= '2026-09-01'");
  console.log("Total órdenes hoy en local:", rows[0].total);

  const [found] = await pool.query("SELECT numero, cliente, fecha_estado FROM ordenes WHERE numero = '3403615'");
  console.log("Orden 3403615 (la número 28):", found);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
