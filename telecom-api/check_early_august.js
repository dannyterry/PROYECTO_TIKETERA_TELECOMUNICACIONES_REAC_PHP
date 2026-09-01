const pool = require('./db.js');

async function main() {
  const [rows1] = await pool.query(
    "SELECT COUNT(*) as c FROM ordenes WHERE fecha_solicitud >= '2026-08-01' AND fecha_solicitud < '2026-08-08'"
  );
  console.log("Órdenes con fecha_solicitud entre 01/08 y 07/08:", rows1[0].c);

  const [rows2] = await pool.query(
    "SELECT COUNT(*) as c FROM ordenes WHERE fecha_creacion >= '2026-08-01' AND fecha_creacion < '2026-08-08'"
  );
  console.log("Órdenes con fecha_creacion entre 01/08 y 07/08:", rows2[0].c);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
