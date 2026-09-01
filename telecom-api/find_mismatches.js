const pool = require('./db.js');

async function findMismatches() {
  const [rows] = await pool.query(
    `SELECT o.id_orden, o.numero, o.cuadrilla, o.tecnico_asignado, o.id_tecnico, u.cuadrilla as user_cuadrilla, CONCAT(u.nombres, ' ', u.apellidos) as user_name
     FROM ordenes o
     LEFT JOIN usuarios u ON o.id_tecnico = u.id_usuario
     WHERE DATE(o.fecha_visita) = '2026-09-01' OR DATE(o.fecha_solicitud) = '2026-09-01'`
  );

  console.log("Revisando coherencia entre Cuadrilla y Técnico asignado de hoy (01/09/2026):");
  rows.forEach(r => {
    console.log(`Ticket ${r.numero} | Cuadrilla Fenix: "${r.cuadrilla}" | Técnico: "${r.tecnico_asignado}" (#${r.id_tecnico})`);
  });

  process.exit(0);
}

findMismatches().catch(console.error);
