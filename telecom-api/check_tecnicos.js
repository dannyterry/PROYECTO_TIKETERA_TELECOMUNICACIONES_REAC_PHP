const mysql = require('mysql2/promise');

async function check() {
  const p = mysql.createPool({ host: '127.0.0.1', user: 'root', password: '', database: 'corporacioncespe_cespedes' });
  const [rows] = await p.query(`
    SELECT 
      u.id_usuario, 
      CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, '')) as nombre, 
      u.estado as estado_usuario, 
      t.id_trabajador, 
      t.estado as estado_trabajador 
    FROM usuarios u 
    LEFT JOIN trabajadores t ON u.id_usuario = t.id_usuario 
    WHERE u.id_rol = 2
  `);
  console.table(rows);
  await p.end();
}

check();
