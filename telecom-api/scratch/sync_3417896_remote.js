const mysql = require('d:/proyectofinal/telecom-api/node_modules/mysql2/promise');

async function updateRemote() {
  const remoteConn = await mysql.createConnection('mysql://u800609594_cespedes:Cespedes123*@srv1245.hstgr.io:3306/u800609594_corporacion');
  try {
    const [res] = await remoteConn.query(`
      UPDATE ordenes 
      SET 
        estado = 'Finalizada Externa',
        tecnico_asignado = 'EXTERNO: ANGEL ANDRES DIAZ CUETO',
        usuario_ejecutor_fenix = 'ANGEL ANDRES DIAZ CUETO',
        id_tecnico = NULL
      WHERE numero = '3417896'
    `);
    console.log("✅ Hosting actualizo filas:", res.affectedRows);
  } catch (err) {
    console.error("Error updating remote:", err);
  } finally {
    await remoteConn.end();
  }
}

updateRemote();
