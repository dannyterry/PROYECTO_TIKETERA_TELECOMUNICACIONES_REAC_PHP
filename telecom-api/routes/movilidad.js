'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { uploadInspeccion } = require('../middleware/upload');
const { requireAuth, signToken } = require('../middleware/requireAuth');
const { uploadFileToS3, uploadBufferToS3, getS3ObjectStream, checkS3ObjectExists, getS3SignedUrl } = require('../services/s3Service');
const path = require('path');
const fs = require('fs');

const { sincronizarTareasOrdenSeguro, getTareasDeBD, sincronizarTareasOrdenesActivas, guardarDetalleTareaEnBD, getMetrajeDeclaradoFenix } = require('../services/taskSyncService');
const { getMotivosCatalogo, resolverTipoTrabajoConCatalogo, resolverTipoTrabajoOficial, normalizeText } = require('../services/tipoTrabajoHelper');

// ─── RUTAS MÓDULO: MOVILIDAD ───────────────────────────────────────

router.get('/vehiculos', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        v.id_vehiculo,
        v.id_marca,
        v.id_modelo,
        v.id_tipo_vehiculo,
        v.id_combustible,
        v.placa,
        v.anio,
        v.transmision,
        v.color,
        v.estado,
        v.ultimo_nivel_combustible,
        v.observaciones,
        v.fecha_ven_soat,
        v.fecha_ven_revision,
        m.nombre AS marca,
        mo.nombre AS modelo,
        tv.nombre AS tipo_vehiculo,
        c.nombre AS combustible,
        COALESCE(t_act.id_trabajador, t.id_trabajador) AS id_trabajador,
        COALESCE(u_act.id_usuario, u.id_usuario) AS id_usuario,
        COALESCE(
          NULLIF(TRIM(CONCAT(COALESCE(u_act.nombres, u.nombres, ''), ' ', COALESCE(u_act.primer_apellido, u_act.apellidos, u.primer_apellido, u.apellidos, ''), ' ', COALESCE(u_act.segundo_apellido, u.segundo_apellido, ''))), ''),
          'Sin asignar'
        ) AS tecnico_asignado,
        COALESCE(u_act.cuadrilla, u.cuadrilla, '') AS cuadrilla,
        (SELECT MAX(km_fin) FROM vehiculo_inspecciones WHERE id_vehiculo = v.id_vehiculo) AS ultimo_km,
        COALESCE(
          va.fecha_inicio,
          (SELECT va2.fecha_inicio FROM vehiculo_asignaciones va2 WHERE va2.id_vehiculo = v.id_vehiculo ORDER BY va2.id_asignacion DESC LIMIT 1)
        ) AS fecha_asignacion,
        COALESCE(
          va.motivo_cambio,
          (SELECT va2.motivo_cambio FROM vehiculo_asignaciones va2 WHERE va2.id_vehiculo = v.id_vehiculo ORDER BY va2.id_asignacion DESC LIMIT 1)
        ) AS motivo_asignacion
      FROM vehiculos v
      LEFT JOIN marcas m ON v.id_marca = m.id_marca
      LEFT JOIN modelos mo ON v.id_modelo = mo.id_modelo
      LEFT JOIN tipos_vehiculo tv ON v.id_tipo_vehiculo = tv.id_tipo_vehiculo
      LEFT JOIN combustibles c ON v.id_combustible = c.id_combustible
      LEFT JOIN vehiculo_asignaciones va ON va.id_vehiculo = v.id_vehiculo AND va.estado = 'Activa'
      LEFT JOIN trabajadores t_act ON va.id_trabajador = t_act.id_trabajador
      LEFT JOIN usuarios u_act ON t_act.id_usuario = u_act.id_usuario
      LEFT JOIN trabajadores t ON v.id_vehiculo = t.id_vehiculo
        AND (t.estado = 'Activo' OR t.estado IS NULL)
        AND EXISTS (
          SELECT 1
          FROM usuarios tu
          LEFT JOIN roles tr ON tu.id_rol = tr.id_rol
          WHERE tu.id_usuario = t.id_usuario
            AND (tu.id_rol IN (2, 6) OR UPPER(COALESCE(tr.nombre, '')) LIKE '%TECNIC%' OR UPPER(COALESCE(tr.nombre, '')) LIKE '%SUPERVI%')
        )
      LEFT JOIN usuarios u ON t.id_usuario = u.id_usuario
      ORDER BY v.placa ASC
    `);

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/catalogos', async (req, res) => {
  try {
    const [marcas] = await pool.query("SELECT id_marca, nombre, estado FROM marcas ORDER BY nombre ASC");
    const [modelos] = await pool.query("SELECT id_modelo, nombre, estado FROM modelos ORDER BY nombre ASC");
    const [tipos_vehiculo] = await pool.query("SELECT id_tipo_vehiculo, nombre, estado FROM tipos_vehiculo ORDER BY nombre ASC");
    const [combustibles] = await pool.query("SELECT id_combustible, nombre, estado FROM combustibles ORDER BY nombre ASC");
    res.json({ marcas, modelos, tipos_vehiculo, combustibles });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/marcas', async (req, res) => {
  try {
    const { nombre, estado = 'Activo' } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre de la marca es requerido' });
    const [result] = await pool.query('INSERT INTO marcas (nombre, estado) VALUES (?, ?)', [nombre.trim(), estado]);
    res.json({ success: true, id_marca: result.insertId, message: 'Marca creada con éxito' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/marcas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, estado } = req.body;
    await pool.query('UPDATE marcas SET nombre = COALESCE(?, nombre), estado = COALESCE(?, estado) WHERE id_marca = ?', [nombre?.trim(), estado, id]);
    res.json({ success: true, message: 'Marca actualizada con éxito' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/marcas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("UPDATE marcas SET estado = 'Inactivo' WHERE id_marca = ?", [id]);
    res.json({ success: true, message: 'Marca desactivada con éxito' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/modelos', async (req, res) => {
  try {
    const { nombre, estado = 'Activo' } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre del modelo es requerido' });
    const [result] = await pool.query('INSERT INTO modelos (nombre, estado) VALUES (?, ?)', [nombre.trim(), estado]);
    res.json({ success: true, id_modelo: result.insertId, message: 'Modelo creado con éxito' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/modelos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, estado } = req.body;
    await pool.query('UPDATE modelos SET nombre = COALESCE(?, nombre), estado = COALESCE(?, estado) WHERE id_modelo = ?', [nombre?.trim(), estado, id]);
    res.json({ success: true, message: 'Modelo actualizado con éxito' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/modelos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("UPDATE modelos SET estado = 'Inactivo' WHERE id_modelo = ?", [id]);
    res.json({ success: true, message: 'Modelo desactivado con éxito' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/tipos-vehiculo', async (req, res) => {
  try {
    const { nombre, estado = 'Activo' } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre del tipo es requerido' });
    const [result] = await pool.query('INSERT INTO tipos_vehiculo (nombre, estado) VALUES (?, ?)', [nombre.trim(), estado]);
    res.json({ success: true, id_tipo_vehiculo: result.insertId, message: 'Tipo de vehículo creado con éxito' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/tipos-vehiculo/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, estado } = req.body;
    await pool.query('UPDATE tipos_vehiculo SET nombre = COALESCE(?, nombre), estado = COALESCE(?, estado) WHERE id_tipo_vehiculo = ?', [nombre?.trim(), estado, id]);
    res.json({ success: true, message: 'Tipo de vehículo actualizado con éxito' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/tipos-vehiculo/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("UPDATE tipos_vehiculo SET estado = 'Inactivo' WHERE id_tipo_vehiculo = ?", [id]);
    res.json({ success: true, message: 'Tipo de vehículo desactivado con éxito' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/vehiculos', async (req, res) => {
  try {
    const {
      placa,
      id_marca,
      id_modelo,
      id_tipo_vehiculo,
      id_combustible,
      anio,
      transmision = 'Manual',
      color,
      estado = 'Disponible',
      observaciones,
      fecha_ven_soat,
      fecha_ven_revision
    } = req.body;

    if (!placa) return res.status(400).json({ error: 'La placa es obligatoria' });

    const [exist] = await pool.query('SELECT id_vehiculo FROM vehiculos WHERE placa = ?', [placa.trim().toUpperCase()]);
    if (exist.length > 0) {
      return res.status(400).json({ error: `La placa ${placa} ya se encuentra registrada.` });
    }

    const [result] = await pool.query(`
      INSERT INTO vehiculos (
        placa, id_marca, id_modelo, id_tipo_vehiculo, id_combustible,
        anio, transmision, color, estado, observaciones,
        fecha_ven_soat, fecha_ven_revision
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      placa.trim().toUpperCase(),
      id_marca || null,
      id_modelo || null,
      id_tipo_vehiculo || null,
      id_combustible || null,
      anio || null,
      transmision,
      color?.trim() || null,
      estado,
      observaciones?.trim() || null,
      fecha_ven_soat || null,
      fecha_ven_revision || null
    ]);

    res.json({ success: true, id_vehiculo: result.insertId, message: 'Vehículo registrado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/vehiculos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      placa,
      id_marca,
      id_modelo,
      id_tipo_vehiculo,
      id_combustible,
      anio,
      transmision,
      color,
      estado,
      observaciones,
      fecha_ven_soat,
      fecha_ven_revision
    } = req.body;

    if (placa) {
      const [exist] = await pool.query('SELECT id_vehiculo FROM vehiculos WHERE placa = ? AND id_vehiculo != ?', [placa.trim().toUpperCase(), id]);
      if (exist.length > 0) {
        return res.status(400).json({ error: `La placa ${placa} ya pertenece a otro vehículo.` });
      }
    }

    await pool.query(`
      UPDATE vehiculos SET
        placa = COALESCE(?, placa),
        id_marca = COALESCE(?, id_marca),
        id_modelo = COALESCE(?, id_modelo),
        id_tipo_vehiculo = COALESCE(?, id_tipo_vehiculo),
        id_combustible = COALESCE(?, id_combustible),
        anio = COALESCE(?, anio),
        transmision = COALESCE(?, transmision),
        color = COALESCE(?, color),
        estado = COALESCE(?, estado),
        observaciones = COALESCE(?, observaciones),
        fecha_ven_soat = COALESCE(?, fecha_ven_soat),
        fecha_ven_revision = COALESCE(?, fecha_ven_revision)
      WHERE id_vehiculo = ?
    `, [
      placa?.trim()?.toUpperCase() || null,
      id_marca || null,
      id_modelo || null,
      id_tipo_vehiculo || null,
      id_combustible || null,
      anio || null,
      transmision || null,
      color?.trim() || null,
      estado || null,
      observaciones !== undefined ? observaciones : null,
      fecha_ven_soat || null,
      fecha_ven_revision || null,
      id
    ]);

    res.json({ success: true, message: 'Vehículo actualizado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get(['/tecnicos', '/tecnicos-flota'], async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        t.id_trabajador,
        u.id_usuario,
        u.documento,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''), ' ', COALESCE(u.segundo_apellido, ''))) AS nombre_completo,
        COALESCE(u.cuadrilla, '') AS cuadrilla,
        COALESCE(u.tipo_servicio, '') AS tipo_servicio,
        COALESCE(u.telefono, '') AS telefono,
        COALESCE(t.id_vehiculo, va.id_vehiculo) AS id_vehiculo,
        COALESCE(v.placa, va.placa, '') AS vehiculo_placa,
        COALESCE(v.marca, va.marca, '') AS vehiculo_marca,
        COALESCE(v.modelo, va.modelo, '') AS vehiculo_modelo,
        (
          SELECT COUNT(*) FROM trabajador_descansos td
          WHERE td.id_trabajador = t.id_trabajador
            AND CURDATE() BETWEEN td.fecha_inicio AND td.fecha_fin
            AND td.estado != 'Cancelado'
        ) AS descanso_hoy
      FROM usuarios u
      LEFT JOIN trabajadores t ON u.id_usuario = t.id_usuario
      LEFT JOIN roles r ON u.id_rol = r.id_rol
      LEFT JOIN (
        SELECT v1.id_vehiculo, v1.placa, m.nombre AS marca, mo.nombre AS modelo
        FROM vehiculos v1
        LEFT JOIN marcas m ON v1.id_marca = m.id_marca
        LEFT JOIN modelos mo ON v1.id_modelo = mo.id_modelo
      ) v ON t.id_vehiculo = v.id_vehiculo
      LEFT JOIN (
        SELECT va1.id_trabajador, va1.id_vehiculo, v2.placa, m2.nombre AS marca, mo2.nombre AS modelo
        FROM vehiculo_asignaciones va1
        JOIN vehiculos v2 ON va1.id_vehiculo = v2.id_vehiculo
        LEFT JOIN marcas m2 ON v2.id_marca = m2.id_marca
        LEFT JOIN modelos mo2 ON v2.id_modelo = mo2.id_modelo
        WHERE va1.estado = 'Activa'
      ) va ON t.id_trabajador = va.id_trabajador
      WHERE (u.id_rol IN (2, 6) OR UPPER(COALESCE(r.nombre, '')) LIKE '%TECNIC%' OR UPPER(COALESCE(r.nombre, '')) LIKE '%SUPERVI%')
        AND (u.estado = 'Activo' OR u.estado IS NULL)
        AND u.estado NOT IN ('Inactivo', 'Cesado')
      GROUP BY u.id_usuario
      ORDER BY nombre_completo ASC
    `);

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/reasignar-vehiculo', async (req, res) => {
  try {
    const { id_vehiculo, id_trabajador, motivo_cambio } = req.body;
    if (!id_vehiculo) {
      return res.status(400).json({ error: "id_vehiculo es requerido" });
    }

    if (id_trabajador) {
      const [rolRows] = await pool.query(`
        SELECT u.id_rol, r.nombre AS rol_nombre
        FROM trabajadores t
        JOIN usuarios u ON t.id_usuario = u.id_usuario
        LEFT JOIN roles r ON u.id_rol = r.id_rol
        WHERE t.id_trabajador = ?
      `, [id_trabajador]);
      const rol = rolRows[0];
      const esValido = rol && (
        [2, 6].includes(Number(rol.id_rol)) || 
        String(rol.rol_nombre || '').toUpperCase().includes('TECNIC') ||
        String(rol.rol_nombre || '').toUpperCase().includes('SUPERVI')
      );
      if (!esValido) {
        return res.status(400).json({ error: "Solo se pueden asignar vehículos a usuarios con rol Técnico o Supervisor." });
      }
    }

    // 1. Cerrar cualquier asignación activa previa para este vehículo
    await pool.query(`
      UPDATE vehiculo_asignaciones 
      SET fecha_fin = NOW(), estado = 'Finalizada' 
      WHERE id_vehiculo = ? AND estado = 'Activa'
    `, [id_vehiculo]);

    // 2. Quitar vehículo de cualquier trabajador anterior
    await pool.query("UPDATE trabajadores SET id_vehiculo = NULL WHERE id_vehiculo = ?", [id_vehiculo]);

    // 3. Si se asigna a un nuevo trabajador
    if (id_trabajador) {
      // Si el trabajador ya tenía otro vehículo asignado, liberarlo
      await pool.query(`
        UPDATE vehiculos SET estado = 'Disponible' 
        WHERE id_vehiculo IN (SELECT id_vehiculo FROM trabajadores WHERE id_trabajador = ? AND id_vehiculo IS NOT NULL)
      `, [id_trabajador]);

      await pool.query(`
        UPDATE vehiculo_asignaciones 
        SET fecha_fin = NOW(), estado = 'Finalizada' 
        WHERE id_trabajador = ? AND estado = 'Activa'
      `, [id_trabajador]);

      await pool.query("UPDATE trabajadores SET id_vehiculo = ? WHERE id_trabajador = ?", [id_vehiculo, id_trabajador]);
      await pool.query("UPDATE vehiculos SET estado = 'En uso' WHERE id_vehiculo = ?", [id_vehiculo]);

      // Guardar en historial
      await pool.query(`
        INSERT INTO vehiculo_asignaciones (id_vehiculo, id_trabajador, fecha_inicio, motivo_cambio, estado)
        VALUES (?, ?, NOW(), ?, 'Activa')
      `, [id_vehiculo, id_trabajador, motivo_cambio || 'Reasignación operativa']);
    } else {
      await pool.query("UPDATE vehiculos SET estado = 'Disponible' WHERE id_vehiculo = ?", [id_vehiculo]);
    }

    res.json({ success: true, message: "Vehículo reasignado con éxito" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/vehiculos/:id/asignaciones', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(`
      SELECT 
        va.id_asignacion,
        va.id_vehiculo,
        va.id_trabajador,
        va.fecha_inicio,
        va.fecha_fin,
        va.motivo_cambio,
        va.estado,
        u.id_usuario,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''), ' ', COALESCE(u.segundo_apellido, ''))) AS nombre_tecnico,
        u.cuadrilla
      FROM vehiculo_asignaciones va
      LEFT JOIN trabajadores t ON va.id_trabajador = t.id_trabajador
      LEFT JOIN usuarios u ON t.id_usuario = u.id_usuario
      WHERE va.id_vehiculo = ?
      ORDER BY va.id_asignacion DESC
    `, [id]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/inspeccion/inicio', uploadInspeccion, async (req, res) => {
  try {
    const { id_vehiculo, id_trabajador, fecha, km_inicio, hora_inicio, observaciones_tecnico, lat_inicio, lng_inicio, nivel_combustible, nivel_combustible_inicio } = req.body;
    const nivelCombInicio = nivel_combustible_inicio || nivel_combustible || 'Medio';

    if (!id_vehiculo || !id_trabajador) {
      return res.status(400).json({ error: "id_vehiculo y id_trabajador son requeridos" });
    }

    const fechaInspeccion = (fecha && fecha.length === 10) ? fecha : getPeruDateStr();
    const horaInicio = hora_inicio || getPeruTimeStr();
    const nivelComb = nivel_combustible || 'Medio';

    const foto_tablero_inicio = req.files && req.files['foto_tablero_inicio'] ? req.files['foto_tablero_inicio'][0].filename : null;
    const foto_aceite = req.files && req.files['foto_aceite'] ? req.files['foto_aceite'][0].filename : null;
    const foto_agua = req.files && req.files['foto_agua'] ? req.files['foto_agua'][0].filename : null;
    const foto_estado_general = req.files && req.files['foto_estado_general'] ? req.files['foto_estado_general'][0].filename : null;

    // Verificar si ya existe inspección hoy para este vehículo o trabajador
    const [existente] = await pool.query(
      "SELECT id_inspeccion FROM vehiculo_inspecciones WHERE id_vehiculo = ? AND fecha = ?",
      [id_vehiculo, fechaInspeccion]
    );

    if (existente.length > 0) {
      // Actualizar registro del día sin sobreescribir fotos de fin
      await pool.query(`
        UPDATE vehiculo_inspecciones SET
          id_trabajador = ?,
          km_inicio = COALESCE(?, km_inicio),
          hora_inicio = COALESCE(?, hora_inicio),
          lat_inicio = COALESCE(?, lat_inicio),
          lng_inicio = COALESCE(?, lng_inicio),
          foto_tablero_inicio = COALESCE(?, foto_tablero_inicio),
          foto_aceite = COALESCE(?, foto_aceite),
          foto_agua = COALESCE(?, foto_agua),
          foto_estado_general = COALESCE(?, foto_estado_general),
          nivel_combustible = COALESCE(?, nivel_combustible),
          nivel_combustible_inicio = COALESCE(?, nivel_combustible_inicio),
          observaciones_tecnico = COALESCE(?, observaciones_tecnico)
        WHERE id_inspeccion = ?
      `, [id_trabajador, km_inicio, horaInicio, lat_inicio || null, lng_inicio || null, foto_tablero_inicio, foto_aceite, foto_agua, foto_estado_general, nivelComb, nivelCombInicio, observaciones_tecnico, existente[0].id_inspeccion]);

      await pool.query("UPDATE vehiculos SET ultimo_nivel_combustible = ? WHERE id_vehiculo = ?", [nivelComb, id_vehiculo]).catch(() => {});

      if (lat_inicio && lng_inicio) {
        await registrarLogGps(id_trabajador, id_vehiculo, Number(lat_inicio), Number(lng_inicio), 'CHECKLIST_INICIO', 'INSP-INICIO', 'Checklist de Inicio de Jornada');
      }

      return res.json({ success: true, message: "Inspección de inicio actualizada con éxito", id_inspeccion: existente[0].id_inspeccion });
    }

    const [insertResult] = await pool.query(`
      INSERT INTO vehiculo_inspecciones (
        id_vehiculo, id_trabajador, fecha, km_inicio, hora_inicio,
        lat_inicio, lng_inicio,
        foto_tablero_inicio, foto_aceite, foto_agua, foto_estado_general,
        nivel_combustible, nivel_combustible_inicio, observaciones_tecnico, estado_auditoria
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendiente')
    `, [id_vehiculo, id_trabajador, fechaInspeccion, km_inicio, horaInicio, lat_inicio || null, lng_inicio || null, foto_tablero_inicio, foto_aceite, foto_agua, foto_estado_general, nivelComb, nivelCombInicio, observaciones_tecnico]);

    await pool.query("UPDATE vehiculos SET ultimo_nivel_combustible = ? WHERE id_vehiculo = ?", [nivelComb, id_vehiculo]).catch(() => {});

    if (lat_inicio && lng_inicio) {
      await registrarLogGps(id_trabajador, id_vehiculo, Number(lat_inicio), Number(lng_inicio), 'CHECKLIST_INICIO', 'INSP-INICIO', 'Checklist de Inicio de Jornada');
    }

    res.json({ success: true, message: "Inspección de inicio registrada correctamente", id_inspeccion: insertResult.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/inspeccion/fin', uploadInspeccion, async (req, res) => {
  try {
    const { id_inspeccion, id_vehiculo, id_trabajador, fecha, km_fin, hora_fin, observaciones_tecnico, lat_fin, lng_fin, nivel_combustible, nivel_combustible_fin } = req.body;
    const foto_combustible_fin = req.files && req.files['foto_combustible_fin'] ? req.files['foto_combustible_fin'][0].filename : null;
    const nivelCombFin = nivel_combustible_fin || nivel_combustible || null;

    const horaFin = hora_fin || getPeruTimeStr();
    const fechaHoy = (fecha && fecha.length === 10) ? fecha : getPeruDateStr();
    const foto_tablero_fin = req.files && req.files['foto_tablero_fin'] ? req.files['foto_tablero_fin'][0].filename : null;
    const nivelComb = nivel_combustible || null;

    let targetId = id_inspeccion;
    if (!targetId) {
      // Priorizar la inspección ABIERTA (km_fin IS NULL) más reciente de ese vehículo o trabajador
      const [found] = await pool.query(
        `SELECT id_inspeccion, km_inicio, fecha 
         FROM vehiculo_inspecciones 
         WHERE (id_vehiculo = ? OR id_trabajador = ?) 
           AND (km_fin IS NULL OR fecha = ?)
         ORDER BY (km_fin IS NULL) DESC, fecha DESC, id_inspeccion DESC 
         LIMIT 1`,
        [id_vehiculo, id_trabajador, fechaHoy]
      );
      if (found.length > 0) {
        targetId = found[0].id_inspeccion;
      }
    }

    if (!targetId) {
      return res.status(404).json({ error: "No se encontró el registro de inicio de jornada para hoy. Realiza primero el check-in." });
    }

    if (lat_fin && lng_fin && id_trabajador) {
      await registrarLogGps(id_trabajador, id_vehiculo, Number(lat_fin), Number(lng_fin), 'CHECKLIST_FIN', 'INSP-FIN', 'Checklist de Cierre de Jornada');
    }

    // Obtener km_inicio y coordenadas de apertura
    const [inspRows] = await pool.query("SELECT * FROM vehiculo_inspecciones WHERE id_inspeccion = ?", [targetId]);
    const insp = inspRows[0];
    const kmInicio = Number(insp.km_inicio) || 0;
    const kmFinNum = Number(km_fin) || 0;
    const kmRecorridos = kmFinNum > kmInicio ? kmFinNum - kmInicio : 0;

    const startLat = insp.lat_inicio ? parseFloat(insp.lat_inicio) : BASE_LAT;
    const startLng = insp.lng_inicio ? parseFloat(insp.lng_inicio) : BASE_LNG;
    const endLat = lat_fin ? parseFloat(lat_fin) : (insp.lat_inicio ? parseFloat(insp.lat_inicio) : BASE_LAT);
    const endLng = lng_fin ? parseFloat(lng_fin) : (insp.lng_inicio ? parseFloat(insp.lng_inicio) : BASE_LNG);

    // Calcular las órdenes atendidas por este técnico en esa fecha para cruce de KM
    let kmEstimadosOrdenes = 0;
    try {
      const [tecRows] = await pool.query(`
        SELECT u.cuadrilla, TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''), ' ', COALESCE(u.segundo_apellido, ''))) AS nombre
        FROM trabajadores t
        JOIN usuarios u ON t.id_usuario = u.id_usuario
        WHERE t.id_trabajador = ?
      `, [insp.id_trabajador]);

      if (tecRows.length > 0) {
        const cuadrilla = tecRows[0].cuadrilla;
        const nombreTec = tecRows[0].nombre;

        const [ordenesDia] = await pool.query(`
          SELECT id_orden, georeferencia, direccion, localidad, estado, hora_asignacion, inicio_visita
          FROM ordenes
          WHERE DATE(fecha_visita) = ? 
            AND LOWER(TRIM(estado)) = 'finalizada'
            AND (cuadrilla LIKE ? OR tecnico_asignado LIKE ? OR id_tecnico = ?)
          ORDER BY hora_asignacion ASC, inicio_visita ASC
        `, [insp.fecha, `%${cuadrilla}%`, `%${nombreTec}%`, insp.id_trabajador]);

        const puntosValidos = [];
        ordenesDia.forEach(o => {
          if (o.georeferencia && o.georeferencia.includes(',')) {
            const parts = o.georeferencia.split(',');
            const lat = parseFloat(parts[0].trim());
            const lon = parseFloat(parts[1].trim());
            if (!isNaN(lat) && !isNaN(lon) && lat !== 0) {
              puntosValidos.push({ lat, lon });
            }
          }
        });

        if (puntosValidos.length > 0) {
          // Distancia del Punto de Inicio real al 1er cliente
          kmEstimadosOrdenes += calcularDistanciaHaversine(startLat, startLng, puntosValidos[0].lat, puntosValidos[0].lon);
          // Distancia entre clientes consecutivos
          for (let i = 0; i < puntosValidos.length - 1; i++) {
            kmEstimadosOrdenes += calcularDistanciaHaversine(puntosValidos[i].lat, puntosValidos[i].lon, puntosValidos[i+1].lat, puntosValidos[i+1].lon);
          }
          // Distancia de regreso al Punto de Fin real
          kmEstimadosOrdenes += calcularDistanciaHaversine(puntosValidos[puntosValidos.length - 1].lat, puntosValidos[puntosValidos.length - 1].lon, endLat, endLng);
          // Factor de ruta urbana (curvas de calles)
          kmEstimadosOrdenes = Math.round(kmEstimadosOrdenes * 1.35 * 10) / 10;
        } else if (ordenesDia.length > 0) {
          // Estimación estándar si no hay GPS exacto en las órdenes
          kmEstimadosOrdenes = Math.round((12 + (ordenesDia.length * 4.5)) * 10) / 10;
        }
      }
    } catch (errKm) {
      console.error("Error al estimar km de órdenes:", errKm);
    }

    const diferenciaKm = Math.round((kmRecorridos - kmEstimadosOrdenes) * 10) / 10;

    await pool.query(`
      UPDATE vehiculo_inspecciones SET
        km_fin = ?,
        hora_fin = ?,
        fecha_cierre_real = NOW(),
        lat_fin = ?,
        lng_fin = ?,
        foto_tablero_fin = COALESCE(?, foto_tablero_fin),
        foto_combustible_fin = COALESCE(?, foto_combustible_fin),
        nivel_combustible_fin = COALESCE(?, nivel_combustible_fin),
        km_recorridos = ?,
        km_estimados_ordenes = ?,
        diferencia_km = ?,
        observaciones_tecnico = CONCAT(COALESCE(observaciones_tecnico, ''), ' | Fin: ', COALESCE(?, ''))
      WHERE id_inspeccion = ?
    `, [kmFinNum, horaFin, lat_fin || null, lng_fin || null, foto_tablero_fin, foto_combustible_fin, nivelCombFin, kmRecorridos, kmEstimadosOrdenes, diferenciaKm, observaciones_tecnico, targetId]);

    if (nivelComb && (id_vehiculo || insp.id_vehiculo)) {
      await pool.query("UPDATE vehiculos SET ultimo_nivel_combustible = ? WHERE id_vehiculo = ?", [nivelComb, id_vehiculo || insp.id_vehiculo]).catch(() => {});
    }

    res.json({
      success: true,
      message: "Cierre de jornada registrado correctamente",
      km_recorridos: kmRecorridos,
      km_estimados_ordenes: kmEstimadosOrdenes,
      diferencia_km: diferenciaKm
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/inspecciones', async (req, res) => {
  try {
    const { fecha_desde, fecha_hasta, id_vehiculo, id_trabajador, estado } = req.query;

    let query = `
      SELECT 
        i.*,
        v.placa,
        v.color,
        m.nombre AS marca,
        mo.nombre AS modelo,
        u.id_usuario,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''), ' ', COALESCE(u.segundo_apellido, ''))) AS nombre_tecnico,
        u.cuadrilla,
        u.telefono,
        (
          SELECT TIME(MAX(COALESCE(ol.fecha_liquidacion, o.fin_visita, o.fecha_estado)))
          FROM ordenes o
          LEFT JOIN orden_liquidaciones ol ON o.id_orden = ol.id_orden
          WHERE DATE(o.fecha_visita) = i.fecha
            AND (o.id_tecnico = t.id_trabajador OR (u.cuadrilla IS NOT NULL AND u.cuadrilla != '' AND o.cuadrilla = u.cuadrilla) OR o.tecnico_asignado LIKE CONCAT('%', u.nombres, '%'))
            AND (LOWER(TRIM(o.estado)) = 'finalizada' OR LOWER(TRIM(o.estado)) = 'liquidada')
        ) AS hora_fin_ultima_orden,
        (
          SELECT COUNT(o.id_orden)
          FROM ordenes o
          WHERE DATE(o.fecha_visita) = i.fecha
            AND (o.id_tecnico = t.id_trabajador OR (u.cuadrilla IS NOT NULL AND u.cuadrilla != '' AND o.cuadrilla = u.cuadrilla) OR o.tecnico_asignado LIKE CONCAT('%', u.nombres, '%'))
            AND (LOWER(TRIM(o.estado)) = 'finalizada' OR LOWER(TRIM(o.estado)) = 'liquidada')
        ) AS total_ordenes_completadas
      FROM vehiculo_inspecciones i
      JOIN vehiculos v ON i.id_vehiculo = v.id_vehiculo
      JOIN trabajadores t ON i.id_trabajador = t.id_trabajador
      JOIN usuarios u ON t.id_usuario = u.id_usuario
      LEFT JOIN marcas m ON v.id_marca = m.id_marca
      LEFT JOIN modelos mo ON v.id_modelo = mo.id_modelo
      WHERE 1=1
    `;

    const params = [];

    if (fecha_desde) {
      query += ` AND i.fecha >= ?`;
      params.push(fecha_desde);
    }
    if (fecha_hasta) {
      query += ` AND i.fecha <= ?`;
      params.push(fecha_hasta);
    }
    if (id_vehiculo) {
      query += ` AND i.id_vehiculo = ?`;
      params.push(id_vehiculo);
    }
    if (id_trabajador) {
      query += ` AND i.id_trabajador = ?`;
      params.push(id_trabajador);
    }
    if (estado) {
      query += ` AND i.estado_auditoria = ?`;
      params.push(estado);
    }

    query += ` ORDER BY i.fecha DESC, i.id_inspeccion DESC LIMIT 200`;

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/inspecciones/:id/auditar', async (req, res) => {
  try {
    const { id } = req.params;
    const { estado_auditoria, observaciones_admin } = req.body;

    await pool.query(`
      UPDATE vehiculo_inspecciones SET
        estado_auditoria = ?,
        observaciones_admin = ?,
        fecha_auditoria = NOW()
      WHERE id_inspeccion = ?
    `, [estado_auditoria || 'Aprobado', observaciones_admin || null, id]);

    res.json({ success: true, message: "Inspección auditada exitosamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/combustible', uploadInspeccion, async (req, res) => {
  try {
    const {
      id_vehiculo, id_trabajador, fecha_carga, tipo_combustible,
      monto_total, galones_m3, km_momento_carga, grifo_estacion,
      numero_comprobante, tipo_comprobante, registrado_por, observaciones
    } = req.body;

    if (!id_vehiculo || !monto_total || !galones_m3 || !km_momento_carga) {
      return res.status(400).json({ error: "Faltan campos obligatorios (vehículo, monto, galones, kilometraje)" });
    }

    const foto_comprobante = req.files && req.files['foto_comprobante'] ? req.files['foto_comprobante'][0].filename : null;

    // Calcular rendimiento con la carga anterior del mismo tipo de combustible
    let rendimiento = null;
    const tipoNorm = String(tipo_combustible || '').toUpperCase();
    const isGas = tipoNorm.includes('GLP') || tipoNorm.includes('GNV');

    // Buscar carga anterior del mismo tipo de combustible (Gas con Gas, Gasolina/Diesel con Gasolina/Diesel)
    const [anteriorMismoTipo] = await pool.query(
      `SELECT km_momento_carga, tipo_combustible FROM vehiculo_combustibles 
       WHERE id_vehiculo = ? 
         AND ${isGas ? "(UPPER(tipo_combustible) LIKE '%GLP%' OR UPPER(tipo_combustible) LIKE '%GNV%')" : "(UPPER(tipo_combustible) NOT LIKE '%GLP%' AND UPPER(tipo_combustible) NOT LIKE '%GNV%')"}
         AND km_momento_carga < ? 
       ORDER BY km_momento_carga DESC, id_combustible_registro DESC LIMIT 1`,
      [id_vehiculo, km_momento_carga]
    );

    // Verificar si el vehículo tiene historial de Gas (vehículo Dual)
    const [historialGas] = await pool.query(
      "SELECT id_combustible_registro FROM vehiculo_combustibles WHERE id_vehiculo = ? AND (UPPER(tipo_combustible) LIKE '%GLP%' OR UPPER(tipo_combustible) LIKE '%GNV%') LIMIT 1",
      [id_vehiculo]
    );
    const esVehiculoDual = isGas || historialGas.length > 0;
    const galones = Number(galones_m3);

    if (anteriorMismoTipo.length > 0) {
      const kmDelta = Number(km_momento_carga) - Number(anteriorMismoTipo[0].km_momento_carga);
      if (galones > 0 && kmDelta > 0) {
        const rawRend = kmDelta / galones;
        // Si es vehículo dual y la carga es de gasolina pequeña (reserva/arranque) o el ratio sale disparado (> 85 km/gl)
        if (esVehiculoDual && !isGas && (galones <= 2.5 || rawRend > 85)) {
          rendimiento = null; // Se clasifica automáticamente como carga de reserva
        } else {
          rendimiento = Math.round(rawRend * 100) / 100;
        }
      }
    }

    const [result] = await pool.query(`
      INSERT INTO vehiculo_combustibles (
        id_vehiculo, id_trabajador, fecha_carga, tipo_combustible,
        monto_total, galones_m3, km_momento_carga, grifo_estacion,
        numero_comprobante, tipo_comprobante, foto_comprobante,
        rendimiento_km_galon, registrado_por, observaciones
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id_vehiculo, id_trabajador || null, fecha_carga || new Date(), tipo_combustible || 'Gasolina',
      monto_total, galones_m3, km_momento_carga, grifo_estacion || 'Estación Central',
      numero_comprobante || null, tipo_comprobante || 'Factura', foto_comprobante,
      rendimiento, registrado_por || 'Admin', observaciones || null
    ]);

    res.json({ success: true, message: "Carga de combustible registrada exitosamente", id_carga: result.insertId, rendimiento });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/combustible', async (req, res) => {
  try {
    const { fecha_desde, fecha_hasta, id_vehiculo } = req.query;

    let query = `
      SELECT 
        c.*,
        v.placa,
        m.nombre AS marca,
        mo.nombre AS modelo,
        u.id_usuario,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''), ' ', COALESCE(u.segundo_apellido, ''))) AS nombre_tecnico
      FROM vehiculo_combustibles c
      JOIN vehiculos v ON c.id_vehiculo = v.id_vehiculo
      LEFT JOIN trabajadores t ON c.id_trabajador = t.id_trabajador
      LEFT JOIN usuarios u ON t.id_usuario = u.id_usuario
      LEFT JOIN marcas m ON v.id_marca = m.id_marca
      LEFT JOIN modelos mo ON v.id_modelo = mo.id_modelo
      WHERE 1=1
    `;

    const params = [];
    if (fecha_desde) {
      query += ` AND c.fecha_carga >= ?`;
      params.push(fecha_desde);
    }
    if (fecha_hasta) {
      query += ` AND c.fecha_carga <= ?`;
      params.push(fecha_hasta);
    }
    if (id_vehiculo) {
      query += ` AND c.id_vehiculo = ?`;
      params.push(id_vehiculo);
    }

    query += ` ORDER BY c.fecha_carga DESC, c.id_combustible_registro DESC LIMIT 200`;

    const [rows] = await pool.query(query, params);

    // Resumen estadístico
    const totalGasto = rows.reduce((acc, r) => acc + (parseFloat(r.monto_total) || 0), 0);
    const totalGalones = rows.reduce((acc, r) => acc + (parseFloat(r.galones_m3) || 0), 0);

    res.json({
      registros: rows,
      resumen: {
        totalGasto: Math.round(totalGasto * 100) / 100,
        totalGalones: Math.round(totalGalones * 100) / 100,
        precioPromedioGalon: totalGalones > 0 ? Math.round((totalGasto / totalGalones) * 100) / 100 : 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/combustible/grifos', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT DISTINCT TRIM(grifo_estacion) AS grifo 
      FROM vehiculo_combustibles 
      WHERE grifo_estacion IS NOT NULL AND TRIM(grifo_estacion) != ''
      ORDER BY grifo_estacion ASC
    `);
    const grifos = rows.map(r => r.grifo).filter(Boolean);
    res.json(grifos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/combustible/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM vehiculo_combustibles WHERE id_combustible_registro = ?", [id]);
    res.json({ success: true, message: "Registro de combustible eliminado" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/combustible/:id', uploadInspeccion, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      id_vehiculo, id_trabajador, fecha_carga, tipo_combustible,
      monto_total, galones_m3, km_momento_carga, grifo_estacion,
      numero_comprobante, tipo_comprobante, observaciones
    } = req.body;

    const foto_comprobante = req.files && req.files['foto_comprobante'] ? req.files['foto_comprobante'][0].filename : null;

    let query = `
      UPDATE vehiculo_combustibles SET
        id_vehiculo = COALESCE(?, id_vehiculo),
        id_trabajador = ?,
        fecha_carga = COALESCE(?, fecha_carga),
        tipo_combustible = COALESCE(?, tipo_combustible),
        monto_total = COALESCE(?, monto_total),
        galones_m3 = COALESCE(?, galones_m3),
        km_momento_carga = COALESCE(?, km_momento_carga),
        grifo_estacion = COALESCE(?, grifo_estacion),
        numero_comprobante = ?,
        tipo_comprobante = COALESCE(?, tipo_comprobante),
        observaciones = ?
    `;
    const params = [
      id_vehiculo, id_trabajador || null, fecha_carga, tipo_combustible,
      monto_total, galones_m3, km_momento_carga, grifo_estacion,
      numero_comprobante || null, tipo_comprobante, observaciones || null
    ];

    if (foto_comprobante) {
      query += `, foto_comprobante = ?`;
      params.push(foto_comprobante);
    }

    query += ` WHERE id_combustible_registro = ?`;
    params.push(id);

    await pool.query(query, params);
    res.json({ success: true, message: "Registro de combustible actualizado correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/dashboard-km', async (req, res) => {
  try {
    const { fecha_desde, fecha_hasta } = req.query;
    const hoyStr = getPeruDateStr();
    const fDesde = fecha_desde || new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const fHasta = fecha_hasta || hoyStr;
    const ahoraMinutos = new Date().getHours() * 60 + new Date().getMinutes();

    // Verificación de Caché en memoria (15 segundos)
    const currentKey = `${fDesde}|${fHasta}`;
    if (
      cacheDashboardKm.data &&
      cacheDashboardKm.queryKey === currentKey &&
      Date.now() - cacheDashboardKm.timestamp < 15000
    ) {
      return res.json(cacheDashboardKm.data);
    }

    // ⚡ 1. EJECUTAR SOLO 4 CONSULTAS BATCH EN PARALELO (CERO N+1 QUERIES)
    const [
      [inspecciones],
      [allWorkers],
      [ordenesRango],
      [gpsLogs]
    ] = await Promise.all([
      // A. Inspecciones explícitas de checklist
      pool.query(`
        SELECT 
          i.*,
          v.placa,
          m.nombre AS marca,
          mo.nombre AS modelo,
          u.id_usuario,
          TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''), ' ', COALESCE(u.segundo_apellido, ''))) AS nombre_tecnico,
          u.cuadrilla
        FROM vehiculo_inspecciones i
        JOIN vehiculos v ON i.id_vehiculo = v.id_vehiculo
        JOIN trabajadores t ON i.id_trabajador = t.id_trabajador
        JOIN usuarios u ON t.id_usuario = u.id_usuario
        LEFT JOIN marcas m ON v.id_marca = m.id_marca
        LEFT JOIN modelos mo ON v.id_modelo = mo.id_modelo
        WHERE i.fecha BETWEEN ? AND ?
        ORDER BY i.fecha DESC, i.km_recorridos DESC
      `, [fDesde, fHasta]),

      // B. Trabajadores activos
      pool.query(`
        SELECT 
          t.id_trabajador,
          t.id_vehiculo,
          u.id_usuario,
          TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''), ' ', COALESCE(u.segundo_apellido, ''))) AS nombre_tecnico,
          u.cuadrilla,
          v.placa,
          m.nombre AS marca,
          mo.nombre AS modelo
        FROM trabajadores t
        JOIN usuarios u ON t.id_usuario = u.id_usuario
        LEFT JOIN vehiculos v ON t.id_vehiculo = v.id_vehiculo
        LEFT JOIN marcas m ON v.id_marca = m.id_marca
        LEFT JOIN modelos mo ON v.id_modelo = mo.id_modelo
        WHERE t.estado = 'activo'
      `),

      // C. Órdenes finalizadas en el rango (con georreferencia)
      pool.query(`
        SELECT 
          id_orden,
          numero AS numero_orden,
          cliente,
          direccion,
          georeferencia,
          estado,
          DATE(COALESCE(fecha_solicitud, fecha_visita, fecha_creacion)) as fecha_orden,
          cuadrilla,
          tecnico_asignado
        FROM ordenes
        WHERE ((DATE(fecha_solicitud) BETWEEN ? AND ?)
           OR (DATE(fecha_visita) BETWEEN ? AND ?)
           OR (DATE(fecha_creacion) BETWEEN ? AND ?))
          AND LOWER(TRIM(estado)) = 'finalizada'
        ORDER BY id_orden ASC
      `, [fDesde, fHasta, fDesde, fHasta, fDesde, fHasta]),

      // D. ÚNICA consulta BATCH de GPS logs para todo el rango
      pool.query(`
        SELECT 
          id_trabajador,
          DATE(fecha_hora) as fecha,
          lat,
          lng,
          fecha_hora,
          tipo_evento
        FROM tecnico_gps_logs
        WHERE fecha_hora >= ? AND fecha_hora <= ?
        ORDER BY fecha_hora ASC
      `, [fDesde + ' 00:00:00', fHasta + ' 23:59:59'])
    ]);

    // ⚡ 2. INDEXACIÓN ULTRA-RÁPIDA EN MEMORIA RAM CON MAPS
    const ordenesPorFecha = new Map();
    for (const ord of ordenesRango) {
      const f = ord.fecha_orden ? String(ord.fecha_orden).slice(0, 10) : '';
      if (!f) continue;
      if (!ordenesPorFecha.has(f)) ordenesPorFecha.set(f, []);
      ordenesPorFecha.get(f).push(ord);
    }

    const gpsLogsMap = new Map();
    for (const log of gpsLogs) {
      const f = String(log.fecha).slice(0, 10);
      const key = `${log.id_trabajador}|${f}`;
      if (!gpsLogsMap.has(key)) gpsLogsMap.set(key, []);
      gpsLogsMap.get(key).push(log);
    }

    // ⚡ 3. CÁLCULO DE RUTA EN MEMORIA (Toma microsegundos)
    const calcularRutaEnMemoria = (f, wName, wCuad) => {
      const ordenesDia = ordenesPorFecha.get(f) || [];
      if (ordenesDia.length === 0) return { puntosRuta: [], kmEstimado: 0 };

      const targetCuad = (wCuad || '').toLowerCase().trim();
      const targetName = (wName || '').toLowerCase().trim();

      const misOrdenes = ordenesDia.filter(ord => {
        const c = (ord.cuadrilla || '').toLowerCase();
        const t = (ord.tecnico_asignado || '').toLowerCase();
        if (targetCuad && c.includes(targetCuad)) return true;
        if (targetName && (t.includes(targetName) || c.includes(targetName))) return true;
        return false;
      });

      const puntosRuta = [];
      let kmAcum = 0;
      for (const ord of misOrdenes) {
        const match = (ord.georeferencia || ord.direccion || '').match(/(-?\d{1,2}\.\d{4,8})\s*,\s*(-?\d{1,3}\.\d{4,8})/);
        if (match) {
          const lat = Number(match[1]);
          const lng = Number(match[2]);
          if (puntosRuta.length > 0) {
            const prev = puntosRuta[puntosRuta.length - 1];
            const tramo = Math.round(calcularDistanciaHaversine(prev.lat, prev.lng, lat, lng) * 1.35 * 10) / 10;
            kmAcum += tramo;
          }
          puntosRuta.push({ lat, lng, orden_id: ord.id_orden, cliente: ord.cliente });
        }
      }

      return {
        puntosRuta,
        kmEstimado: Math.round(kmAcum * 10) / 10
      };
    };

    // ⚡ 4. UNIFICAR REGISTROS
    const keyInspSet = new Set();
    const listaCompleta = [];

    // Enriquecer inspecciones que ya tenían checklist subido
    for (const insp of inspecciones) {
      const f = String(insp.fecha).slice(0, 10);
      const key = `${f}|${insp.id_trabajador}`;
      keyInspSet.add(key);

      const { puntosRuta, kmEstimado } = calcularRutaEnMemoria(f, insp.nombre_tecnico, insp.cuadrilla);
      listaCompleta.push({
        ...insp,
        km_estimados_ordenes: kmEstimado,
        puntos_ruta_count: puntosRuta.length,
      });
    }

    // Fechas con actividad real para no generar basura de días vacíos
    const fechasSet = new Set();
    if (hoyStr >= fDesde && hoyStr <= fHasta) fechasSet.add(hoyStr);
    for (const f of ordenesPorFecha.keys()) fechasSet.add(f);

    const fechasAevaluar = Array.from(fechasSet).sort().reverse();

    for (const f of fechasAevaluar) {
      const esHoy = (f === hoyStr);
      for (const w of allWorkers) {
        const key = `${f}|${w.id_trabajador}`;
        if (!keyInspSet.has(key)) {
          const { puntosRuta, kmEstimado } = calcularRutaEnMemoria(f, w.nombre_tecnico, w.cuadrilla);

          // Si es hoy: incluir si tiene vehículo o tuvo órdenes
          // Si es día pasado: SOLO incluir si tuvo órdenes reales (evita generar 1,000 filas vacías en memoria)
          const debeIncluir = esHoy ? (w.placa || puntosRuta.length > 0) : (puntosRuta.length > 0);

          if (debeIncluir) {
            listaCompleta.push({
              id_inspeccion: `temp-${w.id_trabajador}-${f}`,
              id_vehiculo: w.id_vehiculo || 0,
              id_trabajador: w.id_trabajador,
              fecha: f,
              km_inicio: null,
              hora_inicio: null,
              foto_tablero_inicio: null,
              foto_aceite: null,
              foto_agua: null,
              foto_estado_general: null,
              km_fin: null,
              hora_fin: null,
              foto_tablero_fin: null,
              km_recorridos: 0,
              km_estimados_ordenes: kmEstimado,
              diferencia_km: 0,
              observaciones_tecnico: puntosRuta.length > 0 ? `${puntosRuta.length} clientes finalizados en ruta.` : 'Vehículo asignado en flota.',
              estado_auditoria: puntosRuta.length > 0 ? 'En Ruta' : 'Pendiente',
              observaciones_admin: 'Sin checklist enviado aún',
              placa: w.placa || 'S/P',
              marca: w.marca || '',
              modelo: w.modelo || '',
              id_usuario: w.id_usuario,
              nombre_tecnico: w.nombre_tecnico,
              cuadrilla: w.cuadrilla || '',
              puntos_ruta_count: puntosRuta.length,
            });
            keyInspSet.add(key);
          }
        }
      }
    }

    // ⚡ 5. ENRIQUECER CON GPS DIRECTO EN MEMORIA (0 CONSULTAS A MYSQL)
    const inspeccionesEnriquecidas = listaCompleta.map((insp) => {
      const f = String(insp.fecha).slice(0, 10);
      const key = `${insp.id_trabajador}|${f}`;
      const gpsLogsTecnico = gpsLogsMap.get(key) || [];

      let kmGpsReal = 0;
      for (let i = 0; i < gpsLogsTecnico.length - 1; i++) {
        kmGpsReal += calcularDistanciaHaversine(
          Number(gpsLogsTecnico[i].lat),
          Number(gpsLogsTecnico[i].lng),
          Number(gpsLogsTecnico[i + 1].lat),
          Number(gpsLogsTecnico[i + 1].lng)
        );
      }
      kmGpsReal = Math.round(kmGpsReal * 1.35 * 10) / 10;

      const horaInicioReal = insp.hora_inicio || (gpsLogsTecnico.length > 0 ? gpsLogsTecnico[0].fecha_hora?.slice(11, 16) : "-");
      const horaCierreReal = insp.hora_fin || (gpsLogsTecnico.length > 1 ? gpsLogsTecnico[gpsLogsTecnico.length - 1].fecha_hora?.slice(11, 16) : "-");
      const esHoy = (f === hoyStr);
      const alertaInicioTardio = esHoy && ahoraMinutos > 450 && (!insp.hora_inicio || !insp.foto_tablero_inicio);

      return {
        ...insp,
        km_gps_app: kmGpsReal > 0 ? kmGpsReal : 0,
        puntos_gps_count: gpsLogsTecnico.length,
        hora_inicio_real: horaInicioReal,
        hora_cierre_real: horaCierreReal,
        alerta_inicio_tardio: alertaInicioTardio,
      };
    });

    // Ordenar: fecha descendente, luego mayor km estimado
    inspeccionesEnriquecidas.sort((a, b) => {
      const fCmp = String(b.fecha).localeCompare(String(a.fecha));
      if (fCmp !== 0) return fCmp;
      return (Number(b.km_estimados_ordenes) || 0) - (Number(a.km_estimados_ordenes) || 0);
    });

    // Resumen de métricas
    const totalKmDeclarados = inspeccionesEnriquecidas.reduce((acc, i) => acc + (Number(i.km_recorridos) || 0), 0);
    const totalKmEstimados = inspeccionesEnriquecidas.reduce((acc, i) => acc + (parseFloat(i.km_estimados_ordenes) || 0), 0);
    const totalKmGpsApp = inspeccionesEnriquecidas.reduce((acc, i) => acc + (parseFloat(i.km_gps_app) || 0), 0);
    const totalInspecciones = inspeccionesEnriquecidas.length;
    const aprobadas = inspeccionesEnriquecidas.filter(i => i.estado_auditoria === 'Aprobado').length;
    const pendientes = inspeccionesEnriquecidas.filter(i => i.estado_auditoria === 'Pendiente').length;
    const observadas = inspeccionesEnriquecidas.filter(i => i.estado_auditoria === 'Observado').length;
    const alertasDesvio = inspeccionesEnriquecidas.filter(i => (Number(i.km_recorridos) - Number(i.km_gps_app || i.km_estimados_ordenes)) > 35 && Number(i.km_recorridos) > 0);

    const respuestaFinal = {
      inspecciones: inspeccionesEnriquecidas,
      resumen: {
        totalKmDeclarados: Math.round(totalKmDeclarados),
        totalKmEstimados: Math.round(totalKmEstimados),
        totalKmGpsApp: Math.round(totalKmGpsApp),
        diferenciaTotal: Math.round(totalKmDeclarados - (totalKmGpsApp || totalKmEstimados)),
        totalInspecciones,
        aprobadas,
        pendientes,
        observadas,
        alertasDesvioCount: alertasDesvio.length
      },
      alertasDesvio
    };

    // Guardar en caché 15 segundos
    cacheDashboardKm = {
      data: respuestaFinal,
      timestamp: Date.now(),
      queryKey: currentKey
    };

    res.json(respuestaFinal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/gps-log', async (req, res) => {
  try {
    const { id_trabajador, id_vehiculo, lat, lng, tipo_evento, referencia_id, descripcion } = req.body;
    if (!lat || !lng || !id_trabajador) {
      return res.status(400).json({ error: "Faltan coordenadas o ID de trabajador" });
    }
    await registrarLogGps(id_trabajador, id_vehiculo, lat, lng, tipo_evento || 'APP_PING', referencia_id, descripcion);
    res.json({ success: true, message: "Punto GPS guardado exitosamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/recorrido-tecnico/:idTrabajador', async (req, res) => {
  try {
    const idTrabajador = req.params.idTrabajador;
    const fecha = req.query.fecha || new Date().toISOString().slice(0, 10);

    // 1. Datos del técnico y vehículo
    const [tecRows] = await pool.query(`
      SELECT 
        t.id_trabajador,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''), ' ', COALESCE(u.segundo_apellido, ''))) AS nombre_tecnico,
        u.cuadrilla,
        u.telefono
      FROM trabajadores t
      JOIN usuarios u ON t.id_usuario = u.id_usuario
      WHERE t.id_trabajador = ?
    `, [idTrabajador]);

    const infoTecnico = tecRows[0] || {};

    // 2. Inspección del día
    const [inspRows] = await pool.query(`
      SELECT 
        i.*,
        v.placa,
        m.nombre as marca,
        mo.nombre as modelo
      FROM vehiculo_inspecciones i
      JOIN vehiculos v ON i.id_vehiculo = v.id_vehiculo
      LEFT JOIN marcas m ON v.id_marca = m.id_marca
      LEFT JOIN modelos mo ON v.id_modelo = mo.id_modelo
      WHERE i.id_trabajador = ? AND i.fecha = ?
      LIMIT 1
    `, [idTrabajador, fecha]);

    const inspeccion = inspRows[0] || null;

    // 3. Puntos GPS registrados en tecnico_gps_logs
    const [logs] = await pool.query(`
      SELECT 
        id_gps_log,
        lat,
        lng,
        tipo_evento,
        referencia_id,
        descripcion,
        DATE_FORMAT(fecha_hora, '%H:%i:%s') as hora,
        fecha_hora
      FROM tecnico_gps_logs
      WHERE id_trabajador = ? AND DATE(fecha_hora) = ?
      ORDER BY fecha_hora ASC
    `, [idTrabajador, fecha]);

    // Calcular distancia total entre puntos consecutivos del día
    let kmRecorridosGps = 0;
    const paradasConDistancia = logs.map((p, idx) => {
      let tramoKm = 0;
      if (idx > 0) {
        const prev = logs[idx - 1];
        tramoKm = calcularDistanciaHaversine(Number(prev.lat), Number(prev.lng), Number(p.lat), Number(p.lng));
        tramoKm = Math.round(tramoKm * 1.35 * 10) / 10;
        kmRecorridosGps += tramoKm;
      }
      return {
        ...p,
        tramo_km: tramoKm,
        acumulado_km: Math.round(kmRecorridosGps * 10) / 10,
      };
    });

    // 4. Órdenes del día con georreferencia para trazar la ruta secuencial de clientes
    const targetName = (infoTecnico.nombre_tecnico || '').toLowerCase();
    const targetCuadrilla = (infoTecnico.cuadrilla || '').toLowerCase();

    const [ordenesDia] = await pool.query(`
      SELECT 
        id_orden,
        numero AS numero_orden,
        cliente,
        direccion,
        region_zona,
        georeferencia,
        estado,
        fecha_solicitud,
        fecha_visita,
        cuadrilla,
        tecnico_asignado
      FROM ordenes
      WHERE (DATE(fecha_solicitud) = ? OR DATE(fecha_visita) = ? OR DATE(fecha_creacion) = ?)
        AND LOWER(TRIM(estado)) = 'finalizada'
      ORDER BY id_orden ASC
    `, [fecha, fecha, fecha]);

    // Filtrar órdenes correspondientes a este técnico / cuadrilla
    const misOrdenes = ordenesDia.filter(ord => {
      const c = (ord.cuadrilla || '').toLowerCase();
      const t = (ord.tecnico_asignado || '').toLowerCase();
      if (targetCuadrilla && c.includes(targetCuadrilla)) return true;
      if (targetName && (t.includes(targetName) || c.includes(targetName))) return true;
      return false;
    });

    const paradasOrdenes = [];
    let kmOrdenesAcum = 0;
    misOrdenes.forEach((ord, i) => {
      const match = (ord.georeferencia || ord.direccion || '').match(/(-?\d{1,2}\.\d{4,8})\s*,\s*(-?\d{1,3}\.\d{4,8})/);
      if (match) {
        const lat = Number(match[1]);
        const lng = Number(match[2]);
        let tramo = 0;
        if (paradasOrdenes.length > 0) {
          const prev = paradasOrdenes[paradasOrdenes.length - 1];
          tramo = calcularDistanciaHaversine(prev.lat, prev.lng, lat, lng);
          tramo = Math.round(tramo * 1.35 * 10) / 10;
          kmOrdenesAcum += tramo;
        }
        paradasOrdenes.push({
          id_gps_log: `ord-${ord.id_orden}`,
          lat,
          lng,
          tipo_evento: 'ACTA_CLIENTE',
          referencia_id: String(ord.numero_orden || ord.id_orden),
          descripcion: `Cliente #${i + 1}: ${ord.cliente} (${ord.direccion ? ord.direccion.split('||')[0].slice(0, 50) : 'Dirección'})`,
          hora: ord.fecha_visita ? String(ord.fecha_visita).slice(11, 16) : `Cliente #${i + 1}`,
          tramo_km: tramo,
          acumulado_km: Math.round(kmOrdenesAcum * 10) / 10,
          cliente: ord.cliente,
          ticket: ord.numero_orden,
          direccion: ord.direccion,
          estado: ord.estado,
          orden_visita: i + 1,
        });
      }
    });

    kmRecorridosGps = Math.round(kmRecorridosGps * 10) / 10;
    const kmEstimadoOrdenes = Math.round(kmOrdenesAcum * 10) / 10;

    // Si no hay logs de GPS del móvil todavía, mostrar la ruta de órdenes trazada
    const paradasFinal = paradasConDistancia.length > 0 ? paradasConDistancia : paradasOrdenes;

    res.json({
      fecha,
      id_trabajador: idTrabajador,
      tecnico: infoTecnico,
      inspeccion,
      total_paradas: paradasFinal.length,
      km_recorridos_gps: kmRecorridosGps > 0 ? kmRecorridosGps : kmEstimadoOrdenes,
      km_estimados_ordenes: kmEstimadoOrdenes,
      paradas: paradasFinal,
      paradas_gps: paradasConDistancia,
      paradas_ordenes: paradasOrdenes,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;