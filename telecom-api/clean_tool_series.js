const db = require('./db');

async function cleanNonEquipmentSeries() {
  // 1. Consultar todos los productos que tienen maneja_serie = 1
  const [prods] = await db.query(`
    SELECT p.id_producto, p.codigo, p.nombre, p.maneja_serie, c.nombre as categoria
    FROM productos p
    LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
  `);
  console.log('Todos los productos y sus categorias:');
  for (const p of prods) {
    if (p.maneja_serie) {
      console.log(`- ID: ${p.id_producto} | [${p.categoria}] ${p.nombre} (${p.codigo}) -> maneja_serie = 1`);
    }
  }

  // 2. Establecer maneja_serie = 0 para todas las herramientas, materiales, uniformes, etc.
  // Solo EQUIPOS (id_categoria = 7) y TALONARIOS (id_categoria = 11) deben manejar serie.
  await db.query(`
    UPDATE productos 
    SET maneja_serie = 0 
    WHERE id_categoria NOT IN (7, 11) 
       OR UPPER(nombre) LIKE '%FUSIONADORA%' 
       OR UPPER(nombre) LIKE '%POWER METER%' 
       OR UPPER(nombre) LIKE '%ESCALERA%'
  `);
  console.log('✅ Desactivado maneja_serie = 0 para herramientas e insumos.');

  // 3. Eliminar series de productos que NO sean equipos ni actas
  const [nonEqSeries] = await db.query(`
    SELECT ps.id_producto_serie, p.nombre, ps.numero_serie
    FROM producto_series ps
    JOIN productos p ON ps.id_producto = p.id_producto
    WHERE p.id_categoria NOT IN (7, 11)
       OR UPPER(p.nombre) LIKE '%FUSIONADORA%'
  `);
  console.log('Series no-equipos encontradas:', nonEqSeries.length);

  // Eliminar de trabajador_series
  await db.query(`
    DELETE ts FROM trabajador_series ts
    JOIN producto_series ps ON ts.id_producto_serie = ps.id_producto_serie
    JOIN productos p ON ps.id_producto = p.id_producto
    WHERE p.id_categoria NOT IN (7, 11)
       OR UPPER(p.nombre) LIKE '%FUSIONADORA%'
  `);

  // Eliminar de producto_series
  await db.query(`
    DELETE ps FROM producto_series ps
    JOIN productos p ON ps.id_producto = p.id_producto
    WHERE p.id_categoria NOT IN (7, 11)
       OR UPPER(p.nombre) LIKE '%FUSIONADORA%'
  `);
  console.log('✅ Series de herramientas eliminadas de producto_series.');

  // 4. Para los equipos reales (ONT, Mesh, Decos): Si hay alguna serie en 'RESERVADO' pero sin técnico asignado, pasarla a 'DISPONIBLE'
  await db.query(`
    UPDATE producto_series ps
    LEFT JOIN trabajador_series ts ON ps.id_producto_serie = ts.id_producto_serie AND ts.estado = 'Asignada'
    SET ps.estado = 'DISPONIBLE'
    WHERE ps.estado = 'RESERVADO' AND ts.id_trabajador_serie IS NULL
  `);
  console.log('✅ Series huérfanas en estado RESERVADO corregidas a DISPONIBLE.');

  // 5. Verificar productos serializados finales
  const [finalProds] = await db.query(`
    SELECT p.id_producto, p.codigo, p.nombre, p.maneja_serie, c.nombre as categoria
    FROM productos p
    LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
    WHERE p.maneja_serie = 1
  `);
  console.log('Productos serializados finales:', finalProds);

  process.exit();
}

cleanNonEquipmentSeries().catch(err => {
  console.error(err);
  process.exit(1);
});
