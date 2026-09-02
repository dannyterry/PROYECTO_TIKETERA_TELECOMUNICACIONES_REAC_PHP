const pool = require('./db.js');

async function migrateSeriesSchema() {
  console.log("--------------------------------------------------");
  console.log("🛠️ MIGRACIÓN: AGREGAR codigo_serie A producto_series");
  console.log("--------------------------------------------------");

  // 1. Verificar si la columna codigo_serie ya existe
  const [cols] = await pool.query("SHOW COLUMNS FROM producto_series LIKE 'codigo_serie'");
  if (cols.length === 0) {
    await pool.query("ALTER TABLE producto_series ADD COLUMN codigo_serie VARCHAR(50) NULL AFTER id_producto");
    console.log("✅ Columna 'codigo_serie' agregada con éxito a 'producto_series'.");
  } else {
    console.log("ℹ️ La columna 'codigo_serie' ya existía.");
  }

  // 2. Actualizar códigos de los modelos principales en la tabla productos (3 letras limpias)
  await pool.query("UPDATE productos SET codigo = 'ZTA' WHERE id_producto = 37");
  await pool.query("UPDATE productos SET codigo = 'ZTB' WHERE id_producto = 38");
  await pool.query("UPDATE productos SET codigo = 'WTA' WHERE id_producto = 39");
  console.log("✅ Códigos de modelos configurados: 37->ZTA, 38->ZTB, 39->WTA.");

  // 3. Generar códigos correlativos para las series existentes que no tengan codigo_serie
  const [prods] = await pool.query("SELECT id_producto, codigo, nombre FROM productos WHERE maneja_serie = 1");

  for (const p of prods) {
    const modelCode = (p.codigo || 'EQA').trim();
    const [series] = await pool.query(
      "SELECT id_producto_serie, numero_serie, codigo_serie FROM producto_series WHERE id_producto = ? ORDER BY id_producto_serie ASC",
      [p.id_producto]
    );

    let num = 1;
    for (const s of series) {
      if (!s.codigo_serie) {
        const codigoSerie = `${modelCode}-S${String(num).padStart(3, '0')}`;
        await pool.query(
          "UPDATE producto_series SET codigo_serie = ? WHERE id_producto_serie = ?",
          [codigoSerie, s.id_producto_serie]
        );
      }
      num++;
    }
    console.log(`📦 Producto "${p.nombre}" (${modelCode}): ${series.length} series correlativas actualizadas.`);
  }

  // 4. Mostrar muestra de series con sus nuevos códigos
  const [muestra] = await pool.query(`
    SELECT ps.id_producto_serie, p.codigo AS cod_modelo, p.nombre AS modelo, ps.codigo_serie, ps.numero_serie, ps.estado
    FROM producto_series ps
    JOIN productos p ON ps.id_producto = p.id_producto
    ORDER BY ps.id_producto_serie ASC
    LIMIT 10
  `);
  console.table(muestra);

  process.exit(0);
}

migrateSeriesSchema().catch(console.error);
