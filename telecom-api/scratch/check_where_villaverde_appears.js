const pool = require('../db.js');

async function checkWhereVillaverdeAppears() {
  console.log('=== BÚSQUEDA GLOBAL DE VILLAVERDE EN ÓRDENES Y LIQUIDACIONES ===\n');

  // 1. En ordenes por texto (tecnico_asignado, usuario_ejecutor_fenix, cuadrilla)
  const [ords] = await pool.query(`
    SELECT id_orden, numero, tipo_trabajo, estado, fecha_visita, fin_visita,
           tecnico_asignado, id_tecnico, id_tecnico_reemplazo, cuadrilla, cuadrilla_origen_fenix, usuario_ejecutor_fenix
    FROM ordenes
    WHERE tecnico_asignado LIKE '%VILLAVERDE%' 
       OR tecnico_asignado LIKE '%PUCHURE%'
       OR cuadrilla LIKE '%K 9%'
       OR cuadrilla LIKE '%VILLAVERDE%'
       OR cuadrilla LIKE '%PUCHURE%'
       OR id_tecnico IN (76, 111)
    ORDER BY id_orden DESC
    LIMIT 20
  `);
  console.log(`Órdenes encontradas con Villaverde/Puchure/K9: ${ords.length}`);
  console.table(ords);

  // 2. En orden_liquidaciones
  const [liqs] = await pool.query(`
    SELECT ol.*, u.nombres, u.primer_apellido
    FROM orden_liquidaciones ol
    LEFT JOIN usuarios u ON ol.liquidado_por = u.id_usuario
    WHERE ol.id_trabajador IN (76, 111)
       OR ol.liquidado_por IN (76, 111)
       OR ol.observaciones LIKE '%VILLAVERDE%'
       OR ol.observaciones LIKE '%PUCHURE%'
  `);
  console.log(`Liquidaciones en orden_liquidaciones: ${liqs.length}`);
  console.table(liqs);

  // 3. Ver cómo están registradas las liquidaciones en general
  const [todasLiqs] = await pool.query(`
    SELECT ol.id_liquidacion, ol.id_orden, o.numero, ol.id_trabajador, ol.liquidado_por,
           ol.numero_acta, ol.fecha_liquidacion,
           (SELECT COUNT(*) FROM orden_liquidacion_detalle old WHERE old.id_liquidacion = ol.id_liquidacion) as cant_items
    FROM orden_liquidaciones ol
    LEFT JOIN ordenes o ON ol.id_orden = o.id_orden
    ORDER BY ol.id_liquidacion DESC
    LIMIT 10
  `);
  console.log(`Últimas 10 liquidaciones del sistema en general:`);
  console.table(todasLiqs);

  process.exit(0);
}

checkWhereVillaverdeAppears().catch(console.error);
