const mysql = require('mysql2/promise');

const REMOTE_CONFIG = {
  host: 'corporacioncespedes.com',
  user: 'corporacioncespe_miguel',
  password: 'corporacioncespe_123',
  database: 'corporacioncespe_cespedes',
  dateStrings: true,
};

(async () => {
  try {
    const conn = await mysql.createConnection(REMOTE_CONFIG);
    const [rows] = await conn.query(`
      SELECT id_inspeccion, fecha, km_inicio, km_fin, hora_inicio, hora_fin, 
             foto_tablero_inicio, foto_tablero_fin, km_recorridos
      FROM vehiculo_inspecciones 
      WHERE id_inspeccion IN (9, 10)
    `);
    console.log("INSPECTIONS 9 & 10:", rows);

    rows.forEach(r => {
      console.log(`\n--- Inspección ID ${r.id_inspeccion} (${r.fecha}) ---`);
      if (r.foto_tablero_inicio) {
        const ts = Number(r.foto_tablero_inicio.split('.')[0]);
        console.log("Foto Inicio:", r.foto_tablero_inicio, "->", new Date(ts).toLocaleString('es-PE', { timeZone: 'America/Lima' }));
      }
      if (r.foto_tablero_fin) {
        const ts = Number(r.foto_tablero_fin.split('.')[0]);
        console.log("Foto Fin:", r.foto_tablero_fin, "->", new Date(ts).toLocaleString('es-PE', { timeZone: 'America/Lima' }));
      }
    });

    await conn.end();
  } catch (err) {
    console.error(err);
  }
})();
