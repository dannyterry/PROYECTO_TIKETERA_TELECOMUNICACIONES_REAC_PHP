const db = require('./db');

async function listProds() {
  const [rows] = await db.query(`
    SELECT p.id_producto, p.codigo, p.nombre, p.maneja_serie, p.es_drop, c.nombre as categoria,
           COALESCE(s.cantidad, 0) as stock_central,
           (SELECT COALESCE(SUM(stock), 0) FROM trabajador_productos WHERE id_producto = p.id_producto) as stock_tecnicos
    FROM productos p
    LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
    LEFT JOIN stock s ON p.id_producto = s.id_producto AND s.id_almacen = 1
    ORDER BY c.nombre ASC, p.id_producto ASC
  `);
  console.table(rows);
  process.exit();
}

listProds().catch(err => {
  console.error(err);
  process.exit(1);
});
