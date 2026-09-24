const mysql = require('mysql2/promise');

async function checkTempladores() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  console.log('================================================================');
  console.log('🔍 ANÁLISIS EXCLUSIVO: TEMPLADORES EN WIL NELSON CARHUAZ (ID 64)');
  console.log('================================================================\n');

  // 1. Despachos recibidos de Templadores
  console.log('📦 1. DESPACHOS RECIBIDOS (Total Entregado / Asignado):');
  const [despachos] = await conn.query(`
    SELECT 
      d.id_despacho,
      d.codigo_despacho,
      d.fecha_despacho,
      d.estado,
      dd.id_producto,
      p.nombre AS producto,
      dd.cantidad
    FROM despachos d
    JOIN despacho_detalles dd ON d.id_despacho = dd.id_despacho
    JOIN productos p ON dd.id_producto = p.id_producto
    WHERE d.id_trabajador = 64 AND dd.id_producto = 49
    ORDER BY d.fecha_despacho ASC
  `);
  console.table(despachos);

  const totalDespachado = despachos.reduce((sum, d) => sum + Number(d.cantidad), 0);
  console.log(`➡️ SUMA TOTAL DESPACHADA (Asignado en historial): ${totalDespachado} unidades.\n`);

  // 2. Liquidaciones en Órdenes de Trabajo (Material usado/gastado)
  console.log('📝 2. MATERIAL GASTADO EN ÓRDENES LIQUIDADAS:');
  const [liquidaciones] = await conn.query(`
    SELECT 
      ol.id_liquidacion,
      ol.id_orden,
      o.numero AS orden_numero,
      ol.fecha_liquidacion,
      old.cantidad AS cantidad_gastada,
      p.nombre AS producto
    FROM orden_liquidaciones ol
    JOIN orden_liquidacion_detalle old ON ol.id_liquidacion = old.id_liquidacion
    LEFT JOIN ordenes o ON ol.id_orden = o.id_orden
    JOIN productos p ON old.id_producto = p.id_producto
    WHERE ol.id_trabajador = 64 AND old.id_producto = 49
    ORDER BY ol.fecha_liquidacion ASC
  `);
  console.table(liquidaciones);

  const totalLiquidado = liquidaciones.reduce((sum, l) => sum + Number(l.cantidad_gastada), 0);
  console.log(`➡️ SUMA TOTAL GASTADA EN ÓRDENES: ${totalLiquidado} unidades.\n`);

  // 3. Stock actual en trabajador_productos (Stock en Carro)
  console.log('🚚 3. STOCK ACTUAL EN trabajador_productos (Stock en Carro):');
  const [tp] = await conn.query(`
    SELECT 
      tp.id_trabajador_producto,
      tp.id_trabajador,
      tp.id_producto,
      p.nombre,
      tp.stock,
      tp.fecha_creacion,
      tp.fecha_actualizacion
    FROM trabajador_productos tp
    JOIN productos p ON tp.id_producto = p.id_producto
    WHERE tp.id_trabajador = 64 AND tp.id_producto = 49
  `);
  console.table(tp);

  // 4. Ver todos los despachos que se hicieron a Wil
  console.log('📋 4. TODOS LOS DESPACHOS DE WIL (para ver si hubo varios o uno solo):');
  const [allDesp] = await conn.query(`
    SELECT d.id_despacho, d.codigo_despacho, d.fecha_despacho, dd.id_producto, p.nombre, dd.cantidad
    FROM despachos d
    JOIN despacho_detalles dd ON d.id_despacho = dd.id_despacho
    JOIN productos p ON dd.id_producto = p.id_producto
    WHERE d.id_trabajador = 64
    ORDER BY d.id_despacho ASC, p.nombre ASC
  `);
  console.table(allDesp);

  await conn.end();
}

checkTempladores().catch(console.error);
