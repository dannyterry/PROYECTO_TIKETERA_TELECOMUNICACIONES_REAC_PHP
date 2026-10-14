const pool = require('../db');

async function check() {
  const [rows] = await pool.query(`
    SELECT o.id_orden, o.numero, o.cliente, o.estado, o.fecha_solicitud, o.fecha_visita, 
           o.inicio_visita, o.fin_visita, o.hora_en_camino, o.hora_asignacion,
           o.motivo_cancelacion, o.motivo_regestion, o.motivo_anulacion, o.motivo_finalizacion,
           o.historial_estados,
           tc.total_tareas, tc.tareas_finalizadas, tc.progreso_porcentaje
    FROM ordenes o
    LEFT JOIN orden_tareas_cache tc ON o.numero = tc.numero_orden
    WHERE o.cliente LIKE '%AQUILINA%' OR o.cliente LIKE '%HANCCO%'
  `);

  console.log(`Encontradas ${rows.length} órdenes para AQUILINA:`);
  for (const r of rows) {
    console.log('--------------------------------------------------');
    console.log('ID:', r.id_orden, '| Ticket:', r.numero);
    console.log('Cliente:', r.cliente);
    console.log('Estado en BD (columna estado):', r.estado);
    console.log('Fecha Solicitud:', r.fecha_solicitud, '| Fecha Visita:', r.fecha_visita);
    console.log('Inicio Visita:', r.inicio_visita, '| Fin Visita:', r.fin_visita);
    console.log('Hora Camino:', r.hora_en_camino, '| Asignación:', r.hora_asignacion);
    console.log('Tareas en Cache:', { total: r.total_tareas, finalizadas: r.tareas_finalizadas, pct: r.progreso_porcentaje });
    console.log('Motivo Regestion:', r.motivo_regestion);
    console.log('Motivo Cancelacion:', r.motivo_cancelacion);
    if (r.historial_estados) {
      try {
        const hist = JSON.parse(r.historial_estados);
        console.log('Historial de Estados (Fénix):', hist);
      } catch (e) {
        console.log('Historial raw:', r.historial_estados);
      }
    } else {
      console.log('Historial de Estados: NULL');
    }
  }

  process.exit(0);
}

check().catch(e => {
  console.error(e);
  process.exit(1);
});
