const mysql = require('mysql2/promise');

async function inspectEquiposAndOthers() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  console.log('================================================================');
  console.log('🔍 AUDITORÍA DE EQUIPOS (ONT, MESH, ROUTERS) Y HERRAMIENTAS');
  console.log('================================================================\n');

  // 1. Equipos Serializados (producto_series vs trabajador_series)
  const [equipos] = await conn.execute(`
    SELECT 
      p.id_producto,
      p.codigo,
      p.nombre,
      c.nombre as categoria,
      (SELECT COUNT(*) FROM producto_series ps WHERE ps.id_producto = p.id_producto) as total_series_ingresadas,
      (SELECT COUNT(*) FROM producto_series ps WHERE ps.id_producto = p.id_producto AND ps.estado = 'DISPONIBLE') as series_almacen_disp,
      (SELECT COUNT(*) FROM trabajador_series ts WHERE ts.id_producto = p.id_producto AND ts.estado = 'Asignada') as series_en_cuadrillas,
      (SELECT COUNT(*) FROM trabajador_series ts WHERE ts.id_producto = p.id_producto AND ts.estado IN ('Usada', 'Liquidada')) as series_liquidadas,
      (SELECT COUNT(*) FROM producto_series ps WHERE ps.id_producto = p.id_producto AND ps.estado = 'DEFECTUOSO') as series_defectuosas,
      (SELECT COALESCE(SUM(dc.cantidad), 0) FROM detalle_compras dc WHERE dc.id_producto = p.id_producto) as total_compras_factura
    FROM productos p
    JOIN categorias c ON p.id_categoria = c.id_categoria
    WHERE p.maneja_serie = 1 OR c.nombre = 'EQUIPOS'
    ORDER BY p.nombre ASC
  `);

  console.log('1. EQUIPOS SERIALIZADOS (ONT, MESH, ROUTER, CATV, ETC.):');
  console.table(equipos);

  // 2. Herramientas y Uniformes
  const [herramientas] = await conn.execute(`
    SELECT 
      p.id_producto,
      p.codigo,
      p.nombre,
      c.nombre as categoria,
      COALESCE((SELECT SUM(s.cantidad) FROM stock s WHERE s.id_producto = p.id_producto AND (s.id_almacen = 1 OR s.id_almacen IS NULL)), 0) as stock_central,
      COALESCE((SELECT SUM(tp.stock) FROM trabajador_productos tp WHERE tp.id_producto = p.id_producto), 0) as stock_tecnicos,
      COALESCE((SELECT SUM(dc.cantidad) FROM detalle_compras dc WHERE dc.id_producto = p.id_producto), 0) as compras_factura
    FROM productos p
    JOIN categorias c ON p.id_categoria = c.id_categoria
    WHERE c.nombre IN ('HERRAMIENTAS', 'UNIFORMES', 'VEHICULO', 'ACTAS / GUÍAS')
    ORDER BY c.nombre ASC, p.nombre ASC
  `);

  console.log('\n2. HERRAMIENTAS, UNIFORMES, VEHÍCULO Y ACTAS:');
  console.table(herramientas);

  await conn.end();
}

inspectEquiposAndOthers().catch(console.error);
