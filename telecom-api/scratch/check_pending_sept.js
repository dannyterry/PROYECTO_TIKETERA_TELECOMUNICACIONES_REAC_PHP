const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost', user: 'root', password: '', database: 'corporacioncespe_cespedes'
  });

  const [pendientes] = await conn.query(`
    SELECT id_orden, numero, cliente, cuadrilla, tecnico_asignado, estado, motivo_trabajo, fecha_visita 
    FROM ordenes 
    WHERE (
      (fecha_visita >= '2026-09-01 00:00:00' AND fecha_visita <= '2026-09-29 23:59:59')
      OR (fecha_visita IS NULL AND fecha_solicitud >= '2026-09-01 00:00:00' AND fecha_solicitud <= '2026-09-29 23:59:59')
    )
    AND estado IN ('Iniciada', 'Agendada', 'En camino')
  `);
  console.log('PENDIENTES SEPTIEMBRE (01-29):', pendientes);

  await conn.end();
}

main().catch(console.error);
