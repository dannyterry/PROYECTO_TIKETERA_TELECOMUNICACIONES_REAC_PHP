const pool = require('./db');

async function run() {
  try {
    // 1. Eliminar pruebas anteriores
    await pool.query("DELETE FROM producto_series WHERE numero_serie LIKE 'TEST%'");
    await pool.query("DELETE FROM detalle_compras WHERE id_compra = 4");
    await pool.query("DELETE FROM compras WHERE id_compra = 4");
    await pool.query("DELETE FROM movimientos WHERE referencia LIKE '%Compra #4%'");
    await pool.query("UPDATE stock SET cantidad = 0 WHERE id_producto = 68 AND id_almacen = 1");
    await pool.query("DELETE FROM orden_equipos_retirados WHERE numero_serie LIKE 'TEST%'");
    console.log("✅ Pruebas anteriores eliminadas correctamente.");

    // 2. Registrar 2 equipos del MISMO modelo con su serie:
    // Modelo: ZTE-F670L (Producto: ONT ZTE, id 69, código ZTA)
    // Ambas unidades comparten el mismo ID DE MODELO (Product ID): "ZTE-F670L"
    // Cada una tiene su propio número de serie de fábrica único.

    const idProducto = 69; // ONT ZTE
    const idAlmacen = 1;
    const modeloId = "ZTE-F670L";
    const serie1 = "ZTEG12345678";
    const serie2 = "ZTEG12345679";

    // Registrar compra simulada
    const [compraRes] = await pool.query(`
      INSERT INTO compras (id_proveedor, id_almacen, tipo_comprobante, numero_comprobante, fecha, total, observaciones)
      VALUES (1, 1, 'Guia WIN', 'GR-WIN-2026-001', CURDATE(), 200.00, 'Ingreso de 2 ONTs del mismo modelo ZTE-F670L')
    `);
    const idCompra = compraRes.insertId;

    // Detalle de compra
    await pool.query(`
      INSERT INTO detalle_compras (id_compra, id_producto, cantidad, precio, subtotal, series_ingresadas)
      VALUES (?, ?, 2, 100.00, 200.00, ?)
    `, [idCompra, idProducto, `${serie1},${serie2}`]);

    // Movimiento
    await pool.query(`
      INSERT INTO movimientos (id_producto, id_almacen, tipo, cantidad, referencia, fecha_creacion)
      VALUES (?, ?, 'ENTRADA', 2, ?, NOW())
    `, [idProducto, idAlmacen, `Guía WIN #GR-WIN-2026-001 (Compra #${idCompra})`]);

    // Incrementar stock
    await pool.query(`
      INSERT INTO stock (id_producto, id_almacen, cantidad, cantidad_segundo_uso)
      VALUES (?, ?, 2, 0)
      ON DUPLICATE KEY UPDATE cantidad = cantidad + 2
    `, [idProducto, idAlmacen]);

    // Obtener último número correlativo para ZTA
    const [lastSerie] = await pool.query(
      "SELECT codigo_serie FROM producto_series WHERE id_producto = ? AND codigo_serie IS NOT NULL ORDER BY id_producto_serie DESC LIMIT 1",
      [idProducto]
    );
    let nextNum = 1;
    if (lastSerie.length > 0 && lastSerie[0].codigo_serie) {
      const m = lastSerie[0].codigo_serie.match(/-S(\d+)$/i);
      if (m) nextNum = parseInt(m[1], 10) + 1;
    }

    const codSerie1 = `ZTA-S${String(nextNum).padStart(3, '0')}`;
    nextNum++;
    const codSerie2 = `ZTA-S${String(nextNum).padStart(3, '0')}`;

    // Insertar las 2 series con el MISMO modeloId (PROID)
    await pool.query(`
      INSERT INTO producto_series (id_producto, id_almacen, codigo_serie, proid, numero_serie, estado, fecha_ingreso)
      VALUES (?, ?, ?, ?, ?, 'DISPONIBLE', NOW())
    `, [idProducto, idAlmacen, codSerie1, modeloId, serie1]);

    await pool.query(`
      INSERT INTO producto_series (id_producto, id_almacen, codigo_serie, proid, numero_serie, estado, fecha_ingreso)
      VALUES (?, ?, ?, ?, ?, 'DISPONIBLE', NOW())
    `, [idProducto, idAlmacen, codSerie2, modeloId, serie2]);

    console.log(`✅ Ingresados 2 equipos del modelo "${modeloId}":`);
    console.log(`   1. Serie: ${serie1} | Correlativo: ${codSerie1} | ID Modelo: ${modeloId}`);
    console.log(`   2. Serie: ${serie2} | Correlativo: ${codSerie2} | ID Modelo: ${modeloId}`);

    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

run();
