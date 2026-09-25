const db = require('../db');

async function test() {
  const query = `
    SELECT 
      COALESCE(
        NULLIF(TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))), ''),
        NULLIF(TRIM(o.cuadrilla), ''),
        'Sin Técnico'
      ) AS tecnico_nombre,
      COUNT(DISTINCT o.id_orden) as total_ordenes,
      COUNT(DISTINCT CASE WHEN o.estado LIKE '%Finaliz%' OR o.estado LIKE '%Liquid%' THEN o.id_orden END) as finalizadas,
      COUNT(DISTINCT ol.id_liquidacion) as actas_liquidadas,
      COUNT(DISTINCT CASE WHEN ol.estado = 'Aprobada' OR ol.estado = 'Aprobado' THEN ol.id_liquidacion END) as actas_aprobadas,
      COUNT(DISTINCT CASE WHEN ol.estado = 'Pendiente' THEN ol.id_liquidacion END) as actas_pendientes_revision
    FROM ordenes o
    LEFT JOIN usuarios u ON o.id_tecnico = u.id_usuario
    LEFT JOIN orden_liquidaciones ol ON o.id_orden = ol.id_orden
    WHERE o.fecha_visita >= '2026-09-01'
    GROUP BY tecnico_nombre
    ORDER BY finalizadas DESC
    LIMIT 10
  `;
  const [rows] = await db.query(query);
  console.table(rows);
  process.exit(0);
}
test();
