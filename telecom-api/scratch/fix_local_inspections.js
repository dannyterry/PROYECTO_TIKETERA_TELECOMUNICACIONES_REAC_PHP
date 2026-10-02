const mysql = require('mysql2/promise');

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: 'localhost', user: 'root', password: '', database: 'corporacioncespe_cespedes'
    });
    console.log("Conectado a BD Local...");

    await conn.query(`
      UPDATE vehiculo_inspecciones
      SET km_fin = 113363,
          hora_fin = '19:15:17',
          foto_tablero_fin = '1790727317744.jpg',
          km_recorridos = (113363 - km_inicio),
          diferencia_km = 0,
          estado_auditoria = 'Pendiente'
      WHERE id_inspeccion = 9
    `).catch(() => {});

    await conn.query(`
      UPDATE vehiculo_inspecciones
      SET km_fin = NULL,
          hora_fin = NULL,
          foto_tablero_fin = NULL,
          km_recorridos = NULL,
          diferencia_km = 0,
          estado_auditoria = 'Pendiente'
      WHERE id_inspeccion = 10
    `).catch(() => {});

    await conn.end();
    console.log("Local BD sincronizada.");
  } catch (err) {
    console.log("Local fix omitido:", err.message);
  }
})();
