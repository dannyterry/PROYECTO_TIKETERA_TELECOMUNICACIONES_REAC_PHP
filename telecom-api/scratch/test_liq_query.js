const pool = require('../db');
(async () => {
  const desde = '2026-09-25';
  const hasta = '2026-09-25';
  const dateCondOrd = ' AND COALESCE(o2.fecha_solicitud, o2.fecha_visita, o2.fecha_creacion) >= ? AND COALESCE(o2.fecha_solicitud, o2.fecha_visita, o2.fecha_creacion) <= ?';
  const dateCondLiqJoin = ' AND ol.fecha_liquidacion >= ? AND ol.fecha_liquidacion <= ?';
  
  // Total: 2 for total_ordenes + 2 for total_finalizadas + 2 for dateCondLiqJoin = 6 params
  const paramsResumen = [
    `${desde} 00:00:00`, `${hasta} 23:59:59`, // for total_ordenes
    `${desde} 00:00:00`, `${hasta} 23:59:59`, // for total_finalizadas
    `${desde} 00:00:00`, `${hasta} 23:59:59`, // for dateCondLiqJoin
  ];

  const [tecnicosRows] = await pool.query(`
    SELECT
      u.id_usuario AS id_trabajador,
      CONCAT(u.nombres, ' ', u.apellidos) AS tecnico,
      u.foto_personal,
      u.documento AS tecnico_dni,
      COALESCE(
        NULLIF(TRIM(u.cuadrilla), ''),
        (
          SELECT TRIM(
            CASE 
              WHEN o_c.cuadrilla LIKE '% CESPEDES%' THEN CONCAT(SUBSTRING_INDEX(o_c.cuadrilla, ' CESPEDES', 1), ' CESPEDES')
              WHEN o_c.cuadrilla LIKE '% TRASLADO%' THEN CONCAT(SUBSTRING_INDEX(o_c.cuadrilla, ' TRASLADO', 1), ' TRASLADO')
              WHEN o_c.cuadrilla LIKE '% MOTOWIN%' THEN CONCAT(SUBSTRING_INDEX(o_c.cuadrilla, ' MOTOWIN', 1), ' MOTOWIN')
              ELSE SUBSTRING_INDEX(o_c.cuadrilla, ' ', 3)
            END
          )
          FROM ordenes o_c 
          WHERE o_c.id_tecnico = u.id_usuario AND o_c.cuadrilla IS NOT NULL AND o_c.cuadrilla != ''
          ORDER BY o_c.fecha_visita DESC LIMIT 1
        )
      ) AS cuadrilla,
      (SELECT COUNT(*) FROM ordenes o2 WHERE o2.id_tecnico = u.id_usuario ${dateCondOrd}) AS total_ordenes,
      (SELECT COUNT(*) FROM ordenes o2 WHERE o2.id_tecnico = u.id_usuario AND (LOWER(o2.estado) LIKE '%finaliz%' OR LOWER(o2.estado) LIKE '%liquid%') ${dateCondOrd}) AS total_finalizadas,
      COUNT(DISTINCT CASE WHEN lq.estado <> 'Rechazada' THEN lq.id_liquidacion END) AS total_liquidaciones,
      COUNT(DISTINCT CASE WHEN lq.estado = 'Pendiente' THEN lq.id_liquidacion END) AS total_pendientes,
      COUNT(DISTINCT CASE WHEN lq.estado = 'Aprobada' THEN lq.id_liquidacion END) AS total_aprobadas,
      COUNT(DISTINCT CASE WHEN lq.estado = 'Rechazada' THEN lq.id_liquidacion END) AS total_rechazadas,
      COALESCE(SUM(
        CASE WHEN lq.estado = 'Rechazada' THEN 0
             ELSE lq.costo_liquidacion
        END
      ), 0) AS total_costo,
      MAX(lq.fecha_liquidacion) AS ultima_liquidacion
    FROM usuarios u
    LEFT JOIN trabajadores t ON t.id_usuario = u.id_usuario
    LEFT JOIN (
      SELECT 
        ol.id_liquidacion,
        ol.estado,
        ol.fecha_liquidacion,
        COALESCE(ol.id_trabajador, t2.id_trabajador) AS id_trabajador,
        COALESCE(t2.id_usuario, o2.id_tecnico) AS id_usuario,
        COALESCE(SUM(d.cantidad * COALESCE(p.precio_compra, 0)), 0) AS costo_liquidacion
      FROM orden_liquidaciones ol
      LEFT JOIN trabajadores t2 ON t2.id_trabajador = ol.id_trabajador
      LEFT JOIN ordenes o2 ON o2.id_orden = ol.id_orden
      LEFT JOIN orden_liquidacion_detalle d ON d.id_liquidacion = ol.id_liquidacion
      LEFT JOIN productos p ON p.id_producto = d.id_producto
      WHERE 1=1 ${dateCondLiqJoin}
      GROUP BY ol.id_liquidacion
    ) lq ON (lq.id_usuario = u.id_usuario OR (t.id_trabajador IS NOT NULL AND lq.id_trabajador = t.id_trabajador))
    GROUP BY u.id_usuario
    HAVING total_ordenes > 0 OR total_liquidaciones > 0
    ORDER BY tecnico ASC
  `, paramsResumen);

  console.log('EXITO! TECNICOS ENCONTRADOS:', tecnicosRows.length);
  console.log('SAMPLE TECNICOS:', tecnicosRows.slice(0, 3));

  process.exit();
})();
