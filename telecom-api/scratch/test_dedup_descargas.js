const pool = require('../db');

async function testDescargas(idTrabajador = 101, idProducto = null) {
  // 1. Descargas desde orden_liquidacion_detalle
  let paramsMateriales = [idTrabajador];
  let whereMateriales = "WHERE ol.id_trabajador = ?";
  if (idProducto) {
    whereMateriales += " AND old.id_producto = ?";
    paramsMateriales.push(idProducto);
  }

  const [descargasMateriales] = await pool.query(`
    SELECT 
      old.id_detalle_liq,
      ol.id_liquidacion,
      ol.id_orden,
      COALESCE(o.numero, 'S/N') AS orden_numero,
      COALESCE(o.cod_seguimiento_cliente, o.numero, 'S/T') AS ticket,
      COALESCE(o.cliente, 'Cliente sin registrar') AS cliente,
      COALESCE(o.direccion, 'Sin dirección') AS direccion,
      COALESCE(o.localidad, o.region_zona, 'Sin distrito') AS distrito,
      COALESCE(o.tipo_trabajo, ol.tipo_trabajo_acta, 'Instalación') AS tipo_trabajo,
      ol.numero_acta,
      ol.numero_guia,
      ol.fecha_liquidacion,
      ol.estado AS estado_liquidacion,
      ol.liquidado_por,
      ol.observaciones,
      ol.observaciones_tecnico,
      p.id_producto,
      p.nombre AS producto_nombre,
      p.codigo AS producto_codigo,
      p.es_drop,
      old.cantidad,
      old.drop_inicio,
      old.drop_fin,
      old.numero_serie,
      'DETALLE_LIQ' AS origen
    FROM orden_liquidacion_detalle old
    JOIN orden_liquidaciones ol ON old.id_liquidacion = ol.id_liquidacion
    JOIN productos p ON old.id_producto = p.id_producto
    LEFT JOIN ordenes o ON ol.id_orden = o.id_orden
    ${whereMateriales}
    ORDER BY ol.fecha_liquidacion DESC, ol.id_liquidacion DESC
  `, paramsMateriales);

  // 2. Series desde trabajador_series que NO estén ya en orden_liquidacion_detalle
  let paramsSeries = [idTrabajador];
  let whereSeries = "WHERE ts.id_trabajador = ? AND (ts.estado = 'Usada' OR ts.estado = 'Liquidada')";
  if (idProducto) {
    whereSeries += " AND ts.id_producto = ?";
    paramsSeries.push(idProducto);
  }

  const [descargasSeries] = await pool.query(`
    SELECT 
      CONCAT('ts_', ts.id_trabajador_serie) AS id_detalle_liq,
      ol.id_liquidacion,
      ol.id_orden,
      COALESCE(o.numero, 'S/N') AS orden_numero,
      COALESCE(o.cod_seguimiento_cliente, o.numero, 'S/T') AS ticket,
      COALESCE(o.cliente, 'Cliente sin registrar') AS cliente,
      COALESCE(o.direccion, 'Sin dirección') AS direccion,
      COALESCE(o.localidad, o.region_zona, 'Sin distrito') AS distrito,
      COALESCE(o.tipo_trabajo, ol.tipo_trabajo_acta, 'Instalación') AS tipo_trabajo,
      ol.numero_acta,
      ol.numero_guia,
      COALESCE(ol.fecha_liquidacion, ts.fecha_asignacion) AS fecha_liquidacion,
      COALESCE(ol.estado, 'Liquidada') AS estado_liquidacion,
      ol.liquidado_por,
      ol.observaciones,
      ol.observaciones_tecnico,
      p.id_producto,
      p.nombre AS producto_nombre,
      p.codigo AS producto_codigo,
      p.es_drop,
      1 AS cantidad,
      NULL AS drop_inicio,
      NULL AS drop_fin,
      ps.numero_serie,
      'TRABAJADOR_SERIES' AS origen
    FROM trabajador_series ts
    JOIN producto_series ps ON ts.id_producto_serie = ps.id_producto_serie
    JOIN productos p ON ts.id_producto = p.id_producto
    LEFT JOIN orden_liquidaciones ol ON (
      ol.id_trabajador = ts.id_trabajador AND 
      (ol.numero_acta = ps.numero_serie OR ol.numero_guia = ps.numero_serie)
    )
    LEFT JOIN ordenes o ON ol.id_orden = o.id_orden
    ${whereSeries}
      AND NOT EXISTS (
        SELECT 1 FROM orden_liquidacion_detalle old2 
        JOIN orden_liquidaciones ol2 ON old2.id_liquidacion = ol2.id_liquidacion
        WHERE ol2.id_trabajador = ts.id_trabajador 
          AND (old2.numero_serie = ps.numero_serie OR old2.id_producto = ts.id_producto AND old2.id_liquidacion = ol.id_liquidacion)
      )
    ORDER BY COALESCE(ol.fecha_liquidacion, ts.fecha_asignacion) DESC
  `, paramsSeries);

  console.log(`Materiales/Detalle: ${descargasMateriales.length}`);
  console.log(`Series extras (sin duplicar): ${descargasSeries.length}`);

  const total = [...descargasMateriales, ...descargasSeries];
  console.log(`Total combinado limpio: ${total.length}`);
  console.table(total.map(t => ({
    id: t.id_detalle_liq,
    orden: t.orden_numero,
    producto: t.producto_nombre,
    serie: t.numero_serie,
    cant: t.cantidad,
    origen: t.origen
  })));

  process.exit(0);
}

// Probar con Edmundo Flores (buscar su id_trabajador o id_usuario)
pool.query("SELECT id_usuario, nombres, apellidos FROM usuarios WHERE nombres LIKE '%Edmundo%' OR apellidos LIKE '%Flores%'").then(([users]) => {
  console.log("Usuario:", users[0]);
  if (users[0]) testDescargas(users[0].id_usuario);
});
