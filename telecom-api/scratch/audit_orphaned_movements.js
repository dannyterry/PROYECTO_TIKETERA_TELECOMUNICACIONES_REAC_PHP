const mysql = require('mysql2/promise');

async function auditOrphanedMovements() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  console.log('================================================================');
  console.log('🔍 AUDITORÍA EXACTA DE MOVIMIENTOS EN KARDEX VS ASIGNACIONES REALES');
  console.log('================================================================\n');

  // 1. Obtener todas las salidas de movimientos de materiales
  const [salidas] = await conn.execute(`
    SELECT m.id_movimiento, m.id_producto, p.codigo, p.nombre, m.cantidad, m.referencia, m.fecha_creacion
    FROM movimientos m
    JOIN productos p ON m.id_producto = p.id_producto
    WHERE m.tipo = 'SALIDA'
    ORDER BY m.id_producto, m.fecha_creacion
  `);

  console.log(`Total movimientos de SALIDA registrados en Kardex: ${salidas.length}`);

  // 2. Obtener los despachos registrados en despacho_detalles
  const [despachos] = await conn.execute(`
    SELECT dd.id_producto, dd.id_despacho, d.codigo_despacho, d.id_trabajador, dd.cantidad, d.fecha_despacho,
           CONCAT(u.nombres, ' ', COALESCE(u.primer_apellido, '')) as tecnico
    FROM despacho_detalles dd
    JOIN despachos d ON dd.id_despacho = d.id_despacho
    JOIN trabajadores t ON d.id_trabajador = t.id_trabajador
    JOIN usuarios u ON t.id_usuario = u.id_usuario
  `);

  console.log(`Total detalles de despachos activos en tabla despachos: ${despachos.length}\n`);

  // 3. Analizar por producto
  const [prods] = await conn.execute(`
    SELECT DISTINCT p.id_producto, p.codigo, p.nombre
    FROM productos p
    WHERE p.id_producto IN (SELECT id_producto FROM movimientos WHERE tipo = 'SALIDA')
       OR p.id_producto IN (SELECT id_producto FROM detalle_compras)
    ORDER BY p.nombre
  `);

  const auditResult = [];

  for (const p of prods) {
    const id = p.id_producto;
    const movsProd = salidas.filter(s => s.id_producto === id);
    const despProd = despachos.filter(d => d.id_producto === id);

    const totalSalidasKardex = movsProd.reduce((sum, m) => sum + Number(m.cantidad), 0);
    const totalDespachadoActivo = despProd.reduce((sum, d) => sum + Number(d.cantidad), 0);

    const [compras] = await conn.execute(`SELECT COALESCE(SUM(cantidad),0) as val FROM detalle_compras WHERE id_producto = ?`, [id]);
    const totalCompras = Number(compras[0].val);

    const [stockRows] = await conn.execute(`SELECT COALESCE(SUM(cantidad),0) as val FROM stock WHERE id_producto = ?`, [id]);
    const stockCentral = Number(stockRows[0].val);

    const [truckRows] = await conn.execute(`SELECT COALESCE(SUM(stock),0) as val FROM trabajador_productos WHERE id_producto = ?`, [id]);
    const stockCamionetas = Number(truckRows[0].val);

    const [liqRows] = await conn.execute(`SELECT COALESCE(SUM(cantidad),0) as val FROM orden_liquidacion_detalle WHERE id_producto = ?`, [id]);
    const stockLiquidado = Number(liqRows[0].val);

    const diferencia = totalCompras - (stockCentral + stockCamionetas + stockLiquidado);

    // Identificar movimientos huérfanos / eliminados
    const movsHuerfanos = movsProd.filter(m => {
      // Si la referencia menciona #31 o #66 o dotación semanal previa sin despacho correspondiente
      return m.referencia && (
        m.referencia.includes('#31') || 
        m.referencia.includes('#66') ||
        m.referencia.includes('Dotación semanal') ||
        m.referencia.includes('Asignación inicial')
      );
    });

    const cantidadHuerfana = movsHuerfanos.reduce((sum, m) => sum + Number(m.cantidad), 0);

    if (totalCompras > 0 || totalSalidasKardex > 0 || diferencia !== 0) {
      auditResult.push({
        id,
        codigo: p.codigo,
        nombre: p.nombre,
        compras: totalCompras,
        central: stockCentral,
        camionetas: stockCamionetas,
        liquidado: stockLiquidado,
        totalExistente: stockCentral + stockCamionetas + stockLiquidado,
        diferencia,
        salidasKardex: totalSalidasKardex,
        despachosActivos: totalDespachadoActivo,
        movsHuerfanosDetalle: movsHuerfanos.map(m => `[#${m.id_movimiento}: ${m.cantidad} und - "${m.referencia}"]`).join('; ')
      });
    }
  }

  console.table(auditResult.map(r => ({
    Código: r.codigo,
    Producto: r.nombre.slice(0, 24),
    Compras: r.compras,
    Central: r.central,
    Carros: r.camionetas,
    Liquidado: r.liquidado,
    'Total Calc': r.totalExistente,
    'Dif (En el Aire)': r.diferencia,
    'Movs Eliminados/Huérfanos': r.movsHuerfanosDetalle || 'Ninguno'
  })));

  await conn.end();
}

auditOrphanedMovements().catch(console.error);
