const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  const [rows] = await conn.query(`
    SELECT id_orden, numero, cliente, cuadrilla, tecnico_asignado, usuario_ejecutor_fenix, estado, fecha_visita
    FROM ordenes 
    WHERE (tecnico_asignado LIKE '%EXTERNO%' OR (usuario_ejecutor_fenix IS NOT NULL AND id_tecnico IS NULL))
      AND (
        (fecha_visita >= '2026-09-01 00:00:00' AND fecha_visita <= '2026-09-29 23:59:59')
        OR (fecha_visita IS NULL AND fecha_solicitud >= '2026-09-01 00:00:00' AND fecha_solicitud <= '2026-09-29 23:59:59')
      )
  `);
  console.log('Órdenes con ejecutor externo en Septiembre:', rows.length);
  console.table(rows);

  await conn.end();
}

main().catch(console.error);
