const pool = require('../db');

(async () => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Limpiar áreas antiguas
    await conn.query("DELETE FROM roles_areas");
    await conn.query("DELETE FROM areas");

    // 2. Las 10 áreas exactas solicitadas
    const areasDeseadas = [
      'Operaciones',
      'RRHH',
      'Tecnología',
      'Logística',
      'Almacén',
      'Post venta',
      'Moto win',
      'Ordenamiento',
      'Visita técnica',
      'Tecnico 2'
    ];

    for (let i = 0; i < areasDeseadas.length; i++) {
      await conn.query(
        "INSERT INTO areas (id_area, nombre, estado, fecha_creacion) VALUES (?, ?, 'Activo', NOW())",
        [i + 1, areasDeseadas[i]]
      );
    }

    await conn.commit();
    console.log('✅ ¡10 áreas sincronizadas correctamente en MySQL!');

    const [rows] = await conn.query("SELECT id_area, nombre, estado FROM areas ORDER BY id_area ASC");
    console.log(rows);
  } catch (err) {
    await conn.rollback();
    console.error('❌ Error al sincronizar áreas:', err);
  } finally {
    conn.release();
    process.exit(0);
  }
})();
