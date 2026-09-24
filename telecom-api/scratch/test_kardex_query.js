const mysql = require('mysql2/promise');

async function testKardex() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  const [movs] = await conn.query(`
    SELECT 
      m.id_movimiento,
      m.id_producto,
      p.codigo AS producto_codigo,
      p.nombre AS producto_nombre,
      p.es_drop,
      p.maneja_serie,
      COALESCE(c.nombre, 'MATERIALES') AS categoria,
      m.tipo,
      CASE 
        WHEN m.referencia LIKE '%Devolución%' OR m.referencia LIKE '%devolucion%' OR m.referencia LIKE '%Retorno%' THEN 'DEVOLUCION'
        WHEN m.referencia LIKE '%Compra%' OR m.referencia LIKE '%Factura%' OR m.referencia LIKE '%Ingreso%' THEN 'COMPRA_INGRESO'
        WHEN m.referencia LIKE '%Despacho%' OR m.referencia LIKE '%Dotación%' THEN 'DESPACHO_TECNICO'
        ELSE m.tipo
      END AS subtipo_movimiento,
      m.cantidad,
      ps.numero_serie,
      ps.codigo_serie,
      m.referencia,
      m.fecha_creacion
    FROM movimientos m
    JOIN productos p ON m.id_producto = p.id_producto
    LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
    LEFT JOIN producto_series ps ON m.id_producto_serie = ps.id_producto_serie
    ORDER BY m.fecha_creacion DESC, m.id_movimiento DESC
    LIMIT 20
  `);

  console.log(`Total movimientos en Kardex reciente: ${movs.length}`);
  console.table(movs.map(m => ({
    id: m.id_movimiento,
    producto: m.producto_nombre,
    tipo: m.tipo,
    subtipo: m.subtipo_movimiento,
    cantidad: `${m.cantidad} ${m.es_drop ? 'm' : 'und'}`,
    serie: m.numero_serie || '-',
    ref: m.referencia.slice(0, 45) + '...',
    fecha: m.fecha_creacion
  })));

  // También consultar consumos en órdenes liquidadas
  const [ordenLiquidaciones] = await conn.query(`
    SELECT 
      old.id_detalle,
      ol.id_liquidacion,
      ol.id_orden,
      o.numero AS orden_numero,
      ol.id_trabajador,
      TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS tecnico_nombre,
      u.cuadrilla,
      old.id_producto,
      p.nombre AS producto_nombre,
      p.codigo AS producto_codigo,
      COALESCE(c.nombre, 'MATERIALES') AS categoria,
      old.cantidad,
      old.numero_serie,
      ol.fecha_liquidacion
    FROM orden_liquidacion_detalle old
    JOIN orden_liquidaciones ol ON old.id_liquidacion = ol.id_liquidacion
    JOIN productos p ON old.id_producto = p.id_producto
    LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
    LEFT JOIN trabajadores t ON ol.id_trabajador = t.id_trabajador
    LEFT JOIN usuarios u ON t.id_usuario = u.id_usuario
    LEFT JOIN ordenes o ON ol.id_orden = o.id_orden
    ORDER BY ol.fecha_liquidacion DESC
    LIMIT 10
  `);
  console.log(`\nLiquidaciones en órdenes (Consumo campo):`);
  console.table(ordenLiquidaciones);

  await conn.end();
}

testKardex().catch(console.error);
