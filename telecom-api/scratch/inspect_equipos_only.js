const mysql = require('mysql2/promise');

async function inspectEquiposOnly() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  const [equipos] = await conn.execute(`
    SELECT 
      p.id_producto,
      p.codigo,
      p.nombre,
      c.nombre as categoria,
      (SELECT COUNT(*) FROM producto_series ps WHERE ps.id_producto = p.id_producto) as total_series,
      (SELECT COUNT(*) FROM producto_series ps WHERE ps.id_producto = p.id_producto AND ps.estado = 'DISPONIBLE') as almacen_disp,
      (SELECT COUNT(*) FROM trabajador_series ts WHERE ts.id_producto = p.id_producto AND ts.estado = 'Asignada') as en_cuadrillas,
      (SELECT COUNT(*) FROM trabajador_series ts WHERE ts.id_producto = p.id_producto AND ts.estado IN ('Usada', 'Liquidada')) as liquidadas,
      (SELECT COUNT(*) FROM producto_series ps WHERE ps.id_producto = p.id_producto AND ps.estado = 'DEFECTUOSO') as defectuosas,
      (SELECT COALESCE(SUM(dc.cantidad), 0) FROM detalle_compras dc WHERE dc.id_producto = p.id_producto) as compras_factura
    FROM productos p
    JOIN categorias c ON p.id_categoria = c.id_categoria
    WHERE p.maneja_serie = 1 OR c.nombre = 'EQUIPOS'
    ORDER BY p.nombre ASC
  `);

  console.log('EQUIPOS SERIALIZADOS (ONT, MESH, ROUTER, CATV, ETC.):');
  console.table(equipos);

  await conn.end();
}

inspectEquiposOnly().catch(console.error);
