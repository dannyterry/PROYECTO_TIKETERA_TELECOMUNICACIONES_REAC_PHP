const mysql = require('mysql2/promise');

async function auditDifferencesOnly() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  const [prods] = await conn.execute(`
    SELECT DISTINCT p.id_producto, p.codigo, p.nombre, p.maneja_serie, c.nombre as categoria
    FROM productos p
    LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
    WHERE p.id_producto IN (SELECT id_producto FROM detalle_compras)
       OR p.id_producto IN (SELECT id_producto FROM stock WHERE cantidad > 0)
    ORDER BY c.nombre, p.nombre
  `);

  const results = [];

  for (const p of prods) {
    const id = p.id_producto;

    const [compras] = await conn.execute(`SELECT COALESCE(SUM(cantidad),0) as val FROM detalle_compras WHERE id_producto = ?`, [id]);
    const totalCompras = Number(compras[0].val);

    let stockCentral = 0;
    if (p.maneja_serie) {
      const [s] = await conn.execute(`SELECT COUNT(*) as val FROM producto_series WHERE id_producto = ? AND estado = 'DISPONIBLE'`, [id]);
      stockCentral = Number(s[0].val);
    } else {
      const [s] = await conn.execute(`SELECT COALESCE(SUM(cantidad),0) as val FROM stock WHERE id_producto = ? AND (id_almacen = 1 OR id_almacen IS NULL)`, [id]);
      stockCentral = Number(s[0].val);
    }

    let stockCarros = 0;
    if (p.maneja_serie) {
      const [s] = await conn.execute(`SELECT COUNT(*) as val FROM trabajador_series WHERE id_producto = ? AND estado = 'Asignada'`, [id]);
      stockCarros = Number(s[0].val);
    } else {
      const [s] = await conn.execute(`SELECT COALESCE(SUM(stock),0) as val FROM trabajador_productos WHERE id_producto = ?`, [id]);
      stockCarros = Number(s[0].val);
    }

    let stockLiquidado = 0;
    if (p.maneja_serie) {
      const [s] = await conn.execute(`SELECT COUNT(*) as val FROM trabajador_series WHERE id_producto = ? AND estado IN ('Usada','Liquidada')`, [id]);
      stockLiquidado = Number(s[0].val);
    } else {
      const [s] = await conn.execute(`SELECT COALESCE(SUM(cantidad),0) as val FROM orden_liquidacion_detalle WHERE id_producto = ?`, [id]);
      stockLiquidado = Number(s[0].val);
    }

    const diferencia = totalCompras - (stockCentral + stockCarros + stockLiquidado);

    // Obtener los movimientos de salida específicos de este producto
    const [movs] = await conn.execute(`
      SELECT id_movimiento, tipo, cantidad, referencia, fecha_creacion
      FROM movimientos
      WHERE id_producto = ? AND tipo = 'SALIDA'
    `, [id]);

    if (diferencia !== 0) {
      results.push({
        id,
        codigo: p.codigo,
        nombre: p.nombre,
        categoria: p.categoria,
        serial: p.maneja_serie ? 'SÍ' : 'NO',
        compras: totalCompras,
        central: stockCentral,
        carros: stockCarros,
        liquidado: stockLiquidado,
        diferencia,
        movimientosSalida: movs
      });
    }
  }

  console.log(`\n=== PRODUCTOS CON DIFERENCIA EXACTA (TOTAL: ${results.length}) ===\n`);

  for (const r of results) {
    console.log(`--------------------------------------------------------------------------------`);
    console.log(`📦 [${r.codigo}] ${r.nombre} (${r.categoria}) | Serial: ${r.serial}`);
    console.log(`   Compras Factura: ${r.compras} | Central: ${r.central} | En Carros: ${r.carros} | Liquidado: ${r.liquidado}`);
    console.log(`   ⚠️ DIFERENCIA EN EL AIRE: ${r.diferencia}`);
    console.log(`   📜 Movimientos de SALIDA en Kardex:`);
    if (r.movimientosSalida.length === 0) {
      console.log(`      (No hay movimientos de salida registrados)`);
    } else {
      for (const m of r.movimientosSalida) {
        console.log(`      • Mov #${m.id_movimiento} | Cant: ${m.cantidad} | Fecha: ${m.fecha_creacion.toISOString().slice(0, 19)} | Ref: "${m.referencia}"`);
      }
    }
  }

  await conn.end();
}

auditDifferencesOnly().catch(console.error);
