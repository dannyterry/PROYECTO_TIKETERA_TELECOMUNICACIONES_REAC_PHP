'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth, signToken } = require('../middleware/requireAuth');
const { uploadFileToS3, uploadBufferToS3, getS3ObjectStream, checkS3ObjectExists, getS3SignedUrl } = require('../services/s3Service');
const path = require('path');
const fs = require('fs');


// ─── RUTAS MÓDULO: PAGOS ───────────────────────────────────────

router.get('/resumen', async (req, res) => {
  try {
    const { desde, hasta, estado } = req.query;

    let where = "o.estado IN ('Finalizada', 'Liquidada') AND o.id_tecnico IS NOT NULL";
    const params = [];

    if (desde && hasta) {
      where += " AND DATE(o.fecha_visita) BETWEEN ? AND ?";
      params.push(desde, hasta);
    } else if (desde) {
      where += " AND DATE(o.fecha_visita) >= ?";
      params.push(desde);
    } else if (hasta) {
      where += " AND DATE(o.fecha_visita) <= ?";
      params.push(hasta);
    }

    if (estado === 'liquidada') {
      where += " AND EXISTS (SELECT 1 FROM orden_liquidaciones eli WHERE eli.id_orden = o.id_orden AND eli.estado = 'Aprobada')";
    } else if (estado === 'pendiente') {
      where += " AND EXISTS (SELECT 1 FROM orden_liquidaciones eli WHERE eli.id_orden = o.id_orden AND eli.estado = 'Pendiente')";
    } else if (estado === 'rechazada') {
      where += " AND EXISTS (SELECT 1 FROM orden_liquidaciones eli WHERE eli.id_orden = o.id_orden AND eli.estado = 'Rechazada')";
    } else if (estado === 'sin_liquidar') {
      where += " AND NOT EXISTS (SELECT 1 FROM orden_liquidaciones eli WHERE eli.id_orden = o.id_orden)";
    }

    const sql = `
      SELECT
        o.id_orden,
        o.numero,
        o.fecha_visita,
        o.cliente,
        TRIM(UPPER(COALESCE(o.tipo_trabajo, ''))) AS tipo_trabajo,
        o.motivo_trabajo,
        o.id_tecnico,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS tecnico,
        m.id_motivo,
        COALESCE(o.motivo_trabajo, m.nombre, o.tipo_trabajo) AS motivo_nombre,
        COALESCE(m.precio_compra, 0) AS precio_win,
        COALESCE(m.precio_venta, 0)  AS precio_tecnico,
        (SELECT COALESCE(SUM(
            CASE WHEN ps.estado = 'BAJA' THEN 0
                 ELSE d.cantidad * p.precio_compra END), 0)
         FROM orden_liquidaciones ol
         INNER JOIN orden_liquidacion_detalle d ON d.id_liquidacion = ol.id_liquidacion
         INNER JOIN productos p ON p.id_producto = d.id_producto
         LEFT JOIN producto_series ps ON ps.id_producto_serie = d.id_producto_serie
         WHERE ol.id_orden = o.id_orden
           AND ol.estado IN ('Pendiente','Aprobada')) AS costo_material
      FROM ordenes o
      LEFT JOIN usuarios u ON u.id_usuario = o.id_tecnico
      LEFT JOIN trabajadores t ON t.id_usuario = u.id_usuario
      LEFT JOIN motivos m ON m.id_motivo = (
        SELECT m2.id_motivo 
        FROM motivos m2 
        WHERE m2.estado = 'Activo'
          AND (
            TRIM(UPPER(m2.nombre)) = TRIM(UPPER(COALESCE(o.motivo_trabajo, '')))
            OR TRIM(UPPER(m2.nombre)) = TRIM(UPPER(COALESCE(o.motivo, '')))
            OR TRIM(UPPER(m2.nombre)) = TRIM(UPPER(COALESCE(o.tipo_trabajo, '')))
            OR TRIM(UPPER(m2.tipo_trabajo)) = TRIM(UPPER(COALESCE(o.tipo_trabajo, '')))
          )
        ORDER BY 
          (TRIM(UPPER(m2.nombre)) = TRIM(UPPER(COALESCE(o.motivo_trabajo, '')))) DESC,
          (TRIM(UPPER(m2.nombre)) = TRIM(UPPER(COALESCE(o.motivo, '')))) DESC,
          (TRIM(UPPER(m2.nombre)) = TRIM(UPPER(COALESCE(o.tipo_trabajo, '')))) DESC,
          m2.id_motivo ASC
        LIMIT 1
      )
      WHERE ${where}
      ORDER BY o.numero ASC
    `;

    const [filas] = await pool.query(sql, params);

    const totales = {
      num_ordenes: 0,
      sin_precio: 0,
      ingreso_win: 0,
      costo_material: 0,
      pago_tecnicos: 0,
      ganancia: 0
    };

    const tecnicosMap = {};

    filas.forEach((f) => {
      const ingreso = Math.round(Number(f.precio_win) * 100) / 100;
      const pago = Math.round(Number(f.precio_tecnico) * 100) / 100;
      const material = Math.round(Number(f.costo_material) * 100) / 100;
      const ganancia = Math.round((ingreso - pago - material) * 100) / 100;

      totales.num_ordenes++;
      if (!f.id_motivo) totales.sin_precio++;
      totales.ingreso_win = Math.round((totales.ingreso_win + ingreso) * 100) / 100;
      totales.costo_material = Math.round((totales.costo_material + material) * 100) / 100;
      totales.pago_tecnicos = Math.round((totales.pago_tecnicos + pago) * 100) / 100;
      totales.ganancia = Math.round((totales.ganancia + ganancia) * 100) / 100;

      if (f.id_tecnico) {
        const id = Number(f.id_tecnico);
        if (!tecnicosMap[id]) {
          tecnicosMap[id] = {
            id_trabajador: id,
            tecnico: f.tecnico || `Técnico #${id}`,
            num_ordenes: 0,
            sin_precio: 0,
            ingreso_win: 0,
            costo_material: 0,
            pago_tecnico: 0,
            ganancia: 0
          };
        }

        tecnicosMap[id].num_ordenes++;
        if (!f.id_motivo) tecnicosMap[id].sin_precio++;
        tecnicosMap[id].ingreso_win = Math.round((tecnicosMap[id].ingreso_win + ingreso) * 100) / 100;
        tecnicosMap[id].costo_material = Math.round((tecnicosMap[id].costo_material + material) * 100) / 100;
        tecnicosMap[id].pago_tecnico = Math.round((tecnicosMap[id].pago_tecnico + pago) * 100) / 100;
        tecnicosMap[id].ganancia = Math.round((tecnicosMap[id].ganancia + ganancia) * 100) / 100;
      }
    });

    // Obtener adelantos pendientes por técnico para calcular neto_a_pagar
    const [filasAdelantos] = await pool.query(`
      SELECT 
        id_trabajador,
        COALESCE(SUM(monto), 0) AS total_adelanto
      FROM adelantos_sueldo
      WHERE estado = 'PENDIENTE'
      GROUP BY id_trabajador
    `);

    const adelantosPorTecnico = {};
    let totalAdelantosGlobal = 0;
    filasAdelantos.forEach(a => {
      const monto = Number(a.total_adelanto) || 0;
      adelantosPorTecnico[a.id_trabajador] = monto;
      totalAdelantosGlobal = Math.round((totalAdelantosGlobal + monto) * 100) / 100;
    });

    Object.keys(tecnicosMap).forEach(id => {
      const item = tecnicosMap[id];
      const adelanto = adelantosPorTecnico[id] || 0;
      item.adelantos = adelanto;
      item.neto_a_pagar = Math.round(Math.max(0, item.pago_tecnico - adelanto) * 100) / 100;
    });

    const tecnicos = Object.values(tecnicosMap).sort((a, b) => b.pago_tecnico - a.pago_tecnico);

    res.json({
      success: true,
      fecha_desde: desde,
      fecha_hasta: hasta,
      estado,
      totales: {
        ...totales,
        total_adelantos: totalAdelantosGlobal,
        neto_total: Math.round(Math.max(0, totales.pago_tecnicos - totalAdelantosGlobal) * 100) / 100
      },
      tecnicos
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/detalle/:id_trabajador', async (req, res) => {
  try {
    const { id_trabajador } = req.params;
    const { desde, hasta, estado } = req.query;

    let where = "o.estado IN ('Finalizada', 'Liquidada') AND o.id_tecnico = ?";
    const params = [id_trabajador];

    if (desde && hasta) {
      where += " AND DATE(o.fecha_visita) BETWEEN ? AND ?";
      params.push(desde, hasta);
    } else if (desde) {
      where += " AND DATE(o.fecha_visita) >= ?";
      params.push(desde);
    } else if (hasta) {
      where += " AND DATE(o.fecha_visita) <= ?";
      params.push(hasta);
    }

    if (estado === 'liquidada') {
      where += " AND EXISTS (SELECT 1 FROM orden_liquidaciones eli WHERE eli.id_orden = o.id_orden AND eli.estado = 'Aprobada')";
    } else if (estado === 'pendiente') {
      where += " AND EXISTS (SELECT 1 FROM orden_liquidaciones eli WHERE eli.id_orden = o.id_orden AND eli.estado = 'Pendiente')";
    } else if (estado === 'rechazada') {
      where += " AND EXISTS (SELECT 1 FROM orden_liquidaciones eli WHERE eli.id_orden = o.id_orden AND eli.estado = 'Rechazada')";
    } else if (estado === 'sin_liquidar') {
      where += " AND NOT EXISTS (SELECT 1 FROM orden_liquidaciones eli WHERE eli.id_orden = o.id_orden)";
    }

    const sql = `
      SELECT
        o.id_orden,
        o.numero,
        o.fecha_visita,
        o.cliente,
        TRIM(UPPER(COALESCE(o.tipo_trabajo, ''))) AS tipo_trabajo,
        o.motivo_trabajo,
        o.id_tecnico,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS tecnico,
        m.id_motivo,
        COALESCE(o.motivo_trabajo, m.nombre, o.tipo_trabajo) AS motivo_nombre,
        COALESCE(m.precio_compra, 0) AS precio_win,
        COALESCE(m.precio_venta, 0)  AS precio_tecnico,
        (SELECT COALESCE(SUM(
            CASE WHEN ps.estado = 'BAJA' THEN 0
                 ELSE d.cantidad * p.precio_compra END), 0)
         FROM orden_liquidaciones ol
         INNER JOIN orden_liquidacion_detalle d ON d.id_liquidacion = ol.id_liquidacion
         INNER JOIN productos p ON p.id_producto = d.id_producto
         LEFT JOIN producto_series ps ON ps.id_producto_serie = d.id_producto_serie
         WHERE ol.id_orden = o.id_orden
           AND ol.estado IN ('Pendiente','Aprobada')) AS costo_material
      FROM ordenes o
      LEFT JOIN usuarios u ON u.id_usuario = o.id_tecnico
      LEFT JOIN trabajadores t ON t.id_usuario = u.id_usuario
      LEFT JOIN motivos m ON m.id_motivo = (
        SELECT m2.id_motivo 
        FROM motivos m2 
        WHERE m2.estado = 'Activo'
          AND (
            TRIM(UPPER(m2.nombre)) = TRIM(UPPER(COALESCE(o.motivo_trabajo, '')))
            OR TRIM(UPPER(m2.nombre)) = TRIM(UPPER(COALESCE(o.motivo, '')))
            OR TRIM(UPPER(m2.nombre)) = TRIM(UPPER(COALESCE(o.tipo_trabajo, '')))
            OR TRIM(UPPER(m2.tipo_trabajo)) = TRIM(UPPER(COALESCE(o.tipo_trabajo, '')))
          )
        ORDER BY 
          (TRIM(UPPER(m2.nombre)) = TRIM(UPPER(COALESCE(o.motivo_trabajo, '')))) DESC,
          (TRIM(UPPER(m2.nombre)) = TRIM(UPPER(COALESCE(o.motivo, '')))) DESC,
          (TRIM(UPPER(m2.nombre)) = TRIM(UPPER(COALESCE(o.tipo_trabajo, '')))) DESC,
          m2.id_motivo ASC
        LIMIT 1
      )
      WHERE ${where}
      ORDER BY o.numero ASC
    `;

    const [filas] = await pool.query(sql, params);

    let nombreTecnico = '';
    const ordenes = [];
    const totales = {
      num_ordenes: 0,
      sin_precio: 0,
      ingreso_win: 0,
      costo_material: 0,
      pago_tecnicos: 0,
      ganancia: 0
    };

    filas.forEach((f) => {
      if (!nombreTecnico && f.tecnico) nombreTecnico = f.tecnico;

      const ingreso = Math.round(Number(f.precio_win) * 100) / 100;
      const pago = Math.round(Number(f.precio_tecnico) * 100) / 100;
      const material = Math.round(Number(f.costo_material) * 100) / 100;
      const ganancia = Math.round((ingreso - pago - material) * 100) / 100;

      ordenes.push({
        id_orden: f.id_orden,
        numero: f.numero,
        fecha_visita: f.fecha_visita,
        cliente: f.cliente || '-',
        tipo_trabajo: f.tipo_trabajo || '-',
        motivo: f.motivo_nombre || null,
        precio_win: ingreso,
        pago_tecnico: pago,
        costo_material: material,
        ganancia
      });

      totales.num_ordenes++;
      if (!f.id_motivo) totales.sin_precio++;
      totales.ingreso_win = Math.round((totales.ingreso_win + ingreso) * 100) / 100;
      totales.costo_material = Math.round((totales.costo_material + material) * 100) / 100;
      totales.pago_tecnicos = Math.round((totales.pago_tecnicos + pago) * 100) / 100;
      totales.ganancia = Math.round((totales.ganancia + ganancia) * 100) / 100;
    });

    if (!nombreTecnico) {
      const [uRow] = await pool.query(`
        SELECT TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS nombre
        FROM usuarios u
        LEFT JOIN trabajadores t ON u.id_usuario = t.id_usuario
        WHERE u.id_usuario = ? OR t.id_trabajador = ?
        LIMIT 1
      `, [id_trabajador, id_trabajador]);
      nombreTecnico = uRow[0]?.nombre || `Técnico #${id_trabajador}`;
    }

    // Consultar adelantos asociados a este técnico
    const [adelantosTecnico] = await pool.query(`
      SELECT 
        id_adelanto,
        monto,
        fecha_adelanto,
        metodo_pago,
        numero_operacion,
        motivo,
        estado,
        fecha_descuento,
        observaciones
      FROM adelantos_sueldo
      WHERE id_trabajador = ?
      ORDER BY fecha_adelanto DESC
    `, [id_trabajador]);

    const totalAdelantosPendientes = adelantosTecnico
      .filter(a => a.estado === 'PENDIENTE')
      .reduce((sum, a) => sum + (Number(a.monto) || 0), 0);

    res.json({
      success: true,
      id_trabajador: Number(id_trabajador),
      tecnico: nombreTecnico,
      totales: {
        ...totales,
        total_adelantos: Math.round(totalAdelantosPendientes * 100) / 100,
        neto_a_pagar: Math.round(Math.max(0, totales.pago_tecnicos - totalAdelantosPendientes) * 100) / 100
      },
      ordenes,
      adelantos: adelantosTecnico
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/adelantos', async (req, res) => {
  try {
    const { desde, hasta, estado, id_trabajador } = req.query;

    let where = "1=1";
    const params = [];

    if (desde && hasta) {
      where += " AND a.fecha_adelanto BETWEEN ? AND ?";
      params.push(desde, hasta);
    } else if (desde) {
      where += " AND a.fecha_adelanto >= ?";
      params.push(desde);
    } else if (hasta) {
      where += " AND a.fecha_adelanto <= ?";
      params.push(hasta);
    }

    if (estado && estado !== 'TODOS') {
      where += " AND a.estado = ?";
      params.push(estado);
    }

    if (id_trabajador) {
      where += " AND a.id_trabajador = ?";
      params.push(id_trabajador);
    }

    const sql = `
      SELECT 
        a.id_adelanto,
        a.id_trabajador,
        a.id_usuario_registro,
        a.monto,
        a.fecha_adelanto,
        a.metodo_pago,
        a.numero_operacion,
        a.motivo,
        a.estado,
        a.fecha_descuento,
        a.id_orden_liquidacion,
        a.observaciones,
        a.created_at,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS trabajador,
        u.documento,
        u.telefono,
        r.nombre AS rol_nombre,
        TRIM(CONCAT(COALESCE(ureg.nombres, ''), ' ', COALESCE(ureg.primer_apellido, ureg.apellidos, ''))) AS registrado_por_nombre
      FROM adelantos_sueldo a
      LEFT JOIN usuarios u ON u.id_usuario = a.id_trabajador
      LEFT JOIN roles r ON u.id_rol = r.id_rol
      LEFT JOIN usuarios ureg ON ureg.id_usuario = a.id_usuario_registro
      WHERE ${where}
      ORDER BY a.fecha_adelanto DESC, a.id_adelanto DESC
    `;

    const [adelantos] = await pool.query(sql, params);

    // Calcular KPIs
    let total_monto = 0;
    let total_pendiente = 0;
    let total_descontado = 0;
    let total_anulado = 0;

    adelantos.forEach(a => {
      const monto = Number(a.monto) || 0;
      if (a.estado !== 'ANULADO') {
        total_monto = Math.round((total_monto + monto) * 100) / 100;
      }
      if (a.estado === 'PENDIENTE') {
        total_pendiente = Math.round((total_pendiente + monto) * 100) / 100;
      } else if (a.estado === 'DESCONTADO') {
        total_descontado = Math.round((total_descontado + monto) * 100) / 100;
      } else if (a.estado === 'ANULADO') {
        total_anulado = Math.round((total_anulado + monto) * 100) / 100;
      }
    });

    res.json({
      success: true,
      totales: {
        total_monto,
        total_pendiente,
        total_descontado,
        total_anulado,
        cantidad: adelantos.length
      },
      adelantos
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/adelantos', async (req, res) => {
  try {
    const {
      id_trabajador,
      id_usuario_registro,
      monto,
      fecha_adelanto,
      metodo_pago,
      numero_operacion,
      motivo,
      observaciones
    } = req.body;

    if (!id_trabajador || !monto || Number(monto) <= 0) {
      return res.status(400).json({ error: "El trabajador y un monto mayor a 0 son obligatorios" });
    }

    const fecha = fecha_adelanto || new Date().toISOString().slice(0, 10);
    const metodo = metodo_pago || 'Transferencia';

    const [result] = await pool.query(`
      INSERT INTO adelantos_sueldo (
        id_trabajador,
        id_usuario_registro,
        monto,
        fecha_adelanto,
        metodo_pago,
        numero_operacion,
        motivo,
        estado,
        observaciones
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDIENTE', ?)
    `, [
      id_trabajador,
      id_usuario_registro || null,
      monto,
      fecha,
      metodo,
      numero_operacion || null,
      motivo || 'Adelanto de sueldo',
      observaciones || null
    ]);

    res.json({
      success: true,
      message: "Adelanto registrado correctamente",
      id_adelanto: result.insertId
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/adelantos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      monto,
      fecha_adelanto,
      metodo_pago,
      numero_operacion,
      motivo,
      estado,
      observaciones,
      fecha_descuento
    } = req.body;

    const fields = [];
    const values = [];

    if (monto !== undefined) {
      fields.push("monto = ?");
      values.push(monto);
    }
    if (fecha_adelanto !== undefined) {
      fields.push("fecha_adelanto = ?");
      values.push(fecha_adelanto);
    }
    if (metodo_pago !== undefined) {
      fields.push("metodo_pago = ?");
      values.push(metodo_pago);
    }
    if (numero_operacion !== undefined) {
      fields.push("numero_operacion = ?");
      values.push(numero_operacion);
    }
    if (motivo !== undefined) {
      fields.push("motivo = ?");
      values.push(motivo);
    }
    if (estado !== undefined) {
      fields.push("estado = ?");
      values.push(estado);
      if (estado === 'DESCONTADO' && !fecha_descuento) {
        fields.push("fecha_descuento = ?");
        values.push(new Date().toISOString().slice(0, 10));
      } else if (estado === 'PENDIENTE') {
        fields.push("fecha_descuento = NULL");
      }
    }
    if (fecha_descuento !== undefined && estado !== 'PENDIENTE') {
      fields.push("fecha_descuento = ?");
      values.push(fecha_descuento);
    }
    if (observaciones !== undefined) {
      fields.push("observaciones = ?");
      values.push(observaciones);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: "No se proporcionaron campos para actualizar" });
    }

    values.push(id);
    await pool.query(`UPDATE adelantos_sueldo SET ${fields.join(", ")} WHERE id_adelanto = ?`, values);

    res.json({
      success: true,
      message: "Adelanto actualizado correctamente"
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/adelantos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM adelantos_sueldo WHERE id_adelanto = ?", [id]);
    res.json({ success: true, message: "Adelanto eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;