const pool = require('./db.js');

async function main() {
  const [rows] = await pool.query(
    `SELECT id_orden, numero, cliente, cuadrilla, tecnico_asignado, id_tecnico, estado, motivo_finalizacion, tipo_trabajo, motivo_trabajo, tipo_trabajo_asignado, fecha_visita
     FROM ordenes
     WHERE estado IN ('Finalizada', 'Finalizados', 'Fenix')
       AND (tipo_trabajo LIKE '%ROJO%' OR tipo_trabajo LIKE '%INTERMITENCIA%')`
  );

  console.log(`📌 Total de órdenes finalizadas que aún tienen 'LOS ROJO' / 'INTERMITENCIA' en tipo_trabajo: ${rows.length}`);
  console.table(rows);

  process.exit(0);
}

main().catch(console.error);
