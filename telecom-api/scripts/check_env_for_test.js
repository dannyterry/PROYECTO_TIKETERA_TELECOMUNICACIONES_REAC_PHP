const pool = require('../db');

async function run() {
  try {
    console.log("=== VERIFICANDO TABLAS ===");
    const [t1] = await pool.query("SHOW TABLES LIKE 'liquidaciones_tecnicos'");
    console.log("liquidaciones_tecnicos:", t1.length > 0 ? "EXISTE" : "NO EXISTE");
    const [t2] = await pool.query("SHOW TABLES LIKE 'liquidacion_detalles'");
    console.log("liquidacion_detalles:", t2.length > 0 ? "EXISTE" : "NO EXISTE");

    // Verificar si hay categorías
    const [cats] = await pool.query("SELECT id_categoria, nombre FROM categorias LIMIT 5");
    console.log("Categorías:", cats);

    // Buscar técnico Brayan
    const [tech] = await pool.query(`
      SELECT t.id_trabajador, t.id_usuario, u.nombres, u.apellidos, t.id_vehiculo
      FROM trabajadores t
      JOIN usuarios u ON t.id_usuario = u.id_usuario
      WHERE u.nombres LIKE '%BRAYAN%' OR u.apellidos LIKE '%CANELON%'
    `);
    console.log("Técnico encontrado:", tech);

    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

run();
