const mysql = require('mysql2/promise');

async function auditTempladores() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  console.log('================================================================');
  console.log('🔍 AUDITORÍA DE TEMPLADORES (MAT-TEM)');
  console.log('================================================================\n');

  // 1. Producto Info
  const [prods] = await conn.execute(`
    SELECT * FROM productos WHERE codigo = 'MAT-TEM' OR nombre LIKE '%TEMPLADOR%'
  `);
  console.log('PRODUCTO:');
  console.table(prods);

  if (prods.length === 0) return await conn.end();
  const idProd = prods[0].id_producto;

  // 2. Stock en Almacén Central (tabla stock)
  const [stock] = await conn.execute(`
    SELECT * FROM stock WHERE id_producto = ?
  `, [idProd]);
  console.log('\nTABLA STOCK (ALMACÉN CENTRAL):');
  console.table(stock);

  // 3. Compras registradas
  const [compras] = await conn.execute(`
    SELECT dc.*
    FROM detalle_compras dc
    WHERE dc.id_producto = ?
  `, [idProd]);
  console.log('\nCOMPRAS REGISTRADAS (detalle_compras):');
  console.table(compras);

  // 4. Despachos a técnicos
  const [despachos] = await conn.execute(`
    SELECT dd.*,
           d.codigo_despacho, d.fecha_despacho, d.id_trabajador,
           CONCAT(u.nombres, ' ', COALESCE(u.primer_apellido, '')) as tecnico
    FROM despacho_detalles dd
    JOIN despachos d ON dd.id_despacho = d.id_despacho
    JOIN trabajadores t ON d.id_trabajador = t.id_trabajador
    JOIN usuarios u ON t.id_usuario = u.id_usuario
    WHERE dd.id_producto = ?
    ORDER BY d.fecha_despacho ASC
  `, [idProd]);
  console.log('\nDESPACHOS A TÉCNICOS:');
  console.table(despachos);

  // 5. Stock actual en carros de técnicos (trabajador_productos)
  const [stockTecnicos] = await conn.execute(`
    SELECT tp.id_trabajador, tp.id_producto, tp.stock,
           CONCAT(u.nombres, ' ', COALESCE(u.primer_apellido, '')) as tecnico
    FROM trabajador_productos tp
    JOIN trabajadores t ON tp.id_trabajador = t.id_trabajador
    JOIN usuarios u ON t.id_usuario = u.id_usuario
    WHERE tp.id_producto = ? AND tp.stock > 0
  `, [idProd]);
  console.log('\nSTOCK ACTUAL EN CARROS (trabajador_productos):');
  console.table(stockTecnicos);

  // 6. Consumo en Liquidaciones de Órdenes (orden_liquidacion_detalle)
  const [liquidaciones] = await conn.execute(`
    SELECT old.*,
           ol.id_orden, o.numero as numero_orden, ol.fecha_liquidacion,
           CONCAT(u.nombres, ' ', COALESCE(u.primer_apellido, '')) as tecnico
    FROM orden_liquidacion_detalle old
    JOIN orden_liquidaciones ol ON old.id_liquidacion = ol.id_liquidacion
    LEFT JOIN ordenes o ON ol.id_orden = o.id_orden
    JOIN trabajadores t ON ol.id_trabajador = t.id_trabajador
    JOIN usuarios u ON t.id_usuario = u.id_usuario
    WHERE old.id_producto = ?
    ORDER BY ol.fecha_liquidacion ASC
  `, [idProd]);
  console.log('\nCONSUMO EN LIQUIDACIONES DE ÓRDENES:');
  console.table(liquidaciones);

  // 7. Devoluciones a Almacén
  const [devoluciones] = await conn.execute(`
    SELECT m.id_movimiento, m.tipo, m.cantidad, m.referencia, m.fecha_creacion
    FROM movimientos m
    WHERE m.id_producto = ? AND m.tipo = 'ENTRADA' AND m.referencia LIKE '%Devoluci%'
  `, [idProd]);
  console.log('\nDEVOLUCIONES A ALMACÉN CENTRAL:');
  console.table(devoluciones);

  // Totales
  const totalCompras = compras.reduce((acc, c) => acc + Number(c.cantidad), 0);
  const totalDespachado = despachos.reduce((acc, d) => acc + Number(d.cantidad), 0);
  const totalEnCarros = stockTecnicos.reduce((acc, s) => acc + Number(s.stock), 0);
  const totalLiquidado = liquidaciones.reduce((acc, l) => acc + Number(l.cantidad), 0);
  const stockCentral = stock.reduce((acc, s) => acc + Number(s.cantidad), 0);
  const totalDevoluciones = devoluciones.reduce((acc, d) => acc + Number(d.cantidad), 0);

  console.log('\n================================================================');
  console.log('📊 RESUMEN MATEMÁTICO:');
  console.log(`1. Total Comprado (Entradas Factura):  ${totalCompras} und`);
  console.log(`2. Total Despachado a Camionetas:     ${totalDespachado} und`);
  console.log(`3. Total Devuelto a Almacén Central:  ${totalDevoluciones} und`);
  console.log(`4. Stock Actual en Almacén Central:   ${stockCentral} und`);
  console.log(`   (Cálculo Central: Compras ${totalCompras} - Despachos ${totalDespachado} + Devoluciones ${totalDevoluciones} = ${totalCompras - totalDespachado + totalDevoluciones})`);
  console.log(`5. Stock Actual en Camionetas/Carros: ${totalEnCarros} und`);
  console.log(`6. Total Gastado/Liquidado en Órdenes:${totalLiquidado} und`);
  console.log(`----------------------------------------------------------------`);
  console.log(`7. STOCK TOTAL EXISTENTE EN LA EMPRESA (Central + Carros):`);
  console.log(`   ${stockCentral} (Almacén Central) + ${totalEnCarros} (En Camionetas) = ${stockCentral + totalEnCarros} und`);
  console.log(`8. EXPLICACIÓN DE LA DIFERENCIA (${totalCompras} Comprados vs ${stockCentral + totalEnCarros} Stock Empresa):`);
  console.log(`   ${totalCompras} - ${stockCentral + totalEnCarros} = ${totalCompras - (stockCentral + totalEnCarros)} unidades`);
  console.log(`   -> ${totalLiquidado} unidades fueron CONSUMIDAS/GASTADAS en órdenes liquidadas de clientes instalados.`);
  console.log(`   -> ${totalCompras - (stockCentral + totalEnCarros) - totalLiquidado} unidades de diferencia por ajustes.`);
  console.log('================================================================');

  await conn.end();
}

auditTempladores().catch(console.error);
