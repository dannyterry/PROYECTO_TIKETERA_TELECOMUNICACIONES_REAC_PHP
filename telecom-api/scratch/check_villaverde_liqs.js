const pool = require('../db.js');

async function checkAllVillaverdeLiqs() {
  const [liqs] = await pool.query(`
    SELECT ol.id_liquidacion, ol.id_orden, o.numero as numero_orden, ol.id_trabajador,
           ol.numero_acta, ol.estado as estado_liquidacion, ol.fecha_liquidacion,
           ol.liquidado_por, ol.tipo_trabajo_acta,
           o.estado as estado_orden
    FROM orden_liquidaciones ol
    LEFT JOIN ordenes o ON ol.id_orden = o.id_orden
    WHERE ol.id_trabajador = 76
    ORDER BY ol.id_liquidacion ASC
  `);
  console.log(`TOTAL LIQUIDACIONES DE VILLAVERDE (id_trabajador 76): ${liqs.length}`);
  console.table(liqs);

  // Ver los detalles de materiales de estas liquidaciones
  const [detalles] = await pool.query(`
    SELECT old.id_detalle_liq, old.id_liquidacion, ol.id_orden, o.numero as numero_orden,
           ol.numero_acta, ol.estado as estado_liquidacion,
           old.id_producto, p.nombre as producto_nombre, p.codigo,
           old.cantidad, old.numero_serie, old.drop_inicio, old.drop_fin
    FROM orden_liquidacion_detalle old
    JOIN orden_liquidaciones ol ON old.id_liquidacion = ol.id_liquidacion
    JOIN productos p ON old.id_producto = p.id_producto
    LEFT JOIN ordenes o ON ol.id_orden = o.id_orden
    WHERE ol.id_trabajador = 76
    ORDER BY ol.id_liquidacion, old.id_detalle_liq
  `);
  console.log(`\nTOTAL ITEMS DE MATERIALES EN DETALLE: ${detalles.length}`);
  console.table(detalles);

  process.exit(0);
}

checkAllVillaverdeLiqs().catch(console.error);
