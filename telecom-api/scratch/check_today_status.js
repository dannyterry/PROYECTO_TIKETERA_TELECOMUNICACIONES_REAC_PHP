const pool = require('../db');

async function run() {
  const [rows] = await pool.query(`
    SELECT o.id_orden, o.numero, o.cliente, o.estado, o.tipo_orden, o.inicio_visita, o.fin_visita,
           o.motivo_regestion, o.motivo_cancelacion,
           tc.total_tareas, tc.tareas_finalizadas, tc.progreso_porcentaje
    FROM ordenes o
    LEFT JOIN orden_tareas_cache tc ON o.numero = tc.numero_orden
    WHERE (
      DATE(COALESCE(o.fecha_solicitud, o.fecha_visita, o.inicio_visita, o.fecha_creacion, NOW())) = CURDATE()
      OR DATE(o.fecha_solicitud) = '2026-10-14'
      OR DATE(o.fecha_visita) = '2026-10-14'
    )
    ORDER BY o.estado ASC, o.id_orden DESC
  `);

  console.log(`Total órdenes hoy: ${rows.length}`);
  
  // Agrupar por estado
  const counts = {};
  rows.forEach(r => {
    counts[r.estado] = (counts[r.estado] || 0) + 1;
  });
  console.log('Conteo por estado:', counts);

  console.log('\nDetalle:');
  console.table(rows.map(x => ({
    ticket: x.numero,
    cliente: x.cliente ? x.cliente.substring(0, 22) : '-',
    estado: x.estado,
    inicio: x.inicio_visita ? x.inicio_visita.substring(11, 16) : '-',
    tareas: x.total_tareas ? `${x.tareas_finalizadas}/${x.total_tareas}` : '-',
    regestion: x.motivo_regestion ? x.motivo_regestion.substring(0, 18) : null,
    cancelacion: x.motivo_cancelacion ? x.motivo_cancelacion.substring(0, 18) : null
  })));

  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
