const pool = require('./db.js');

async function listInventoryTables() {
  const [tables] = await pool.query(`
    SHOW TABLES WHERE 
      Tables_in_corporacioncespe_cespedes LIKE '%almacen%'
      OR Tables_in_corporacioncespe_cespedes LIKE '%producto%'
      OR Tables_in_corporacioncespe_cespedes LIKE '%serie%'
      OR Tables_in_corporacioncespe_cespedes LIKE '%compra%'
      OR Tables_in_corporacioncespe_cespedes LIKE '%proveedor%'
      OR Tables_in_corporacioncespe_cespedes LIKE '%trabajador_producto%'
      OR Tables_in_corporacioncespe_cespedes LIKE '%trabajador_serie%'
      OR Tables_in_corporacioncespe_cespedes LIKE '%equipo%'
      OR Tables_in_corporacioncespe_cespedes LIKE '%material%'
      OR Tables_in_corporacioncespe_cespedes LIKE '%acta%'
      OR Tables_in_corporacioncespe_cespedes LIKE '%categoria%'
  `);

  console.log("Tablas encontradas:", tables);
  process.exit(0);
}

listInventoryTables().catch(console.error);
