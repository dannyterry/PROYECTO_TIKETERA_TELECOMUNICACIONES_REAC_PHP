const db = require('./db');

async function main() {
  const [prods] = await db.query("SELECT id_producto, codigo, nombre, id_categoria FROM productos WHERE nombre LIKE '%MESH%' OR codigo LIKE '%MESH%'");
  console.log('Productos Mesh:', prods);
  for (const prod of prods) {
    const prodId = prod.id_producto;
    const [stockRows] = await db.query('SELECT * FROM stock WHERE id_producto = ?', [prodId]);
    console.log(`Stock for ${prod.nombre} (ID ${prodId}):`, stockRows);

    const [seriesRows] = await db.query('SELECT numero_serie, estado, id_almacen FROM producto_series WHERE id_producto = ?', [prodId]);
    console.log(`Total series in DB for ID ${prodId}:`, seriesRows.length);
    console.log('Series list:', seriesRows.map(s => `${s.numero_serie} (${s.estado})`));

    const [tpRows] = await db.query('SELECT tp.*, ps.numero_serie FROM trabajador_series tp JOIN producto_series ps ON tp.id_producto_serie = ps.id_producto_serie WHERE tp.id_producto = ?', [prodId]);
    console.log('Trabajador series asignadas:', tpRows);
  }
  process.exit();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
