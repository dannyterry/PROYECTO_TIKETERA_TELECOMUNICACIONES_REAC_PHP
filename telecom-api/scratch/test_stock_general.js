const mysql = require('mysql2/promise');

async function main() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes',
    port: 3306
  });

  try {
    console.log('Testing /api/almacen/stock-general query 1 (productos)...');
    const [productos] = await pool.query(`
      SELECT 
        p.id_producto,
        p.id_categoria,
        p.codigo,
        p.nombre,
        p.descripcion,
        p.stand,
        p.fila,
        CASE 
          WHEN p.stand IS NOT NULL AND p.fila IS NOT NULL THEN CONCAT('Stand ', p.stand, ' · Fila ', p.fila)
          WHEN p.stand IS NOT NULL THEN CONCAT('Stand ', p.stand)
          ELSE NULL 
        END AS ubicacion,
        p.proid,
        p.stock_minimo,
        p.maneja_serie,
        p.es_drop,
        p.precio_compra,
        p.categoria_liquidar,
        COALESCE((SELECT MAX(ps.fecha_ingreso) FROM producto_series ps WHERE ps.id_producto = p.id_producto), p.fecha_creacion) AS fecha_ingreso,
        c.nombre AS categoria,
        CASE 
          WHEN p.maneja_serie = 1 THEN COALESCE((SELECT COUNT(*) FROM producto_series ps WHERE ps.id_producto = p.id_producto AND ps.estado = 'DISPONIBLE'), 0)
          ELSE COALESCE((SELECT SUM(s.cantidad) FROM stock s WHERE s.id_producto = p.id_producto AND (s.id_almacen = 1 OR s.id_almacen IS NULL)), 0)
        END AS stock_central,
        COALESCE((SELECT SUM(s.cantidad_segundo_uso) FROM stock s WHERE s.id_producto = p.id_producto AND (s.id_almacen = 1 OR s.id_almacen IS NULL)), 0) AS stock_segundo_uso,
        CASE
          WHEN p.maneja_serie = 1 THEN COALESCE((
            SELECT COUNT(*) 
            FROM trabajador_series ts 
            JOIN trabajadores t ON ts.id_trabajador = t.id_trabajador 
            JOIN usuarios u ON t.id_usuario = u.id_usuario 
            LEFT JOIN roles r ON u.id_rol = r.id_rol 
            WHERE ts.id_producto = p.id_producto 
              AND ts.estado = 'Asignada'
              AND (u.id_rol IN (2, 6) OR UPPER(COALESCE(r.nombre, '')) LIKE '%TECNIC%' OR UPPER(COALESCE(r.nombre, '')) LIKE '%SUPERVI%')
          ), 0)
          ELSE COALESCE((
            SELECT SUM(tp.stock) 
            FROM trabajador_productos tp 
            JOIN trabajadores t ON tp.id_trabajador = t.id_trabajador 
            JOIN usuarios u ON t.id_usuario = u.id_usuario 
            LEFT JOIN roles r ON u.id_rol = r.id_rol 
            WHERE tp.id_producto = p.id_producto 
              AND (u.id_rol IN (2, 6) OR UPPER(COALESCE(r.nombre, '')) LIKE '%TECNIC%' OR UPPER(COALESCE(r.nombre, '')) LIKE '%SUPERVI%')
          ), 0)
        END AS stock_en_tecnicos,
        COALESCE((SELECT COUNT(*) FROM producto_series ps WHERE ps.id_producto = p.id_producto AND ps.estado = 'DISPONIBLE'), 0) AS series_disponibles
      FROM productos p
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      WHERE p.estado = 'Activo' OR p.estado IS NULL
      ORDER BY c.nombre ASC, p.nombre ASC
    `);
    console.log('Productos count:', productos.length);

    console.log('Testing query 2 (stockPorTecnico)...');
    const [stockPorTecnico] = await pool.query(`
      SELECT 
        tp.id_trabajador,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS tecnico_nombre,
        COALESCE(u.documento, '') AS tecnico_dni,
        COALESCE(u.cuadrilla, '') AS cuadrilla,
        COALESCE(v.placa, 'Sin vehículo') AS vehiculo_placa,
        p.id_producto,
        p.nombre AS producto_nombre,
        p.codigo AS producto_codigo,
        p.proid,
        p.es_drop,
        c.nombre AS categoria,
        tp.stock,
        COALESCE(
          (SELECT MAX(ts.fecha_asignacion) FROM trabajador_series ts WHERE ts.id_trabajador = tp.id_trabajador AND ts.id_producto = tp.id_producto),
          (SELECT MAX(d.fecha_despacho) FROM despacho_detalles dd JOIN despachos d ON dd.id_despacho = d.id_despacho WHERE d.id_trabajador = tp.id_trabajador AND dd.id_producto = tp.id_producto),
          tp.fecha_creacion,
          tp.fecha_actualizacion
        ) AS fecha_entrega,
        COALESCE((
          SELECT SUM(dd.cantidad) 
          FROM despacho_detalles dd 
          JOIN despachos d ON dd.id_despacho = d.id_despacho 
          WHERE d.id_trabajador = tp.id_trabajador AND dd.id_producto = tp.id_producto
        ), 0) AS total_despachado_historial,
        COALESCE((
          SELECT SUM(old.cantidad)
          FROM orden_liquidacion_detalle old
          JOIN orden_liquidaciones ol ON old.id_liquidacion = ol.id_liquidacion
          WHERE ol.id_trabajador = tp.id_trabajador AND old.id_producto = tp.id_producto
        ), 0) AS total_gastado_ordenes,
        COALESCE((
          SELECT SUM(m.cantidad)
          FROM movimientos m
          WHERE (m.referencia LIKE CONCAT('%Técnico #', tp.id_trabajador, '%') 
                 OR m.referencia LIKE CONCAT('%', u.nombres, '%'))
            AND m.id_producto = tp.id_producto
            AND m.tipo = 'ENTRADA'
            AND (m.referencia LIKE '%Devolución%' OR m.referencia LIKE '%devolucion%' OR m.referencia LIKE '%Retorno%')
        ), 0) AS total_devuelto_almacen
      FROM trabajador_productos tp
      JOIN trabajadores t ON tp.id_trabajador = t.id_trabajador
      JOIN usuarios u ON t.id_usuario = u.id_usuario
      JOIN productos p ON tp.id_producto = p.id_producto
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      LEFT JOIN vehiculos v ON t.id_vehiculo = v.id_vehiculo
      WHERE tp.stock > 0
      ORDER BY tecnico_nombre ASC, p.nombre ASC
    `);
    console.log('StockPorTecnico count:', stockPorTecnico.length);

    console.log('Testing query 3 (seriesTecnicos)...');
    const [seriesTecnicos] = await pool.query(`
      SELECT 
        ts.id_trabajador_serie,
        ts.id_trabajador,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS tecnico_nombre,
        COALESCE(u.documento, '') AS tecnico_dni,
        COALESCE(u.cuadrilla, '') AS cuadrilla,
        COALESCE(v.placa, 'Sin vehículo') AS vehiculo_placa,
        p.id_producto,
        p.nombre AS producto_nombre,
        p.codigo AS producto_codigo,
        p.proid,
        c.nombre AS categoria,
        ts.serie,
        ts.estado,
        ts.fecha_asignacion AS fecha_entrega,
        ts.id_equipo
      FROM trabajador_series ts
      JOIN trabajadores t ON ts.id_trabajador = t.id_trabajador
      JOIN usuarios u ON t.id_usuario = u.id_usuario
      JOIN productos p ON ts.id_producto = p.id_producto
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      LEFT JOIN vehiculos v ON t.id_vehiculo = v.id_vehiculo
      WHERE ts.estado = 'Asignada'
      ORDER BY tecnico_nombre ASC, p.nombre ASC, ts.serie ASC
    `);
    console.log('SeriesTecnicos count:', seriesTecnicos.length);

  } catch (err) {
    console.error('SQL Error:', err);
  } finally {
    await pool.end();
  }
}

main();
