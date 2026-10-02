const mysql = require('mysql2/promise');

async function main() {
  const remoteConn = await mysql.createConnection({
    host: 'corporacioncespedes.com',
    port: 3306,
    user: 'corporacioncespe_miguel',
    password: 'corporacioncespe_123',
    database: 'corporacioncespe_cespedes'
  });

  // Ensure column usuario_ejecutor_fenix exists in hosting
  try {
    await remoteConn.query("ALTER TABLE ordenes ADD COLUMN usuario_ejecutor_fenix VARCHAR(255) DEFAULT NULL");
    console.log('✅ Columna usuario_ejecutor_fenix agregada en Hosting');
  } catch (e) {
    console.log('Nota columna hosting:', e.message);
  }

  // Update the 2 external orders in hosting
  const [res1] = await remoteConn.query(`
    UPDATE ordenes 
    SET estado = 'Finalizada Externa',
        tecnico_asignado = 'EXTERNO: MARIO CESAR SULCA CAJAHUARINGA',
        usuario_ejecutor_fenix = 'MARIO CESAR SULCA CAJAHUARINGA',
        id_tecnico = NULL
    WHERE numero = '3402198'
  `);
  console.log('Hosting 3402198 actualizado:', res1.affectedRows);

  const [res2] = await remoteConn.query(`
    UPDATE ordenes 
    SET estado = 'Finalizada Externa',
        tecnico_asignado = 'EXTERNO: ERICK ADALBERTO GALLARDO TARDILLO',
        usuario_ejecutor_fenix = 'ERICK ADALBERTO GALLARDO TARDILLO',
        id_tecnico = NULL
    WHERE numero = '3471757'
  `);
  console.log('Hosting 3471757 actualizado:', res2.affectedRows);

  await remoteConn.end();
}

main().catch(console.error);
