const mysql = require('mysql2/promise');

async function timeline() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  console.log('================================================================');
  console.log('⏱️ LÍNEA DE TIEMPO COMPLETA DE WIL NELSON CARHUAZ (23/09/2026)');
  console.log('================================================================\n');

  // 1. Despachos registrados
  const [desp] = await conn.query(`
    SELECT d.id_despacho, d.codigo_despacho, d.fecha_despacho, d.tipo_despacho, d.observaciones,
           dd.id_producto, p.nombre as producto_nombre, dd.cantidad
    FROM despachos d
    JOIN despacho_detalles dd ON d.id_despacho = dd.id_despacho
    JOIN productos p ON dd.id_producto = p.id_producto
    WHERE d.id_trabajador = 64
    ORDER BY d.fecha_despacho ASC
  `);

  console.log('📦 HISTORIAL DE TODOS LOS DESPACHOS:');
  console.table(desp.map(d => ({
    id: d.id_despacho,
    codigo: d.codigo_despacho,
    fecha: d.fecha_despacho,
    producto: d.producto_nombre,
    cantidad: d.cantidad,
    obs: d.observaciones
  })));

  // 2. Liquidaciones registradas
  const [liq] = await conn.query(`
    SELECT ol.id_liquidacion, ol.id_orden, o.numero AS orden_numero, ol.fecha_liquidacion,
           old.id_producto, p.nombre as producto_nombre, old.cantidad
    FROM orden_liquidaciones ol
    JOIN orden_liquidacion_detalle old ON ol.id_liquidacion = old.id_liquidacion
    LEFT JOIN ordenes o ON ol.id_orden = o.id_orden
    JOIN productos p ON old.id_producto = p.id_producto
    WHERE ol.id_trabajador = 64
    ORDER BY ol.fecha_liquidacion ASC
  `);

  console.log('\n📝 HISTORIAL DE TODAS LAS LIQUIDACIONES:');
  console.table(liq.map(l => ({
    id_liq: l.id_liquidacion,
    orden: l.orden_numero,
    fecha: l.fecha_liquidacion,
    producto: l.producto_nombre,
    cantidad_gastada: l.cantidad
  })));

  // 3. Revisar id_trabajador vs id_usuario en los despachos
  console.log('\n🔍 REVISIÓN DE ID_TRABAJADOR VS ID_USUARIO:');
  const [userRow] = await conn.query('SELECT id_usuario, nombres, primer_apellido FROM usuarios WHERE nombres LIKE "%WIL%"');
  const [trabRow] = await conn.query('SELECT id_trabajador, id_usuario FROM trabajadores WHERE id_usuario = ?', [userRow[0].id_usuario]);
  console.log('Usuario:', userRow[0]);
  console.log('Trabajador:', trabRow[0]);

  // 4. Ver si hay despachos asignados a otro id
  const [otherDesp] = await conn.query('SELECT d.*, dd.* FROM despachos d JOIN despacho_detalles dd ON d.id_despacho = dd.id_despacho WHERE d.observaciones LIKE "%WIL%" OR d.observaciones LIKE "%CARHUAZ%"');
  console.log('\nDespachos con mención a Wil en observaciones:', otherDesp);

  await conn.end();
}

timeline().catch(console.error);
