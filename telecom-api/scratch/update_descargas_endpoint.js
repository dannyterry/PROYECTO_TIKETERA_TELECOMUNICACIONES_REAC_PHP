const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'server.js');
let content = fs.readFileSync(filePath, 'utf-8');

const normalize = str => str.replace(/\r\n/g, '\n');

const oldSeriesQuery = `      LEFT JOIN orden_liquidaciones ol ON (
        ol.id_trabajador = ts.id_trabajador AND 
        (ol.numero_acta = ps.numero_serie OR ol.numero_guia = ps.numero_serie OR EXISTS(
          SELECT 1 FROM orden_liquidacion_detalle old2 
          WHERE old2.id_liquidacion = ol.id_liquidacion AND old2.numero_serie = ps.numero_serie
        ))
      )
      LEFT JOIN ordenes o ON ol.id_orden = o.id_orden
      \${whereSeries}
      ORDER BY COALESCE(ol.fecha_liquidacion, ts.fecha_asignacion) DESC`;

const newSeriesQuery = `      LEFT JOIN orden_liquidaciones ol ON (
        ol.id_trabajador = ts.id_trabajador AND 
        (ol.numero_acta = ps.numero_serie OR ol.numero_guia = ps.numero_serie)
      )
      LEFT JOIN ordenes o ON ol.id_orden = o.id_orden
      \${whereSeries}
        AND NOT EXISTS (
          SELECT 1 FROM orden_liquidacion_detalle old2 
          JOIN orden_liquidaciones ol2 ON old2.id_liquidacion = ol2.id_liquidacion
          WHERE ol2.id_trabajador = ts.id_trabajador 
            AND (old2.numero_serie = ps.numero_serie OR (old2.id_producto = ts.id_producto AND old2.id_liquidacion = ol.id_liquidacion))
        )
      ORDER BY COALESCE(ol.fecha_liquidacion, ts.fecha_asignacion) DESC`;

if (normalize(content).includes(normalize(oldSeriesQuery))) {
  content = normalize(content).replace(normalize(oldSeriesQuery), newSeriesQuery);
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log("✅ server.js query de descargasSeries actualizada exitosamente");
} else {
  console.error("❌ No se encontró el bloque exacto en server.js");
}
