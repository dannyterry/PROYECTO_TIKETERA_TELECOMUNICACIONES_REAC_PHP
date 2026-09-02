const pool = require('./db.js');

async function listProducts() {
  const [rows] = await pool.query(
    "SELECT id_producto, codigo, nombre, id_categoria, categoria_liquidar, maneja_serie, es_drop FROM productos ORDER BY id_producto ASC"
  );
  console.log("Total productos en DB:", rows.length);
  console.table(rows);
  process.exit(0);
}

listProducts().catch(console.error);
