const mysql = require('mysql2/promise');

async function testEndpoint() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  // Query 1: Movimientos Generales de Kardex (Compras, Despachos, Devoluciones, Ajustes)
  const [movs] = await pool.query(`
    SELECT 
      CONCAT('MOV-', m.id_movimiento) AS id_unico,
      'KARDEX' AS origen,
      m.id_movimiento,
      m.id_producto,
      p.codigo AS producto_codigo,
      p.nombre AS producto_nombre,
      p.es_drop,
      p.maneja_serie,
      COALESCE(c.nombre, 'MATERIALES') AS categoria,
      m.tipo,
      CASE 
        WHEN m.referencia LIKE '%Devolución%' OR m.referencia LIKE '%devolucion%' OR m.referencia LIKE '%Retorno%' THEN 'DEVOLUCION_TECNICO'
        WHEN m.referencia LIKE '%Compra%' OR m.referencia LIKE '%Factura%' OR m.referencia LIKE '%Ingreso%' THEN 'COMPRA_INGRESO'
        WHEN m.referencia LIKE '%Despacho%' OR m.referencia LIKE '%Dotación%' THEN 'DESPACHO_TECNICO'
        WHEN m.referencia LIKE '%Ajuste%' THEN 'AJUSTE_INVENTARIO'
        ELSE m.tipo
      END AS subtipo,
      m.cantidad,
      COALESCE(ps.numero_serie, '') AS numero_serie,
      COALESCE(ps.codigo_serie, '') AS codigo_serie,
      m.referencia,
      m.fecha_creacion AS fecha
    FROM movimientos m
    JOIN productos p ON m.id_producto = p.id_producto
    LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
    LEFT JOIN producto_series ps ON m.id_producto_serie = ps.id_producto_serie
    ORDER BY m.fecha_creacion DESC, m.id_movimiento DESC
  `);

  // Query 2: Consumos y Descargos en Órdenes de Trabajo de Campo
  const [ordenLiquidaciones] = await pool.query(`
    SELECT 
      CONCAT('ORD-', old.id_detalle_liq) AS id_unico,
      'ORDEN_CAMPO' AS origen,
      old.id_detalle_liq AS id_movimiento,
      old.id_producto,
      p.codigo AS producto_codigo,
      p.nombre AS producto_nombre,
      p.es_drop,
      p.maneja_serie,
      COALESCE(c.nombre, 'MATERIALES') AS categoria,
      'SALIDA' AS tipo,
      'LIQUIDACION_ORDEN' AS subtipo,
      old.cantidad,
      COALESCE(old.numero_serie, '') AS numero_serie,
      '' AS codigo_serie,
      CONCAT('Descargo en Orden #', COALESCE(o.numero, old.id_liquidacion), ' - Técnico: ', TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, '')))) AS referencia,
      ol.fecha_liquidacion AS fecha
    FROM orden_liquidacion_detalle old
    JOIN orden_liquidaciones ol ON old.id_liquidacion = ol.id_liquidacion
    JOIN productos p ON old.id_producto = p.id_producto
    LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
    LEFT JOIN trabajadores t ON ol.id_trabajador = t.id_trabajador
    LEFT JOIN usuarios u ON t.id_usuario = u.id_usuario
    LEFT JOIN ordenes o ON ol.id_orden = o.id_orden
    ORDER BY ol.fecha_liquidacion DESC
  `);

  // Unificar y ordenar por fecha descendente
  const todos = [...movs, ...ordenLiquidaciones].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  console.log(`Total movimientos unificados: ${todos.length}`);
  console.log('Muestra de los 5 primeros:');
  console.table(todos.slice(0, 5));

  const totalEntradas = todos.filter(m => m.tipo === 'ENTRADA').reduce((acc, m) => acc + Number(m.cantidad || 0), 0);
  const totalDespachos = todos.filter(m => m.subtipo === 'DESPACHO_TECNICO').reduce((acc, m) => acc + Number(m.cantidad || 0), 0);
  const totalDevoluciones = todos.filter(m => m.subtipo === 'DEVOLUCION_TECNICO').reduce((acc, m) => acc + Number(m.cantidad || 0), 0);
  const totalConsumoOrdenes = todos.filter(m => m.subtipo === 'LIQUIDACION_ORDEN').reduce((acc, m) => acc + Number(m.cantidad || 0), 0);

  console.log('KPIs:', { totalMovimientos: todos.length, totalEntradas, totalDespachos, totalDevoluciones, totalConsumoOrdenes });

  await pool.end();
}

testEndpoint().catch(console.error);
