const mysql = require('mysql2/promise');

async function inspectDifferences() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  const [productos] = await conn.execute(`
    SELECT 
      p.id_producto,
      p.codigo,
      p.nombre,
      p.maneja_serie,
      c.nombre AS categoria
    FROM productos p
    LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
    ORDER BY c.nombre ASC, p.nombre ASC
  `);

  const results = [];

  for (const prod of productos) {
    const id = prod.id_producto;

    // Compras
    const [compras] = await conn.execute(`
      SELECT COALESCE(SUM(cantidad), 0) AS total_compras
      FROM detalle_compras
      WHERE id_producto = ?
    `, [id]);
    const totalCompras = Number(compras[0].total_compras || 0);

    // Stock Central
    let stockCentral = 0;
    if (prod.maneja_serie === 1) {
      const [seriesDisp] = await conn.execute(`
        SELECT COUNT(*) AS total FROM producto_series WHERE id_producto = ? AND estado = 'DISPONIBLE'
      `, [id]);
      stockCentral = Number(seriesDisp[0].total || 0);
    } else {
      const [stk] = await conn.execute(`
        SELECT COALESCE(SUM(cantidad), 0) AS total FROM stock WHERE id_producto = ? AND (id_almacen = 1 OR id_almacen IS NULL)
      `, [id]);
      stockCentral = Number(stk[0].total || 0);
    }

    // Stock Carros
    let stockCarros = 0;
    if (prod.maneja_serie === 1) {
      const [seriesAsig] = await conn.execute(`
        SELECT COUNT(*) AS total FROM trabajador_series WHERE id_producto = ? AND estado = 'Asignada'
      `, [id]);
      stockCarros = Number(seriesAsig[0].total || 0);
    } else {
      const [stkCarros] = await conn.execute(`
        SELECT COALESCE(SUM(stock), 0) AS total FROM trabajador_productos WHERE id_producto = ?
      `, [id]);
      stockCarros = Number(stkCarros[0].total || 0);
    }

    // Liquidado en Órdenes
    let totalLiquidado = 0;
    if (prod.maneja_serie === 1) {
      const [seriesLiq] = await conn.execute(`
        SELECT COUNT(*) AS total FROM trabajador_series WHERE id_producto = ? AND estado IN ('Usada', 'Liquidada')
      `, [id]);
      totalLiquidado = Number(seriesLiq[0].total || 0);
    } else {
      const [liq] = await conn.execute(`
        SELECT COALESCE(SUM(cantidad), 0) AS total FROM orden_liquidacion_detalle WHERE id_producto = ?
      `, [id]);
      totalLiquidado = Number(liq[0].total || 0);
    }

    // Despachos
    const [desp] = await conn.execute(`
      SELECT COALESCE(SUM(cantidad), 0) AS total FROM despacho_detalles WHERE id_producto = ?
    `, [id]);
    const totalDespachado = Number(desp[0].total || 0);

    // Salidas Kardex
    const [movSalidas] = await conn.execute(`
      SELECT COALESCE(SUM(cantidad), 0) AS total FROM movimientos WHERE id_producto = ? AND tipo = 'SALIDA'
    `, [id]);
    const totalSalidasKardex = Number(movSalidas[0].total || 0);

    const totalEmpresa = stockCentral + stockCarros;
    const balanceCompras = totalCompras - (totalEmpresa + totalLiquidado);
    const desfaseDespachos = totalSalidasKardex - totalDespachado;

    // Guardar si hay compras o stock
    if (totalCompras > 0 || totalEmpresa > 0 || totalLiquidado > 0) {
      results.push({
        id,
        codigo: prod.codigo,
        nombre: prod.nombre,
        categoria: prod.categoria,
        maneja_serie: prod.maneja_serie ? 'SÍ' : 'NO',
        compras: totalCompras,
        central: stockCentral,
        carros: stockCarros,
        total_empresa: totalEmpresa,
        liquidado: totalLiquidado,
        despachos_tabla: totalDespachado,
        salidas_kardex: totalSalidasKardex,
        desfase_despachos: desfaseDespachos,
        diferencia_compras: balanceCompras
      });
    }
  }

  console.log('=== PRODUCTOS CON COMPRAS O STOCK (DETALLE COMPLETO) ===');
  console.table(results.map(r => ({
    Código: r.codigo,
    Producto: r.nombre.slice(0, 28),
    Categoría: r.categoria,
    Serial: r.maneja_serie,
    'Compras (Facturas)': r.compras,
    'Stock Central': r.central,
    'En Carros': r.carros,
    'Total Empresa': r.total_empresa,
    'Liquidado Clientes': r.liquidado,
    'Despachos Tabla': r.despachos_tabla,
    'Salidas Kardex': r.salidas_kardex,
    'Desfase Salidas': r.desfase_despachos,
    'Dif Compras': r.diferencia_compras
  })));

  await conn.end();
}

inspectDifferences().catch(console.error);
