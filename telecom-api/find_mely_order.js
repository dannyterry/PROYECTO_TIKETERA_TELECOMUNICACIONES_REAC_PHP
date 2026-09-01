const pool = require('./db.js');

async function main() {
  const [rows] = await pool.query(
    "SELECT * FROM ordenes WHERE cliente LIKE '%VALVIN%' OR cliente LIKE '%MELY%' OR numero = '3404111'"
  );

  console.log("📌 Registro completo de la orden de MELY GIOVANA VALVIN LAZARO en la Base de Datos:");
  console.log(JSON.stringify(rows, null, 2));

  process.exit(0);
}

main().catch(console.error);
