'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth, signToken } = require('../middleware/requireAuth');
const { uploadFileToS3, uploadBufferToS3, getS3ObjectStream, checkS3ObjectExists, getS3SignedUrl } = require('../services/s3Service');
const path = require('path');
const fs = require('fs');


// ─── RUTAS MÓDULO: AUDITORIA ───────────────────────────────────────

router.post(['/heartbeat', '/auditoria/heartbeat'], async (req, res) => {
  try {
    const { id_usuario, usuario_nombre, modulo, distrito_conexion, lat_conexion, lng_conexion } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    let targetUserId = id_usuario;

    if (id_usuario) {
      await pool.query(`
        UPDATE usuarios 
        SET ultimo_acceso = NOW(), 
            esta_online = 1,
            distrito_conexion = COALESCE(?, distrito_conexion),
            lat_conexion = COALESCE(?, lat_conexion),
            lng_conexion = COALESCE(?, lng_conexion),
            ip_conexion = ?
        WHERE id_usuario = ?
      `, [distrito_conexion || null, lat_conexion || null, lng_conexion || null, ip, id_usuario]);
    } else if (usuario_nombre && usuario_nombre.trim()) {
      const [uRows] = await pool.query(`
        SELECT id_usuario FROM usuarios
        WHERE (TRIM(CONCAT(COALESCE(nombres, ''), ' ', COALESCE(primer_apellido, apellidos, ''))) LIKE ? OR nombres LIKE ? OR usuario = ?)
        LIMIT 1
      `, [`%${usuario_nombre.trim()}%`, `%${usuario_nombre.trim()}%`, usuario_nombre.trim()]);
      
      if (uRows.length > 0) {
        targetUserId = uRows[0].id_usuario;
        await pool.query(`
          UPDATE usuarios 
          SET ultimo_acceso = NOW(), 
              esta_online = 1,
              distrito_conexion = COALESCE(?, distrito_conexion),
              lat_conexion = COALESCE(?, lat_conexion),
              lng_conexion = COALESCE(?, lng_conexion),
              ip_conexion = ?
          WHERE id_usuario = ?
        `, [distrito_conexion || null, lat_conexion || null, lng_conexion || null, ip, targetUserId]);
      }
    }

    if (targetUserId) {
      await registrarJornadaPing(pool, targetUserId, ip, modulo ? `Navegando en ${modulo}` : 'Activo en el sistema');
    }

    res.json({ success: true, timestamp: new Date() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get(['/mensajes', '/chat/mensajes'], async (req, res) => {
  try {
    const { id_usuario, con_usuario, limit } = req.query;
    const limitVal = Math.min(200, Math.max(1, Number(limit) || 100));

    let rows;
    if (con_usuario && con_usuario !== 'general') {
      // Chat privado entre id_usuario y con_usuario
      const [resPrivate] = await pool.query(`
        SELECT * FROM mensajes_chat
        WHERE (id_emisor = ? AND id_receptor = ?)
           OR (id_emisor = ? AND id_receptor = ?)
        ORDER BY fecha_envio ASC
        LIMIT ?
      `, [id_usuario, con_usuario, con_usuario, id_usuario, limitVal]);
      rows = resPrivate;

      // Marcar como leídos los mensajes recibidos
      if (id_usuario) {
        await pool.query(`
          UPDATE mensajes_chat
          SET leido = 1
          WHERE id_emisor = ? AND id_receptor = ? AND leido = 0
        `, [con_usuario, id_usuario]);
      }
    } else {
      // Canal general de equipo (id_receptor IS NULL)
      const [resGeneral] = await pool.query(`
        SELECT * FROM mensajes_chat
        WHERE id_receptor IS NULL
        ORDER BY fecha_envio ASC
        LIMIT ?
      `, [limitVal]);
      rows = resGeneral;
    }

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get(['/noleidos', '/chat/noleidos'], async (req, res) => {
  try {
    const { id_usuario } = req.query;
    if (!id_usuario) return res.json({ total: 0, por_usuario: {} });

    const [rows] = await pool.query(`
      SELECT id_emisor, COUNT(*) as cantidad
      FROM mensajes_chat
      WHERE id_receptor = ? AND leido = 0
      GROUP BY id_emisor
    `, [id_usuario]);

    const por_usuario = {};
    let total = 0;
    rows.forEach(r => {
      por_usuario[r.id_emisor] = r.cantidad;
      total += r.cantidad;
    });

    res.json({ total, por_usuario });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post(['/enviar', '/chat/enviar'], async (req, res) => {
  try {
    const { id_emisor, emisor_nombre, emisor_rol, emisor_area, id_receptor, receptor_nombre, mensaje } = req.body;

    if (!mensaje || !mensaje.trim()) {
      return res.status(400).json({ error: 'El mensaje no puede estar vacío' });
    }

    const [result] = await pool.query(`
      INSERT INTO mensajes_chat 
        (id_emisor, emisor_nombre, emisor_rol, emisor_area, id_receptor, receptor_nombre, mensaje, fecha_envio)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      id_emisor || 0,
      emisor_nombre || 'Personal',
      emisor_rol || 'Gestión',
      emisor_area || 'Operaciones',
      id_receptor || null,
      receptor_nombre || null,
      mensaje.trim(),
    ]);

    // Actualizar último acceso del emisor
    if (id_emisor) {
      await pool.query(`
        UPDATE usuarios 
        SET ultimo_acceso = NOW(), esta_online = 1, ultima_accion = ?
        WHERE id_usuario = ?
      `, [`Envió mensaje en chat: "${mensaje.trim().substring(0, 30)}..."`, id_emisor]);
    }

    res.json({
      success: true,
      id_mensaje: result.insertId,
      fecha_envio: new Date(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post(['/registrar', '/auditoria/registrar'], async (req, res) => {
  try {
    const { id_usuario, usuario_nombre, modulo, accion, id_referencia, descripcion } = req.body;
    await registrarAuditoria(pool, { id_usuario, usuario_nombre, modulo, accion, id_referencia, descripcion, req });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get(['/usuarios-online', '/auditoria/usuarios-online'], async (req, res) => {
  try {
    // Considerar ONLINE si su ultimo_acceso fue en los últimos 15 minutos
    const [rows] = await pool.query(`
      SELECT 
        u.id_usuario,
        u.documento,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS nombre_completo,
        u.email,
        u.id_rol,
        r.nombre AS rol_nombre,
        COALESCE(u.area, 'Operaciones') AS area,
        COALESCE(u.distrito_conexion, u.distrito, '') AS distrito,
        u.distrito_conexion,
        u.lat_conexion,
        u.lng_conexion,
        u.ip_conexion,
        COALESCE(u.direccion, '') AS direccion,
        u.ultimo_acceso,
        u.ultima_accion,
        CASE 
          WHEN u.ultimo_acceso >= DATE_SUB(NOW(), INTERVAL 15 MINUTE) THEN 1 
          ELSE 0 
        END AS esta_online
      FROM usuarios u
      LEFT JOIN roles r ON u.id_rol = r.id_rol
      WHERE u.estado = 'Activo' AND (u.id_rol != 2 OR u.id_rol IS NULL)
      ORDER BY esta_online DESC, u.ultimo_acceso DESC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get(['/logs', '/auditoria/logs'], async (req, res) => {
  try {
    const { fechaDesde, fechaHasta, modulo, id_usuario, limite } = req.query;
    let sql = `SELECT * FROM auditoria_actividad WHERE 1=1`;
    const params = [];

    if (fechaDesde) {
      sql += ` AND DATE(fecha_creacion) >= ?`;
      params.push(fechaDesde);
    }
    if (fechaHasta) {
      sql += ` AND DATE(fecha_creacion) <= ?`;
      params.push(fechaHasta);
    }
    if (modulo && modulo !== 'Todos') {
      if (modulo === 'GESTION') {
        sql += ` AND (modulo = 'GESTION' OR accion IN ('OBSERVACION_LLAMADA', 'INCONCERT_TOGGLE', 'ASIGNACION_TECNICO'))`;
      } else {
        sql += ` AND modulo = ?`;
        params.push(modulo);
      }
    }
    if (id_usuario && id_usuario !== 'Todos') {
      sql += ` AND id_usuario = ?`;
      params.push(id_usuario);
    }

    const limitVal = Math.min(1000, Math.max(1, Number(limite) || 100));
    sql += ` ORDER BY fecha_creacion DESC LIMIT ${limitVal}`;

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get(['/metricas-gestores', '/auditoria/metricas-gestores'], async (req, res) => {
  try {
    const { fecha, desde, hasta } = req.query;
    let dateCondition = "";
    const params = [];

    if (desde && hasta) {
      dateCondition = " AND DATE(a.fecha_creacion) >= ? AND DATE(a.fecha_creacion) <= ?";
      params.push(desde, hasta);
    } else if (fecha) {
      dateCondition = " AND DATE(a.fecha_creacion) = ?";
      params.push(fecha);
    } else {
      dateCondition = " AND DATE(a.fecha_creacion) = CURDATE()";
    }

    const sql = `
      SELECT 
        u.id_usuario,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS usuario_nombre,
        r.nombre AS rol_nombre,
        COALESCE(u.area, 'Gestión') AS area,
        COUNT(a.id_log) AS total_acciones,
        COALESCE(SUM(CASE WHEN a.accion = 'OBSERVACION_LLAMADA' OR a.accion = 'INCONCERT_TOGGLE' THEN 1 ELSE 0 END), 0) AS llamadas_gestionadas,
        COALESCE(SUM(CASE WHEN a.accion = 'ASIGNACION_TECNICO' THEN 1 ELSE 0 END), 0) AS ordenes_asignadas,
        COALESCE(SUM(CASE WHEN a.accion LIKE '%ESTADO%' THEN 1 ELSE 0 END), 0) AS cambios_estado,
        MAX(a.fecha_creacion) AS ultima_actividad
      FROM usuarios u
      LEFT JOIN roles r ON r.id_rol = u.id_rol
      LEFT JOIN auditoria_actividad a ON a.id_usuario = u.id_usuario ${dateCondition}
      WHERE u.estado = 'Activo' AND (u.id_rol = 4 OR UPPER(COALESCE(r.nombre, '')) LIKE '%GESTION%')
      GROUP BY u.id_usuario, u.nombres, u.primer_apellido, u.apellidos, r.nombre, u.area
      ORDER BY total_acciones DESC, usuario_nombre ASC
    `;

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get(['/grafico-gestion', '/auditoria/grafico-gestion'], async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    let dateFilter = '';
    const params = [];

    if (desde && hasta) {
      dateFilter = ' AND DATE(a.fecha_creacion) >= ? AND DATE(a.fecha_creacion) <= ?';
      params.push(desde, hasta);
    } else if (desde) {
      dateFilter = ' AND DATE(a.fecha_creacion) >= ?';
      params.push(desde);
    }

    // 1. Evolución por día (llamadas Inconcert, observaciones con clientes, asignaciones a técnicos)
    const [evolucion] = await pool.query(`
      SELECT 
        DATE_FORMAT(a.fecha_creacion, '%Y-%m-%d') as fecha,
        DATE_FORMAT(a.fecha_creacion, '%d/%m') as fecha_corta,
        COALESCE(SUM(CASE WHEN a.accion = 'INCONCERT_TOGGLE' THEN 1 ELSE 0 END), 0) AS llamadas_inconcert,
        COALESCE(SUM(CASE WHEN a.accion = 'OBSERVACION_LLAMADA' THEN 1 ELSE 0 END), 0) AS observaciones_cliente,
        COALESCE(SUM(CASE WHEN a.accion = 'ASIGNACION_TECNICO' THEN 1 ELSE 0 END), 0) AS asignaciones_tecnico,
        COUNT(a.id_log) AS total_interacciones
      FROM auditoria_actividad a
      JOIN usuarios u ON a.id_usuario = u.id_usuario
      LEFT JOIN roles r ON u.id_rol = r.id_rol
      WHERE (u.id_rol = 4 OR UPPER(COALESCE(r.nombre, '')) = 'GESTION')
        ${dateFilter}
      GROUP BY DATE(a.fecha_creacion)
      ORDER BY fecha ASC
    `, params);

    // 2. Desglose comparativo EXCLUSIVO para Rol de Gestión en el rango
    const [porGestor] = await pool.query(`
      SELECT 
        u.id_usuario,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS usuario_nombre,
        COALESCE(SUM(CASE WHEN a.accion = 'INCONCERT_TOGGLE' THEN 1 ELSE 0 END), 0) AS llamadas,
        COALESCE(SUM(CASE WHEN a.accion = 'OBSERVACION_LLAMADA' THEN 1 ELSE 0 END), 0) AS observaciones,
        COALESCE(SUM(CASE WHEN a.accion = 'ASIGNACION_TECNICO' THEN 1 ELSE 0 END), 0) AS asignaciones,
        COUNT(a.id_log) AS total
      FROM usuarios u
      LEFT JOIN roles r ON u.id_rol = r.id_rol
      LEFT JOIN auditoria_actividad a ON a.id_usuario = u.id_usuario ${dateFilter}
      WHERE u.estado = 'Activo' AND (u.id_rol = 4 OR UPPER(COALESCE(r.nombre, '')) = 'GESTION')
      GROUP BY u.id_usuario, u.nombres, u.primer_apellido, u.apellidos, u.id_rol, r.nombre
      ORDER BY total DESC, usuario_nombre ASC
    `, params);

    // 3. Totales acumulados
    let totalLlamadas = 0;
    let totalObservaciones = 0;
    let totalAsignaciones = 0;
    let totalInteracciones = 0;

    evolucion.forEach(e => {
      totalLlamadas += Number(e.llamadas_inconcert || 0);
      totalObservaciones += Number(e.observaciones_cliente || 0);
      totalAsignaciones += Number(e.asignaciones_tecnico || 0);
      totalInteracciones += Number(e.total_interacciones || 0);
    });

    const porGestorConEfectividad = porGestor.map(g => {
      const ll = Number(g.llamadas || 0);
      const obs = Number(g.observaciones || 0);
      let efectividad = 0;
      if (ll > 0) efectividad = Math.min(100, Math.round((obs / ll) * 100));
      else if (obs > 0) efectividad = 100;
      return {
        ...g,
        llamadas: ll,
        observaciones: obs,
        asignaciones: Number(g.asignaciones || 0),
        total: Number(g.total || 0),
        efectividad
      };
    });

    const tasaEfectividadGlobal = totalLlamadas > 0
      ? Math.min(100, Math.round((totalObservaciones / totalLlamadas) * 100))
      : 0;

    res.json({
      evolucion,
      porGestor: porGestorConEfectividad,
      resumen: {
        totalLlamadas,
        totalObservaciones,
        totalAsignaciones,
        totalInteracciones,
        tasaEfectividadGlobal
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get(['/jornada-timeline', '/auditoria/jornada-timeline'], async (req, res) => {
  try {
    const fecha = req.query.fecha || new Date().toISOString().split('T')[0];
    const { area, rol, search } = req.query;

    let sql = `
      SELECT 
        u.id_usuario,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS nombre_completo,
        u.email,
        u.usuario,
        u.id_rol,
        r.nombre AS rol_nombre,
        COALESCE(u.area, 'Operaciones') AS area,
        COALESCE(u.distrito_conexion, u.distrito, '') AS distrito,
        u.foto_personal,
        u.ultimo_acceso,
        CASE 
          WHEN u.ultimo_acceso >= DATE_SUB(NOW(), INTERVAL 15 MINUTE) THEN 1 
          ELSE 0 
        END AS esta_online,
        j.hora_primer_ingreso,
        j.hora_ultimo_acceso,
        COALESCE(j.minutos_totales, 0) AS minutos_totales,
        j.intervalos_actividad,
        COALESCE(j.ultima_accion, u.ultima_accion, 'Sin actividad registrada') AS ultima_accion,
        j.ip_address,
        j.fecha
      FROM usuarios u
      LEFT JOIN roles r ON u.id_rol = r.id_rol
      LEFT JOIN control_jornadas_personal j ON j.id_usuario = u.id_usuario AND j.fecha = ?
      WHERE u.estado = 'Activo' AND (u.id_rol != 2 OR u.id_rol IS NULL)
    `;
    const params = [fecha];

    if (area && area !== 'Todos') {
      sql += ` AND (u.area = ? OR r.nombre = ?)`;
      params.push(area, area);
    }
    if (rol && rol !== 'Todos') {
      sql += ` AND r.nombre = ?`;
      params.push(rol);
    }
    if (search && search.trim()) {
      sql += ` AND (u.nombres LIKE ? OR u.primer_apellido LIKE ? OR u.apellidos LIKE ? OR u.usuario LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    sql += ` ORDER BY esta_online DESC, (j.hora_primer_ingreso IS NOT NULL) DESC, j.hora_primer_ingreso ASC, u.nombres ASC`;

    const [rows] = await pool.query(sql, params);

    // Formatear datos para la línea de tiempo (Rango horario estándar 06:00 a 22:00 = 16 horas = 960 minutos)
    const RANGO_INICIO_MIN = 6 * 60; // 06:00 = 360 min
    const RANGO_FIN_MIN = 22 * 60;   // 22:00 = 1320 min
    const RANGO_DURACION_MIN = RANGO_FIN_MIN - RANGO_INICIO_MIN; // 960 min

    const aMinutosDesdeMedianoche = (timeStr) => {
      if (!timeStr) return null;
      const parts = String(timeStr).split(':').map(Number);
      return (parts[0] || 0) * 60 + (parts[1] || 0);
    };

    const formatearHora12 = (timeStr) => {
      if (!timeStr) return '--:--';
      const parts = String(timeStr).split(':');
      let h = parseInt(parts[0], 10);
      const m = parts[1] || '00';
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12;
      h = h ? h : 12;
      return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
    };

    const formatearDuracion = (totalMin) => {
      if (!totalMin || totalMin <= 0) return '0m';
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      if (h === 0) return `${m}m`;
      return `${h}h ${m}m`;
    };

    let totalMinutosAcumulados = 0;
    let totalUsuariosConIngreso = 0;
    let sumaHoraIngresoMinutos = 0;

    const usuariosFormateados = rows.map((u) => {
      let intervalos = [];
      try {
        intervalos = typeof u.intervalos_actividad === 'string' ? JSON.parse(u.intervalos_actividad) : (u.intervalos_actividad || []);
      } catch (e) {
        intervalos = [];
      }

      let primerIngreso = u.hora_primer_ingreso;
      let ultimoAcceso = u.hora_ultimo_acceso;
      let minutosTotales = Number(u.minutos_totales) || 0;

      // Si no tiene registros en la tabla jornada pero su ultimo_acceso coincide con la fecha consultada
      if (!primerIngreso && u.ultimo_acceso) {
        const dAcceso = new Date(u.ultimo_acceso);
        const ymdAcceso = dAcceso.toISOString().split('T')[0];
        if (ymdAcceso === fecha) {
          const horaAcceso = dAcceso.toTimeString().split(' ')[0];
          primerIngreso = horaAcceso;
          ultimoAcceso = horaAcceso;
          minutosTotales = Math.max(10, minutosTotales);
          if (intervalos.length === 0) {
            intervalos = [{ inicio: horaAcceso.substring(0, 5), fin: horaAcceso.substring(0, 5), minutos: 10 }];
          }
        }
      }

      // Convertir intervalos en segmentos para la barra horizontal (06:00 a 22:00)
      const segmentosGrafico = (Array.isArray(intervalos) ? intervalos : []).map((iv) => {
        const iniMin = aMinutosDesdeMedianoche(iv.inicio);
        const finMin = aMinutosDesdeMedianoche(iv.fin) || iniMin;
        
        const iniClamped = Math.max(RANGO_INICIO_MIN, Math.min(RANGO_FIN_MIN, iniMin));
        const finClamped = Math.max(RANGO_INICIO_MIN, Math.min(RANGO_FIN_MIN, Math.max(finMin, iniClamped + 6)));

        const leftPct = Math.max(0, Math.min(100, ((iniClamped - RANGO_INICIO_MIN) / RANGO_DURACION_MIN) * 100));
        const widthPct = Math.max(1.8, Math.min(100 - leftPct, ((finClamped - iniClamped) / RANGO_DURACION_MIN) * 100));

        return {
          inicio: iv.inicio,
          fin: iv.fin,
          inicioFormato: formatearHora12(iv.inicio),
          finFormato: formatearHora12(iv.fin),
          minutos: iv.minutos || Math.max(5, finMin - iniMin),
          leftPct: Number(leftPct.toFixed(2)),
          widthPct: Number(widthPct.toFixed(2))
        };
      });

      // Si no hay intervalos pero sí hay primerIngreso y ultimoAcceso, generar 1 segmento global
      if (segmentosGrafico.length === 0 && primerIngreso && ultimoAcceso) {
        const iniMin = aMinutosDesdeMedianoche(primerIngreso);
        const finMin = aMinutosDesdeMedianoche(ultimoAcceso);
        const iniClamped = Math.max(RANGO_INICIO_MIN, Math.min(RANGO_FIN_MIN, iniMin));
        const finClamped = Math.max(RANGO_INICIO_MIN, Math.min(RANGO_FIN_MIN, Math.max(finMin, iniClamped + 10)));
        const leftPct = Math.max(0, Math.min(100, ((iniClamped - RANGO_INICIO_MIN) / RANGO_DURACION_MIN) * 100));
        const widthPct = Math.max(2.2, Math.min(100 - leftPct, ((finClamped - iniClamped) / RANGO_DURACION_MIN) * 100));

        segmentosGrafico.push({
          inicio: String(primerIngreso).substring(0, 5),
          fin: String(ultimoAcceso).substring(0, 5),
          inicioFormato: formatearHora12(primerIngreso),
          finFormato: formatearHora12(ultimoAcceso),
          minutos: Math.max(10, finMin - iniMin),
          leftPct: Number(leftPct.toFixed(2)),
          widthPct: Number(widthPct.toFixed(2))
        });
      }

      if (primerIngreso) {
        totalUsuariosConIngreso++;
        sumaHoraIngresoMinutos += (aMinutosDesdeMedianoche(primerIngreso) || 0);
        totalMinutosAcumulados += minutosTotales;
      }

      return {
        ...u,
        hora_primer_ingreso: primerIngreso,
        hora_ultimo_acceso: ultimoAcceso,
        hora_primer_ingreso_formato: formatearHora12(primerIngreso),
        hora_ultimo_acceso_formato: formatearHora12(ultimoAcceso),
        minutos_totales: minutosTotales,
        tiempo_conectado_formato: formatearDuracion(minutosTotales),
        segmentosGrafico
      };
    });

    const promedioMinutosPorUsuario = totalUsuariosConIngreso > 0 ? Math.round(totalMinutosAcumulados / totalUsuariosConIngreso) : 0;
    const promedioHoraIngresoMin = totalUsuariosConIngreso > 0 ? Math.round(sumaHoraIngresoMinutos / totalUsuariosConIngreso) : 0;
    const horaIngresoPromedioStr = promedioHoraIngresoMin > 0 ? `${Math.floor(promedioHoraIngresoMin / 60)}:${String(promedioHoraIngresoMin % 60).padStart(2, '0')}` : null;

    res.json({
      success: true,
      fecha,
      resumen: {
        totalPersonal: rows.length,
        totalActivosEnDia: totalUsuariosConIngreso,
        totalOnlineAhora: rows.filter((r) => r.esta_online === 1).length,
        promedioHoraIngreso: formatearHora12(horaIngresoPromedioStr),
        promedioHorasTrabajadas: formatearDuracion(promedioMinutosPorUsuario)
      },
      usuarios: usuariosFormateados
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;