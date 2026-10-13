const mysql = require('mysql2/promise');
const fs = require('fs');

const REMOTE_CONFIG = {
  host: 'corporacioncespedes.com',
  user: 'corporacioncespe_miguel',
  password: 'corporacioncespe_123',
  database: 'corporacioncespe_cespedes',
  dateStrings: true,
  connectTimeout: 30000
};

async function auditEdmundo() {
  const conn = await mysql.createConnection(REMOTE_CONFIG);
  try {
    console.log("=== 1. BUSCANDO A EDMUNDO FLORES ===");
    const [techs] = await conn.query(`
      SELECT t.id_trabajador, t.id_usuario, u.nombres, u.apellidos, u.usuario, u.cuadrilla, t.estado
      FROM trabajadores t
      JOIN usuarios u ON t.id_usuario = u.id_usuario
      WHERE u.nombres LIKE '%EDMUNDO%' OR u.apellidos LIKE '%EDMUNDO%'
         OR u.nombres LIKE '%FLORES%' OR u.apellidos LIKE '%FLORES%'
    `);
    console.log("Trabajadores encontrados:", techs);

    if (techs.length === 0) {
      console.log("No se encontró ningún trabajador con ese nombre.");
      return;
    }

    const edmundo = techs.find(t => 
      (t.nombres + ' ' + t.apellidos).toUpperCase().includes('EDMUNDO')
    ) || techs[0];

    const idTrabajador = edmundo.id_trabajador;
    console.log(`\n=== AUDITANDO ID TRABAJADOR: ${idTrabajador} (${edmundo.nombres} ${edmundo.apellidos}) ===\n`);

    // 2. Órdenes Liquidadas por Edmundo Flores
    const [ordenes] = await conn.query(`
      SELECT 
        ol.id_liquidacion,
        ol.id_orden,
        o.numero AS numero_ticket,
        ol.numero_acta,
        ol.tipo_trabajo_acta,
        ol.fecha_liquidacion,
        ol.liquidado_por,
        ol.estado AS estado_liquidacion,
        ol.drop_total_metros
      FROM orden_liquidaciones ol
      LEFT JOIN ordenes o ON ol.id_orden = o.id_orden
      WHERE ol.id_trabajador = ?
      ORDER BY ol.fecha_liquidacion ASC
    `, [idTrabajador]);
    console.log(`Órdenes liquidadas encontradas: ${ordenes.length}`);

    // Materiales consumidos en esas liquidaciones
    const [matsConsumidos] = await conn.query(`
      SELECT 
        old.id_producto,
        p.nombre AS producto_nombre,
        p.es_drop,
        p.categoria_liquidar,
        SUM(old.cantidad) AS total_consumido
      FROM orden_liquidacion_detalle old
      JOIN orden_liquidaciones ol ON old.id_liquidacion = ol.id_liquidacion
      JOIN productos p ON old.id_producto = p.id_producto
      WHERE ol.id_trabajador = ?
      GROUP BY old.id_producto, p.nombre, p.es_drop, p.categoria_liquidar
    `, [idTrabajador]);

    // Detalle orden por orden
    const [detalleOrdenes] = await conn.query(`
      SELECT 
        ol.id_orden,
        o.numero AS numero_ticket,
        ol.numero_acta,
        ol.tipo_trabajo_acta,
        p.id_producto,
        p.nombre AS producto_nombre,
        old.cantidad,
        old.numero_serie,
        old.drop_inicio,
        old.drop_fin
      FROM orden_liquidaciones ol
      LEFT JOIN ordenes o ON ol.id_orden = o.id_orden
      LEFT JOIN orden_liquidacion_detalle old ON ol.id_liquidacion = old.id_liquidacion
      LEFT JOIN productos p ON old.id_producto = p.id_producto
      WHERE ol.id_trabajador = ?
      ORDER BY ol.fecha_liquidacion ASC, old.id_detalle_liq ASC
    `, [idTrabajador]);

    // 3. Stock Actual en Camioneta (trabajador_productos)
    const [stockMovil] = await conn.query(`
      SELECT 
        tp.id_producto,
        p.nombre AS producto_nombre,
        p.es_drop,
        p.categoria_liquidar,
        c.nombre AS categoria,
        tp.stock AS stock_actual_movil
      FROM trabajador_productos tp
      JOIN productos p ON tp.id_producto = p.id_producto
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      WHERE tp.id_trabajador = ?
      ORDER BY c.nombre ASC, p.nombre ASC
    `, [idTrabajador]);

    // 4. Movimientos / Despachos históricos de Almacén al Técnico
    const [movsDespacho] = await conn.query(`
      SELECT 
        m.id_producto,
        p.nombre AS producto_nombre,
        m.tipo_movimiento,
        SUM(m.cantidad) AS total_cantidad
      FROM movimientos m
      JOIN productos p ON m.id_producto = p.id_producto
      WHERE m.id_trabajador = ?
      GROUP BY m.id_producto, p.nombre, m.tipo_movimiento
    `, [idTrabajador]);

    // 5. Series en Custodia (trabajador_series)
    const [seriesCustodia] = await conn.query(`
      SELECT 
        ts.id_trabajador_serie,
        ts.id_producto,
        p.nombre AS equipo_nombre,
        ps.numero_serie,
        ts.estado,
        c.nombre AS categoria
      FROM trabajador_series ts
      JOIN producto_series ps ON ts.id_producto_serie = ps.id_producto_serie
      JOIN productos p ON ts.id_producto = p.id_producto
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      WHERE ts.id_trabajador = ?
      ORDER BY p.nombre ASC, ps.numero_serie ASC
    `, [idTrabajador]);

    console.log("\n=== RESUMEN OBTENIDO CON ÉXITO ===");
    console.log({
      totalOrdenes: ordenes.length,
      matsConsumidosCount: matsConsumidos.length,
      stockMovilCount: stockMovil.length,
      movsCount: movsDespacho.length,
      seriesCount: seriesCustodia.length
    });

    fs.writeFileSync('d:/proyectofinal/telecom-api/scratch/edmundo_data.json', JSON.stringify({
      edmundo,
      ordenes,
      matsConsumidos,
      detalleOrdenes,
      stockMovil,
      movsDespacho,
      seriesCustodia
    }, null, 2));

    console.log("Datos exportados a scratch/edmundo_data.json");
  } catch (err) {
    console.error("Error en auditoría:", err);
  } finally {
    await conn.end();
    process.exit(0);
  }
}

auditEdmundo();
