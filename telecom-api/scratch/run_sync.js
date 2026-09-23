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
      DATE(COALESCE(o.fecha_visita, o.fecha_solicitud)) AS fecha_orden,
      TIME(COALESCE(o.inicio_visita, o.hora_en_camino, o.hora_asignacion, o.fecha_visita, o.fecha_solicitud)) AS hora_inicio,
      t.id_trabajador,
      COALESCE(h.hora_entrada, '07:45:00') AS horario_entrada,
      COALESCE(h.tolerancia_min, 1) AS tolerancia_min,
      (
        SELECT COUNT(*) FROM trabajador_descansos td
        WHERE td.id_trabajador = t.id_trabajador
          AND DATE(COALESCE(o.fecha_visita, o.fecha_solicitud)) BETWEEN td.fecha_inicio AND td.fecha_fin
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
    LEFT JOIN asistencias a ON (t.id_trabajador = a.id_trabajador AND a.fecha = DATE(COALESCE(o.fecha_visita, o.fecha_solicitud)))
    WHERE (
      (DATE(o.fecha_visita) BETWEEN ? AND ?)
      OR (o.fecha_visita IS NULL AND DATE(o.fecha_solicitud) BETWEEN ? AND ?)
    )
    ORDER BY DATE(COALESCE(o.fecha_visita, o.fecha_solicitud)) ASC, hora_inicio ASC
  `, [fDesde, fHasta, fDesde, fHasta]);

  const techMap = new Map();
  for (const r of ordenRows) {
    if (!r.fecha_orden || !r.hora_inicio) continue;
    const fStr = typeof r.fecha_orden === 'string' ? r.fecha_orden.slice(0, 10) : (r.fecha_orden instanceof Date ? r.fecha_orden.toISOString().slice(0, 10) : String(r.fecha_orden).slice(0, 10));
    const key = `${r.id_trabajador}_${fStr}`;
    if (!techMap.has(key)) {
      techMap.set(key, { ...r, fechaStr: fStr });
    }
  }

  console.log('Sincronizando asistencias calculadas:', techMap.size);

  for (const [key, data] of techMap.entries()) {
    if (data.tiene_descanso > 0 || ['Descanso', 'Permiso'].includes(data.asistencia_estado)) continue;
    const horaInicioStr = String(data.hora_inicio);
    const horarioEntradaStr = String(data.horario_entrada);
    const toleranciaMin = parseInt(data.tolerancia_min || 1, 10);
    const [hI, mI, sI] = horaInicioStr.split(':').map(n => parseInt(n || 0, 10));
    const [hH, mH, sH] = horarioEntradaStr.split(':').map(n => parseInt(n || 0, 10));
    const secInicio = (hI * 3600) + (mI * 60) + (sI || 0);
    const secHorario = (hH * 3600) + (mH * 60) + (sH || 0);
    const secLimite = secHorario + (toleranciaMin * 60);
    let estadoCalculado = 'Asistio';
    let minutosTarde = 0;
    if (secInicio > secLimite) {
      estadoCalculado = 'Tardanza';
      minutosTarde = Math.max(0, Math.ceil((secInicio - secHorario) / 60));
    }
    const obsAuto = `Auto (OT #${data.numero_orden || data.id_orden})`;
    
    // Check if asistencia exists for (id_trabajador, fecha)
    const [exist] = await pool.query("SELECT id_asistencia, estado, observacion FROM asistencias WHERE id_trabajador = ? AND fecha = ?", [data.id_trabajador, data.fechaStr]);
    if (exist.length > 0) {
      if (!['Descanso', 'Permiso'].includes(exist[0].estado)) {
        await pool.query(`
          UPDATE asistencias SET
            hora_entrada = ?,
            estado = ?,
            minutos_tarde = ?,
            id_orden = ?,
            tipo = 'Automatico',
            observacion = IF(observacion IS NULL OR observacion = '' OR observacion LIKE 'Auto%', ?, observacion)
          WHERE id_asistencia = ?
        `, [horaInicioStr, estadoCalculado, minutosTarde, data.id_orden, obsAuto, exist[0].id_asistencia]);
      }
    } else {
      try {
        await pool.query(`
          INSERT INTO asistencias (id_trabajador, id_orden, fecha, hora_entrada, estado, minutos_tarde, tipo, observacion)
          VALUES (?, ?, ?, ?, ?, ?, 'Automatico', ?)
        `, [data.id_trabajador, data.id_orden, data.fechaStr, horaInicioStr, estadoCalculado, minutosTarde, obsAuto]);
      } catch (e) {
        // Fallback without id_orden if conflict
        await pool.query(`
          INSERT INTO asistencias (id_trabajador, fecha, hora_entrada, estado, minutos_tarde, tipo, observacion)
          VALUES (?, ?, ?, ?, ?, 'Automatico', ?)
          ON DUPLICATE KEY UPDATE
            hora_entrada = VALUES(hora_entrada),
            estado = IF(estado IN ('Descanso','Permiso'), estado, VALUES(estado)),
            minutos_tarde = IF(estado IN ('Descanso','Permiso'), 0, VALUES(minutos_tarde))
        `, [data.id_trabajador, data.fechaStr, horaInicioStr, estadoCalculado, minutosTarde, obsAuto]);
      }
    }
  }

  // Check Villalba on Sept 2
  const [asistV] = await pool.query("SELECT * FROM asistencias WHERE id_trabajador = 105 AND fecha = '2026-09-02'");
  console.log('Asistencia Villalba 2026-09-02:', asistV);

  await pool.end();
})();
