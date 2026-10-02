const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost', user: 'root', password: '', database: 'corporacioncespe_cespedes'
  });

  const [order] = await conn.query("SELECT * FROM ordenes WHERE numero = '3471757'");
  console.log('--- DETALLE DE ORDEN 3471757 ---');
  console.log(order[0]);

  // Check if there are tasks for 3471757 in orden_tareas or similar
  try {
    const [tareas] = await conn.query("SELECT * FROM orden_tareas WHERE id_orden = ? OR numero_orden = ?", [order[0]?.id_orden, '3471757']);
    console.log('\n--- TAREAS DE LA ORDEN ---', tareas.length);
    console.log(tareas);
  } catch (e) {
    console.log('Error tareas:', e.message);
  }

  // Check if remote hosting has more info on 3471757
  try {
    const remoteConn = await mysql.createConnection({
      host: 'corporacioncespedes.com', port: 3306, user: 'corporacioncespe_miguel', password: 'corporacioncespe_123', database: 'corporacioncespe_cespedes'
    });
    const [remoteOrder] = await remoteConn.query("SELECT * FROM ordenes WHERE numero = '3471757'");
    console.log('\n--- DETALLE EN HOSTING DE 3471757 ---');
    console.log(remoteOrder[0]);
    await remoteConn.end();
  } catch (e) {
    console.log('Error hosting:', e.message);
  }

  await conn.end();
}

main().catch(console.error);
