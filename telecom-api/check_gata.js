const mysql = require('mysql2/promise');

const REMOTE_CONFIG = {
  host: 'corporacioncespedes.com',
  user: 'corporacioncespe_miguel',
  password: 'corporacioncespe_123',
  database: 'corporacioncespe_cespedes',
  dateStrings: true
};

async function checkGataDetails() {
  const remote = mysql.createPool(REMOTE_CONFIG);

  console.log('=== PRODUCTOS GATA (85 y 86) ===');
  const [prods] = await remote.query("SELECT * FROM productos WHERE id_producto IN (85, 86)");
  console.table(prods);

  console.log('=== ASIGNACIONES EN TRABAJADOR_PRODUCTOS ===');
  const [tp] = await remote.query(`
    SELECT tp.id_trabajador_producto, tp.id_trabajador, tp.id_producto, p.nombre, p.codigo, tp.stock, tp.fecha_creacion,
           t.id_usuario, u.nombres, u.primer_apellido, u.apellidos
    FROM trabajador_productos tp
    JOIN productos p ON tp.id_producto = p.id_producto
    LEFT JOIN trabajadores t ON tp.id_trabajador = t.id_trabajador
    LEFT JOIN usuarios u ON t.id_usuario = u.id_usuario
    WHERE tp.id_producto IN (85, 86)
    ORDER BY tp.id_trabajador_producto DESC
  `);
  console.table(tp);

  // Ver dónde se guarda el stock de almacén (entradas, compras, stocks, etc.)
  const [tablas] = await remote.query("SHOW TABLES");
  console.log('=== TABLAS EN BD ===');
  console.log(tablas.map(t => Object.values(t)[0]).join(', '));

  // Ver detalles de despachos / movimientos
  for (let tabla of ['despachos', 'despacho_detalles', 'movimientos_inventario', 'entradas_producto', 'compras_detalles', 'inventario', 'stock_almacen']) {
    try {
      const [rows] = await remote.query(`SELECT * FROM ${tabla} WHERE id_producto IN (85, 86) LIMIT 10`);
      console.log(`\n=== REGISTROS EN TABLA ${tabla} ===`);
      console.table(rows);
    } catch(e) {}
  }

  process.exit();
}

checkGataDetails().catch(e => { console.error(e); process.exit(1); });
