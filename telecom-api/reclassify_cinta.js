const db = require('./db');

async function reclassifyCinta() {
  const [cats] = await db.query('SELECT id_categoria, nombre FROM categorias');
  console.log('Categorias disponibles:', cats);

  const herCat = cats.find(c => c.nombre.toUpperCase().includes('HERRAMIENTA'));
  if (!herCat) {
    console.error('No se encontró la categoría HERRAMIENTAS');
    process.exit(1);
  }

  await db.query(
    "UPDATE productos SET id_categoria = ?, codigo = 'HER-CIN-01' WHERE id_producto = 43 OR UPPER(nombre) LIKE '%CINTA AISLANTE%'",
    [herCat.id_categoria]
  );
  console.log(`✅ Cinta aislante reclasificada a "${herCat.nombre}" (ID: ${herCat.id_categoria}) con código HER-CIN-01.`);

  const [cinta] = await db.query(`
    SELECT p.id_producto, p.codigo, p.nombre, c.nombre as categoria, p.maneja_serie, p.es_drop
    FROM productos p
    JOIN categorias c ON p.id_categoria = c.id_categoria
    WHERE p.id_producto = 43
  `);
  console.log('Estado actual de la cinta:', cinta[0]);

  process.exit();
}

reclassifyCinta().catch(err => {
  console.error(err);
  process.exit(1);
});
