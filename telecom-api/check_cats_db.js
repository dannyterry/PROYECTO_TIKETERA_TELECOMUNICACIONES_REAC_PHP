const pool = require('./db.js');

async function checkCategories() {
  const [cats] = await pool.query("SELECT id_categoria, nombre FROM categorias ORDER BY id_categoria ASC");
  console.log("Categorías existentes en DB:");
  console.table(cats);
  process.exit(0);
}

checkCategories().catch(console.error);
