const mysql = require('mysql2/promise');

async function auditAllInventory() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  console.log('================================================================');
  console.log('🔍 AUDITORÍA INTEGRAL DE TODO EL INVENTARIO: COMPRAS VS STOCK VS CARROS VS LIQUIDACIONES');
  console.log('================================================================\n');

  // 1. Obtener todos los productos y categorías
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

  const report = [];

  for (const prod of productos) {
    const id = prod.id_producto;

    // A. Compras
    const [compras] = await conn.execute(`
      SELECT COALESCE(SUM(cantidad), 0) AS total_compras
      FROM detalle_compras
      WHERE id_producto = ?
    `, [id]);
    const totalCompras = Number(compras[0].total_compras || 0);

    // B. Movimientos de ENTRADA (por si hubo ingresos manuales no registrados en detalle_compras)
    const [movEntradas] = await conn.execute(`
      SELECT COALESCE(SUM(cantidad), 0) AS total_entradas_mov
      FROM movimientos
      WHERE id_producto = ? AND tipo = 'ENTRADA'
    `, [id]);
    const totalEntradasMov = Number(movEntradas[0].total_entradas_mov || 0);

    // C. Stock Almacén Central
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

    // D. Stock en Carros / Camionetas
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

    // E. Total Liquidado / Gastado en Órdenes de Clientes
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

    // F. Despachos Históricos registrados en despachos
    const [desp] = await conn.execute(`
      SELECT COALESCE(SUM(cantidad), 0) AS total FROM despacho_detalles WHERE id_producto = ?
    `, [id]);
    const totalDespachado = Number(desp[0].total || 0);

    // G. Movimientos de Salida en Kardex
    const [movSalidas] = await conn.execute(`
      SELECT COALESCE(SUM(cantidad), 0) AS total FROM movimientos WHERE id_producto = ? AND tipo = 'SALIDA'
    `, [id]);
    const totalSalidasKardex = Number(movSalidas[0].total || 0);

    // H. Devoluciones a Almacén
    const [devs] = await conn.execute(`
      SELECT COALESCE(SUM(cantidad), 0) AS total 
      FROM movimientos 
      WHERE id_producto = ? AND tipo = 'ENTRADA' AND (referencia LIKE '%Devoluci%' OR referencia LIKE '%Retorno%')
    `, [id]);
    const totalDevoluciones = Number(devs[0].total || 0);

    const totalEmpresa = stockCentral + stockCarros;
    const balanceTotal = totalCompras - (totalEmpresa + totalLiquidado);
    const diferenciaDespachos = totalSalidasKardex - totalDespachado;

    // Solo incluir si tiene movimientos o compras o stock
    if (totalCompras > 0 || totalEmpresa > 0 || totalLiquidado > 0 || totalDespachado > 0 || totalSalidasKardex > 0) {
      report.push({
        id,
        codigo: prod.codigo,
        nombre: prod.nombre,
        categoria: prod.categoria || 'Sin Categoría',
        maneja_serie: prod.maneja_serie ? 'SÍ (Serializado)' : 'NO (Granel/Unid)',
        comprado: totalCompras,
        stock_central: stockCentral,
        stock_carros: stockCarros,
        total_empresa: totalEmpresa,
        liquidado_ordenes: totalLiquidado,
        total_despachado_activo: totalDespachado,
        salidas_kardex: totalSalidasKardex,
        desfase_despachos_kardex: diferenciaDespachos,
        cuadre_compras: balanceTotal === 0 ? '✅ CUADRADO' : `⚠️ DIFERENCIA (${balanceTotal > 0 ? '+' : ''}${balanceTotal})`,
        diferencia_numerica: balanceTotal
      });
    }
  }

  console.log(`TOTAL PRODUCTOS AUDITADOS CON ACTIVIDAD: ${report.length}\n`);

  // Mostrar los que tienen alguna diferencia
  const conDiferencias = report.filter(r => r.diferencia_numerica !== 0 || r.desfase_despachos_kardex !== 0);
  console.log(`⚠️ PRODUCTOS CON DESCUADRE O DIFERENCIA DE REGISTRO: ${conDiferencias.length}`);
  console.table(conDiferencias.map(r => ({
    Código: r.codigo,
    Producto: r.nombre.slice(0, 30),
    Categoría: r.categoria,
    Comprado: r.comprado,
    Central: r.stock_central,
    Carros: r.stock_carros,
    TotalEmpresa: r.total_empresa,
    Liquidado: r.liquidado_ordenes,
    DespachosActivos: r.total_despachado_activo,
    SalidasKardex: r.salidas_kardex,
    DesfaseKardex: r.desfase_despachos_kardex,
    Estado: r.cuadre_compras
  })));

  console.log('\n✅ PRODUCTOS 100% CUADRADOS:');
  const cuadrados = report.filter(r => r.diferencia_numerica === 0 && r.desfase_despachos_kardex === 0);
  console.table(cuadrados.map(r => ({
    Código: r.codigo,
    Producto: r.nombre.slice(0, 30),
    Categoría: r.categoria,
    Comprado: r.comprado,
    Central: r.stock_central,
    Carros: r.stock_carros,
    Liquidado: r.liquidado_ordenes,
    Estado: r.cuadre_compras
  })));

  await conn.end();
}

auditAllInventory().catch(console.error);
