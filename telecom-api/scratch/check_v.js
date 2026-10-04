const mysql = require('mysql2/promise');

async function testVillalba() {
  const pool = mysql.createPool({ host: '127.0.0.1', user: 'root', password: '', database: 'corporacioncespe_cespedes' });
  const [u] = await pool.query("SELECT u.id_usuario, t.id_trabajador, u.nombres, u.primer_apellido, u.cuadrilla, t.id_vehiculo, t.estado FROM usuarios u LEFT JOIN trabajadores t ON u.id_usuario = t.id_usuario WHERE u.primer_apellido LIKE '%VILLALBA%' OR u.nombres LIKE '%EDIXON%'");
  console.log('Usuario Villalba:', u);

  const [ord] = await pool.query("SELECT id_orden, numero, estado, fecha_visita, fecha_solicitud, cuadrilla, tecnico_asignado, georeferencia FROM ordenes WHERE (tecnico_asignado LIKE '%VILLALBA%' OR cuadrilla LIKE '%MOTOWIN%') AND (DATE(fecha_visita) = '2026-10-03' OR DATE(fecha_solicitud) = '2026-10-03')");
  console.log('Total ordenes 2026-10-03:', ord.length);
  console.log(ord);

  process.exit(0);
}

testVillalba();
