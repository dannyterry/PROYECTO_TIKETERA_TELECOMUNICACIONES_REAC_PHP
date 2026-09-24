const db = require('../db');

async function run() {
  console.log("=== INSPECCIÓN DE DATOS PARA MATRIZ DE RECABLEADOS Y DROP ===");

  // 1. Tipos de trabajo en ordenes
  const [types] = await db.query('SELECT DISTINCT tipo_trabajo FROM ordenes ORDER BY tipo_trabajo');
  console.log('Tipos de trabajo en ordenes:', types.map(t => t.tipo_trabajo));

  // 2. Tipos de trabajo en actas de liquidación
  const [actaTypes] = await db.query('SELECT DISTINCT tipo_trabajo_acta FROM orden_liquidaciones ORDER BY tipo_trabajo_acta');
  console.log('Tipos de trabajo en liquidaciones:', actaTypes.map(t => t.tipo_trabajo_acta));

  // 3. Conteo de ordenes con tipos relacionados a drop / recableado / traslado
  const [ords] = await db.query(`
    SELECT 
      COALESCE(u.id_usuario, o.id_tecnico) as id_tecnico,
      COALESCE(CONCAT(u.nombres, ' ', u.apellidos), o.tecnico_asignado, o.cuadrilla, 'Sin Asignar') as tecnico,
      COUNT(o.id_orden) as total_ordenes,
      SUM(CASE WHEN UPPER(o.tipo_trabajo) LIKE '%RECABLE%' OR UPPER(COALESCE(ol.tipo_trabajo_acta,'')) LIKE '%RECABLE%' THEN 1 ELSE 0 END) as recableados,
      SUM(CASE WHEN UPPER(o.tipo_trabajo) LIKE '%TRASLAD%' OR UPPER(COALESCE(ol.tipo_trabajo_acta,'')) LIKE '%TRASLAD%' THEN 1 ELSE 0 END) as traslados,
      SUM(CASE WHEN UPPER(o.tipo_trabajo) LIKE '%ALTA%' OR UPPER(o.tipo_trabajo) LIKE '%INSTALAC%' OR UPPER(COALESCE(ol.tipo_trabajo_acta,'')) LIKE '%ALTA%' THEN 1 ELSE 0 END) as altas,
      SUM(COALESCE(ol.drop_total_metros, 0)) as total_metros_bobina
    FROM ordenes o
    LEFT JOIN usuarios u ON (o.id_tecnico = u.id_usuario OR (o.tecnico_asignado IS NOT NULL AND CONCAT(u.nombres, ' ', u.apellidos) = o.tecnico_asignado))
    LEFT JOIN orden_liquidaciones ol ON o.id_orden = ol.id_orden
    WHERE o.estado != 'Cancelada' AND o.estado != 'Anulada'
    GROUP BY id_tecnico, tecnico
    ORDER BY recableados DESC, total_ordenes DESC
    LIMIT 20
  `);

  console.log("\nTop Técnicos vs Recableados:");
  console.table(ords);

  // 4. Detalle de drop conectorizado vs bobina en ordenes liquidadas
  const [dropMats] = await db.query(`
    SELECT 
      ol.id_liquidacion,
      ol.id_orden,
      ol.id_trabajador,
      CONCAT(u.nombres, ' ', u.apellidos) as tecnico,
      ol.tipo_trabajo_acta,
      ol.drop_total_metros as metros_bobina,
      p.nombre as producto_material,
      d.cantidad as cant_material
    FROM orden_liquidaciones ol
    LEFT JOIN trabajadores t ON ol.id_trabajador = t.id_trabajador
    LEFT JOIN usuarios u ON t.id_usuario = u.id_usuario
    LEFT JOIN orden_liquidacion_detalle d ON ol.id_liquidacion = d.id_liquidacion
    LEFT JOIN productos p ON d.id_producto = p.id_producto
    WHERE (p.nombre LIKE '%DROP%' OR p.nombre LIKE '%CONECTORIZADO%' OR ol.drop_total_metros > 0)
    ORDER BY ol.id_liquidacion DESC
  `);
  console.log("\nLiquidaciones con Drop/Conectorizados:", dropMats);

  process.exit(0);
}
run();
