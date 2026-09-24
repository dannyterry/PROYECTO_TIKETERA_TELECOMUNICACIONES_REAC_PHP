const mysql = require('mysql2/promise');

async function testSupervisionQueries() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  console.log('--- 1. TÉCNICOS COMBO (SOLO ROL TÉCNICO) ---');
  const [tecnicos] = await conn.query(`
    SELECT 
      COALESCE(t.id_trabajador, u.id_usuario) as id_tecnico,
      CONCAT(TRIM(COALESCE(u.nombres, '')), ' ', TRIM(COALESCE(u.primer_apellido, u.apellidos, ''))) as tecnico,
      COALESCE(u.documento, '') as dni,
      COALESCE(u.cuadrilla, '') as cuadrilla,
      r.nombre as rol
    FROM usuarios u
    LEFT JOIN trabajadores t ON t.id_usuario = u.id_usuario
    LEFT JOIN roles r ON u.id_rol = r.id_rol
    WHERE u.estado = 'Activo'
      AND (
        u.id_rol = 2 
        OR (UPPER(COALESCE(r.nombre, '')) LIKE '%TECNIC%' AND UPPER(COALESCE(r.nombre, '')) NOT LIKE '%ADMIN%')
      )
    ORDER BY u.nombres ASC, u.apellidos ASC
  `);
  console.table(tecnicos);

  console.log('\n--- 2. SUPERVISORES COMBO (SOLO ROL SUPERVISOR / ADMIN) ---');
  const [supervisores] = await conn.query(`
    SELECT 
      u.id_usuario,
      CONCAT(TRIM(COALESCE(u.nombres, '')), ' ', TRIM(COALESCE(u.primer_apellido, u.apellidos, ''))) as supervisor,
      u.usuario,
      COALESCE(r.nombre, '') as rol
    FROM usuarios u
    LEFT JOIN roles r ON u.id_rol = r.id_rol
    WHERE u.estado = 'Activo'
      AND (
        u.id_rol = 6 
        OR UPPER(COALESCE(r.nombre, '')) LIKE '%SUPERVIC%' 
        OR UPPER(COALESCE(r.nombre, '')) LIKE '%SUPERVIS%'
        OR UPPER(COALESCE(u.cargo, '')) LIKE '%SUPERVISOR%'
        OR u.id_rol = 1
      )
    ORDER BY u.nombres ASC, u.apellidos ASC
  `);
  console.table(supervisores);

  await conn.end();
}

testSupervisionQueries().catch(console.error);
