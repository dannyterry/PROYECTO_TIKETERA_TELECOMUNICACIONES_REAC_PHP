const mysql = require('mysql2/promise');

const REMOTE_CONFIG = {
  host: 'corporacioncespedes.com',
  user: 'corporacioncespe_miguel',
  password: 'corporacioncespe_123',
  database: 'corporacioncespe_cespedes',
  dateStrings: true,
  connectTimeout: 60000
};

(async () => {
  try {
    const conn = await mysql.createConnection(REMOTE_CONFIG);
    const [rows] = await conn.query(`
      SELECT i.*, v.placa,
             TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS nombre
      FROM vehiculo_inspecciones i
      JOIN vehiculos v ON i.id_vehiculo = v.id_vehiculo
      JOIN trabajadores t ON i.id_trabajador = t.id_trabajador
      JOIN usuarios u ON t.id_usuario = u.id_usuario
      ORDER BY i.id_inspeccion DESC
      LIMIT 10
    `);
    console.log("PROD INSPECTIONS:", JSON.stringify(rows, null, 2));
    await conn.end();
  } catch (err) {
    console.error(err);
  }
})();
