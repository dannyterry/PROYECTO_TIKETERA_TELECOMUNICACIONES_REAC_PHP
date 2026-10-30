'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth, signToken } = require('../middleware/requireAuth');
const { uploadFileToS3, uploadBufferToS3, getS3ObjectStream, checkS3ObjectExists, getS3SignedUrl } = require('../services/s3Service');
const path = require('path');
const fs = require('fs');


// ─── RUTAS MÓDULO: CORREOS ───────────────────────────────────────

router.get('/config', async (req, res) => {
  try {
    const claves = ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASSWORD', 'EMAIL_SECURE', 'EMAIL_FROM_NAME', 'EMAIL_PRUEBA'];
    const [rows] = await pool.query("SELECT clave, valor FROM configuracion WHERE clave IN (?)", [claves]);
    const config = {
      EMAIL_HOST: '',
      EMAIL_PORT: '587',
      EMAIL_USER: '',
      EMAIL_PASSWORD: '',
      EMAIL_SECURE: 'tls',
      EMAIL_FROM_NAME: '',
      EMAIL_PRUEBA: ''
    };
    rows.forEach(r => {
      if (r.clave in config) config[r.clave] = r.valor || '';
    });
    res.json(config);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/config', async (req, res) => {
  try {
    const data = req.body;
    for (const [k, v] of Object.entries(data)) {
      await pool.query(`
        INSERT INTO configuracion (clave, valor, updated_at)
        VALUES (?, ?, NOW())
        ON DUPLICATE KEY UPDATE valor = VALUES(valor), updated_at = NOW()
      `, [k, String(v ?? '')]);
    }
    res.json({ success: true, message: "Configuración SMTP guardada exitosamente." });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/tecnicos', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        t.id_trabajador,
        CONCAT_WS(' ', u.nombres, u.apellidos) AS tecnico,
        u.email
      FROM trabajadores t
      INNER JOIN usuarios u ON u.id_usuario = t.id_usuario
      INNER JOIN roles r    ON r.id_rol     = u.id_rol
      WHERE (LOWER(r.nombre) LIKE '%tecnico%' OR r.id_rol = 2)
        AND u.email IS NOT NULL
        AND TRIM(u.email) <> ''
        AND TRIM(u.email) <> '-'
      ORDER BY tecnico ASC
    `);
    res.json(rows);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/enviar-prueba', async (req, res) => {
  try {
    const { email } = req.body;
    const [rows] = await pool.query(
      "SELECT clave, valor FROM configuracion WHERE clave IN ('EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASSWORD', 'EMAIL_SECURE', 'EMAIL_FROM_NAME', 'EMAIL_PRUEBA')"
    );
    const cfg = {};
    rows.forEach(r => { cfg[r.clave] = r.valor; });

    const destino = email || cfg.EMAIL_PRUEBA;
    if (!destino) return res.status(400).json({ success: false, mensaje: "Debe ingresar un correo de destino." });

    if (!cfg.EMAIL_HOST || !cfg.EMAIL_USER || !cfg.EMAIL_PASSWORD) {
      return res.status(400).json({ success: false, mensaje: "La configuración SMTP está incompleta." });
    }

    const transporter = nodemailer.createTransport({
      host: cfg.EMAIL_HOST,
      port: parseInt(cfg.EMAIL_PORT || '587', 10),
      secure: cfg.EMAIL_SECURE === 'ssl',
      auth: {
        user: cfg.EMAIL_USER,
        pass: cfg.EMAIL_PASSWORD
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    await transporter.sendMail({
      from: `"${cfg.EMAIL_FROM_NAME || 'Sistema Telecom'}" <${cfg.EMAIL_USER}>`,
      to: destino,
      subject: "Correo de prueba - Configuración Exitosa",
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #059669;">¡Configuración SMTP Correcta!</h2>
          <p>Este es un correo de prueba emitido desde la plataforma de telecomunicaciones.</p>
          <p>La conexión con el servidor <b>${cfg.EMAIL_HOST}</b> se ha validado exitosamente.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <small style="color: #888;">Fecha y hora de envío: ${new Date().toLocaleString('es-PE')}</small>
        </div>
      `
    });

    res.json({ success: true, mensaje: `Correo de prueba enviado exitosamente a ${destino}.` });
  } catch (error) {
    res.status(500).json({ success: false, mensaje: error.message });
  }
});

router.get(['/config', '/correos/config'], async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT clave, valor FROM configuracion WHERE clave LIKE 'EMAIL_%'");
    const config = {
      EMAIL_HOST: '',
      EMAIL_PORT: '587',
      EMAIL_USER: '',
      EMAIL_PASSWORD: '',
      EMAIL_SECURE: 'tls',
      EMAIL_FROM_NAME: 'Sistema Telecom',
      EMAIL_PRUEBA: ''
    };
    rows.forEach(r => {
      config[r.clave] = r.valor;
    });
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post(['/config', '/correos/config'], async (req, res) => {
  try {
    const body = req.body || {};
    const keys = ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASSWORD', 'EMAIL_SECURE', 'EMAIL_FROM_NAME', 'EMAIL_PRUEBA'];
    for (const k of keys) {
      if (body[k] !== undefined) {
        await pool.query(
          `INSERT INTO configuracion (clave, valor, grupo, descripcion, updated_at) 
           VALUES (?, ?, 'email', 'Configuración de servidor SMTP', NOW())
           ON DUPLICATE KEY UPDATE valor = VALUES(valor), updated_at = NOW()`,
          [k, String(body[k])]
        );
      }
    }
    res.json({ success: true, mensaje: 'Configuración SMTP guardada correctamente.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get(['/tecnicos', '/correos/tecnicos'], async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        id_trabajador,
        CONCAT(nombres, ' ', apellidos) as tecnico,
        correo as email
      FROM trabajadores
      WHERE estado = 'Activo' AND correo IS NOT NULL AND correo != ''
      ORDER BY nombres ASC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post(['/enviar-prueba', '/correos/enviar-prueba'], async (req, res) => {
  try {
    const nodemailer = require('nodemailer');
    const [rows] = await pool.query("SELECT clave, valor FROM configuracion WHERE clave LIKE 'EMAIL_%'");
    const cfg = {};
    rows.forEach(r => { cfg[r.clave] = r.valor; });

    const destino = req.body?.email || cfg.EMAIL_PRUEBA || cfg.EMAIL_USER;
    if (!destino) {
      return res.status(400).json({ success: false, mensaje: 'No hay correo destinatario especificado.' });
    }

    const transporter = nodemailer.createTransport({
      host: cfg.EMAIL_HOST,
      port: Number(cfg.EMAIL_PORT) || 587,
      secure: cfg.EMAIL_SECURE === 'ssl',
      auth: {
        user: cfg.EMAIL_USER,
        pass: cfg.EMAIL_PASSWORD
      },
      tls: { rejectUnauthorized: false }
    });

    await transporter.sendMail({
      from: `"${cfg.EMAIL_FROM_NAME || 'Corporación Céspedes'}" <${cfg.EMAIL_USER}>`,
      to: destino,
      subject: 'Prueba de Conexión SMTP - Corporación Céspedes',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #4f46e5;">Prueba Exitosa de Conexión SMTP</h2>
          <p>Tu servidor de correo está correctamente conectado y listo para enviar reportes a los técnicos.</p>
          <hr style="border: none; border-top: 1px solid #eee;" />
          <small style="color: #666;">Corporación Céspedes • Telecomunicaciones</small>
        </div>
      `
    });

    res.json({ success: true, mensaje: `Correo de prueba enviado con éxito a ${destino}` });
  } catch (error) {
    console.error('Error enviando correo SMTP:', error);
    res.status(500).json({ success: false, mensaje: error.message });
  }
});

module.exports = router;