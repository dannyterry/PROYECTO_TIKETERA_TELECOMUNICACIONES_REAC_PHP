const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  const [allExternals] = await conn.query(`
    SELECT id_orden, numero, cliente, cuadrilla, tecnico_asignado, usuario_ejecutor_fenix, estado, fecha_visita
    FROM ordenes 
    WHERE (tecnico_asignado LIKE '%EXTERNO%' OR (usuario_ejecutor_fenix IS NOT NULL AND id_tecnico IS NULL))
      AND estado = 'Finalizada'
  `);
  console.log('Órdenes Finalizadas con ejecutor EXTERNO en toda la BD:', allExternals.length);
  console.table(allExternals);

  await conn.end();
}

main().catch(console.error);
