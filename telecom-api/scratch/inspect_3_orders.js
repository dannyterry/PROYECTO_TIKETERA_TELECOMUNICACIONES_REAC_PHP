const mysql = require('d:/proyectofinal/telecom-api/node_modules/mysql2/promise');

async function inspectOrders() {
  const localPool = mysql.createPool({ host: '127.0.0.1', user: 'root', password: '', database: 'corporacioncespe_cespedes', port: 3306 });
  const prodPool = mysql.createPool({ host: 'corporacioncespedes.com', user: 'corporacioncespe_miguel', password: 'corporacioncespe_123', database: 'corporacioncespe_cespedes' });

  try {
    const nums = ['3416734', '3417984', '3416446'];
    const [localRows] = await localPool.query("SELECT id_orden, numero, cliente, tecnico_asignado, cuadrilla, id_tecnico, usuario_ejecutor_fenix, estado, historial_estados FROM ordenes WHERE numero IN (?)", [nums]);
    console.log("=== LOCAL ===");
    for (const r of localRows) {
      console.log(`OT: ${r.numero} | Cliente: ${r.cliente} | Estado: ${r.estado} | Técnico: ${r.tecnico_asignado} | id_tec: ${r.id_tecnico} | Ejecutor: ${r.usuario_ejecutor_fenix}`);
    }

    const [prodRows] = await prodPool.query("SELECT id_orden, numero, cliente, tecnico_asignado, cuadrilla, id_tecnico, usuario_ejecutor_fenix, estado, historial_estados FROM ordenes WHERE numero IN (?)", [nums]);
    console.log("\n=== PRODUCCIÓN ===");
    for (const r of prodRows) {
      console.log(`OT: ${r.numero} | Cliente: ${r.cliente} | Estado: ${r.estado} | Técnico: ${r.tecnico_asignado} | id_tec: ${r.id_tecnico} | Ejecutor: ${r.usuario_ejecutor_fenix}`);
      let h = [];
      try { h = JSON.parse(r.historial_estados || '[]'); } catch(e){}
      console.log("  Historial top entries:", h.slice(0, 4));
    }
  } catch (err) {
    console.error(err);
  } finally {
    await localPool.end();
    await prodPool.end();
  }
}

inspectOrders();
