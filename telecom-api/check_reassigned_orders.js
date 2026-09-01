const pool = require('./db.js');

async function main() {
  const [r1] = await pool.query("SELECT * FROM ordenes WHERE numero = '3404398'");
  console.log("Orden 3404398:", r1[0]);

  const [r2] = await pool.query("SELECT * FROM ordenes WHERE numero = '3404111'");
  console.log("Orden 3404111:", r2[0]);

  process.exit(0);
}

main().catch(console.error);
