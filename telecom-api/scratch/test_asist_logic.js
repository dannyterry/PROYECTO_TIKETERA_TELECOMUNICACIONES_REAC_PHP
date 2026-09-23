const mysql = require('mysql2/promise');
(async () => {
  const pool = await mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  const fDesde = '2026-09-01';
  const fHasta = '2026-09-30';

  const [ordenRows] = await pool.query(`
    SELECT 
      o.id_orden,
      o.numero AS numero_orden,
      o.id_tecnico,
      o.tecnico_asignado,
      DATE(COALESCE(o.inicio_visita, o.fecha_visita, o.fecha_solicitud)) AS fecha_orden,
      TIME(COALESCE(o.inicio_visita, o.hora_en_camino, o.hora_asignacion, o.fecha_visita, o.fecha_solicitud)) AS hora_inicio,
      t.id_trabajador,
      COALESCE(h.hora_entrada, '07:45:00') AS horario_entrada,
      COALESCE(h.tolerancia_min, 1) AS tolerancia_min,
      (
        SELECT COUNT(*) FROM trabajador_descansos td
        WHERE td.id_trabajador = t.id_trabajador
          AND DATE(COALESCE(o.inicio_visita, o.fecha_visita, o.fecha_solicitud)) BETWEEN td.fecha_inicio AND td.fecha_fin
          AND td.estado != 'Cancelado'
      ) AS tiene_descanso,
      a.id_asistencia,
      a.tipo AS asistencia_tipo,
      a.estado AS asistencia_estado,
      a.observacion AS asistencia_observacion
    FROM ordenes o
    INNER JOIN trabajadores t ON (
      o.id_tecnico = t.id_usuario 
      OR o.id_tecnico = t.id_trabajador
    )
    LEFT JOIN horarios h ON t.id_horario = h.id_horario
    LEFT JOIN asistencias a ON (t.id_trabajador = a.id_trabajador AND a.fecha = DATE(COALESCE(o.inicio_visita, o.fecha_visita, o.fecha_solicitud)))
    WHERE (
      (DATE(o.inicio_visita) BETWEEN ? AND ?)
      OR (DATE(o.fecha_visita) BETWEEN ? AND ?)
      OR (DATE(o.fecha_solicitud) BETWEEN ? AND ?)
    )
    AND (o.inicio_visita IS NOT NULL OR o.fecha_visita IS NOT NULL OR o.fecha_solicitud IS NOT NULL)
    ORDER BY DATE(COALESCE(o.inicio_visita, o.fecha_visita, o.fecha_solicitud)) ASC, hora_inicio ASC
  `, [fDesde, fHasta, fDesde, fHasta, fDesde, fHasta]);

  console.log('Total ordenes encontradas en septiembre:', ordenRows.length);
  const techMap = new Map();
  for (const r of ordenRows) {
    if (!r.fecha_orden || !r.hora_inicio) continue;
    const fStr = typeof r.fecha_orden === 'string' ? r.fecha_orden.slice(0, 10) : (r.fecha_orden instanceof Date ? r.fecha_orden.toISOString().slice(0, 10) : String(r.fecha_orden).slice(0, 10));
    const key = `${r.id_trabajador}_${fStr}`;
    if (!techMap.has(key)) {
      techMap.set(key, { ...r, fechaStr: fStr });
    }
  }
  console.log('Total asistencias calculadas por día/técnico en septiembre:', techMap.size);
  let punctual = 0, late = 0;
  for (const [k, d] of techMap.entries()) {
    const horaInicioStr = String(d.hora_inicio);
    const [hI, mI] = horaInicioStr.split(':').map(n => parseInt(n || 0, 10));
    const sec = hI * 3600 + mI * 60;
    if (sec <= 7 * 3600 + 46 * 60) punctual++;
    else late++;
  }
  console.log('Puntuales (<= 07:46):', punctual, 'Tardanzas (> 07:46):', late);

  await pool.end();
})();
