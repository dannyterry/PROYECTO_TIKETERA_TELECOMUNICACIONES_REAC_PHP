const mysql = require('mysql2/promise');

async function auditRealDifferences() {
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
    WHERE p.id_producto IN (SELECT dc.id_producto FROM detalle_compras dc JOIN compras cmp ON dc.id_compra = cmp.id_compra WHERE cmp.estado != 'ANULADA')
       OR p.id_producto IN (SELECT id_producto FROM stock WHERE cantidad > 0)
    ORDER BY c.nombre, p.nombre
  `);

  const results = [];

  for (const p of prods) {
    const id = p.id_producto;

    // Compras ACTIVAS (excluyendo ANULADAS)
    const [compras] = await conn.execute(`
      SELECT COALESCE(SUM(dc.cantidad),0) as val 
      FROM detalle_compras dc
      JOIN compras c ON dc.id_compra = c.id_compra
      WHERE dc.id_producto = ? AND c.estado != 'ANULADA'
    `, [id]);
    const totalComprasActivas = Number(compras[0].val);

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

    const diferencia = totalComprasActivas - (stockCentral + stockCarros + stockLiquidado);

    // Obtener los movimientos de salida asignados a técnicos eliminados (#31, #66)
    const [movsHuerfanos] = await conn.execute(`
      SELECT id_movimiento, cantidad, referencia, fecha_creacion
      FROM movimientos
      WHERE id_producto = ? AND tipo = 'SALIDA' 
        AND (referencia LIKE '%#31%' OR referencia LIKE '%#66%')
    `, [id]);

    const cantHuerfana = movsHuerfanos.reduce((sum, m) => sum + Number(m.cantidad), 0);

    if (diferencia !== 0 || totalComprasActivas > 0) {
      results.push({
        id,
        codigo: p.codigo,
        nombre: p.nombre,
        categoria: p.categoria,
        serial: p.maneja_serie ? 'SÍ' : 'NO',
        comprasActivas: totalComprasActivas,
        central: stockCentral,
        carros: stockCarros,
        liquidado: stockLiquidado,
        totalExistente: stockCentral + stockCarros + stockLiquidado,
        diferencia,
        salidasHuerfanas31_66: cantHuerfana,
        detalleHuerfanos: movsHuerfanos.map(m => `Mov #${m.id_movimiento}: ${m.cantidad} und`).join(', ')
      });
    }
  }

  console.log(`\n=== TABLA COMPARATIVA CON COMPRAS ACTIVAS (EXCLUYENDO ANULACIONES) ===`);
  const discrepancias = results.filter(r => r.diferencia !== 0);
  console.table(discrepancias.map(r => ({
    Código: r.codigo,
    Producto: r.nombre.slice(0, 24),
    'Compras Activas': r.comprasActivas,
    'Stock Central': r.central,
    'En Carros': r.carros,
    'Liquidado': r.liquidado,
    'Total Contabilizado': r.totalExistente,
    'Diferencia Exacta': r.diferencia,
    'Salidas (#31 y #66)': r.salidasHuerfanas31_66,
    'Detalle Movimientos': r.detalleHuerfanos || 'N/A'
  })));

  await conn.end();
}

auditRealDifferences().catch(console.error);
