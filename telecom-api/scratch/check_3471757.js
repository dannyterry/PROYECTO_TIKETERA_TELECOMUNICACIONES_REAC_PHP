const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  const [row] = await conn.query("SELECT id_orden, numero, cliente, cuadrilla, tecnico_asignado, usuario_ejecutor_fenix, estado, motivo_finalizacion, historial_estados FROM ordenes WHERE numero = '3471757'");
  console.log('TICKET 3471757:', row[0]);

  await conn.end();
}

main().catch(console.error);
