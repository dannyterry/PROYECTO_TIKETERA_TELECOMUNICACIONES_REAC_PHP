const mysql = require('d:/proyectofinal/telecom-api/node_modules/mysql2/promise');

async function inspectCarlos() {
  const prodPool = mysql.createPool({ host: 'corporacioncespedes.com', user: 'corporacioncespe_miguel', password: 'corporacioncespe_123', database: 'corporacioncespe_cespedes' });

  try {
    const [prodRows] = await prodPool.query("SELECT id_orden, numero, cliente, tecnico_asignado, cuadrilla, id_tecnico, usuario_ejecutor_fenix, estado, historial_estados FROM ordenes WHERE cliente LIKE '%CARLOS ALBERTO BRUNO%'");
    console.log("CARLOS ALBERTO:", prodRows[0]);
    let h = [];
    try { h = JSON.parse(prodRows[0].historial_estados || '[]'); } catch(e){}
    console.table(h);
  } catch (err) {
    console.error(err);
  } finally {
    await prodPool.end();
  }
}

inspectCarlos();
