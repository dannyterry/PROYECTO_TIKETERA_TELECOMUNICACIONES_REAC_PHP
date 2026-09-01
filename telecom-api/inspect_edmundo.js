const pool = require('./db.js');

async function main() {
  const [rows] = await pool.query(
    "SELECT id_orden, numero, cliente, cuadrilla, tecnico_asignado, id_tecnico, id_tecnico_reemplazo, estado, motivo_cancelacion, motivo_finalizacion, motivo_regestion, fecha_visita, hora_asignacion, inicio_visita, fin_visita FROM ordenes WHERE DATE(fecha_visita) = '2026-09-01' OR DATE(fecha_solicitud) = '2026-09-01'"
  );

  const filtered = rows.filter(o => 
    (o.tecnico_asignado && o.tecnico_asignado.includes('EDMUNDO')) || 
    (o.cuadrilla && o.cuadrilla.includes('EDMUNDO')) || 
    (o.cuadrilla && o.cuadrilla.includes('K 6')) || 
    (o.cuadrilla && o.cuadrilla.includes('K 19')) || 
    (o.tecnico_asignado && o.tecnico_asignado.includes('SANDY'))
  );

  console.log("📌 Órdenes encontradas para Edmundo Flores y Sandy Efrain (K 6 / K 19):");
  console.table(filtered.map(o => ({
    id: o.id_orden,
    ticket: o.numero,
    cliente: o.cliente,
    cuadrilla: o.cuadrilla,
    tecnico_asignado: o.tecnico_asignado,
    id_tecnico: o.id_tecnico,
    estado: o.estado,
    motivo_cancelacion: o.motivo_cancelacion,
    motivo_regestion: o.motivo_regestion,
    motivo_finalizacion: o.motivo_finalizacion
  })));

  process.exit(0);
}

main().catch(console.error);
