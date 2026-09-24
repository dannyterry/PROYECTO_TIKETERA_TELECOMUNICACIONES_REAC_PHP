const mysql = require('mysql2/promise');

async function analyzeWil() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  console.log('================================================================');
  console.log('🔍 ANÁLISIS DETALLADO: WIL NELSON CARHUAZ (PRODUCCIÓN EN LOCAL)');
  console.log('================================================================\n');

  // 1. Datos de usuario y trabajador
  const [users] = await conn.query(`
    SELECT u.id_usuario, u.nombres, u.primer_apellido, u.segundo_apellido, u.documento, u.cuadrilla, u.estado,
           t.id_trabajador, t.id_vehiculo, v.placa
    FROM usuarios u
    LEFT JOIN trabajadores t ON u.id_usuario = t.id_usuario
    LEFT JOIN vehiculos v ON t.id_vehiculo = v.id_vehiculo
    WHERE u.nombres LIKE '%WIL%' OR u.primer_apellido LIKE '%CARHUAZ%' OR u.segundo_apellido LIKE '%CARHUAZ%'
  `);
  console.log('👤 USUARIO / TRABAJADOR:');
  console.table(users);

  if (users.length === 0) {
    await conn.end();
    return;
  }

  const u = users[0];
  const idT = u.id_trabajador; // 64
  const idU = u.id_usuario;    // 64

  // 2. Historial de Despachos / Asignaciones
  console.log('\n📦 1. HISTORIAL DE DESPACHOS (despachos & despacho_detalles):');
  const [despachos] = await conn.query(`
    SELECT 
      d.id_despacho,
      d.codigo_despacho,
      d.id_trabajador,
      d.fecha_despacho,
      d.estado AS estado_despacho,
      dd.id_producto,
      p.nombre AS producto_nombre,
      p.codigo AS producto_codigo,
      dd.cantidad
    FROM despachos d
    LEFT JOIN despacho_detalles dd ON d.id_despacho = dd.id_despacho
    LEFT JOIN productos p ON dd.id_producto = p.id_producto
    WHERE d.id_trabajador = ?
    ORDER BY d.id_despacho ASC
  `, [idT]);
  console.log(`Total items en historial de despachos: ${despachos.length}`);
  console.table(despachos);

  // 3. Stock actual en Móviles (trabajador_productos)
  console.log('\n🚚 2. STOCK ACTUAL EN MÓVILES (trabajador_productos):');
  const [tp] = await conn.query(`
    SELECT 
      tp.id_trabajador_producto,
      tp.id_trabajador,
      tp.id_producto,
      p.nombre AS producto_nombre,
      p.codigo AS producto_codigo,
      tp.stock,
      tp.fecha_creacion,
      tp.fecha_actualizacion
    FROM trabajador_productos tp
    JOIN productos p ON tp.id_producto = p.id_producto
    WHERE tp.id_trabajador = ?
    ORDER BY tp.id_producto ASC
  `, [idT]);
  console.log(`Total registros en trabajador_productos: ${tp.length}`);
  console.table(tp);

  // 4. Series asignadas en Móviles (trabajador_series)
  console.log('\n🔢 3. SERIES ASIGNADAS EN MÓVILES (trabajador_series):');
  const [ts] = await conn.query(`
    SELECT 
      ts.id_trabajador_serie,
      ts.id_trabajador,
      ts.id_producto,
      p.nombre AS producto_nombre,
      ps.numero_serie,
      ps.codigo_serie,
      ts.estado,
      ts.fecha_asignacion
    FROM trabajador_series ts
    JOIN producto_series ps ON ts.id_producto_serie = ps.id_producto_serie
    JOIN productos p ON ts.id_producto = p.id_producto
    WHERE ts.id_trabajador = ?
    ORDER BY ts.id_producto ASC, ps.numero_serie ASC
  `, [idT]);
  console.log(`Total series asignadas: ${ts.length}`);
  console.table(ts);

  // 5. Liquidaciones u Órdenes liquidadas
  console.log('\n📝 4. LIQUIDACIONES / DESCARGOS REALIZADOS (orden_liquidaciones & orden_liquidacion_detalle):');
  const [liq] = await conn.query(`
    SELECT 
      ol.id_liquidacion,
      ol.id_orden,
      ol.id_trabajador,
      ol.fecha_liquidacion,
      old.id_producto,
      p.nombre AS producto_nombre,
      old.cantidad,
      old.numero_serie
    FROM orden_liquidaciones ol
    LEFT JOIN orden_liquidacion_detalle old ON ol.id_liquidacion = old.id_liquidacion
    LEFT JOIN productos p ON old.id_producto = p.id_producto
    WHERE ol.id_trabajador = ?
  `, [idT]);
  console.log(`Total liquidaciones registradas: ${liq.length}`);
  console.table(liq);

  // 6. Resumen comparativo producto por producto
  console.log('\n📊 5. COMPARACIÓN DIRECTA: HISTORIAL DESPACHADO vs STOCK EN MÓVIL vs SERIES ACTIVAS:');
  const [comp] = await conn.query(`
    SELECT 
      p.id_producto,
      p.nombre AS producto_nombre,
      p.maneja_serie,
      COALESCE((
        SELECT SUM(dd.cantidad) 
        FROM despacho_detalles dd 
        JOIN despachos d ON dd.id_despacho = d.id_despacho 
        WHERE d.id_trabajador = ? AND dd.id_producto = p.id_producto
      ), 0) AS total_despachado_historial,
      COALESCE((
        SELECT tp.stock 
        FROM trabajador_productos tp 
        WHERE tp.id_trabajador = ? AND tp.id_producto = p.id_producto
      ), 0) AS stock_en_trabajador_productos,
      COALESCE((
        SELECT COUNT(*) 
        FROM trabajador_series ts 
        WHERE ts.id_trabajador = ? AND ts.id_producto = p.id_producto AND ts.estado = 'Asignada'
      ), 0) AS series_activas_en_trabajador_series
    FROM productos p
    WHERE p.id_producto IN (
      SELECT dd.id_producto FROM despacho_detalles dd JOIN despachos d ON dd.id_despacho = d.id_despacho WHERE d.id_trabajador = ?
      UNION
      SELECT tp.id_producto FROM trabajador_productos tp WHERE tp.id_trabajador = ?
      UNION
      SELECT ts.id_producto FROM trabajador_series ts WHERE ts.id_trabajador = ?
    )
    ORDER BY p.nombre ASC
  `, [idT, idT, idT, idT, idT, idT]);
  console.table(comp);

  await conn.end();
}

analyzeWil().catch(console.error);
