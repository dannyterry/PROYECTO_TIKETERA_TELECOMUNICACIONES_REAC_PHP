const db = require('./db');

async function auditProject() {
  console.log('==================================================');
  console.log('🔍 AUDITORÍA INTEGRAL DE BASE DE DATOS Y FLUJOS');
  console.log('==================================================\n');

  // 1. Listar todas las tablas existentes
  const [tables] = await db.query('SHOW TABLES');
  const tableNames = tables.map(t => Object.values(t)[0]);
  console.log(`📋 Total de tablas en la base de datos (${tableNames.length}):`, tableNames.join(', '));

  // 2. Revisar Catálogo de Productos y Posibles Duplicados
  console.log('\n--- 📦 1. AUDITORÍA DE PRODUCTOS Y CATEGORÍAS ---');
  const [prods] = await db.query(`
    SELECT p.id_producto, p.codigo, p.nombre, p.maneja_serie, p.es_drop, p.stock_minimo, p.precio_compra,
           c.id_categoria, c.nombre AS categoria,
           COALESCE(s.cantidad, 0) AS stock_central,
           (SELECT COALESCE(SUM(stock), 0) FROM trabajador_productos WHERE id_producto = p.id_producto) AS stock_en_tecnicos,
           (SELECT COUNT(*) FROM producto_series WHERE id_producto = p.id_producto AND estado = 'DISPONIBLE') AS series_disp_almacen,
           (SELECT COUNT(*) FROM producto_series WHERE id_producto = p.id_producto AND estado = 'RESERVADO') AS series_en_tecnicos
    FROM productos p
    LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
    LEFT JOIN stock s ON p.id_producto = s.id_producto AND s.id_almacen = 1
    ORDER BY c.nombre ASC, p.nombre ASC
  `);

  console.log(`Total de productos activos: ${prods.length}`);
  const prodNombres = prods.map(p => p.nombre.trim().toUpperCase());
  const duplicadosNom = prods.filter((p, idx) => prodNombres.indexOf(p.nombre.trim().toUpperCase()) !== idx);
  if (duplicadosNom.length > 0) {
    console.log('⚠️ Productos con nombres duplicados o redundantes:', duplicadosNom.map(d => `${d.nombre} (ID: ${d.id_producto})`));
  } else {
    console.log('✅ No hay productos con nombres exactamente duplicados.');
  }

  // 3. Revisar discrepancias entre Stock Físico y Series
  console.log('\n--- 🏷️ 2. CUADRE ENTRE STOCK FÍSICO Y SERIES ---');
  const serializados = prods.filter(p => p.maneja_serie);
  let hayDiscrepancias = false;
  for (const p of serializados) {
    const stockCentral = Number(p.stock_central);
    const seriesCentral = Number(p.series_disp_almacen);
    const stockTec = Number(p.stock_en_tecnicos);
    const seriesTec = Number(p.series_en_tecnicos);

    const diffCentral = stockCentral !== seriesCentral;
    const diffTec = stockTec !== seriesTec;

    if (diffCentral || diffTec) {
      hayDiscrepancias = true;
      console.log(`⚠️ DESCUADRE en [${p.categoria}] ${p.nombre} (ID: ${p.id_producto}):`);
      if (diffCentral) console.log(`   - Central: Stock = ${stockCentral} vs Series Disp = ${seriesCentral}`);
      if (diffTec) console.log(`   - Técnicos: Stock = ${stockTec} vs Series Asignadas = ${seriesTec}`);
    }
  }
  if (!hayDiscrepancias) {
    console.log('✅ Todos los productos serializados cuadran 100% (Stock Físico == Series Registradas).');
  }

  // 4. Revisar Integridad de Técnicos y Asignaciones
  console.log('\n--- 👥 3. TÉCNICOS, CUADRILLAS Y ASIGNACIONES ---');
  const [tecnicos] = await db.query(`
    SELECT t.id_trabajador, u.id_usuario, CONCAT(u.nombres, ' ', COALESCE(u.primer_apellido, u.apellidos, '')) as nombre,
           u.cuadrilla, v.placa as vehiculo_placa,
           (SELECT COUNT(*) FROM trabajador_productos WHERE id_trabajador = t.id_trabajador AND stock > 0) as tipos_insumos,
           (SELECT COUNT(*) FROM trabajador_series WHERE id_trabajador = t.id_trabajador AND estado = 'Asignada') as series_activas
    FROM trabajadores t
    JOIN usuarios u ON t.id_usuario = u.id_usuario
    LEFT JOIN vehiculos v ON t.id_vehiculo = v.id_vehiculo
  `);
  console.log(`Total trabajadores registrados: ${tecnicos.length}`);
  tecnicos.forEach(t => {
    console.log(`- ID: ${t.id_trabajador} | ${t.nombre} | Cuadrilla: ${t.cuadrilla || 'S/C'} | Placa: ${t.vehiculo_placa || 'S/V'} | Insumos: ${t.tipos_insumos} | Series: ${t.series_activas}`);
  });

  // 5. Revisar Liquidaciones, Equipos Retirados y Materiales Consumidos
  console.log('\n--- 📝 4. AUDITORÍA DE LIQUIDACIONES Y EQUIPOS RETIRADOS ---');
  const [liqCount] = await db.query('SELECT COUNT(*) as total FROM orden_liquidaciones');
  const [detCount] = await db.query('SELECT COUNT(*) as total FROM orden_liquidacion_detalle');
  const [retCount] = await db.query('SELECT COUNT(*) as total FROM orden_equipos_retirados');
  console.log(`Total Liquidaciones guardadas: ${liqCount[0].total}`);
  console.log(`Total Detalles de Materiales Usados en Actas: ${detCount[0].total}`);
  console.log(`Total Equipos Retirados de Clientes: ${retCount[0].total}`);

  // 6. Revisar Huérfanos o Claves Foráneas Desconectadas
  console.log('\n--- 🔗 5. DETECCIÓN DE REGISTROS HUÉRFANOS ---');
  const [huerfanosTS] = await db.query(`
    SELECT ts.id_trabajador_serie, ts.id_producto_serie
    FROM trabajador_series ts
    LEFT JOIN producto_series ps ON ts.id_producto_serie = ps.id_producto_serie
    WHERE ps.id_producto_serie IS NULL
  `);
  console.log(`Series en técnicos sin producto_serie (huérfanas): ${huerfanosTS.length}`);

  const [huerfanosTP] = await db.query(`
    SELECT tp.id_trabajador_producto, tp.id_producto
    FROM trabajador_productos tp
    LEFT JOIN productos p ON tp.id_producto = p.id_producto
    WHERE p.id_producto IS NULL
  `);
  console.log(`Insumos en técnicos sin producto (huérfanos): ${huerfanosTP.length}`);

  process.exit();
}

auditProject().catch(err => {
  console.error('Error durante auditoría:', err);
  process.exit(1);
});
