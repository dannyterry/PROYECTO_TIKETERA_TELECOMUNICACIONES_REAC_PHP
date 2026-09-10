const pool = require('../db');

(async () => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Limpiar áreas antiguas y relaciones huérfanas
    await conn.query("DELETE FROM roles_areas");
    await conn.query("DELETE FROM areas");

    // 2. Las 10 áreas exactas solicitadas por la empresa
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

    // 3. Normalizar usuarios.area con las áreas válidas
    await conn.query("UPDATE usuarios SET area = 'Operaciones' WHERE LOWER(TRIM(area)) = 'operaciones'");
    await conn.query("UPDATE usuarios SET area = 'RRHH' WHERE LOWER(TRIM(area)) IN ('rrhh', 'rr.hh.', 'rr hh', 'recursos humanos')");
    await conn.query("UPDATE usuarios SET area = 'Almacén' WHERE LOWER(TRIM(area)) LIKE '%almac%'");
    await conn.query("UPDATE usuarios SET area = 'Tecnología' WHERE LOWER(TRIM(area)) LIKE '%tecnolog%'");
    await conn.query("UPDATE usuarios SET area = 'Visita técnica' WHERE LOWER(TRIM(area)) LIKE '%visita%'");

    await conn.commit();
    console.log('✅ ¡10 áreas sincronizadas correctamente en MySQL!');

    const [rows] = await conn.query(`
      SELECT 
        a.id_area, 
        a.nombre, 
        a.estado,
        (SELECT COUNT(*) FROM usuarios u WHERE LOWER(TRIM(u.area)) = LOWER(TRIM(a.nombre))) AS total_empleados
      FROM areas a 
      ORDER BY a.id_area ASC
    `);
    console.log('--- REPORTE FINAL DE ÁREAS ---');
    console.table(rows);
  } catch (err) {
    await conn.rollback();
    console.error('❌ Error al sincronizar áreas:', err);
  } finally {
    conn.release();
    process.exit(0);
  }
})();
