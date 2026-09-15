const mysql = require('mysql2/promise');

const REMOTE_CONFIG = {
  host: 'corporacioncespedes.com',
  user: 'corporacioncespe_miguel',
  password: 'corporacioncespe_123',
  database: 'corporacioncespe_cespedes',
  dateStrings: true,
  connectTimeout: 30000
};

async function syncRemoteTrabajadores() {
  try {
    const remotePool = mysql.createPool(REMOTE_CONFIG);
    console.log('Conectando al hosting remoto...');
    await remotePool.query(`
      UPDATE trabajadores t
      JOIN usuarios u ON t.id_usuario = u.id_usuario
      SET t.estado = u.estado
      WHERE t.estado != u.estado
    `);
    console.log('✅ Estado de trabajadores sincronizado en el servidor remoto.');
    await remotePool.end();
  } catch (err) {
    console.warn('No se pudo actualizar remoto o ya estaba sincronizado:', err.message);
  }
}

syncRemoteTrabajadores();
