'use strict';
/**
 * middleware/upload.js
 * Instancias de Multer compartidas para todos los routers
 */
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, uploadDir); },
  filename: function (req, file, cb) { cb(null, Date.now() + path.extname(file.originalname)); }
});

// Upload general (empleados, documentos)
const upload = multer({ storage }).fields([
  { name: 'foto_personal', maxCount: 1 },
  { name: 'doc_delantera', maxCount: 1 },
  { name: 'doc_trasera', maxCount: 1 },
  { name: 'brevete_delantera', maxCount: 1 },
  { name: 'brevete_trasera', maxCount: 1 },
  { name: 'revision_tecnica_frontal', maxCount: 1 },
  { name: 'revision_tecnica_posterior', maxCount: 1 },
  { name: 'tarjeta_propiedad_frontal', maxCount: 1 },
  { name: 'tarjeta_propiedad_posterior', maxCount: 1 },
  { name: 'recibo_servicio_pdf', maxCount: 1 },
  { name: 'cv_pdf', maxCount: 1 },
  { name: 'certificado_pdf', maxCount: 1 },
  { name: 'otro_documento_pdf', maxCount: 1 },
  { name: 'dni_pdf', maxCount: 1 },
  { name: 'licencia_pdf', maxCount: 1 },
]);

// Upload inspecciones de movilidad
const uploadInspeccion = multer({ storage }).fields([
  { name: 'foto_km_actual', maxCount: 1 },
  { name: 'foto_km_fin', maxCount: 1 },
  { name: 'foto_combustible', maxCount: 1 },
  { name: 'foto_ticket', maxCount: 1 },
  { name: 'foto_voucher', maxCount: 1 },
  { name: 'foto_inspeccion', maxCount: 1 },
  { name: 'foto_checklist', maxCount: 1 },
]);

// Upload foto acta de liquidación
const uploadFotoActa = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|pdf/;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.test(ext));
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
}).single('foto_acta');

module.exports = { upload, uploadInspeccion, uploadFotoActa };

