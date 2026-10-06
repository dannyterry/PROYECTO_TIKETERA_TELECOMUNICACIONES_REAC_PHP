const mysql = require('d:/proyectofinal/telecom-api/node_modules/mysql2/promise');

async function fixLocal() {
  const conn = await mysql.createConnection({ host: '127.0.0.1', user: 'root', password: '', database: 'corporacioncespe_cespedes', port: 3306 });
  try {
    await conn.query("UPDATE ordenes SET estado = 'Finalizada', tecnico_asignado = 'KLINDER WALTER PANIURA RAMIREZ', id_tecnico = 75, usuario_ejecutor_fenix = 'KLINDER WALTER PANIURA RAMIREZ' WHERE numero = '3416734'");
    await conn.query("UPDATE ordenes SET estado = 'Finalizada', tecnico_asignado = 'SAITH ABRAHAM ILIZARBE BERROCAL', id_tecnico = 106, usuario_ejecutor_fenix = 'SAITH ABRAHAM ILIZARBE BERROCAL' WHERE numero = '3416446'");
    await conn.query("UPDATE ordenes SET estado = 'Finalizada', tecnico_asignado = 'BRAYAN JESUS CANELON GONZALES', id_tecnico = 67, usuario_ejecutor_fenix = 'BRAYAN JESUS CANELON GONZALES' WHERE numero = '3417904'");
    console.log("✅ Local DB sincronizado.");
  } finally {
    await conn.end();
  }
}

fixLocal();
