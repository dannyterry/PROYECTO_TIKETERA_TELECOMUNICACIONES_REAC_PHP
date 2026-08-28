const db = require('./db');

async function cleanLegacyProducts() {
  console.log('--- 🧹 INICIANDO LIMPIEZA DE PRODUCTOS OBSOLETOS / DUPLICADOS ---');

  // IDs candidatos para limpieza (Gas, Genéricos antiguos y duplicados con stock 0)
  const legacyIds = [1, 2, 3, 4, 5, 14, 15, 22, 23, 24, 25];

  for (const id of legacyIds) {
    const [p] = await db.query('SELECT id_producto, codigo, nombre FROM productos WHERE id_producto = ?', [id]);
    if (p.length === 0) continue;

    const prod = p[0];

    // Verificar si tiene stock en almacén central
    const [stockCentral] = await db.query('SELECT cantidad FROM stock WHERE id_producto = ?', [id]);
    const cantCentral = stockCentral[0]?.cantidad || 0;

    // Verificar si tiene stock en técnicos
    const [stockTec] = await db.query('SELECT SUM(stock) as total FROM trabajador_productos WHERE id_producto = ?', [id]);
    const cantTec = stockTec[0]?.total || 0;

    // Verificar si tiene series registradas
    const [series] = await db.query('SELECT COUNT(*) as total FROM producto_series WHERE id_producto = ?', [id]);
    const cantSeries = series[0]?.total || 0;

    // Verificar si tiene liquidaciones asociadas
    const [liqDet] = await db.query('SELECT COUNT(*) as total FROM orden_liquidacion_detalle WHERE id_producto = ?', [id]);
    const cantLiq = liqDet[0]?.total || 0;

    console.log(`Producto ID ${id}: "${prod.nombre}" (${prod.codigo}) -> Central: ${cantCentral}, Tec: ${cantTec}, Series: ${cantSeries}, Liq: ${cantLiq}`);

    if (cantCentral === 0 && cantTec === 0 && cantSeries === 0 && cantLiq === 0) {
      // Eliminar referencias de pruebas en detalle_compras y movimientos
      await db.query('DELETE FROM detalle_compras WHERE id_producto = ?', [id]);
      await db.query('DELETE FROM movimientos WHERE id_producto = ?', [id]);
      // Eliminar de stock si existe fila en 0
      await db.query('DELETE FROM stock WHERE id_producto = ?', [id]);
      // Eliminar de trabajador_productos si existe fila en 0
      await db.query('DELETE FROM trabajador_productos WHERE id_producto = ?', [id]);
      // Eliminar producto
      await db.query('DELETE FROM productos WHERE id_producto = ?', [id]);
      console.log(`   ✅ Eliminado con éxito: "${prod.nombre}" (ID: ${id})`);
    } else {
      console.log(`   ⚠️ NO se elimina ID ${id} porque tiene datos activos.`);
    }
  }

  // Verificar catálogo resultante
  const [prodsRestantes] = await db.query(`
    SELECT p.id_producto, p.codigo, p.nombre, c.nombre as categoria,
           COALESCE(s.cantidad, 0) as stock_central,
           (SELECT COALESCE(SUM(stock), 0) FROM trabajador_productos WHERE id_producto = p.id_producto) as stock_tecnicos
    FROM productos p
    LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
    LEFT JOIN stock s ON p.id_producto = s.id_producto AND s.id_almacen = 1
    ORDER BY c.nombre ASC, p.nombre ASC
  `);

  console.log(`\n🎉 Catálogo de productos 100% limpio y saneado. Total productos activos: ${prodsRestantes.length}`);
  console.table(prodsRestantes);

  process.exit();
}

cleanLegacyProducts().catch(err => {
  console.error('Error durante limpieza:', err);
  process.exit(1);
});
