const mysql = require('mysql2/promise');

async function inspectTechs() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    database: 'corporacioncespe_cespedes'
  });

  const [rows] = await conn.query(`
    SELECT t.id_trabajador, t.id_usuario, u.username, u.rol, u.tipo_servicio, u.estado as usuario_estado,
           t.cuadrilla, t.vehiculo_placa,
           TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS nombre_completo,
           u.dni
    FROM trabajadores t
    JOIN usuarios u ON t.id_usuario = u.id_usuario
    WHERE u.rol IN ('Tecnico', 'tecnico', 'Supervisor', 'supervisor')
    LIMIT 10
  `);

  console.log('Técnicos/Supervisores:', rows);

  // Ver tipos de servicio únicos
  const [servicios] = await conn.query(`
    SELECT DISTINCT u.tipo_servicio, u.rol
    FROM trabajadores t
    JOIN usuarios u ON t.id_usuario = u.id_usuario
  `);
  console.log('Servicios y roles:', servicios);

  await conn.end();
}

inspectTechs();

