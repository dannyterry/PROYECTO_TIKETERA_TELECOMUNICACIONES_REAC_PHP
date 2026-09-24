const db = require('../db');

(async () => {
  try {
    const [rows] = await db.query(`
      SELECT 
        u.id_usuario,
        CONCAT(TRIM(COALESCE(u.nombres, '')), ' ', TRIM(COALESCE(u.primer_apellido, u.apellidos, ''))) as supervisor,
        u.usuario,
        COALESCE(r.nombre, u.cargo, 'SUPERVISOR') as cargo,
        COALESCE(u.telefono, '') as telefono
      FROM usuarios u
      LEFT JOIN roles r ON u.id_rol = r.id_rol
      WHERE u.estado = 'Activo'
        AND (
          u.id_rol = 6 
          OR UPPER(COALESCE(r.nombre, '')) LIKE '%SUPERVIC%' 
          OR UPPER(COALESCE(r.nombre, '')) LIKE '%SUPERVIS%'
        )
      ORDER BY u.nombres ASC, u.primer_apellido ASC
    `);
    console.log('Resultados supervisores:', rows);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
})();
