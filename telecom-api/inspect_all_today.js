const pool = require('./db.js');

async function main() {
  const [rows] = await pool.query(
    `SELECT id_orden, numero, cliente, cuadrilla, tecnico_asignado, id_tecnico, hora_asignacion, estado 
     FROM ordenes 
     WHERE DATE(fecha_visita) = '2026-09-01' OR DATE(fecha_solicitud) = '2026-09-01'
     ORDER BY cuadrilla ASC, hora_asignacion ASC`
  );

  console.log(`📌 Total de órdenes encontradas para hoy: ${rows.length}\n`);
  rows.forEach((o, i) => {
    console.log(`${i + 1}. Ticket: ${o.numero} | Cuadrilla en BD: "${o.cuadrilla}" | Técnico en BD: "${o.tecnico_asignado}" | ID_Tec: ${o.id_tecnico} | Estado: ${o.estado}`);
  });

  process.exit(0);
}

main().catch(console.error);
