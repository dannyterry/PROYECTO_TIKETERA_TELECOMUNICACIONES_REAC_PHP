'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth, signToken } = require('../middleware/requireAuth');
const { uploadFileToS3, uploadBufferToS3, getS3ObjectStream, checkS3ObjectExists, getS3SignedUrl } = require('../services/s3Service');
const path = require('path');
const fs = require('fs');

const { sincronizarTareasOrdenSeguro, getTareasDeBD, sincronizarTareasOrdenesActivas, guardarDetalleTareaEnBD, getMetrajeDeclaradoFenix } = require('../services/taskSyncService');
const { getMotivosCatalogo, resolverTipoTrabajoConCatalogo, resolverTipoTrabajoOficial, normalizeText } = require('../services/tipoTrabajoHelper');

// ─── RUTAS MÓDULO: SUPERVISION ───────────────────────────────────────

router.get(['/tecnicos-combo', '/supervision/tecnicos-combo'], async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        COALESCE(t.id_trabajador, u.id_usuario) as id_tecnico,
        CONCAT(TRIM(COALESCE(u.nombres, '')), ' ', TRIM(COALESCE(u.primer_apellido, u.apellidos, ''))) as tecnico,
        COALESCE(u.nombres, '') as nombres,
        COALESCE(u.primer_apellido, u.apellidos, '') as apellidos,
        COALESCE(u.documento, '') as dni,
        COALESCE(u.cuadrilla, '') as cuadrilla,
        COALESCE(u.telefono, '') as celular,
        COALESCE(u.cargo, '') as cargo,
        COALESCE(u.tipo_servicio, '') as tipo_servicio
      FROM usuarios u
      LEFT JOIN trabajadores t ON t.id_usuario = u.id_usuario
      LEFT JOIN roles r ON u.id_rol = r.id_rol
      WHERE u.estado = 'Activo'
        AND (
          u.id_rol = 2 
          OR (UPPER(COALESCE(r.nombre, '')) LIKE '%TECNIC%' AND UPPER(COALESCE(r.nombre, '')) NOT LIKE '%ADMIN%')
        )
      ORDER BY u.nombres ASC, u.primer_apellido ASC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error en /api/supervision/tecnicos-combo:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get(['/supervisores-combo', '/supervision/supervisores-combo'], async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        u.id_usuario,
        CONCAT(TRIM(COALESCE(u.nombres, '')), ' ', TRIM(COALESCE(u.primer_apellido, u.apellidos, ''))) as supervisor,
        u.usuario,
        COALESCE(r.nombre, u.cargo, 'SUPERVISOR') as cargo,
        COALESCE(u.telefono, '') as telefono
      FROM usuarios u
      LEFT JOIN roles r ON u.id_rol = r.id_rol
      WHERE u.estado = 'Activo'
        AND (
          u.id_rol = 6 
          OR UPPER(COALESCE(r.nombre, '')) LIKE '%SUPERVIC%' 
          OR UPPER(COALESCE(r.nombre, '')) LIKE '%SUPERVIS%'
        )
      ORDER BY u.nombres ASC, u.primer_apellido ASC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error en /api/supervision/supervisores-combo:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get(['/buscar-orden', '/supervision/buscar-orden'], async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || !q.trim()) {
      return res.json({ success: true, data: [] });
    }

    const term = `%${q.trim()}%`;
    const [rows] = await pool.query(`
      SELECT 
        o.id_orden,
        o.numero as ot,
        COALESCE(o.cod_seguimiento_cliente, '') as codigo_pedido,
        COALESCE(o.codigo_seguimiento, '') as ticket,
        COALESCE(o.cliente, '') as cliente,
        COALESCE(o.movil, o.fijo, '') as telefono,
        COALESCE(o.localidad, o.region_zona, '') as distrito,
        COALESCE(u.nombre_completo, o.tecnico_asignado, '') as tecnico,
        COALESCE(o.id_tecnico, u.id_usuario, 0) as id_tecnico,
        COALESCE(u.documento, '') as dni_tecnico,
        COALESCE(o.cuadrilla, u.cuadrilla, '') as cuadrilla,
        COALESCE(DATE_FORMAT(o.fecha_visita, '%Y-%m-%d'), DATE_FORMAT(o.fecha_solicitud, '%Y-%m-%d'), DATE_FORMAT(o.fecha_estado, '%Y-%m-%d'), '') as fecha_atencion,
        COALESCE(o.motivo_trabajo, o.tipo_trabajo, o.motivo, '') as tipo_trabajo,
        COALESCE(o.direccion, o.ubicacion, '') as direccion,
        COALESCE(o.georeferencia, '') as georeferencia
      FROM ordenes o
      LEFT JOIN (
        SELECT id_usuario, CONCAT(TRIM(COALESCE(nombres, '')), ' ', TRIM(COALESCE(apellidos, ''))) as nombre_completo, documento, cuadrilla 
        FROM usuarios
      ) u ON u.id_usuario = o.id_tecnico
      WHERE (
        o.numero LIKE ? 
        OR o.codigo_seguimiento LIKE ? 
        OR o.cod_seguimiento_cliente LIKE ? 
        OR o.cliente LIKE ?
      )
      ORDER BY o.id_orden DESC
      LIMIT 15
    `, [term, term, term, term]);

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error en /api/supervision/buscar-orden:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get(['/campo', '/supervision/campo'], async (req, res) => {
  try {
    const { desde, hasta, tecnico, tipo_inspeccion, supervisor } = req.query;
    let whereClauses = [];
    let params = [];

    if (desde && hasta) {
      whereClauses.push('fecha BETWEEN ? AND ?');
      params.push(desde, hasta);
    } else if (desde) {
      whereClauses.push('fecha >= ?');
      params.push(desde);
    } else if (hasta) {
      whereClauses.push('fecha <= ?');
      params.push(hasta);
    }

    if (tecnico) {
      whereClauses.push('tecnico LIKE ?');
      params.push(`%${tecnico.trim()}%`);
    }

    if (tipo_inspeccion && tipo_inspeccion !== 'TODOS') {
      whereClauses.push('tipo_inspeccion = ?');
      params.push(tipo_inspeccion);
    }

    if (supervisor) {
      whereClauses.push('supervisor LIKE ?');
      params.push(`%${supervisor.trim()}%`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const [rows] = await pool.query(
      `SELECT * FROM supervision_campo ${whereSql} ORDER BY fecha DESC, hora DESC, id DESC`,
      params
    );

    res.json({ success: true, total: rows.length, data: rows });
  } catch (error) {
    console.error('Error en GET /api/supervision/campo:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get(['/campo/:id', '/supervision/campo/:id'], async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM supervision_campo WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ficha de supervisión no encontrada' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get(['/activa-supervisor', '/supervision/activa-supervisor'], async (req, res) => {
  try {
    const { supervisor, id_supervisor } = req.query;
    if (!supervisor && !id_supervisor) {
      return res.status(400).json({ success: false, error: 'supervisor o id_supervisor es requerido' });
    }

    let query = `
      SELECT * FROM supervision_campo 
      WHERE (estado_operativo = 'EN_CAMINO' OR estado_operativo = 'INICIADA')
    `;
    let params = [];

    if (supervisor) {
      query += ` AND supervisor LIKE ?`;
      params.push(`%${supervisor.trim()}%`);
    }

    query += ` ORDER BY id DESC LIMIT 1`;

    const [rows] = await pool.query(query, params);
    if (rows.length > 0) {
      let items = rows[0].items_json;
      if (typeof items === 'string') {
        try {
          items = JSON.parse(items);
        } catch {}
      }
      return res.json({ success: true, tieneActiva: true, data: { ...rows[0], items_json: items } });
    }

    res.json({ success: true, tieneActiva: false, data: null });
  } catch (error) {
    console.error('Error en GET /api/supervision/activa-supervisor:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post(['/campo', '/supervision/campo'], async (req, res) => {
  try {
    const {
      id,
      id_tecnico,
      tecnico,
      dni,
      cuadrilla,
      id_orden,
      numero_ticket,
      cliente_orden,
      direccion_orden,
      coordenadas_orden,
      coordenadas_en_camino,
      coordenadas_inicio,
      coordenadas_fin,
      distancia_metros_inicio,
      tipo_inspeccion,
      fecha,
      hora,
      hora_inicio,
      hora_fin,
      estado_operativo,
      lugar_inspeccion,
      supervisor,
      cumplimiento_porcentaje,
      semaforo,
      items_json,
      observaciones,
      firma_supervisor,
      foto_epp_uniforme,
      foto_herramientas,
      foto_carro_limpio
    } = req.body;

    if (!tecnico || !fecha) {
      return res.status(400).json({ success: false, error: 'Técnico y fecha son campos obligatorios' });
    }

    const itemsStr = typeof items_json === 'object' ? JSON.stringify(items_json) : (items_json || null);

    if (id) {
      // Actualizar
      await pool.query(
        `UPDATE supervision_campo SET
          id_tecnico = ?, tecnico = ?, dni = ?, cuadrilla = ?, tipo_inspeccion = ?,
          id_orden = ?, numero_ticket = ?, cliente_orden = ?, direccion_orden = ?,
          coordenadas_orden = ?, coordenadas_en_camino = ?, coordenadas_inicio = ?, coordenadas_fin = ?,
          distancia_metros_inicio = ?,
          fecha = ?, hora = ?, hora_inicio = ?, hora_fin = ?, estado_operativo = ?,
          lugar_inspeccion = ?, supervisor = ?,
          cumplimiento_porcentaje = ?, semaforo = ?, items_json = ?,
          observaciones = ?, firma_supervisor = ?,
          foto_epp_uniforme = ?, foto_herramientas = ?, foto_carro_limpio = ?
        WHERE id = ?`,
        [
          id_tecnico || null, tecnico, dni || null, cuadrilla || null, tipo_inspeccion || 'CAMPO_GENERAL',
          id_orden || null, numero_ticket || null, cliente_orden || null, direccion_orden || null,
          coordenadas_orden || null, coordenadas_en_camino || null, coordenadas_inicio || null, coordenadas_fin || null,
          distancia_metros_inicio || null,
          fecha, hora || null, hora_inicio || null, hora_fin || null, estado_operativo || 'FINALIZADA',
          lugar_inspeccion || null, supervisor || null,
          cumplimiento_porcentaje || 100, semaforo || 'verde', itemsStr,
          observaciones || null, firma_supervisor || null,
          foto_epp_uniforme || null, foto_herramientas || null, foto_carro_limpio || null,
          id
        ]
      );
      return res.json({ success: true, id, message: 'Supervisión actualizada correctamente' });
    } else {
      // Insertar
      const [result] = await pool.query(
        `INSERT INTO supervision_campo (
          id_tecnico, tecnico, dni, cuadrilla, tipo_inspeccion,
          id_orden, numero_ticket, cliente_orden, direccion_orden,
          coordenadas_orden, coordenadas_en_camino, coordenadas_inicio, coordenadas_fin,
          distancia_metros_inicio,
          fecha, hora, hora_inicio, hora_fin, estado_operativo, lugar_inspeccion, supervisor,
          cumplimiento_porcentaje, semaforo, items_json,
          observaciones, firma_supervisor,
          foto_epp_uniforme, foto_herramientas, foto_carro_limpio
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id_tecnico || null, tecnico, dni || null, cuadrilla || null, tipo_inspeccion || 'CAMPO_GENERAL',
          id_orden || null, numero_ticket || null, cliente_orden || null, direccion_orden || null,
          coordenadas_orden || null, coordenadas_en_camino || null, coordenadas_inicio || null, coordenadas_fin || null,
          distancia_metros_inicio || null,
          fecha, hora || null, hora_inicio || null, hora_fin || null, estado_operativo || 'FINALIZADA',
          lugar_inspeccion || null, supervisor || null,
          cumplimiento_porcentaje || 100, semaforo || 'verde', itemsStr,
          observaciones || null, firma_supervisor || null,
          foto_epp_uniforme || null, foto_herramientas || null, foto_carro_limpio || null
        ]
      );
      return res.json({ success: true, id: result.insertId, message: 'Supervisión guardada exitosamente' });
    }
  } catch (error) {
    console.error('Error en POST /api/supervision/campo:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete(['/campo/:id', '/supervision/campo/:id'], async (req, res) => {
  try {
    await pool.query('DELETE FROM supervision_campo WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Ficha de supervisión eliminada' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get(['/calidad-cliente', '/supervision/calidad-cliente'], async (req, res) => {
  try {
    const { desde, hasta, tecnico, estado_conformidad, auditor } = req.query;
    let whereClauses = [];
    let params = [];

    if (desde && hasta) {
      whereClauses.push('fecha_auditoria BETWEEN ? AND ?');
      params.push(desde, hasta);
    } else if (desde) {
      whereClauses.push('fecha_auditoria >= ?');
      params.push(desde);
    } else if (hasta) {
      whereClauses.push('fecha_auditoria <= ?');
      params.push(hasta);
    }

    if (tecnico) {
      whereClauses.push('tecnico LIKE ?');
      params.push(`%${tecnico.trim()}%`);
    }

    if (estado_conformidad && estado_conformidad !== 'TODOS') {
      whereClauses.push('estado_conformidad = ?');
      params.push(estado_conformidad);
    }

    if (auditor) {
      whereClauses.push('auditor LIKE ?');
      params.push(`%${auditor.trim()}%`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const [rows] = await pool.query(
      `SELECT * FROM supervision_calidad_cliente ${whereSql} ORDER BY fecha_auditoria DESC, id DESC`,
      params
    );

    res.json({ success: true, total: rows.length, data: rows });
  } catch (error) {
    console.error('Error en GET /api/supervision/calidad-cliente:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post(['/calidad-cliente', '/supervision/calidad-cliente'], async (req, res) => {
  try {
    const {
      id,
      id_orden,
      numero_ticket,
      numero_acta,
      id_tecnico,
      tecnico,
      cuadrilla,
      cliente,
      telefono,
      distrito,
      fecha_atencion,
      fecha_auditoria,
      auditor,
      preguntas_json,
      puntaje_porcentaje,
      calificacion_estrellas,
      comentario_cliente,
      estado_conformidad
    } = req.body;

    if (!tecnico || !cliente || !fecha_auditoria) {
      return res.status(400).json({ success: false, error: 'Técnico, cliente y fecha son obligatorios' });
    }

    const preguntasStr = typeof preguntas_json === 'object' ? JSON.stringify(preguntas_json) : (preguntas_json || null);

    if (id) {
      await pool.query(
        `UPDATE supervision_calidad_cliente SET
          id_orden = ?, numero_ticket = ?, id_tecnico = ?, tecnico = ?, cuadrilla = ?,
          cliente = ?, telefono = ?, distrito = ?, fecha_atencion = ?, fecha_auditoria = ?,
          auditor = ?, preguntas_json = ?, puntaje_porcentaje = ?, calificacion_estrellas = ?,
          comentario_cliente = ?, estado_conformidad = ?
        WHERE id = ?`,
        [
          id_orden || null, numero_ticket || null, id_tecnico || null, tecnico, cuadrilla || null,
          cliente, telefono || null, distrito || null, fecha_atencion || null, fecha_auditoria,
          auditor || null, preguntasStr, puntaje_porcentaje || 100, calificacion_estrellas || 5,
          comentario_cliente || null, estado_conformidad || 'CONFORME',
          id
        ]
      );
      return res.json({ success: true, id, message: 'Auditoría de calidad actualizada' });
    } else {
      const [result] = await pool.query(
        `INSERT INTO supervision_calidad_cliente (
          id_orden, numero_ticket, id_tecnico, tecnico, cuadrilla,
          cliente, telefono, distrito, fecha_atencion, fecha_auditoria,
          auditor, preguntas_json, puntaje_porcentaje, calificacion_estrellas,
          comentario_cliente, estado_conformidad
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id_orden || null, numero_ticket || null, id_tecnico || null, tecnico, cuadrilla || null,
          cliente, telefono || null, distrito || null, fecha_atencion || null, fecha_auditoria,
          auditor || null, preguntasStr, puntaje_porcentaje || 100, calificacion_estrellas || 5,
          comentario_cliente || null, estado_conformidad || 'CONFORME'
        ]
      );
      return res.json({ success: true, id: result.insertId, message: 'Auditoría de calidad guardada' });
    }
  } catch (error) {
    console.error('Error en POST /api/supervision/calidad-cliente:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete(['/calidad-cliente/:id', '/supervision/calidad-cliente/:id'], async (req, res) => {
  try {
    await pool.query('DELETE FROM supervision_calidad_cliente WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Auditoría eliminada con éxito' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get(['/stats', '/supervision/stats'], async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    let filterCampo = '';
    let filterCalidad = '';
    let paramsCampo = [];
    let paramsCalidad = [];

    if (desde && hasta) {
      filterCampo = 'WHERE fecha BETWEEN ? AND ?';
      paramsCampo = [desde, hasta];
      filterCalidad = 'WHERE fecha_auditoria BETWEEN ? AND ?';
      paramsCalidad = [desde, hasta];
    }

    const [campoStats] = await pool.query(`
      SELECT 
        COUNT(*) as total_inspecciones,
        COALESCE(ROUND(AVG(cumplimiento_porcentaje), 1), 0) as promedio_cumplimiento,
        SUM(CASE WHEN semaforo = 'verde' THEN 1 ELSE 0 END) as total_verdes,
        SUM(CASE WHEN semaforo = 'amarillo' THEN 1 ELSE 0 END) as total_amarillos,
        SUM(CASE WHEN semaforo = 'rojo' THEN 1 ELSE 0 END) as total_rojos
      FROM supervision_campo ${filterCampo}
    `, paramsCampo);

    const [clienteStats] = await pool.query(`
      SELECT 
        COUNT(*) as total_auditorias,
        COALESCE(ROUND(AVG(puntaje_porcentaje), 1), 0) as promedio_puntaje,
        COALESCE(ROUND(AVG(calificacion_estrellas), 1), 0) as promedio_estrellas,
        SUM(CASE WHEN estado_conformidad = 'CONFORME' THEN 1 ELSE 0 END) as total_conformes,
        SUM(CASE WHEN estado_conformidad = 'CON_OBSERVACIONES' THEN 1 ELSE 0 END) as total_observaciones,
        SUM(CASE WHEN estado_conformidad = 'NO_CONFORME' THEN 1 ELSE 0 END) as total_no_conformes
      FROM supervision_calidad_cliente ${filterCalidad}
    `, paramsCalidad);

    const [rankingTecnicos] = await pool.query(`
      SELECT 
        c.tecnico,
        c.cuadrilla,
        COUNT(c.id) as total_supervisiones,
        ROUND(AVG(c.cumplimiento_porcentaje), 1) as score_campo,
        COALESCE(ROUND(AVG(a.puntaje_porcentaje), 1), 0) as score_cliente,
        ROUND((AVG(c.cumplimiento_porcentaje) * 0.5 + COALESCE(AVG(a.puntaje_porcentaje), 0) * 0.5), 1) as score_global
      FROM supervision_campo c
      LEFT JOIN supervision_calidad_cliente a ON a.tecnico = c.tecnico
      ${filterCampo}
      GROUP BY c.tecnico, c.cuadrilla
      ORDER BY score_global DESC
      LIMIT 20
    `, paramsCampo);

    res.json({
      success: true,
      campo: campoStats[0] || {},
      cliente: clienteStats[0] || {},
      ranking: rankingTecnicos || []
    });
  } catch (error) {
    console.error('Error en GET /api/supervision/stats:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get(['/avance-diario', '/supervision/avance-diario'], async (req, res) => {
  try {
    const { fecha } = req.query;
    const hoy = new Date();
    const pad = n => String(n).padStart(2, '0');
    const targetFecha = fecha || `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`;

    // Obtener catálogo de supervisores
    const [supervisores] = await pool.query(`
      SELECT 
        u.id_usuario as id_supervisor,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) as supervisor,
        u.usuario,
        u.foto_personal as foto
      FROM usuarios u
      LEFT JOIN roles r ON u.id_rol = r.id_rol
      WHERE (u.id_rol = 6 OR LOWER(COALESCE(r.nombre, '')) LIKE '%supervi%' OR LOWER(COALESCE(u.cargo, '')) LIKE '%supervi%') 
        AND LOWER(COALESCE(r.nombre, '')) NOT LIKE '%admin%'
        AND u.estado = 'Activo'
      ORDER BY supervisor ASC
    `);

    // Obtener supervisiones de campo del día
    const [campoRows] = await pool.query(`
      SELECT * FROM supervision_campo WHERE fecha = ? ORDER BY hora DESC, id DESC
    `, [targetFecha]);

    // Obtener auditorías de clientes del día
    const [clienteRows] = await pool.query(`
      SELECT * FROM supervision_calidad_cliente WHERE fecha_auditoria = ? ORDER BY id DESC
    `, [targetFecha]);

    const META_TECNICOS = 6;
    const META_CLIENTES = 2;

    const avanceSupervisores = supervisores.map(sup => {
      const supName = (sup.supervisor || '').toLowerCase();
      const supUser = (sup.usuario || '').toLowerCase();

      const campoDelSup = campoRows.filter(r => {
        const s = (r.supervisor || '').toLowerCase();
        return s.includes(supName) || (supUser && s.includes(supUser));
      });

      const clienteDelSup = clienteRows.filter(r => {
        const a = (r.auditor || '').toLowerCase();
        return a.includes(supName) || (supUser && a.includes(supUser));
      });

      const totalTec = campoDelSup.length;
      const totalCli = clienteDelSup.length;
      const totalPuntos = Math.min(totalTec, META_TECNICOS) + Math.min(totalCli, META_CLIENTES);
      const pctAvance = Math.round((totalPuntos / (META_TECNICOS + META_CLIENTES)) * 100);

      let coordenadasSupervisor = null;
      let ordenActual = null;
      let distanciaMetros = null;

      const ultimaCampo = campoDelSup[0];
      let estadoActual = 'DISPONIBLE';
      let supervisandoA = '';
      let cuadrillaActual = '';
      let horaInicioActual = '';

      if (ultimaCampo) {
        if (ultimaCampo.estado_operativo === 'EN_CAMINO') {
          estadoActual = 'EN_CAMINO';
          supervisandoA = ultimaCampo.tecnico;
          cuadrillaActual = ultimaCampo.cuadrilla || '';
          horaInicioActual = ultimaCampo.hora_inicio || ultimaCampo.hora || '';
          coordenadasSupervisor = ultimaCampo.coordenadas_en_camino || ultimaCampo.coordenadas_inicio || null;
        } else if (ultimaCampo.estado_operativo === 'INICIADA') {
          estadoActual = 'EN_SUPERVISION';
          supervisandoA = ultimaCampo.tecnico;
          cuadrillaActual = ultimaCampo.cuadrilla || '';
          horaInicioActual = ultimaCampo.hora_inicio || ultimaCampo.hora || '';
          coordenadasSupervisor = ultimaCampo.coordenadas_inicio || ultimaCampo.coordenadas_en_camino || null;
        } else {
          estadoActual = totalTec >= META_TECNICOS && totalCli >= META_CLIENTES ? 'FINALIZADO' : 'DISPONIBLE';
          coordenadasSupervisor = ultimaCampo.coordenadas_fin || ultimaCampo.coordenadas_inicio || null;
        }

        distanciaMetros = ultimaCampo.distancia_metros_inicio || null;
        if (ultimaCampo.numero_ticket || ultimaCampo.id_orden) {
          ordenActual = {
            id_orden: ultimaCampo.id_orden,
            numero_ticket: ultimaCampo.numero_ticket,
            cliente: ultimaCampo.cliente_orden,
            direccion: ultimaCampo.direccion_orden,
            coordenadas: ultimaCampo.coordenadas_orden
          };
        }
      }

      const supervisionesHoy = [
        ...campoDelSup.map(c => ({
          id: c.id,
          tipo: 'CAMPO',
          tecnico: c.tecnico,
          cuadrilla: c.cuadrilla,
          cliente: c.cliente_orden || '',
          ticket: c.numero_ticket || '',
          direccion: c.direccion_orden || c.lugar_inspeccion || '',
          coordenadas_orden: c.coordenadas_orden || null,
          coordenadas_supervisor: c.coordenadas_inicio || c.coordenadas_en_camino || null,
          distancia_metros: c.distancia_metros_inicio || null,
          estado_operativo: c.estado_operativo || 'FINALIZADA',
          hora: c.hora || c.hora_inicio || '',
          hora_inicio: c.hora_inicio || '',
          hora_fin: c.hora_fin || '',
          cumplimiento: c.cumplimiento_porcentaje || 100,
          semaforo: c.semaforo || 'verde'
        })),
        ...clienteDelSup.map(cl => ({
          id: cl.id,
          tipo: 'CLIENTE',
          tecnico: cl.tecnico,
          cuadrilla: cl.cuadrilla,
          cliente: cl.cliente,
          ticket: cl.numero_ticket || '',
          direccion: cl.direccion || '',
          hora: '',
          cumplimiento: cl.puntaje_porcentaje || 100,
          semaforo: cl.estado_conformidad === 'CONFORME' ? 'verde' : cl.estado_conformidad === 'CON_OBSERVACIONES' ? 'amarillo' : 'rojo'
        }))
      ];

      return {
        id_supervisor: sup.id_supervisor,
        supervisor: sup.supervisor,
        usuario: sup.usuario,
        foto: sup.foto,
        total_tecnicos_supervisados: totalTec,
        meta_tecnicos: META_TECNICOS,
        total_clientes_auditados: totalCli,
        meta_clientes: META_CLIENTES,
        porcentaje_avance: pctAvance,
        estado_actual: estadoActual,
        supervisando_a: supervisandoA,
        cuadrilla_actual: cuadrillaActual,
        hora_inicio_actual: horaInicioActual,
        ultima_actividad: ultimaCampo ? (ultimaCampo.hora || ultimaCampo.created_at) : null,
        coordenadas_supervisor: coordenadasSupervisor,
        orden_actual: ordenActual,
        distancia_metros: distanciaMetros,
        supervisiones_hoy: supervisionesHoy
      };
    });

    // Cruce de materiales auditados en terreno vs stock en almacén
    const [stockAlmacen] = await pool.query(`
      SELECT 
        ts.id_trabajador,
        t.id_usuario,
        CONCAT(u.nombres, ' ', COALESCE(u.primer_apellido, u.apellidos, '')) as tecnico,
        u.cuadrilla,
        p.nombre as producto,
        ts.stock as stock_sistema
      FROM trabajador_productos ts
      JOIN trabajadores t ON ts.id_trabajador = t.id_trabajador
      JOIN usuarios u ON t.id_usuario = u.id_usuario
      JOIN productos p ON ts.id_producto = p.id_producto
      WHERE ts.stock > 0
      ORDER BY tecnico ASC, p.nombre ASC
    `);

    // Obtener las últimas fichas de supervisión de campo de cada técnico
    const [todasFichasCampo] = await pool.query(`
      SELECT id, id_tecnico, tecnico, fecha, items_json
      FROM supervision_campo
      ORDER BY fecha DESC, hora DESC, id DESC
    `);

    // Indexar auditoría más reciente por técnico (por id_tecnico o por nombre normalizado)
    const auditoriaPorTecnico = new Map();
    for (const ficha of todasFichasCampo) {
      const keyTec = ficha.id_tecnico || (ficha.tecnico ? ficha.tecnico.trim().toUpperCase() : null);
      if (!keyTec || auditoriaPorTecnico.has(keyTec)) continue;

      let items = [];
      try {
        items = typeof ficha.items_json === 'string' ? JSON.parse(ficha.items_json) : (ficha.items_json || []);
      } catch (err) {
        items = [];
      }

      // Mapear cantidad física auditada por nombre normalizado de producto
      const mapaItems = new Map();
      if (Array.isArray(items)) {
        for (const it of items) {
          if (!it || !it.nombre) continue;
          const normNombre = it.nombre.trim().toUpperCase();
          let cantFisica = null;
          if (it.cantidad !== undefined && it.cantidad !== null && it.cantidad !== '') {
            const parsed = parseFloat(it.cantidad);
            if (!isNaN(parsed)) cantFisica = parsed;
          } else if (Array.isArray(it.series) && it.series.length > 0) {
            cantFisica = it.series.length;
          } else if (it.cumple !== undefined) {
            cantFisica = it.cumple ? 1 : 0;
          }
          mapaItems.set(normNombre, {
            cantidad_auditada: cantFisica,
            estado_item: it.estado || (it.cumple ? 'BUENO' : 'MALO'),
            fecha_auditoria: ficha.fecha
          });
        }
      }

      auditoriaPorTecnico.set(keyTec, {
        fecha_auditoria: ficha.fecha,
        items: mapaItems
      });
    }

    // Enriquecer cruce de stock con cantidad física auditada y diferencia
    const cruceConDiferencias = stockAlmacen.map(row => {
      const stockSis = Number(row.stock_sistema) || 0;
      const keyId = row.id_usuario;
      const keyNombre = (row.tecnico || '').trim().toUpperCase();
      const auditTec = auditoriaPorTecnico.get(keyId) || auditoriaPorTecnico.get(keyNombre);

      let cantAuditada = null;
      let fechaAuditoria = null;

      if (auditTec && auditTec.items) {
        fechaAuditoria = auditTec.fecha_auditoria;
        const normProd = (row.producto || '').trim().toUpperCase();

        // Buscar coincidencia exacta o por subcadena
        if (auditTec.items.has(normProd)) {
          cantAuditada = auditTec.items.get(normProd).cantidad_auditada;
        } else {
          for (const [itNombre, itData] of auditTec.items.entries()) {
            if (normProd.includes(itNombre) || itNombre.includes(normProd)) {
              cantAuditada = itData.cantidad_auditada;
              break;
            }
          }
        }
      }

      const tieneAuditoria = cantAuditada !== null;
      const diferencia = tieneAuditoria ? (cantAuditada - stockSis) : null;

      let estadoAuditoria = 'PENDIENTE'; // Sin auditar aún
      if (tieneAuditoria) {
        if (diferencia === 0) estadoAuditoria = 'CONFORME'; // Coincide exactamente
        else if (diferencia > 0) estadoAuditoria = 'SOBRANTE'; // Técnico tiene más de lo registrado
        else estadoAuditoria = 'FALTANTE'; // Técnico tiene menos de lo registrado
      }

      return {
        ...row,
        cantidad_auditada: cantAuditada,
        diferencia: diferencia,
        estado_auditoria: estadoAuditoria,
        fecha_auditoria: fechaAuditoria
      };
    });

    res.json({
      success: true,
      fecha: targetFecha,
      kpis_globales: {
        total_supervisores_activos: avanceSupervisores.length,
        total_tecnicos_supervisados_hoy: campoRows.length,
        total_clientes_auditados_hoy: clienteRows.length,
        meta_global_tecnicos: avanceSupervisores.length * META_TECNICOS,
        meta_global_clientes: avanceSupervisores.length * META_CLIENTES,
        porcentaje_cumplimiento_global: avanceSupervisores.length > 0
          ? Math.round(
              avanceSupervisores.reduce((acc, s) => acc + s.porcentaje_avance, 0) / avanceSupervisores.length
            )
          : 0
      },
      supervisores: avanceSupervisores,
      cruce_stock: cruceConDiferencias
    });
  } catch (error) {
    console.error('Error en GET /api/supervision/avance-diario:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;