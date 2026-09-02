const pool = require('./db.js');

async function updateExistingEquipment() {
  await pool.query("UPDATE productos SET codigo = 'ZTA001' WHERE id_producto = 37");
  await pool.query("UPDATE productos SET codigo = 'ZTB001' WHERE id_producto = 38");
  await pool.query("UPDATE productos SET codigo = 'WTA001' WHERE id_producto = 39");

  const [rows] = await pool.query("SELECT id_producto, codigo, nombre FROM productos WHERE id_producto IN (37, 38, 39)");
  console.log("Equipos actualizados con sus nuevos códigos elegantes:");
  console.table(rows);

  process.exit(0);
}

updateExistingEquipment().catch(console.error);
