const mysql = require('mysql2/promise');
(async () => {
  const pool = await mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  const [users] = await pool.query("SELECT u.id_usuario, t.id_trabajador, u.nombres, u.primer_apellido, u.apellidos, u.usuario FROM usuarios u LEFT JOIN trabajadores t ON u.id_usuario = t.id_usuario WHERE u.nombres LIKE '%VILLALBA%' OR u.primer_apellido LIKE '%VILLALBA%' OR u.apellidos LIKE '%VILLALBA%'");
  console.log('User/Worker Villalba:', users);

  const fDesde = '2026-09-01';
  const fHasta = '2026-09-30';

  const [ordenRows] = await pool.query(`
    SELECT 
      o.id_orden,
      o.numero AS numero_orden,
      o.id_tecnico,
      o.tecnico_asignado,
      DATE(COALESCE(o.fecha_visita, o.fecha_solicitud, o.inicio_visita)) AS fecha_orden,
      TIME(COALESCE(o.inicio_visita, o.hora_en_camino, o.hora_asignacion, o.fecha_visita, o.fecha_solicitud)) AS hora_inicio,
      t.id_trabajador,
      COALESCE(h.hora_entrada, '07:45:00') AS horario_entrada,
      COALESCE(h.tolerancia_min, 1) AS tolerancia_min,
      (
        SELECT COUNT(*) FROM trabajador_descansos td
        WHERE td.id_trabajador = t.id_trabajador
          AND DATE(COALESCE(o.fecha_visita, o.fecha_solicitud, o.inicio_visita)) BETWEEN td.fecha_inicio AND td.fecha_fin
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
    LEFT JOIN asistencias a ON (t.id_trabajador = a.id_trabajador AND a.fecha = DATE(COALESCE(o.fecha_visita, o.fecha_solicitud, o.inicio_visita)))
    WHERE (
      (DATE(o.fecha_visita) BETWEEN ? AND ?)
      OR (DATE(o.fecha_solicitud) BETWEEN ? AND ?)
    )
    AND (o.inicio_visita IS NOT NULL OR o.fecha_visita IS NOT NULL OR o.fecha_solicitud IS NOT NULL)
    ORDER BY DATE(COALESCE(o.fecha_visita, o.fecha_solicitud, o.inicio_visita)) ASC, hora_inicio ASC
  `, [fDesde, fHasta, fDesde, fHasta]);

  console.log('Total ordenes encontradas en septiembre:', ordenRows.length);
  const villalbaSept2 = ordenRows.filter(r => r.id_trabajador === 105 && String(r.fecha_orden).includes('2026-09-02') || (r.fecha_orden instanceof Date && r.fecha_orden.toISOString().includes('2026-09-02')));
  console.log('Villalba on Sept 2:', villalbaSept2);

  await pool.end();
})();
