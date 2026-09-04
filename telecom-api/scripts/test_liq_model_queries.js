const mysql = require('mysql2/promise');

async function testQuery() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  // Query que corre el PHP en resumen_tecnicos
  const [resumen] = await conn.query(`
    SELECT
      t.id_trabajador,
      CONCAT(u.nombres,' ',u.apellidos) AS tecnico,
      (SELECT COUNT(*) FROM ordenes o2
       WHERE o2.id_tecnico = t.id_trabajador AND o2.fecha_visita >= '2026-09-04 00:00:00' AND o2.fecha_visita <= '2026-09-04 23:59:59') AS total_ordenes,
      COUNT(DISTINCT CASE WHEN ol.estado <> 'Rechazada' THEN ol.id_liquidacion END) AS total_liquidaciones,
      COUNT(DISTINCT CASE WHEN ol.estado = 'Pendiente' THEN ol.id_liquidacion END) AS total_pendientes,
      COUNT(DISTINCT CASE WHEN ol.estado = 'Rechazada' THEN ol.id_liquidacion END) AS total_rechazadas,
      COALESCE(SUM(
          CASE WHEN ol.estado = 'Rechazada' THEN 0
               WHEN ps.estado = 'BAJA' THEN 0
               ELSE d.cantidad * COALESCE(p.precio_compra, 0)
          END
      ), 0) AS total_costo,
      MAX(ol.fecha_liquidacion) AS ultima_liquidacion
    FROM trabajadores t
    INNER JOIN usuarios u ON u.id_usuario = t.id_usuario
    LEFT JOIN orden_liquidaciones ol ON ol.id_trabajador = t.id_trabajador AND ol.fecha_liquidacion >= '2026-09-04 00:00:00' AND ol.fecha_liquidacion <= '2026-09-04 23:59:59'
    LEFT JOIN orden_liquidacion_detalle d ON d.id_liquidacion = ol.id_liquidacion
    LEFT JOIN productos p       ON p.id_producto = d.id_producto
    LEFT JOIN producto_series ps ON ps.id_producto_serie = d.id_producto_serie
    WHERE t.id_trabajador = 65
    GROUP BY t.id_trabajador
  `);
  console.log("RESUMEN YOMAR:", resumen);

  // Query que corre el PHP en por_tecnico
  const [porTecnico] = await conn.query(`
    SELECT
      ol.id_liquidacion,
      ol.numero_acta,
      ol.fecha_liquidacion,
      ol.observaciones,
      ol.estado AS estado_liquidacion,
      o.numero      AS numero_orden,
      o.cliente,
      o.direccion,
      o.tipo_trabajo,
      COALESCE(
          NULLIF(TRIM(o.motivo_finalizacion), ''),
          NULLIF(TRIM(o.motivo_cancelacion), '')
      ) AS tipo_averia,
      o.fecha_visita,
      COUNT(d.id_detalle_liq) AS total_items,
      COALESCE(SUM(
          CASE WHEN ol.estado = 'Rechazada' THEN 0
               WHEN ps.estado = 'BAJA' THEN 0
               ELSE d.cantidad * COALESCE(p.precio_compra, 0)
          END
      ), 0) AS total_costo
    FROM orden_liquidaciones ol
    INNER JOIN ordenes o ON o.id_orden = ol.id_orden
    LEFT JOIN orden_liquidacion_detalle d ON d.id_liquidacion = ol.id_liquidacion
    LEFT JOIN productos p       ON p.id_producto = d.id_producto
    LEFT JOIN producto_series ps ON ps.id_producto_serie = d.id_producto_serie
    WHERE ol.id_trabajador = 65
    GROUP BY ol.id_liquidacion
  `);
  console.log("POR TECNICO YOMAR:", porTecnico);

  // Query que corre el PHP en detalle
  const [detalleMat] = await conn.query(`
    SELECT d.id_detalle_liq, d.id_producto, d.numero_serie, d.cantidad,
           d.drop_inicio, d.drop_fin,
           p.nombre AS nombre_producto, p.categoria_liquidar, p.precio_compra,
           ps.estado AS estado_serie,
           (CASE WHEN ps.estado = 'BAJA' THEN 0
                 ELSE d.cantidad * COALESCE(p.precio_compra, 0)
            END) AS costo
    FROM orden_liquidacion_detalle d
    LEFT JOIN productos p        ON p.id_producto = d.id_producto
    LEFT JOIN producto_series ps ON ps.id_producto_serie = d.id_producto_serie
    WHERE d.id_liquidacion = 4
    ORDER BY p.categoria_liquidar DESC, p.nombre ASC
  `);
  console.log("DETALLE MATERIALES:", detalleMat);

  await conn.end();
}

testQuery().catch(console.error);
