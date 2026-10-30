'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth, signToken } = require('../middleware/requireAuth');
const { uploadFileToS3, uploadBufferToS3, getS3ObjectStream, checkS3ObjectExists, getS3SignedUrl } = require('../services/s3Service');
const path = require('path');
const fs = require('fs');


// ─── RUTAS MÓDULO: ASISTENCIAS ───────────────────────────────────────

router.get('/diaria', async (req, res) => {
  try {
    const fecha = req.query.fecha || new Date().toISOString().slice(0, 10);
    const idRol = req.query.id_rol;

    // Sincronizar automáticamente en segundo plano con las órdenes del día
    try {
      await syncAsistenciasFromOrders(fecha, fecha);
    } catch (e) {
      console.warn("Advertencia en syncAsistenciasFromOrders:", e.message);
    }

    let rolFilter = "";
    const params = [fecha];
    if (idRol && idRol !== "Todos") {
      rolFilter = "AND u.id_rol = ?";
      params.push(idRol);
    }

    const [rows] = await pool.query(`
      SELECT 
        u.id_usuario,
        t.id_trabajador,
        u.documento,
        u.id_rol,
        r.nombre AS rol_nombre,
        u.area AS cargo,
        COALESCE(u.tipo_servicio, '') AS tipo_trabajo,
        COALESCE(u.opcion_personal, '') AS opcion_personal,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''), ' ', COALESCE(u.segundo_apellido, ''))) AS nombre_completo,
        COALESCE(u.cuadrilla, '') AS cuadrilla,
        COALESCE(v.placa, '') AS vehiculo_placa,
        a.id_asistencia,
        a.fecha,
        COALESCE(a.hora_entrada, '') AS hora_entrada,
        COALESCE(a.hora_salida, '') AS hora_salida,
        a.estado,
        COALESCE(a.minutos_tarde, 0) AS minutos_tarde,
        COALESCE(a.tipo, 'Manual') AS tipo,
        a.id_orden,
        o.numero AS orden_numero,
        COALESCE(a.observacion, '') AS observacion,
        (
          SELECT COUNT(*) FROM trabajador_descansos td
          WHERE td.id_trabajador = t.id_trabajador
            AND ? BETWEEN td.fecha_inicio AND td.fecha_fin
            AND td.estado != 'Cancelado'
        ) AS tiene_descanso_programado
      FROM usuarios u
      LEFT JOIN roles r ON u.id_rol = r.id_rol
      LEFT JOIN trabajadores t ON u.id_usuario = t.id_usuario
      LEFT JOIN vehiculos v ON t.id_vehiculo = v.id_vehiculo
      LEFT JOIN asistencias a ON t.id_trabajador = a.id_trabajador AND a.fecha = ?
      LEFT JOIN ordenes o ON a.id_orden = o.id_orden
      WHERE (u.estado = 'Activo' OR u.estado IS NULL)
        ${rolFilter}
      ORDER BY u.cuadrilla ASC, nombre_completo ASC
    `, [fecha, ...params]);

    res.json({ fecha, asistencias: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/sincronizar-ordenes', async (req, res) => {
  try {
    const fecha = req.body?.fecha || req.query?.fecha || new Date().toISOString().slice(0, 10);
    const count = await syncAsistenciasFromOrders(fecha, fecha);
    res.json({ success: true, count, message: `Se sincronizaron ${count} asistencias automáticas desde órdenes.` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/marcar', async (req, res) => {
  try {
    const { id_trabajador, id_usuario, fecha, estado, hora_entrada, hora_salida, minutos_tarde, observacion } = req.body;

    let targetTrabajadorId = null;

    // Prioridad 1: Si viene id_usuario, SIEMPRE resolver el id_trabajador real correspondiente
    if (id_usuario) {
      const [tRows] = await pool.query("SELECT id_trabajador FROM trabajadores WHERE id_usuario = ? LIMIT 1", [id_usuario]);
      if (tRows.length > 0) {
        targetTrabajadorId = tRows[0].id_trabajador;
      } else {
        const [insT] = await pool.query("INSERT INTO trabajadores (id_trabajador, id_usuario, id_horario, fecha_ingreso, estado) VALUES (?, ?, 1, CURDATE(), 'Activo')", [id_usuario, id_usuario]);
        targetTrabajadorId = id_usuario;
      }
    } else if (id_trabajador) {
      // Si solo viene id_trabajador, verificar si existe directamente
      const [chk] = await pool.query("SELECT id_trabajador FROM trabajadores WHERE id_trabajador = ? LIMIT 1", [id_trabajador]);
      if (chk.length > 0) {
        targetTrabajadorId = chk[0].id_trabajador;
      } else {
        // En caso de que se haya enviado id_usuario dentro del campo id_trabajador por confusión
        const [byUser] = await pool.query("SELECT id_trabajador FROM trabajadores WHERE id_usuario = ? LIMIT 1", [id_trabajador]);
        if (byUser.length > 0) {
          targetTrabajadorId = byUser[0].id_trabajador;
        }
      }
    }

    if (!targetTrabajadorId) {
      return res.status(400).json({ error: "id_trabajador o id_usuario es requerido." });
    }

    const fechaAsistencia = fecha || new Date().toISOString().slice(0, 10);
    const estadoAsistencia = estado || 'Asistio';
    const isNoWorkStatus = ['Falta', 'Descanso'].includes(estadoAsistencia);
    const defaultHoraEntrada = isNoWorkStatus ? null : '07:45:00';
    const finalHoraEntrada = hora_entrada ? hora_entrada : defaultHoraEntrada;
    const finalHoraSalida = hora_salida ? hora_salida : null;

    const [exist] = await pool.query("SELECT id_asistencia FROM asistencias WHERE id_trabajador = ? AND fecha = ?", [targetTrabajadorId, fechaAsistencia]);

    if (exist.length > 0) {
      await pool.query(`
        UPDATE asistencias SET
          estado = ?,
          hora_entrada = COALESCE(?, hora_entrada),
          hora_salida = COALESCE(?, hora_salida),
          minutos_tarde = COALESCE(?, minutos_tarde),
          observacion = COALESCE(?, observacion),
          tipo = 'Manual'
        WHERE id_asistencia = ?
      `, [estadoAsistencia, finalHoraEntrada, finalHoraSalida, minutos_tarde || 0, observacion || null, exist[0].id_asistencia]);

      res.json({ success: true, message: "Asistencia actualizada", id_asistencia: exist[0].id_asistencia, id_trabajador: targetTrabajadorId });
    } else {
      const [insRes] = await pool.query(`
        INSERT INTO asistencias (id_trabajador, fecha, hora_entrada, hora_salida, estado, minutos_tarde, tipo, observacion)
        VALUES (?, ?, ?, ?, ?, ?, 'Manual', ?)
      `, [targetTrabajadorId, fechaAsistencia, finalHoraEntrada, finalHoraSalida, estadoAsistencia, minutos_tarde || 0, observacion || null]);

      res.json({ success: true, message: "Asistencia registrada", id_asistencia: insRes.insertId, id_trabajador: targetTrabajadorId });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/matriz', async (req, res) => {
  try {
    const { desde, hasta, id_rol } = req.query;
    if (!desde || !hasta) {
      return res.status(400).json({ error: "Fechas desde y hasta son requeridas." });
    }

    // Auto-sincronizar todas las fechas del rango consultado con las órdenes de campo
    try {
      await syncAsistenciasFromOrders(desde, hasta);
    } catch (e) {
      console.warn("Advertencia en syncAsistenciasFromOrders para matriz:", e.message);
    }

    let rolFilter = "";
    const params = [desde, hasta];
    if (id_rol && id_rol !== "Todos") {
      rolFilter = "AND u.id_rol = ?";
      params.push(id_rol);
    }

    const [trabajadores] = await pool.query(`
      SELECT 
        u.id_usuario,
        t.id_trabajador,
        u.documento,
        u.id_rol,
        r.nombre AS rol_nombre,
        u.area AS cargo,
        COALESCE(u.tipo_servicio, '') AS tipo_trabajo,
        COALESCE(u.opcion_personal, '') AS opcion_personal,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''), ' ', COALESCE(u.segundo_apellido, ''))) AS nombre_completo,
        COALESCE(u.cuadrilla, '') AS cuadrilla
      FROM usuarios u
      LEFT JOIN roles r ON u.id_rol = r.id_rol
      LEFT JOIN trabajadores t ON u.id_usuario = t.id_usuario
      WHERE (u.estado = 'Activo' OR u.estado IS NULL)
        ${rolFilter}
      ORDER BY u.cuadrilla ASC, nombre_completo ASC
    `, params.slice(2));

    const [asistencias] = await pool.query(`
      SELECT a.id_asistencia, a.id_trabajador, t.id_usuario, a.fecha, a.hora_entrada, a.estado, a.minutos_tarde, a.observacion,
             a.tipo, a.id_orden, o.numero AS numero_orden, o.cliente,
             COALESCE(
               o.hora_asignacion,
               (SELECT MIN(o2.hora_asignacion) FROM ordenes o2 
                WHERE (o2.id_tecnico = t.id_usuario OR o2.id_tecnico = t.id_trabajador)
                  AND (DATE(o2.fecha_visita) = a.fecha OR DATE(o2.fecha_solicitud) = a.fecha)
                  AND o2.hora_asignacion IS NOT NULL)
             ) AS hora_asignacion,
             o.inicio_visita, o.hora_en_camino, o.fin_visita
      FROM asistencias a
      LEFT JOIN trabajadores t ON a.id_trabajador = t.id_trabajador
      LEFT JOIN ordenes o ON a.id_orden = o.id_orden
      WHERE a.fecha BETWEEN ? AND ?
    `, [desde, hasta]);

    const [descansos] = await pool.query(`
      SELECT td.id_descanso, td.id_trabajador, t.id_usuario, td.fecha_inicio, td.fecha_fin, td.motivo, td.estado
      FROM trabajador_descansos td
      LEFT JOIN trabajadores t ON td.id_trabajador = t.id_trabajador
      WHERE td.estado != 'Cancelado'
        AND NOT (td.fecha_fin < ? OR td.fecha_inicio > ?)
    `, [desde, hasta]);

    res.json({ desde, hasta, trabajadores, asistencias, descansos });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/descansos', async (req, res) => {
  try {
    const idRol = req.query.id_rol;
    let rolFilter = "";
    const params = [];
    if (idRol && idRol !== "Todos") {
      rolFilter = "WHERE u.id_rol = ?";
      params.push(idRol);
    }
    const [rows] = await pool.query(`
      SELECT 
        td.*,
        u.id_usuario,
        u.documento,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''), ' ', COALESCE(u.segundo_apellido, ''))) AS nombre_completo,
        u.cuadrilla
      FROM trabajador_descansos td
      LEFT JOIN trabajadores t ON td.id_trabajador = t.id_trabajador
      LEFT JOIN usuarios u ON t.id_usuario = u.id_usuario
      ${rolFilter}
      ORDER BY td.fecha_inicio DESC
    `, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/descansos', async (req, res) => {
  try {
    const { id_trabajador, id_usuario, fecha_inicio, fecha_fin, motivo, estado = 'Programado' } = req.body;

    let targetTrabajadorId = null;
    if (id_usuario) {
      const [tRows] = await pool.query("SELECT id_trabajador FROM trabajadores WHERE id_usuario = ? LIMIT 1", [id_usuario]);
      if (tRows.length > 0) {
        targetTrabajadorId = tRows[0].id_trabajador;
      } else {
        const [insT] = await pool.query("INSERT INTO trabajadores (id_trabajador, id_usuario, id_horario, fecha_ingreso, estado) VALUES (?, ?, 1, CURDATE(), 'Activo')", [id_usuario, id_usuario]);
        targetTrabajadorId = id_usuario;
      }
    } else if (id_trabajador) {
      const [chk] = await pool.query("SELECT id_trabajador FROM trabajadores WHERE id_trabajador = ? LIMIT 1", [id_trabajador]);
      if (chk.length > 0) {
        targetTrabajadorId = chk[0].id_trabajador;
      } else {
        const [byUser] = await pool.query("SELECT id_trabajador FROM trabajadores WHERE id_usuario = ? LIMIT 1", [id_trabajador]);
        if (byUser.length > 0) {
          targetTrabajadorId = byUser[0].id_trabajador;
        }
      }
    }

    if (!targetTrabajadorId || !fecha_inicio || !fecha_fin) {
      return res.status(400).json({ error: "Trabajador (id_trabajador o id_usuario), fecha_inicio y fecha_fin son requeridos." });
    }

    const [result] = await pool.query(`
      INSERT INTO trabajador_descansos (id_trabajador, fecha_inicio, fecha_fin, motivo, estado)
      VALUES (?, ?, ?, ?, ?)
    `, [targetTrabajadorId, fecha_inicio, fecha_fin, motivo?.trim() || null, estado]);
    res.json({ success: true, id_descanso: result.insertId, id_trabajador: targetTrabajadorId, message: "Descanso programado con éxito." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/descansos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("UPDATE trabajador_descansos SET estado = 'Cancelado' WHERE id_descanso = ?", [id]);
    res.json({ success: true, message: "Descanso cancelado con éxito." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/descansos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { id_trabajador, id_usuario, fecha_inicio, fecha_fin, motivo, estado } = req.body;

    let targetTrabajadorId = null;
    if (id_usuario) {
      const [tRows] = await pool.query("SELECT id_trabajador FROM trabajadores WHERE id_usuario = ? LIMIT 1", [id_usuario]);
      if (tRows.length > 0) {
        targetTrabajadorId = tRows[0].id_trabajador;
      } else {
        targetTrabajadorId = id_usuario;
      }
    } else if (id_trabajador) {
      targetTrabajadorId = id_trabajador;
    }

    const updates = [];
    const params = [];

    if (targetTrabajadorId) {
      updates.push("id_trabajador = ?");
      params.push(targetTrabajadorId);
    }
    if (fecha_inicio) {
      updates.push("fecha_inicio = ?");
      params.push(fecha_inicio);
    }
    if (fecha_fin) {
      updates.push("fecha_fin = ?");
      params.push(fecha_fin);
    }
    if (motivo !== undefined) {
      updates.push("motivo = ?");
      params.push(motivo?.trim() || null);
    }
    if (estado) {
      updates.push("estado = ?");
      params.push(estado);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No hay campos para actualizar." });
    }

    params.push(id);
    await pool.query(`UPDATE trabajador_descansos SET ${updates.join(', ')} WHERE id_descanso = ?`, params);

    res.json({ success: true, message: "Descanso actualizado con éxito." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;