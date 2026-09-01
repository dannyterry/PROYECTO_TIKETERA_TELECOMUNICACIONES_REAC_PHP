const pool = require('./db.js');

async function main() {
  const [cRows] = await pool.query(
    "SELECT COUNT(*) as total FROM ordenes WHERE DATE(fecha_visita) = '2026-09-01' OR DATE(fecha_solicitud) = '2026-09-01'"
  );
  console.log("📌 Total de órdenes de hoy (01/09/2026) en la Base de Datos:", cRows[0].total);

  const [list] = await pool.query(
    "SELECT id_orden, numero, cliente, tecnico_asignado, id_tecnico, id_tecnico_reemplazo, DATE_FORMAT(fecha_visita, '%Y-%m-%d %H:%i') as visita FROM ordenes WHERE DATE(fecha_visita) = '2026-09-01' OR DATE(fecha_solicitud) = '2026-09-01' ORDER BY id_orden DESC"
  );

  console.log("\n📋 Listado completo de las " + list.length + " órdenes:");
  list.forEach((o, i) => {
    console.log(`${i + 1}. [ID: ${o.id_orden}] Ticket: ${o.numero} | Cliente: ${o.cliente} | Técnico: ${o.tecnico_asignado} | T1: #${o.id_tecnico} | T2: #${o.id_tecnico_reemplazo || '-'} | Visita: ${o.visita}`);
  });

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
