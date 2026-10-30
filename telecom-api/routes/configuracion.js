'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth, signToken } = require('../middleware/requireAuth');
const { uploadFileToS3, uploadBufferToS3, getS3ObjectStream, checkS3ObjectExists, getS3SignedUrl } = require('../services/s3Service');
const path = require('path');
const fs = require('fs');


// ─── RUTAS MÓDULO: CONFIGURACION ───────────────────────────────────────

router.get(['/motivos', '/'], async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        id_motivo, 
        nombre, 
        COALESCE(tipo_trabajo, '') AS tipo_trabajo,
        COALESCE(precio_compra, 0.00) AS precio_compra,
        COALESCE(precio_venta, 0.00) AS precio_venta,
        limites_materiales,
        estado,
        fecha_creacion
      FROM motivos
      ORDER BY nombre ASC
    `);
    res.json(rows);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { nombre, tipo_trabajo, precio_compra, precio_venta, limites_materiales, estado = 'Activo' } = req.body;
    if (!nombre || !nombre.trim()) return res.status(400).json({ error: "El nombre del motivo es requerido." });
    const limitesStr = typeof limites_materiales === 'object' ? JSON.stringify(limites_materiales) : (limites_materiales || null);
    const [result] = await pool.query(`
      INSERT INTO motivos (nombre, tipo_trabajo, precio_compra, precio_venta, limites_materiales, estado)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [nombre.trim().toUpperCase(), tipo_trabajo?.trim() || null, precio_compra || 0.00, precio_venta || 0.00, limitesStr, estado]);
    res.json({ success: true, id_motivo: result.insertId, message: "Motivo creado con éxito." });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, tipo_trabajo, precio_compra, precio_venta, limites_materiales, estado } = req.body;
    const limitesStr = typeof limites_materiales === 'object' ? JSON.stringify(limites_materiales) : (limites_materiales !== undefined ? limites_materiales : null);
    await pool.query(`
      UPDATE motivos 
      SET 
        nombre = COALESCE(?, nombre),
        tipo_trabajo = COALESCE(?, tipo_trabajo),
        precio_compra = COALESCE(?, precio_compra),
        precio_venta = COALESCE(?, precio_venta),
        limites_materiales = COALESCE(?, limites_materiales),
        estado = COALESCE(?, estado)
      WHERE id_motivo = ?
    `, [nombre?.trim()?.toUpperCase() || null, tipo_trabajo?.trim() || null, precio_compra, precio_venta, limitesStr, estado || null, id]);
    res.json({ success: true, message: "Motivo actualizado con éxito." });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("UPDATE motivos SET estado = 'Inactivo' WHERE id_motivo = ?", [id]);
    res.json({ success: true, message: "Motivo desactivado con éxito." });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, precio_cespedes, actualizar_motivos = true, estado } = req.body;

    // Obtener nombre actual antes de actualizar para cascada en motivos
    const [curr] = await pool.query("SELECT nombre FROM tipos_trabajo WHERE id_tipo_trabajo = ?", [id]);
    const oldNombre = curr[0]?.nombre;

    const pCespedes = precio_cespedes !== undefined ? (parseFloat(precio_cespedes) || 0.00) : null;
    const newNombre = nombre?.trim()?.toUpperCase() || null;

    await pool.query(
      `UPDATE tipos_trabajo SET 
        nombre = COALESCE(?, nombre), 
        precio_cespedes = COALESCE(?, precio_cespedes), 
        estado = COALESCE(?, estado) 
      WHERE id_tipo_trabajo = ?`,
      [newNombre, pCespedes, estado || null, id]
    );

    // Unificación automática en motivos vinculados
    if (actualizar_motivos && pCespedes !== null) {
      const targetNombre = newNombre || oldNombre;
      if (targetNombre) {
        await pool.query(
          "UPDATE motivos SET precio_venta = ? WHERE UPPER(tipo_trabajo) = UPPER(?)",
          [pCespedes, targetNombre]
        );
      }
    }

    res.json({ success: true, message: "Tipo de trabajo actualizado y precios unificados con éxito." });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("UPDATE tipos_trabajo SET estado = 'Inactivo' WHERE id_tipo_trabajo = ?", [id]);
    res.json({ success: true, message: "Tipo de trabajo desactivado con éxito." });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/sistema', async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT id, clave, valor, descripcion, grupo, updated_at FROM configuracion ORDER BY grupo ASC, clave ASC");
    res.json(rows);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/sistema', async (req, res) => {
  try {
    const configs = req.body; // objeto clave: valor o array
    if (typeof configs === 'object' && !Array.isArray(configs)) {
      for (const [clave, valor] of Object.entries(configs)) {
        await pool.query(`
          INSERT INTO configuracion (clave, valor, updated_at)
          VALUES (?, ?, NOW())
          ON DUPLICATE KEY UPDATE valor = VALUES(valor), updated_at = NOW()
        `, [clave, String(valor ?? '')]);
      }
    }
    res.json({ success: true, message: "Configuración guardada exitosamente." });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get(['/', '/motivos'], async (req, res) => {
  try {
    let rows = [];
    try {
      const [r] = await pool.query("SELECT * FROM motivos WHERE estado = 'Activo' ORDER BY nombre ASC");
      rows = r;
    } catch (e1) {
      const [r] = await pool.query("SELECT * FROM motivos ORDER BY nombre ASC");
      rows = r;
    }
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;