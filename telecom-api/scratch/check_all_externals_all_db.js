const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost', user: 'root', password: '', database: 'corporacioncespe_cespedes'
  });

  const [techUsers] = await conn.query("SELECT id_usuario, nombres, apellidos, primer_apellido, segundo_apellido, cuadrilla FROM usuarios");

  const [allOrders] = await conn.query(`
    SELECT id_orden, numero, cliente, cuadrilla, tecnico_asignado, usuario_ejecutor_fenix, estado, historial_estados, fecha_visita, fecha_solicitud
    FROM ordenes 
    WHERE (tecnico_asignado LIKE '%EXTERNO%' OR usuario_ejecutor_fenix IS NOT NULL OR estado = 'Finalizada Externa')
  `);
  console.log('Total órdenes con marca externa en toda la BD:', allOrders.length);
  console.table(allOrders);

  await conn.end();
}

main().catch(console.error);
