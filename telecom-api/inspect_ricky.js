const pool = require('./db.js');

async function main() {
  const [userRows] = await pool.query(
    "SELECT id_usuario, nombres, apellidos, cuadrilla, estado FROM usuarios WHERE id_usuario = 91 OR nombres LIKE '%RICKY%'"
  );
  console.log("Usuario Ricky en tabla usuarios:", userRows);

  const [orders91] = await pool.query(
    "SELECT id_orden, numero, cliente, cuadrilla, tecnico_asignado, id_tecnico, estado, fecha_solicitud, fecha_visita FROM ordenes WHERE DATE(fecha_solicitud) = '2026-09-02' OR DATE(fecha_visita) = '2026-09-02'"
  );
  console.log("Todas las órdenes de hoy (02/09/2026) - Total " + orders91.length + ":");
  console.table(orders91);

  process.exit(0);
}

main().catch(console.error);
