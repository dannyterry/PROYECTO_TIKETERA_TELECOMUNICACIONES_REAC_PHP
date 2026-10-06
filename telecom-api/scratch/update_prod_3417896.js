const mysql = require('d:/proyectofinal/telecom-api/node_modules/mysql2/promise');

const prodConfig = {
  host: 'corporacioncespedes.com',
  user: 'corporacioncespe_miguel',
  password: 'corporacioncespe_123',
  database: 'corporacioncespe_cespedes',
};

async function updateProd() {
  try {
    const conn = await mysql.createConnection(prodConfig);
    console.log("✅ Conectado exitosamente a Producción (corporacioncespedes.com)");

    const [rows] = await conn.query("SELECT id_orden, numero, cliente, tecnico_asignado, estado, id_tecnico, usuario_ejecutor_fenix FROM ordenes WHERE numero = '3417896'");
    console.log("Estado ANTES en Producción:", rows);

    const [updateRes] = await conn.query(`
      UPDATE ordenes 
      SET 
        estado = 'Finalizada Externa',
        tecnico_asignado = 'EXTERNO: ANGEL ANDRES DIAZ CUETO',
        usuario_ejecutor_fenix = 'ANGEL ANDRES DIAZ CUETO',
        id_tecnico = NULL
      WHERE numero = '3417896'
    `);
    console.log("Filas actualizadas en Producción:", updateRes.affectedRows);

    const [rowsAfter] = await conn.query("SELECT id_orden, numero, cliente, tecnico_asignado, estado, id_tecnico, usuario_ejecutor_fenix FROM ordenes WHERE numero = '3417896'");
    console.log("Estado DESPUÉS en Producción:", rowsAfter);

    await conn.end();
  } catch (err) {
    console.error("Error en producción:", err.message);
  }
}

updateProd();
