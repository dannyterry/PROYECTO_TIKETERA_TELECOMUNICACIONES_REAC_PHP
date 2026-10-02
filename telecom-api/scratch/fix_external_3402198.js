const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  const [res] = await conn.query(`
    UPDATE ordenes 
    SET estado = 'Finalizada Externa'
    WHERE (tecnico_asignado LIKE 'EXTERNO:%' OR (usuario_ejecutor_fenix IS NOT NULL AND id_tecnico IS NULL AND usuario_ejecutor_fenix != ''))
      AND estado = 'Finalizada'
  `);
  console.log('Órdenes actualizadas a Finalizada Externa:', res.affectedRows);

  const [order] = await conn.query("SELECT id_orden, numero, cliente, cuadrilla, tecnico_asignado, usuario_ejecutor_fenix, estado FROM ordenes WHERE numero = '3402198'");
  console.log('ESTADO ACTUALIZADO DE LA ORDEN 3402198:', order[0]);

  // Also check if remote hosting has this order and update it there as well if accessible
  try {
    const remoteConn = await mysql.createConnection({
      host: 'corporacioncespedes.com',
      port: 3306,
      user: 'corporacioncespe_miguel',
      password: 'corporacioncespe_123',
      database: 'corporacioncespe_cespedes'
    });
    const [remoteRes] = await remoteConn.query(`
      UPDATE ordenes 
      SET estado = 'Finalizada Externa'
      WHERE numero = '3402198' OR (tecnico_asignado LIKE 'EXTERNO:%' AND estado = 'Finalizada')
    `);
    console.log('Hosting actualizado a Finalizada Externa:', remoteRes.affectedRows);
    await remoteConn.end();
  } catch (e) {
    console.log('Nota hosting:', e.message);
  }

  await conn.end();
}

main().catch(console.error);
