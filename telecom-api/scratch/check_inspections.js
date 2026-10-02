const mysql = require('mysql2/promise');

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: 'localhost', user: 'root', password: '', database: 'corporacioncespe_cespedes'
    });
    const [cols] = await conn.query("DESCRIBE vehiculo_inspecciones");
    console.log("COLUMNS:", cols.map(c => c.Field));

    const [rows] = await conn.query(`
      SELECT i.*, v.placa,
             TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS nombre
      FROM vehiculo_inspecciones i
      JOIN vehiculos v ON i.id_vehiculo = v.id_vehiculo
      JOIN trabajadores t ON i.id_trabajador = t.id_trabajador
      JOIN usuarios u ON t.id_usuario = u.id_usuario
      ORDER BY i.fecha DESC, i.id_inspeccion DESC
      LIMIT 10
    `);
    console.log("INSPECTIONS:", JSON.stringify(rows, null, 2));
    await conn.end();
  } catch (err) {
    console.error(err);
  }
})();
