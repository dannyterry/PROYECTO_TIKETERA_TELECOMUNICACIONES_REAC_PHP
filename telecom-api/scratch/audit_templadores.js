const mysql = require('mysql2/promise');

async function auditTempladoresStock() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  console.log('================================================================');
  console.log('🔍 AUDITORÍA COMPLETA DE TEMPLADORES (ID PRODUCTO: 49)');
  console.log('================================================================\n');

  // 1. Stock actual en Almacén Central
  const [stockCentral] = await conn.query(`
    SELECT s.*, p.nombre, p.codigo
    FROM stock s
    JOIN productos p ON s.id_producto = p.id_producto
    WHERE s.id_producto = 49
  `);
  console.log('🏢 1. STOCK EN ALMACÉN CENTRAL:');
  console.table(stockCentral);

  // 2. Stock en TODOS los técnicos (trabajador_productos)
  const [stockTecnicos] = await conn.query(`
    SELECT tp.id_trabajador, u.nombres, u.primer_apellido, tp.stock, tp.fecha_creacion, tp.fecha_actualizacion
    FROM trabajador_productos tp
    JOIN trabajadores t ON tp.id_trabajador = t.id_trabajador
    JOIN usuarios u ON t.id_usuario = u.id_usuario
    WHERE tp.id_producto = 49 AND tp.stock > 0
  `);
  console.log('\n🚚 2. STOCK EN TODOS LOS TÉCNICOS:');
  console.table(stockTecnicos);

  // 3. Todos los despachos registrados de Templadores
  const [todosDespachos] = await conn.query(`
    SELECT d.id_despacho, d.codigo_despacho, d.id_trabajador, u.nombres, u.primer_apellido,
           d.fecha_despacho, dd.cantidad, d.observaciones
    FROM despachos d
    JOIN despacho_detalles dd ON d.id_despacho = dd.id_despacho
    JOIN trabajadores t ON d.id_trabajador = t.id_trabajador
    JOIN usuarios u ON t.id_usuario = u.id_usuario
    WHERE dd.id_producto = 49
    ORDER BY d.fecha_despacho ASC
  `);
  console.log('\n📦 3. TODOS LOS DESPACHOS DE TEMPLADORES:');
  console.table(todosDespachos);

  // 4. Detalle de compras
  const [compras] = await conn.query(`
    SELECT dc.* FROM detalle_compras dc WHERE dc.id_producto = 49
  `);
  console.log('\n🛒 4. ENTRADAS / COMPRAS DE TEMPLADORES:');
  console.table(compras);

  // 5. Todos los movimientos de Kardex para Templadores
  const [movs] = await conn.query(`
    SELECT m.*
    FROM movimientos m
    WHERE m.id_producto = 49
    ORDER BY m.id_movimiento ASC
  `);
  console.log('\n📜 5. KARDEX / MOVIMIENTOS DE TEMPLADORES:');
  console.table(movs);

  // 6. Liquidaciones en órdenes de todos los técnicos para Templadores
  const [liqTotal] = await conn.query(`
    SELECT ol.id_liquidacion, ol.id_orden, o.numero AS orden_num, ol.id_trabajador, u.nombres, u.primer_apellido,
           old.cantidad, ol.fecha_liquidacion
    FROM orden_liquidaciones ol
    JOIN orden_liquidacion_detalle old ON ol.id_liquidacion = old.id_liquidacion
    JOIN trabajadores t ON ol.id_trabajador = t.id_trabajador
    JOIN usuarios u ON t.id_usuario = u.id_usuario
    LEFT JOIN ordenes o ON ol.id_orden = o.id_orden
    WHERE old.id_producto = 49
  `);
  console.log('\n📝 6. LIQUIDACIONES EN ÓRDENES (CONSUMO):');
  console.table(liqTotal);

  await conn.end();
}

auditTempladoresStock().catch(console.error);
