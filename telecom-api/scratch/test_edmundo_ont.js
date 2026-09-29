const pool = require('../db');

async function testEdmundoExacto() {
  const idTrabajador = 78; // EDMUNDO FLORES GUIZABALDO
  const idProducto = 68; // ONT HUAWEI

  // 1. ANTES (cómo estaba el endpoint en server.js)
  const [descAntes1] = await pool.query(`
    SELECT old.id_detalle_liq, o.numero, old.numero_serie, 'DETALLE' as src
    FROM orden_liquidacion_detalle old
    JOIN orden_liquidaciones ol ON old.id_liquidacion = ol.id_liquidacion
    JOIN productos p ON old.id_producto = p.id_producto
    LEFT JOIN ordenes o ON ol.id_orden = o.id_orden
    WHERE ol.id_trabajador = ? AND old.id_producto = ?
  `, [idTrabajador, idProducto]);

  const [descAntes2] = await pool.query(`
    SELECT ts.id_trabajador_serie, o.numero, ps.numero_serie, 'SERIES' as src
    FROM trabajador_series ts
    JOIN producto_series ps ON ts.id_producto_serie = ps.id_producto_serie
    JOIN productos p ON ts.id_producto = p.id_producto
    LEFT JOIN orden_liquidaciones ol ON (
      ol.id_trabajador = ts.id_trabajador AND 
      (ol.numero_acta = ps.numero_serie OR ol.numero_guia = ps.numero_serie OR EXISTS(
        SELECT 1 FROM orden_liquidacion_detalle old2 
        WHERE old2.id_liquidacion = ol.id_liquidacion AND old2.numero_serie = ps.numero_serie
      ))
    )
    LEFT JOIN ordenes o ON ol.id_orden = o.id_orden
    WHERE ts.id_trabajador = ? AND (ts.estado = 'Usada' OR ts.estado = 'Liquidada') AND ts.id_producto = ?
  `, [idTrabajador, idProducto]);

  console.log("\n❌ ANTES (Total 4 registros con duplicados exactos):");
  console.table([...descAntes1, ...descAntes2]);

  // 2. AHORA (Deduplicado limpio)
  const [descAhora2] = await pool.query(`
    SELECT ts.id_trabajador_serie, o.numero, ps.numero_serie, 'SERIES_EXTRA' as src
    FROM trabajador_series ts
    JOIN producto_series ps ON ts.id_producto_serie = ps.id_producto_serie
    JOIN productos p ON ts.id_producto = p.id_producto
    LEFT JOIN orden_liquidaciones ol ON (
      ol.id_trabajador = ts.id_trabajador AND 
      (ol.numero_acta = ps.numero_serie OR ol.numero_guia = ps.numero_serie)
    )
    LEFT JOIN ordenes o ON ol.id_orden = o.id_orden
    WHERE ts.id_trabajador = ? AND (ts.estado = 'Usada' OR ts.estado = 'Liquidada') AND ts.id_producto = ?
      AND NOT EXISTS (
        SELECT 1 FROM orden_liquidacion_detalle old2 
        JOIN orden_liquidaciones ol2 ON old2.id_liquidacion = ol2.id_liquidacion
        WHERE ol2.id_trabajador = ts.id_trabajador 
          AND (old2.numero_serie = ps.numero_serie OR (old2.id_producto = ts.id_producto AND old2.id_liquidacion = ol.id_liquidacion))
      )
  `, [idTrabajador, idProducto]);

  console.log("\n✅ AHORA (Exactamente 2 registros reales de ONT HUAWEI):");
  console.table([...descAntes1, ...descAhora2]);

  process.exit(0);
}

testEdmundoExacto();
