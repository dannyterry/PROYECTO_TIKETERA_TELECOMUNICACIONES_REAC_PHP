'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth, signToken } = require('../middleware/requireAuth');
const { uploadFileToS3, uploadBufferToS3, getS3ObjectStream, checkS3ObjectExists, getS3SignedUrl } = require('../services/s3Service');
const path = require('path');
const fs = require('fs');


// ─── RUTAS MÓDULO: INVENTARIO ───────────────────────────────────────

router.get('/transferencias/buscar-tecnico-dni', async (req, res) => {
  try {
    const dni = String(req.query.dni || '').trim();
    if (!dni || dni.length < 6) {
      return res.status(400).json({ success: false, message: 'DNI inválido o incompleto' });
    }

    const [rows] = await pool.query(`
      SELECT 
        t.id_trabajador,
        u.id_usuario,
        COALESCE(u.documento, '') AS dni,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS nombre_completo,
        COALESCE(u.cuadrilla, '') AS cuadrilla,
        COALESCE(v.placa, 'Sin vehículo') AS vehiculo_placa,
        COALESCE(u.telefono, '') AS telefono,
        r.nombre AS rol_nombre,
        u.id_rol
      FROM trabajadores t
      JOIN usuarios u ON t.id_usuario = u.id_usuario
      LEFT JOIN roles r ON u.id_rol = r.id_rol
      LEFT JOIN vehiculos v ON t.id_vehiculo = v.id_vehiculo
      WHERE TRIM(u.documento) = ?
        AND (u.estado = 'Activo' OR u.estado IS NULL)
        AND (
          u.id_rol = 2 
          OR UPPER(COALESCE(r.nombre, '')) LIKE '%TECNIC%'
          OR UPPER(COALESCE(r.nombre, '')) LIKE '%SUPERVIS%'
          OR UPPER(COALESCE(r.nombre, '')) LIKE '%CALIDAD%'
        )
      LIMIT 1
    `, [dni]);

    if (rows.length === 0) {
      // Verificar si el usuario existe pero tiene otro rol (ej: Administración, Almacén, Gestión)
      const [usuarioOtroRol] = await pool.query(`
        SELECT u.id_usuario, TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS nombre_completo,
               r.nombre AS rol_nombre
        FROM usuarios u
        LEFT JOIN roles r ON u.id_rol = r.id_rol
        WHERE TRIM(u.documento) = ?
          AND (u.estado = 'Activo' OR u.estado IS NULL)
        LIMIT 1
      `, [dni]);

      if (usuarioOtroRol.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Solo se permite personal con rol técnico o supervisor'
        });
      }

      return res.status(404).json({ success: false, message: 'No se encontró ningún técnico o supervisor activo con ese DNI' });
    }

    res.json({ success: true, tecnico: rows[0] });
  } catch (error) {
    console.error('Error en buscar-tecnico-dni:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/transferencias/solicitar', async (req, res) => {
  let connection;
  try {
    const {
      id_trabajador_origen,
      id_trabajador_destino,
      motivo,
      materiales, // [{ id_producto, nombre_producto, cantidad, unidad_medida }]
      series      // [{ id_producto, id_producto_serie, numero_serie, nombre_producto }]
    } = req.body;

    if (!id_trabajador_origen || !id_trabajador_destino) {
      return res.status(400).json({ success: false, message: 'Se requiere técnico origen y destino' });
    }

    if (Number(id_trabajador_origen) === Number(id_trabajador_destino)) {
      return res.status(400).json({ success: false, message: 'No puedes transferirte materiales a ti mismo' });
    }

    const itemsMateriales = Array.isArray(materiales) ? materiales.filter(m => Number(m.cantidad) > 0) : [];
    const itemsSeries = Array.isArray(series) ? series.filter(s => String(s.numero_serie || '').trim() !== '') : [];

    if (itemsMateriales.length === 0 && itemsSeries.length === 0) {
      return res.status(400).json({ success: false, message: 'Debes seleccionar al menos un material o equipo con serie' });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Obtener datos de ambos técnicos
    const [infoTecnicos] = await connection.query(`
      SELECT 
        t.id_trabajador,
        COALESCE(u.documento, '') AS dni,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS nombre,
        COALESCE(u.cuadrilla, '') AS cuadrilla
      FROM trabajadores t
      JOIN usuarios u ON t.id_usuario = u.id_usuario
      WHERE t.id_trabajador IN (?, ?)
    `, [id_trabajador_origen, id_trabajador_destino]);

    const tecOrigen = infoTecnicos.find(t => Number(t.id_trabajador) === Number(id_trabajador_origen));
    const tecDestino = infoTecnicos.find(t => Number(t.id_trabajador) === Number(id_trabajador_destino));

    if (!tecOrigen || !tecDestino) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Técnico de origen o destino no válido' });
    }

    // Validar disponibilidad de materiales en stock del técnico origen
    for (const mat of itemsMateriales) {
      const [tp] = await connection.query(
        'SELECT stock FROM trabajador_productos WHERE id_trabajador = ? AND id_producto = ?',
        [id_trabajador_origen, mat.id_producto]
      );
      const stockActual = tp.length > 0 ? Number(tp[0].stock) : 0;
      if (stockActual < Number(mat.cantidad)) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `Stock insuficiente para ${mat.nombre_producto || 'el producto'}. Tienes ${stockActual} pero intentas transferir ${mat.cantidad}`
        });
      }
    }

    // Validar que las series realmente pertenezcan al técnico origen
    for (const ser of itemsSeries) {
      const serieStr = String(ser.numero_serie).trim().toUpperCase();
      let prodSerieId = ser.id_producto_serie ? Number(ser.id_producto_serie) : null;

      if (!prodSerieId && serieStr) {
        // Buscar id_producto_serie por numero_serie en producto_series
        const [psRows] = await connection.query(
          "SELECT id_producto_serie, id_producto FROM producto_series WHERE UPPER(TRIM(numero_serie)) = ? LIMIT 1",
          [serieStr]
        );
        if (psRows.length > 0) {
          prodSerieId = psRows[0].id_producto_serie;
          if (!ser.id_producto) ser.id_producto = psRows[0].id_producto;
        }
      }

      ser.id_producto_serie = prodSerieId;

      const [ts] = await connection.query(`
        SELECT ts.id_trabajador_serie, ts.estado, ts.id_producto_serie
        FROM trabajador_series ts
        LEFT JOIN producto_series ps ON ts.id_producto_serie = ps.id_producto_serie
        WHERE ts.id_trabajador = ? 
          AND (ts.id_producto_serie = ? OR (ps.numero_serie IS NOT NULL AND UPPER(TRIM(ps.numero_serie)) = ?))
          AND ts.estado = 'Asignada'
      `, [id_trabajador_origen, prodSerieId || 0, serieStr]);

      if (ts.length === 0) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `La serie ${serieStr} no está asignada actualmente a tu usuario o ya fue liquidada.`
        });
      }
    }

    // Generar código único de transferencia
    const now = new Date();
    const dateCode = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const codigoTransferencia = `TRF-${dateCode}-${randomSuffix}`;

    // Insertar cabecera de transferencia
    const [resHeader] = await connection.query(`
      INSERT INTO transferencias_tecnicos (
        codigo_transferencia,
        id_trabajador_origen,
        id_trabajador_destino,
        dni_origen,
        nombre_origen,
        cuadrilla_origen,
        dni_destino,
        nombre_destino,
        cuadrilla_destino,
        estado,
        motivo_transferencia,
        total_items,
        total_series,
        fecha_solicitud
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDIENTE', ?, ?, ?, NOW())
    `, [
      codigoTransferencia,
      id_trabajador_origen,
      id_trabajador_destino,
      tecOrigen.dni,
      tecOrigen.nombre,
      tecOrigen.cuadrilla,
      tecDestino.dni,
      tecDestino.nombre,
      tecDestino.cuadrilla,
      motivo || 'Transferencia de soporte operativo entre técnicos de campo',
      itemsMateriales.reduce((acc, m) => acc + Number(m.cantidad || 0), 0),
      itemsSeries.length
    ]);

    const idTransferencia = resHeader.insertId;

    // Insertar detalles de materiales
    for (const mat of itemsMateriales) {
      await connection.query(`
        INSERT INTO transferencia_tecnico_detalles (
          id_transferencia,
          id_producto,
          nombre_producto,
          cantidad,
          unidad_medida,
          es_serie,
          numero_serie,
          id_producto_serie
        ) VALUES (?, ?, ?, ?, ?, 0, NULL, NULL)
      `, [
        idTransferencia,
        mat.id_producto,
        mat.nombre_producto || 'Material',
        mat.cantidad,
        mat.unidad_medida || 'und'
      ]);
    }

    // Insertar detalles de series
    for (const ser of itemsSeries) {
      await connection.query(`
        INSERT INTO transferencia_tecnico_detalles (
          id_transferencia,
          id_producto,
          nombre_producto,
          cantidad,
          unidad_medida,
          es_serie,
          numero_serie,
          id_producto_serie
        ) VALUES (?, ?, ?, 1, 'und', 1, ?, ?)
      `, [
        idTransferencia,
        ser.id_producto || 1,
        ser.nombre_producto || 'Equipo Serializado',
        String(ser.numero_serie).trim().toUpperCase(),
        ser.id_producto_serie || null
      ]);
    }

    await connection.commit();

    res.json({
      success: true,
      message: `Solicitud de transferencia ${codigoTransferencia} creada correctamente. En espera de confirmación de ${tecDestino.nombre}.`,
      codigo: codigoTransferencia,
      id_transferencia: idTransferencia
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error en solicitar transferencia:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

router.get('/transferencias/pendientes', async (req, res) => {
  try {
    const id_trabajador = Number(req.query.id_trabajador);
    if (!id_trabajador) {
      return res.status(400).json({ success: false, message: 'id_trabajador requerido' });
    }

    // Transferencias entrantes donde este técnico es el receptor
    const [entrantes] = await pool.query(`
      SELECT 
        t.*,
        TIMESTAMPDIFF(MINUTE, t.fecha_solicitud, NOW()) AS minutos_transcurridos
      FROM transferencias_tecnicos t
      WHERE t.id_trabajador_destino = ? AND t.estado = 'PENDIENTE'
      ORDER BY t.fecha_solicitud DESC
    `, [id_trabajador]);

    // Transferencias salientes que este técnico envió
    const [salientes] = await pool.query(`
      SELECT 
        t.*,
        TIMESTAMPDIFF(MINUTE, t.fecha_solicitud, NOW()) AS minutos_transcurridos
      FROM transferencias_tecnicos t
      WHERE t.id_trabajador_origen = ? AND t.estado = 'PENDIENTE'
      ORDER BY t.fecha_solicitud DESC
    `, [id_trabajador]);

    // Cargar detalles para cada transferencia entrante
    for (const trf of entrantes) {
      const [detalles] = await pool.query(
        'SELECT * FROM transferencia_tecnico_detalles WHERE id_transferencia = ?',
        [trf.id_transferencia]
      );
      trf.detalles = detalles;
    }

    for (const trf of salientes) {
      const [detalles] = await pool.query(
        'SELECT * FROM transferencia_tecnico_detalles WHERE id_transferencia = ?',
        [trf.id_transferencia]
      );
      trf.detalles = detalles;
    }

    // Transferencias salientes que este técnico envió y que fueron respondidas en las últimas 24 horas
    const [respondidas_recientes] = await pool.query(`
      SELECT 
        t.*,
        TIMESTAMPDIFF(MINUTE, t.fecha_respuesta, NOW()) AS minutos_desde_respuesta
      FROM transferencias_tecnicos t
      WHERE t.id_trabajador_origen = ? 
        AND t.estado IN ('ACEPTADA', 'RECHAZADA')
        AND t.fecha_respuesta >= NOW() - INTERVAL 24 HOUR
      ORDER BY t.fecha_respuesta DESC
      LIMIT 10
    `, [id_trabajador]);

    for (const trf of respondidas_recientes) {
      const [detalles] = await pool.query(
        'SELECT * FROM transferencia_tecnico_detalles WHERE id_transferencia = ?',
        [trf.id_transferencia]
      );
      trf.detalles = detalles;
    }

    res.json({
      success: true,
      entrantes,
      salientes,
      respondidas_recientes,
      total_pendientes: entrantes.length
    });
  } catch (error) {
    console.error('Error en obtener transferencias pendientes:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/transferencias/:id/responder', async (req, res) => {
  let connection;
  try {
    const idTransferencia = Number(req.params.id);
    const { id_trabajador_destino, accion, motivo_rechazo } = req.body;

    if (!['ACEPTAR', 'RECHAZAR'].includes(accion)) {
      return res.status(400).json({ success: false, message: 'Acción inválida. Use ACEPTAR o RECHAZAR' });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Bloquear y validar registro
    const [transferRows] = await connection.query(
      'SELECT * FROM transferencias_tecnicos WHERE id_transferencia = ? FOR UPDATE',
      [idTransferencia]
    );

    if (transferRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Transferencia no encontrada' });
    }

    const trf = transferRows[0];

    if (trf.estado !== 'PENDIENTE') {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Esta transferencia ya fue respondida previamente (Estado: ${trf.estado})`
      });
    }

    if (id_trabajador_destino && Number(trf.id_trabajador_destino) !== Number(id_trabajador_destino)) {
      await connection.rollback();
      return res.status(403).json({ success: false, message: 'No estás autorizado para responder esta transferencia' });
    }

    if (accion === 'RECHAZAR') {
      await connection.query(`
        UPDATE transferencias_tecnicos
        SET estado = 'RECHAZADA',
            motivo_rechazo = ?,
            fecha_respuesta = NOW()
        WHERE id_transferencia = ?
      `, [motivo_rechazo || 'Rechazado por el técnico receptor', idTransferencia]);

      await connection.commit();
      return res.json({
        success: true,
        message: 'Transferencia rechazada. El stock no ha sido modificado.'
      });
    }

    // ACCIÓN: ACEPTAR -> Ejecutar traspaso de stock y registro en Kardex
    const [detalles] = await connection.query(
      'SELECT * FROM transferencia_tecnico_detalles WHERE id_transferencia = ?',
      [idTransferencia]
    );

    for (const item of detalles) {
      if (Number(item.es_serie) === 0) {
        // Material no serializado
        const cant = Number(item.cantidad);
        const prodId = Number(item.id_producto);

        // Descontar al origen
        await connection.query(`
          UPDATE trabajador_productos 
          SET stock = GREATEST(0, stock - ?), fecha_actualizacion = NOW()
          WHERE id_trabajador = ? AND id_producto = ?
        `, [cant, trf.id_trabajador_origen, prodId]);

        // Aumentar al receptor
        const [tpDest] = await connection.query(
          'SELECT id_trabajador_producto FROM trabajador_productos WHERE id_trabajador = ? AND id_producto = ?',
          [trf.id_trabajador_destino, prodId]
        );

        if (tpDest.length > 0) {
          await connection.query(
            'UPDATE trabajador_productos SET stock = stock + ?, fecha_actualizacion = NOW() WHERE id_trabajador_producto = ?',
            [cant, tpDest[0].id_trabajador_producto]
          );
        } else {
          await connection.query(
            'INSERT INTO trabajador_productos (id_trabajador, id_producto, stock, fecha_creacion, fecha_actualizacion) VALUES (?, ?, ?, NOW(), NOW())',
            [trf.id_trabajador_destino, prodId, cant]
          );
        }

        // Registrar KARDEX: Salida de Origen
        const refSalida = `Traspaso a Técnico: ${trf.nombre_destino} (DNI ${trf.dni_destino}) [Ref: ${trf.codigo_transferencia}]`;
        await connection.query(`
          INSERT INTO movimientos (id_producto, id_almacen, tipo, cantidad, referencia, fecha_creacion)
          VALUES (?, 1, 'SALIDA', ?, ?, NOW())
        `, [prodId, cant, refSalida]);

        // Registrar KARDEX: Entrada a Destino
        const refEntrada = `Recepción de Traspaso: De ${trf.nombre_origen} (DNI ${trf.dni_origen}) [Ref: ${trf.codigo_transferencia}]`;
        await connection.query(`
          INSERT INTO movimientos (id_producto, id_almacen, tipo, cantidad, referencia, fecha_creacion)
          VALUES (?, 1, 'ENTRADA', ?, ?, NOW())
        `, [prodId, cant, refEntrada]);

      } else {
        // Equipo serializado
        const serieStr = String(item.numero_serie).trim().toUpperCase();
        const prodId = Number(item.id_producto);
        let prodSerieId = item.id_producto_serie ? Number(item.id_producto_serie) : null;

        if (!prodSerieId && serieStr) {
          const [psRows] = await connection.query(
            "SELECT id_producto_serie FROM producto_series WHERE UPPER(TRIM(numero_serie)) = ? LIMIT 1",
            [serieStr]
          );
          if (psRows.length > 0) prodSerieId = psRows[0].id_producto_serie;
        }

        // Reasignar la serie en trabajador_series al nuevo técnico receptor
        const [updateSerieRes] = await connection.query(`
          UPDATE trabajador_series ts
          LEFT JOIN producto_series ps ON ts.id_producto_serie = ps.id_producto_serie
          SET ts.id_trabajador = ?,
              ts.fecha_asignacion = NOW(),
              ts.estado = 'Asignada'
          WHERE ts.id_trabajador = ?
            AND (ts.id_producto_serie = ? OR (ps.numero_serie IS NOT NULL AND UPPER(TRIM(ps.numero_serie)) = ?))
        `, [
          trf.id_trabajador_destino,
          trf.id_trabajador_origen,
          prodSerieId || 0,
          serieStr
        ]);

        // Si por alguna razón no existía en trabajador_series, insertarlo para el receptor
        if (updateSerieRes.affectedRows === 0 && prodSerieId) {
          await connection.query(`
            INSERT INTO trabajador_series (id_trabajador, id_producto, id_producto_serie, estado, fecha_asignacion)
            VALUES (?, ?, ?, 'Asignada', NOW())
          `, [
            trf.id_trabajador_destino,
            prodId,
            prodSerieId
          ]);
        }

        // Registrar KARDEX para el equipo serializado
        const refSalidaSer = `Traspaso Equipo Serializado: Salida de ${trf.nombre_origen} a ${trf.nombre_destino} [Serie: ${serieStr}] [Ref: ${trf.codigo_transferencia}]`;
        await connection.query(`
          INSERT INTO movimientos (id_producto, id_almacen, tipo, cantidad, referencia, fecha_creacion)
          VALUES (?, 1, 'SALIDA', 1, ?, NOW())
        `, [prodId, refSalidaSer]);

        const refEntradaSer = `Traspaso Equipo Serializado: Ingreso a ${trf.nombre_destino} desde ${trf.nombre_origen} [Serie: ${serieStr}] [Ref: ${trf.codigo_transferencia}]`;
        await connection.query(`
          INSERT INTO movimientos (id_producto, id_almacen, tipo, cantidad, referencia, fecha_creacion)
          VALUES (?, 1, 'ENTRADA', 1, ?, NOW())
        `, [prodId, refEntradaSer]);
      }
    }

    // Actualizar estado de la cabecera
    await connection.query(`
      UPDATE transferencias_tecnicos
      SET estado = 'ACEPTADA',
          fecha_respuesta = NOW()
      WHERE id_transferencia = ?
    `, [idTransferencia]);

    await connection.commit();

    res.json({
      success: true,
      message: `¡Transferencia ${trf.codigo_transferencia} aceptada con éxito! El stock y equipos han sido incorporados a tu camioneta.`
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error al responder transferencia:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

router.post('/transferencias/:id/cancelar', async (req, res) => {
  try {
    const idTransferencia = Number(req.params.id);
    const { id_trabajador_origen } = req.body;

    const [rows] = await pool.query(
      'SELECT * FROM transferencias_tecnicos WHERE id_transferencia = ?',
      [idTransferencia]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Transferencia no encontrada' });
    }

    const trf = rows[0];
    if (trf.estado !== 'PENDIENTE') {
      return res.status(400).json({ success: false, message: `No se puede cancelar una transferencia en estado ${trf.estado}` });
    }

    if (id_trabajador_origen && Number(trf.id_trabajador_origen) !== Number(id_trabajador_origen)) {
      return res.status(403).json({ success: false, message: 'Solo el emisor puede cancelar esta solicitud' });
    }

    await pool.query(`
      UPDATE transferencias_tecnicos
      SET estado = 'CANCELADA',
          fecha_respuesta = NOW()
      WHERE id_transferencia = ?
    `, [idTransferencia]);

    res.json({ success: true, message: 'Transferencia cancelada con éxito' });
  } catch (error) {
    console.error('Error al cancelar transferencia:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/transferencias/historial', async (req, res) => {
  try {
    const { fecha_desde, fecha_hasta, estado, id_trabajador, buscar } = req.query;

    let query = `
      SELECT 
        t.*,
        DATE_FORMAT(t.fecha_solicitud, '%d/%m/%Y %H:%i') AS fecha_solicitud_fmt,
        DATE_FORMAT(t.fecha_respuesta, '%d/%m/%Y %H:%i') AS fecha_respuesta_fmt
      FROM transferencias_tecnicos t
      WHERE 1=1
    `;
    const params = [];

    if (fecha_desde) {
      query += ' AND DATE(t.fecha_solicitud) >= ?';
      params.push(fecha_desde);
    }
    if (fecha_hasta) {
      query += ' AND DATE(t.fecha_solicitud) <= ?';
      params.push(fecha_hasta);
    }
    if (estado && estado !== 'TODOS') {
      query += ' AND t.estado = ?';
      params.push(estado);
    }
    if (id_trabajador) {
      query += ' AND (t.id_trabajador_origen = ? OR t.id_trabajador_destino = ?)';
      params.push(id_trabajador, id_trabajador);
    }
    if (buscar) {
      query += ` AND (
        t.codigo_transferencia LIKE ? OR
        t.nombre_origen LIKE ? OR
        t.nombre_destino LIKE ? OR
        t.dni_origen LIKE ? OR
        t.dni_destino LIKE ? OR
        t.cuadrilla_origen LIKE ? OR
        t.cuadrilla_destino LIKE ?
      )`;
      const b = `%${buscar}%`;
      params.push(b, b, b, b, b, b, b);
    }

    query += ' ORDER BY t.fecha_solicitud DESC LIMIT 200';

    const [transfers] = await pool.query(query, params);

    // Adjuntar items a cada transferencia
    for (const trf of transfers) {
      const [detalles] = await pool.query(
        'SELECT * FROM transferencia_tecnico_detalles WHERE id_transferencia = ?',
        [trf.id_transferencia]
      );
      trf.detalles = detalles;
    }

    res.json({
      success: true,
      total: transfers.length,
      transferencias: transfers
    });
  } catch (error) {
    console.error('Error al obtener historial de transferencias:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;