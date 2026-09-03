// 🇵🇪 Forzar Timezone oficial de Perú (America/Lima / UTC-5)
process.env.TZ = "America/Lima";

const express = require("express");
const cors = require("cors");
const pool = require("./db");
const multer = require("multer"); 
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// CONFIGURACIÓN DE MULTER CON RUTA ABSOLUTA (Para compatibilidad con cPanel / Passenger)
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, uploadDir); },
  filename: function (req, file, cb) { cb(null, Date.now() + path.extname(file.originalname)); }
});

const upload = multer({ storage: storage }).fields([
  { name: 'foto_personal', maxCount: 1 }, { name: 'cv_pdf', maxCount: 1 },
  { name: 'dni_pdf', maxCount: 1 }, { name: 'licencia_pdf', maxCount: 1 },
  { name: 'recibo_servicio_pdf', maxCount: 1 }, { name: 'certificado_pdf', maxCount: 1 }
]);

app.get("/", (req, res) => { res.send("API Telecom funcionando con MySQL y Multer"); });

// ⏱️ Endpoint de Diagnóstico de Zona Horaria
app.get("/time-diagnostic", async (req, res) => {
  try {
    const [dbTz] = await pool.query("SELECT NOW() as db_now, CURDATE() as db_curdate, @@global.time_zone as global_tz, @@session.time_zone as session_tz");
    const now = new Date();
    const limaTime = now.toLocaleString("es-PE", { timeZone: "America/Lima" });
    const utcTime = now.toUTCString();
    const isoTime = now.toISOString();

    console.log(`[Time Diagnostic] Perú: ${limaTime} | Server UTC: ${utcTime} | DB Now: ${dbTz[0]?.db_now}`);

    res.json({
      peru_time: limaTime,
      server_utc: utcTime,
      server_iso: isoTime,
      process_tz: process.env.TZ,
      db: dbTz[0]
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- 🛡️ SISTEMA DE AUDITORÍA Y TRAZABILIDAD ---
async function registrarAuditoria(db, { id_usuario, usuario_nombre, modulo, accion, id_referencia, descripcion, req }) {
  try {
    let userId = id_usuario;
    let userName = usuario_nombre;
    let rolId = null;
    let rolNombre = '';
    let areaNombre = '';

    if (userId) {
      const [uRows] = await db.query(`
        SELECT u.id_usuario, u.nombres, u.primer_apellido, u.apellidos, u.id_rol, u.area, r.nombre as rol_nombre
        FROM usuarios u
        LEFT JOIN roles r ON u.id_rol = r.id_rol
        WHERE u.id_usuario = ? LIMIT 1
      `, [userId]);

      if (uRows.length > 0) {
        const u = uRows[0];
        userName = userName || `${u.nombres} ${u.primer_apellido || u.apellidos || ''}`.trim();
        rolId = u.id_rol;
        rolNombre = u.rol_nombre || '';
        areaNombre = u.area || '';

        await db.query(`
          UPDATE usuarios 
          SET ultimo_acceso = NOW(), esta_online = 1, ultima_accion = ?
          WHERE id_usuario = ?
        `, [descripcion ? String(descripcion).slice(0, 250) : accion, userId]);
      }
    }

    const ip = req ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '') : '';

    await db.query(`
      INSERT INTO auditoria_actividad (
        id_usuario, usuario_nombre, id_rol, rol_nombre, area,
        modulo, accion, id_referencia, descripcion, ip_address, fecha_creacion
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      userId || null,
      userName || 'Sistema / Desconocido',
      rolId,
      rolNombre,
      areaNombre,
      modulo || 'GENERAL',
      accion || 'ACCION',
      id_referencia ? String(id_referencia) : null,
      descripcion || accion,
      ip
    ]);
  } catch (err) {
    console.error('Error al registrar auditoría:', err.message);
  }
}

const https = require("https");

function fetchJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { 
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 
        'Accept': 'application/json',
        ...headers 
      } 
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('Timeout de conexión')); });
  });
}

function calculateRuc10(dni) {
  if (!dni || !/^\d{8}$/.test(dni)) return null;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const digits = ('10' + dni).split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += digits[i] * weights[i];
  const remainder = sum % 11;
  let checkDigit = 11 - remainder;
  if (checkDigit === 10) checkDigit = 0;
  else if (checkDigit === 11) checkDigit = 1;
  return '10' + dni + checkDigit;
}

// --- CONSULTA SUNAT / DNI ULTRA RÁPIDA Y 100% COMPATIBLE CON CPANEL / HOSTING ---
app.get("/sunat/:dni", async (req, res) => {
  const dni = req.params.dni;

  if (!dni || !/^\d{8}$/.test(dni)) {
    return res.status(400).json({ error: "Ingrese un DNI válido de 8 dígitos." });
  }

  const token = process.env.SUNAT_TOKEN || process.env.APIS_TOKEN || '';
  const headers = token ? { 'Authorization': 'Bearer ' + token } : {};
  const ruc10 = calculateRuc10(dni);

  let dniData = null;
  let rucData = null;

  // 1. Consulta DNI (RENIEC)
  try {
    const dniUrl = token 
      ? 'https://api.apis.net.pe/v2/reniec/dni?numero=' + dni
      : 'https://api.apis.net.pe/v1/dni?numero=' + dni;
    const resDni = await fetchJson(dniUrl, headers);
    if (resDni.status === 200 && resDni.data && (resDni.data.nombre || resDni.data.nombres)) {
      dniData = resDni.data;
    }
  } catch (e) {
    console.log("Aviso DNI API:", e.message);
  }

  // 2. Consulta RUC (SUNAT)
  if (ruc10) {
    try {
      const rucUrl = token
        ? 'https://api.apis.net.pe/v2/sunat/ruc?numero=' + ruc10
        : 'https://api.apis.net.pe/v1/ruc?numero=' + ruc10;
      const resRuc = await fetchJson(rucUrl, headers);
      if (resRuc.status === 200 && resRuc.data && resRuc.data.numeroDocumento) {
        rucData = resRuc.data;
      }
    } catch (e) {
      console.log("Aviso RUC API:", e.message);
    }
  }

  // 3. Responder con los datos encontrados
  if (dniData || rucData) {
    const nombres = (dniData && (dniData.nombres || dniData.nombre)) || '';
    const primerApellido = (dniData && dniData.apellidoPaterno) || '';
    const segundoApellido = (dniData && dniData.apellidoMaterno) || '';
    const razonSocial = (rucData && rucData.nombre) || (dniData && dniData.nombre) || `${primerApellido} ${segundoApellido} ${nombres}`.trim();

    return res.json({
      dni,
      datos: {
        ruc: (rucData && rucData.numeroDocumento) || ruc10 || '',
        razonSocial: razonSocial,
        nombres: (dniData && dniData.nombres) || '',
        primerApellido: primerApellido,
        segundoApellido: segundoApellido,
        tipoContribuyente: (rucData && rucData.tipoDocumento) ? 'PERSONA NATURAL' : 'PERSONA NATURAL SIN NEGOCIO',
        estado: (rucData && rucData.estado) || 'ACTIVO',
        condicion: (rucData && rucData.condicion) || 'HABIDO',
        actividadesEconomicas: ''
      }
    });
  }

  // 4. Si la red externa falla, responder al menos con el RUC calculado para no bloquear al usuario
  if (ruc10) {
    return res.json({
      dni,
      datos: {
        ruc: ruc10,
        razonSocial: '',
        tipoContribuyente: 'PERSONA NATURAL SIN NEGOCIO',
        estado: 'ACTIVO',
        condicion: 'HABIDO',
        actividadesEconomicas: ''
      }
    });
  }

  res.status(404).json({ error: "No se encontraron datos para el DNI ingresado." });
});

app.get("/sunat/ruc/:ruc", async (req, res) => {
  const ruc = (req.params.ruc || '').trim();

  if (!/^\d{11}$/.test(ruc)) {
    return res.status(400).json({ error: "Ingrese un RUC válido de 11 dígitos." });
  }

  try {
    // 1. Buscar primero en base de datos local de proveedores
    const [provExistente] = await pool.query("SELECT * FROM proveedores WHERE ruc = ? LIMIT 1", [ruc]);
    if (provExistente.length > 0) {
      const p = provExistente[0];
      return res.json({
        ruc: p.ruc,
        razonSocial: p.razon_social || p.nombre_comercial,
        direccion: p.direccion || '',
        telefono: p.telefono || '',
        estado: p.estado || 'ACTIVO',
        condicion: 'HABIDO',
        origen: 'LOCAL_DB'
      });
    }

    // 2. Si no está en BD local, consultar API de SUNAT
    const token = process.env.SUNAT_TOKEN || process.env.APIS_TOKEN || '';
    const headers = token ? { 'Authorization': 'Bearer ' + token } : {};
    const rucUrl = token
      ? 'https://api.apis.net.pe/v2/sunat/ruc?numero=' + ruc
      : 'https://api.apis.net.pe/v1/ruc?numero=' + ruc;

    const resRuc = await fetchJson(rucUrl, headers);
    if (resRuc.status === 200 && resRuc.data && resRuc.data.razonSocial || resRuc.data.nombre) {
      const d = resRuc.data;
      const razonSocial = d.razonSocial || d.nombre || '';
      const direccion = d.direccion || `${d.departamento || ''} ${d.provincia || ''} ${d.distrito || ''}`.trim();
      return res.json({
        ruc,
        razonSocial,
        direccion,
        telefono: '',
        estado: d.estado || 'ACTIVO',
        condicion: d.condicion || 'HABIDO',
        origen: 'SUNAT_API'
      });
    }

    // Si la API no respondió nombre, devolver fallback estructurado
    return res.json({
      ruc,
      razonSocial: `PROVEEDOR RUC ${ruc}`,
      direccion: '',
      telefono: '',
      estado: 'ACTIVO',
      condicion: 'HABIDO',
      origen: 'FALLBACK'
    });
  } catch (error) {
    res.json({
      ruc,
      razonSocial: `PROVEEDOR RUC ${ruc}`,
      direccion: '',
      telefono: '',
      estado: 'ACTIVO',
      condicion: 'HABIDO',
      origen: 'FALLBACK'
    });
  }
});

// --- COMISIONES SBS (AFP) EN VIVO Y 100% COMPATIBLE CON HOSTING ---
const fallbackAfp = [
  { afp: 'HABITAT', flujo: '1.47%', saldo: '1.25%', prima: '1.74%', aporte: '10.00%' },
  { afp: 'INTEGRA', flujo: '1.55%', saldo: '0.82%', prima: '1.74%', aporte: '10.00%' },
  { afp: 'PRIMA', flujo: '1.60%', saldo: '1.25%', prima: '1.74%', aporte: '10.00%' },
  { afp: 'PROFUTURO', flujo: '1.69%', saldo: '1.20%', prima: '1.74%', aporte: '10.00%' }
];

app.get("/sbs/comisiones", async (req, res) => {
  try {
    const html = await new Promise((resolve, reject) => {
      const sbsReq = https.get('https://www.sbs.gob.pe/app/spp/empleadores/comisiones_spp/Paginas/comision_prima.aspx', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      }, (sbsRes) => {
        let data = '';
        sbsRes.on('data', chunk => data += chunk);
        sbsRes.on('end', () => resolve(data));
      });
      sbsReq.on('error', reject);
      sbsReq.setTimeout(6000, () => { sbsReq.destroy(); reject(new Error('Timeout SBS')); });
    });

    const afps = ['HABITAT', 'INTEGRA', 'PRIMA', 'PROFUTURO'];
    const trMatches = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];
    const results = [];

    for (const tr of trMatches) {
      const tdMatches = tr.match(/<td[\s\S]*?<\/td>/gi) || [];
      if (tdMatches.length >= 5) {
        const cleanTds = tdMatches.map(td => td.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
        const afpName = cleanTds[0].toUpperCase();
        if (afps.includes(afpName) && !results.some(r => r.afp === afpName)) {
          results.push({
            afp: afpName,
            flujo: cleanTds[1],
            saldo: cleanTds[2],
            prima: cleanTds[3],
            aporte: cleanTds[4]
          });
        }
      }
    }

    if (results.length === 4) {
      return res.json(results);
    }

    // Si la estructura cambió levemente, devolvemos el respaldo seguro
    return res.json(fallbackAfp);
  } catch (error) {
    console.log("Aviso SBS (usando respaldo seguro):", error.message);
    return res.json(fallbackAfp);
  }
});

// --- OBTENER USUARIOS ---
app.get('/empleados', async (req, res) => {
  try {
    // APLICAMOS UN LEFT JOIN PARA TRAER EL NOMBRE DEL ROL
    const [usuarios] = await pool.query(`
      SELECT u.*, r.nombre AS nombre_rol 
      FROM usuarios u 
      LEFT JOIN roles r ON u.id_rol = r.id_rol 
      ORDER BY u.id_usuario DESC
    `);
    
    const [hijos] = await pool.query(`SELECT * FROM usuario_hijos`);
    const usuariosConHijos = usuarios.map(user => ({ 
      ...user, 
      hijos: hijos.filter(h => h.id_usuario === user.id_usuario) 
    }));
    
    res.json(usuariosConHijos);
  } catch (error) { 
    res.status(500).json({ error: error.message }); 
  }
});


// --- CREAR USUARIO ---
app.post('/empleados', upload, async (req, res) => {
  const connection = await pool.getConnection(); 
  try {
    await connection.beginTransaction(); 
    const d = req.body;
    const dateOrNull = (val) => (val && val !== "") ? val : null;
    let cn = null, ca1 = null, ca2 = null, cfn = null;

    if (d.derechohabientes) {
      try {
        const f = JSON.parse(d.derechohabientes);
        if (f.esposa) { cn = f.esposa.nombres || null; ca1 = f.esposa.primerApellido || null; ca2 = f.esposa.segundoApellido || null; cfn = dateOrNull(f.esposa.nacimiento); }
      } catch(e) {}
    }

    // ATRAPAMOS LOS ARCHIVOS DE MULTER
    const getFile = (field) => req.files && req.files[field] ? req.files[field][0].filename : null;
    const foto = getFile('foto_personal');
    const cv = getFile('cv_pdf');
    const dniPdf = getFile('dni_pdf');
    const licenciaPdf = getFile('licencia_pdf');
    const reciboPdf = getFile('recibo_servicio_pdf');
    const certPdf = getFile('certificado_pdf');

    const [r] = await connection.query(`
      INSERT INTO usuarios (id_rol, tipo_documento, documento, ruc, sunat_estado, sunat_condicion, sunat_actividad, nombres, apellidos, primer_apellido, segundo_apellido, email, usuario, password, estado, telefono, fecha_ingreso, fecha_nacimiento, sexo, estado_civil, pais_nacimiento, direccion, distrito, sueldo, numero_emergencia, banco, cuenta_bancaria, cci, area, opcion_personal, cuadrilla, regimen_pensionario, tipo_comision_afp, cuspp, vencimiento_sctr, vencimiento_emo, categoria_licencia, numero_brevete, emision_brevete, fecha_vencimiento_brevete, talla_polo, talla_pantalon, talla_calzado, ultimo_empleo_1, ultimo_empleo_2, ultimo_empleo_3, emergencia_nombre, emergencia_parentesco, emergencia_telefono_2, emergencia_direccion, conyuge_nombres, conyuge_apellido1, conyuge_apellido2, conyuge_fecha_nacimiento, foto_personal, cv_pdf, dni_pdf, licencia_pdf, recibo_servicio_pdf, certificado_pdf) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      d.id_rol || null, d.tipoDocumento || "DNI", d.dni || "", d.ruc || "", d.estadoContribuyente || "", d.condicionContribuyente || "", d.actividadEconomica || "",
      d.nombres || "", d.apellidos || `${d.primerApellido || ""} ${d.segundoApellido || ""}`.trim(), d.primerApellido || "", d.segundoApellido || "", d.correo || "", d.usuario || "", d.password || d.dni,
      d.estado || "Activo", d.telefono || "", dateOrNull(d.fechaIngreso), dateOrNull(d.fechaNacimiento), d.sexo || null, d.estadoCivil || null, d.paisNacimiento || "Perú", d.direccion || "", d.distrito || "",d.sueldo || null,
      d.telefonoEmergencia || "", d.banco || "", d.cuenta || "", d.cci || "", d.area || "", d.opcionPersonal || "", d.cuadrilla || "",
      d.regimenPensionario || "", d.tipoComision || "", d.cuspp || "", dateOrNull(d.sctrVencimiento), dateOrNull(d.emoVencimiento),
      d.licencia || "Sin Licencia", d.numeroBrevete || "", dateOrNull(d.fechaEmisionLicencia), dateOrNull(d.fechaVencimientoLicencia),
      d.tallaPolo || "", d.tallaPantalon || "", d.tallaCalzado || "", d.ultimoEmpleo1 || "", d.ultimoEmpleo2 || "", d.ultimoEmpleo3 || "",
      d.contactoEmergencia || "", d.parentesco || "", d.telefonoAlternativo || "", d.direccionEmergencia || "", cn, ca1, ca2, cfn,
      foto, cv, dniPdf, licenciaPdf, reciboPdf, certPdf
    ]);

    if (d.derechohabientes) {
      try {
        const f = JSON.parse(d.derechohabientes);
        if (f.hijos && Array.isArray(f.hijos)) {
          for (let h of f.hijos) {
            if (h.nombres) await connection.query(`INSERT INTO usuario_hijos (id_usuario, nombres, apellido1, apellido2, fecha_nacimiento) VALUES (?, ?, ?, ?, ?)`, [r.insertId, h.nombres, h.primerApellido, h.segundoApellido, dateOrNull(h.nacimiento)]);
          }
        }
      } catch(e) {}
    }
    await connection.commit(); res.status(201).json({ message: "Empleado creado" });
  } catch (error) { await connection.rollback(); console.error(error); res.status(500).json({ error: error.message }); } finally { connection.release(); }
});

// --- ELIMINAR USUARIO ---
/*app.delete('/empleados/:id', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    await connection.beginTransaction();

    const [trabajadorRows] = await connection.query('SELECT id_trabajador FROM trabajadores WHERE id_usuario = ?', [id]);
    
    if (trabajadorRows.length > 0) {
      const idTrabajador = trabajadorRows[0].id_trabajador;
      await connection.query('DELETE FROM asistencias WHERE id_trabajador = ?', [idTrabajador]);
      await connection.query('DELETE FROM trabajador_series WHERE id_trabajador = ?', [idTrabajador]);
      await connection.query('DELETE FROM trabajador_productos WHERE id_trabajador = ?', [idTrabajador]);
      await connection.query('DELETE FROM trabajadores WHERE id_trabajador = ?', [idTrabajador]);
    }

    // SI NO TIENES "ON DELETE CASCADE" EN EL HISTORIAL, LO BORRAMOS AQUÍ:
    await connection.query('DELETE FROM historial_estados WHERE id_usuario = ?', [id]).catch(() => {});

    await connection.query('DELETE FROM usuario_hijos WHERE id_usuario = ?', [id]);
    await connection.query('DELETE FROM usuarios WHERE id_usuario = ?', [id]);

    await connection.commit();
    res.json({ message: "Empleado eliminado correctamente con todas sus dependencias" });
  } catch (error) { 
    await connection.rollback();
    console.error("Error al eliminar:", error); 
    res.status(500).json({ error: "No se pudo eliminar el empleado: " + error.message }); 
  } finally {
    connection.release();
  }
});*/


// --- ACTUALIZAR USUARIO ---
app.put('/empleados/:id', upload, async (req, res) => {
  const { id } = req.params; const d = req.body;
  const connection = await pool.getConnection(); 
  
  try {
    const dateOrNull = (val) => (val && val !== "") ? val : null;
    let cn = null, ca1 = null, ca2 = null, cfn = null;

    // 🚀 1. OBTENEMOS EL ESTADO ANTERIOR DE LA BASE DE DATOS
    const [usuarioActual] = await connection.query("SELECT estado FROM usuarios WHERE id_usuario = ?", [id]);
    const estadoAnterior = usuarioActual.length > 0 ? usuarioActual[0].estado : null;

    if (d.derechohabientes) {
      try {
        const f = typeof d.derechohabientes === 'string' ? JSON.parse(d.derechohabientes) : d.derechohabientes;
        if (f.esposa) { cn = f.esposa.nombres || null; ca1 = f.esposa.primerApellido || null; ca2 = f.esposa.segundoApellido || null; cfn = dateOrNull(f.esposa.nacimiento); }
      } catch(e) {}
    }

    let q = `UPDATE usuarios SET id_rol=?, tipo_documento=?, documento=?, ruc=?, sunat_estado=?, sunat_condicion=?, sunat_actividad=?, nombres=?, apellidos=?, primer_apellido=?, segundo_apellido=?, email=?, usuario=?, estado=?, telefono=?, fecha_ingreso=?, fecha_nacimiento=?, sexo=?, estado_civil=?, pais_nacimiento=?, direccion=?, distrito=?, sueldo=?, numero_emergencia=?, banco=?, cuenta_bancaria=?, cci=?, area=?, opcion_personal=?, cuadrilla=?, regimen_pensionario=?, tipo_comision_afp=?, cuspp=?, vencimiento_sctr=?, vencimiento_emo=?, categoria_licencia=?, numero_brevete=?, emision_brevete=?, fecha_vencimiento_brevete=?, talla_polo=?, talla_pantalon=?, talla_calzado=?, ultimo_empleo_1=?, ultimo_empleo_2=?, ultimo_empleo_3=?, emergencia_nombre=?, emergencia_parentesco=?, emergencia_telefono_2=?, emergencia_direccion=?, conyuge_nombres=?, conyuge_apellido1=?, conyuge_apellido2=?, conyuge_fecha_nacimiento=?`;
    const v = [d.id_rol||null, d.tipoDocumento||"DNI", d.dni||"", d.ruc||"", d.estadoContribuyente||"", d.condicionContribuyente||"", d.actividadEconomica||"", d.nombres||"", d.apellidos||`${d.primerApellido || ""} ${d.segundoApellido || ""}`.trim(), d.primerApellido||"", d.segundoApellido||"", d.correo||"", d.usuario||"", d.estado||"Activo", d.telefono||"", dateOrNull(d.fechaIngreso), dateOrNull(d.fechaNacimiento), d.sexo||null, d.estadoCivil||null, d.paisNacimiento||"Perú", d.direccion||"", d.distrito||"", d.sueldo || null, d.telefonoEmergencia||"", d.banco||"", d.cuenta||"", d.cci||"", d.area||"", d.opcionPersonal||"", d.cuadrilla||"", d.regimenPensionario||"", d.tipoComision||"", d.cuspp||"", dateOrNull(d.sctrVencimiento), dateOrNull(d.emoVencimiento), d.licencia||"Sin Licencia", d.numeroBrevete||"", dateOrNull(d.fechaEmisionLicencia), dateOrNull(d.fechaVencimientoLicencia), d.tallaPolo||"", d.tallaPantalon||"", d.tallaCalzado||"", d.ultimoEmpleo1||"", d.ultimoEmpleo2||"", d.ultimoEmpleo3||"", d.contactoEmergencia||"", d.parentesco||"", d.telefonoAlternativo||"", d.direccionEmergencia||"", cn, ca1, ca2, cfn];
    
    if (d.password && d.password.trim() !== "") { q += `, password=?`; v.push(d.password); }

    const getFile = (field) => req.files && req.files[field] ? req.files[field][0].filename : null;
    
    if (getFile('foto_personal')) { q += `, foto_personal=?`; v.push(getFile('foto_personal')); }
    if (getFile('cv_pdf')) { q += `, cv_pdf=?`; v.push(getFile('cv_pdf')); }
    if (getFile('dni_pdf')) { q += `, dni_pdf=?`; v.push(getFile('dni_pdf')); }
    if (getFile('licencia_pdf')) { q += `, licencia_pdf=?`; v.push(getFile('licencia_pdf')); }
    if (getFile('recibo_servicio_pdf')) { q += `, recibo_servicio_pdf=?`; v.push(getFile('recibo_servicio_pdf')); }
    if (getFile('certificado_pdf')) { q += `, certificado_pdf=?`; v.push(getFile('certificado_pdf')); }

    q += ` WHERE id_usuario=?`; v.push(id);
    await connection.query(q, v);

    // LÓGICA DE HIJOS
    if (d.derechohabientes) {
      try {
        const f = typeof d.derechohabientes === 'string' ? JSON.parse(d.derechohabientes) : d.derechohabientes;
        if (f.hijos && Array.isArray(f.hijos)) {
          await connection.query(`DELETE FROM usuario_hijos WHERE id_usuario = ?`, [id]);
          for (let h of f.hijos) {
            if (h.nombres) await connection.query(`INSERT INTO usuario_hijos (id_usuario, nombres, apellido1, apellido2, fecha_nacimiento) VALUES (?, ?, ?, ?, ?)`, [id, h.nombres, h.primerApellido, h.segundoApellido, dateOrNull(h.nacimiento)]);
          }
        }
      } catch(e) {}
    }
    

    // 🚀 2. SI EL ESTADO CAMBIÓ, LO GUARDAMOS EN EL HISTORIAL (¡Incluso los reingresos a Activo!)
    const nuevoEstado = d.estado || "Activo";
    
    if (nuevoEstado !== estadoAnterior) {
      await connection.query(
        `INSERT INTO historial_estados (id_usuario, estado_cambiado, fecha_inicio, fecha_fin, observacion) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          id, 
          nuevoEstado, 
          dateOrNull(d.estadoFechaInicio), 
          dateOrNull(d.estadoFechaFin), 
          d.estadoObservacion || (nuevoEstado === "Activo" ? "Retorno a actividades" : null)
        ]
      );
    }

    res.json({ message: "Usuario actualizado" });
  } catch (error) { 
    console.error(error);
    res.status(500).json({ error: error.message }); 
  } finally {
    connection.release();
  }
});

// --- OBTENER HISTORIAL DE ESTADOS DE UN EMPLEADO ---
app.get('/empleados/:id/historial', async (req, res) => {
  try {
    const { id } = req.params;
    // Traemos el historial ordenado desde el evento más reciente al más antiguo
    const [historial] = await pool.query(
      "SELECT * FROM historial_estados WHERE id_usuario = ? ORDER BY fecha_registro DESC", 
      [id]
    );
    res.json(historial);
  } catch (error) { 
    res.status(500).json({ error: error.message }); 
  }
});

app.get('/roles', async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT id_rol, nombre FROM roles WHERE estado = 'Activo'");
    res.json(rows);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ============================================================
// 📦 ENDPOINTS DEL MÓDULO DE ÓRDENES (TABLERO / GRID EN TIEMPO REAL)
// ============================================================

const {
  sincronizarFenix,
  obtenerOrdeVisiId,
  obtenerTareasOrden,
  obtenerDetalleTarea,
  obtenerImagenReal,
  obtenerHistorialEstados,
  extraerTiemposDeHistorial
} = require('./services/fenixScraper');

// --- 1. OBTENER TODAS LAS ÓRDENES (CON NOMBRE DE TÉCNICO VINCULADO Y FILTRO DE FECHAS) ---
app.get('/ordenes', async (req, res) => {
  try {
    const { fechaDesde, fechaHasta, cliente, search } = req.query;

    let whereClause = "";
    const params = [];

    if (cliente && cliente.trim()) {
      const cleanCli = cliente.trim();
      whereClause = `WHERE (o.cliente = ? OR o.cliente LIKE ? OR o.numero_documento = ?)`;
      params.push(cleanCli, `%${cleanCli}%`, cleanCli);
    } else if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      const dateFilters = [];
      const dateParams = [];

      if (fechaDesde && fechaHasta) {
        dateFilters.push(`(
          (o.fecha_solicitud >= ? AND o.fecha_solicitud <= ?)
          OR (o.fecha_solicitud IS NULL AND o.fecha_visita >= ? AND o.fecha_visita <= ?)
          OR (o.fecha_solicitud IS NULL AND o.fecha_visita IS NULL AND o.fecha_creacion >= ? AND o.fecha_creacion <= ?)
        )`);
        dateParams.push(
          `${fechaDesde} 00:00:00`, `${fechaHasta} 23:59:59`,
          `${fechaDesde} 00:00:00`, `${fechaHasta} 23:59:59`,
          `${fechaDesde} 00:00:00`, `${fechaHasta} 23:59:59`
        );
      } else if (fechaDesde) {
        dateFilters.push(`(
          o.fecha_solicitud >= ? 
          OR (o.fecha_solicitud IS NULL AND o.fecha_visita >= ?)
          OR (o.fecha_solicitud IS NULL AND o.fecha_visita IS NULL AND o.fecha_creacion >= ?)
        )`);
        dateParams.push(
          `${fechaDesde} 00:00:00`,
          `${fechaDesde} 00:00:00`,
          `${fechaDesde} 00:00:00`
        );
      }

      whereClause = `WHERE (
        o.cliente LIKE ? 
        OR o.numero_documento LIKE ? 
        OR o.numero LIKE ? 
        OR o.codigo_seguimiento LIKE ? 
        OR o.cod_seguimiento_cliente LIKE ? 
        OR o.tecnico_asignado LIKE ?
      ) ${dateFilters.length > 0 ? `AND ${dateFilters.join(' AND ')}` : ""}`;
      params.push(q, q, q, q, q, q, ...dateParams);
    } else if (fechaDesde && fechaHasta) {
      whereClause = `WHERE (
        COALESCE(o.fecha_solicitud, o.fecha_visita, o.hora_asignacion, o.inicio_visita, o.fecha_creacion) >= ?
        AND COALESCE(o.fecha_solicitud, o.fecha_visita, o.hora_asignacion, o.inicio_visita, o.fecha_creacion) <= ?
      )`;
      params.push(
        `${fechaDesde} 00:00:00`, `${fechaHasta} 23:59:59`
      );
    } else if (fechaDesde) {
      whereClause = `WHERE COALESCE(o.fecha_solicitud, o.fecha_visita, o.hora_asignacion, o.inicio_visita, o.fecha_creacion) >= ?`;
      params.push(`${fechaDesde} 00:00:00`);
    } else if (fechaHasta) {
      whereClause = `WHERE COALESCE(o.fecha_solicitud, o.fecha_visita, o.hora_asignacion, o.inicio_visita, o.fecha_creacion) <= ?`;
      params.push(`${fechaHasta} 23:59:59`);
    }

    const query = `
      SELECT 
        o.*,
        COALESCE(
          NULLIF(TRIM(o.tecnico_asignado), ''),
          NULLIF(TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''), ' ', COALESCE(u.segundo_apellido, ''))), '')
        ) AS nombre_tecnico,
        u.cuadrilla AS cuadrilla_tecnico,
        TRIM(CONCAT(COALESCE(u2.nombres, ''), ' ', COALESCE(u2.primer_apellido, u2.apellidos, ''), ' ', COALESCE(u2.segundo_apellido, ''))) AS nombre_tecnico_2
      FROM ordenes o
      LEFT JOIN usuarios u ON o.id_tecnico = u.id_usuario
      LEFT JOIN usuarios u2 ON o.id_tecnico_reemplazo = u2.id_usuario
      ${whereClause}
      ORDER BY 
        CASE WHEN nombre_tecnico IS NULL OR TRIM(nombre_tecnico) = '' THEN 1 ELSE 0 END,
        nombre_tecnico ASC, 
        o.id_orden DESC
    `;

    const [rows] = await pool.query(query, params);
    
    // Función de normalización exhaustiva (ignora tildes, mayúsculas, espacios dobles)
    const normalizeName = (str) => {
      if (!str) return '';
      return String(str)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    };

    let enriched = [];

    if (!whereClause) {
      // 1. Conteo rápido en una sola pasada O(N) para toda la base de datos
      const clientCounts = new Map();
      const docCounts = new Map();
      for (const r of rows) {
        if (r.cliente) {
          const k = normalizeName(r.cliente);
          clientCounts.set(k, (clientCounts.get(k) || 0) + 1);
        }
        if (r.numero_documento) {
          const d = String(r.numero_documento).trim();
          docCounts.set(d, (docCounts.get(d) || 0) + 1);
        }
      }

      enriched = rows.map(r => {
        const kName = normalizeName(r.cliente);
        const kDoc = r.numero_documento ? String(r.numero_documento).trim() : '';
        const count = Math.max(clientCounts.get(kName) || 1, docCounts.get(kDoc) || 1);
        return {
          ...r,
          total_ordenes_cliente: count,
          total_ordenes_mismo_tecnico: count,
          es_reiterada: count > 1,
          es_reiterada_tecnico: count > 1
        };
      });
    } else {
      // 2. Consulta de historial con índices O(1) para órdenes filtradas por fecha/técnico
      const clientNames = [...new Set(rows.map(r => r.cliente).filter(Boolean))];
      const docs = [...new Set(rows.map(r => r.numero_documento).filter(Boolean))];

      let historyRows = [];
      if (clientNames.length > 0 || docs.length > 0) {
        const [hist] = await pool.query(`
          SELECT id_orden, cliente, numero_documento, cuadrilla, tecnico_asignado, id_tecnico
          FROM ordenes
          WHERE cliente IN (?) OR numero_documento IN (?)
          ORDER BY id_orden DESC
        `, [clientNames.length > 0 ? clientNames : [''], docs.length > 0 ? docs : ['']]);
        historyRows = hist;
      }

      // Indexar historyRows en Maps O(1)
      const clientHistMap = new Map();
      const docHistMap = new Map();
      for (const h of historyRows) {
        if (h.cliente) {
          const k = normalizeName(h.cliente);
          if (!clientHistMap.has(k)) clientHistMap.set(k, []);
          clientHistMap.get(k).push(h);
        }
        if (h.numero_documento) {
          const d = String(h.numero_documento).trim();
          if (!docHistMap.has(d)) docHistMap.set(d, []);
          docHistMap.get(d).push(h);
        }
      }

      enriched = rows.map(r => {
        const kName = normalizeName(r.cliente);
        const kDoc = r.numero_documento ? String(r.numero_documento).trim() : '';

        const tecRef = (r.nombre_tecnico || r.tecnico_asignado || r.cuadrilla || r.cuadrilla_tecnico || '').toLowerCase();
        const tecTokens = tecRef.split(/\s+/).filter(t => t.length > 3 && !['cespedes', 'sga', 'motowin'].includes(t));

        // Historial completo del cliente usando Map O(1)
        const clienteHist = (kName && clientHistMap.get(kName)) || (kDoc && docHistMap.get(kDoc)) || [];
        const totalClienteGeneral = Math.max(1, clienteHist.length);

        // Mismo técnico
        let totalMismoTecnico = 1;
        if (clienteHist.length > 1) {
          const matching = clienteHist.filter(h => {
            if (r.id_tecnico && h.id_tecnico && String(r.id_tecnico) === String(h.id_tecnico)) return true;
            const hTecRef = (h.tecnico_asignado || h.cuadrilla || '').toLowerCase();
            if (tecTokens.length > 0) {
              return tecTokens.some(tok => hTecRef.includes(tok));
            }
            return false;
          });
          totalMismoTecnico = Math.max(1, matching.length);
        }

        return {
          ...r,
          total_ordenes_cliente: totalClienteGeneral,
          total_ordenes_mismo_tecnico: totalMismoTecnico,
          es_reiterada: totalClienteGeneral > 1,
          es_reiterada_tecnico: totalMismoTecnico > 1
        };
      });
    }

    res.json(enriched);
  } catch (error) {
    console.error("Error al consultar ordenes en BD:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// --- 1.1 SINCRONIZAR ÓRDENES CON WIN / FÉNIX (SCRAPER EN TIEMPO REAL CON CANDADO Y TIMEOUT ANTI-SATURACIÓN) ---
let estaSincronizandoFenix = false;
let ultimoErrorFenixTime = 0;

app.post('/ordenes/sincronizar-win', async (req, res) => {
  // 1. Candado Anti-Duplicados: si ya hay una sincronización corriendo, no duplicar procesos
  if (estaSincronizandoFenix) {
    return res.json({ 
      success: true, 
      warning: "Ya hay una sincronización en curso. Petición omitida para proteger recursos.",
      status: "SYNC_IN_PROGRESS" 
    });
  }

  // 2. Cooldown: Si Fénix falló hace menos de 60 segundos, responder rápido sin saturar
  if (Date.now() - ultimoErrorFenixTime < 60000) {
    return res.json({
      success: false,
      warning: "Fénix se encuentra temporalmente inaccesible. Reintentando en breve.",
      status: "COOLDOWN"
    });
  }

  try {
    estaSincronizandoFenix = true;
    const { fechaDesde, fechaHasta } = req.body || {};

    // Timeout máximo de seguridad: Si Fénix tarda más de 40 segundos, cortar de inmediato
    const timeoutSeguridad = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Timeout de seguridad: Fénix tardó más de 40s en responder")), 40000)
    );

    const resultado = await Promise.race([
      sincronizarFenix({ fechaDesde, fechaHasta }),
      timeoutSeguridad
    ]);

    ultimoErrorFenixTime = 0;
    res.json(resultado);
  } catch (error) {
    ultimoErrorFenixTime = Date.now();
    console.error("❌ Error o timeout en sincronización Fénix:", error.message);
    res.status(500).json({ error: error.message });
  } finally {
    estaSincronizandoFenix = false; // Siempre liberar el candado
  }
});

// --- 1.2 OBTENER TAREAS EN TIEMPO REAL DE UNA ORDEN (MODAL DE FÉNIX) ---
app.get('/ordenes/:numero/tareas', async (req, res) => {
  try {
    const { numero } = req.params;
    const ordeVisiId = await obtenerOrdeVisiId(numero);
    if (!ordeVisiId) {
      return res.json({ success: true, numero, ordeVisiId: null, tareas: [] });
    }
    const tareas = await obtenerTareasOrden(ordeVisiId);
    res.json({ success: true, numero, ordeVisiId, tareas });
  } catch (error) {
    console.error("Error al obtener tareas de la orden:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- 1.3 OBTENER DETALLE DE UNA TAREA ESPECÍFICA (FOTOS, COORDENADAS, TIEMPOS) ---
app.post('/ordenes/tarea-detalle', async (req, res) => {
  try {
    const { idTarea, index } = req.body || {};
    const detalle = await obtenerDetalleTarea(idTarea, index);
    res.json({ success: true, detalle });
  } catch (error) {
    console.error("Error al obtener detalle de tarea:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- 1.3.1 OBTENER FOTO EN ALTA RESOLUCIÓN DE UNA TAREA (FÉNIX OBTENERIMAGEN) ---
app.post('/ordenes/tarea-imagen', async (req, res) => {
  try {
    const { dataId, opcion, titulo } = req.body || {};
    if (!dataId) {
      return res.status(400).json({ success: false, message: 'dataId es requerido' });
    }
    const imagen = await obtenerImagenReal(dataId, opcion || 1, titulo || '');
    if (!imagen) {
      return res.status(404).json({ success: false, message: 'No se encontró la imagen en Fénix' });
    }
    res.json({ success: true, imagen });
  } catch (error) {
    console.error("Error al obtener imagen en alta resolución:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- 1.4 OBTENER HISTORIAL DE ESTADOS DE UNA ORDEN (Y ENRIQUECER HORARIOS) ---
app.get('/ordenes/:numero/historial-estados', async (req, res) => {
  try {
    const { numero } = req.params;
    const historial = await obtenerHistorialEstados(numero);
    
    // Si se obtuvieron hitos de tiempo, enriquecer automáticamente la BD si estaban nulos
    if (historial && historial.length > 0) {
      const tiempos = extraerTiemposDeHistorial(historial);
      if (tiempos.horaEnCamino || tiempos.inicioVisita || tiempos.finVisita || tiempos.horaAsignacion) {
        await pool.query(
          `UPDATE ordenes 
           SET 
             hora_en_camino = COALESCE(hora_en_camino, ?),
             inicio_visita = COALESCE(inicio_visita, ?),
             fin_visita = COALESCE(fin_visita, ?),
             hora_asignacion = COALESCE(hora_asignacion, ?)
           WHERE numero = ? OR id_orden = ?`,
          [
            tiempos.horaEnCamino,
            tiempos.inicioVisita,
            tiempos.finVisita,
            tiempos.horaAsignacion,
            numero,
            numero
          ]
        ).catch(() => {});
      }
    }
    
    res.json({ success: true, numero, historial });
  } catch (error) {
    console.error("Error al obtener historial de estados:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- 2. ASIGNAR TÉCNICO A UNA ORDEN ---
app.put('/ordenes/:id/tecnico', async (req, res) => {
  try {
    const { id } = req.params;
    const { id_tecnico, id_tecnico_reemplazo, tecnico, numero } = req.body || {};
    const searchParam = numero || id;

    let finalIdTecnico = id_tecnico || null;
    let finalIdTecnico2 = id_tecnico_reemplazo || null;
    let nombreTitularGuardar = null;

    if (!tecnico || tecnico === "" || tecnico === "-- Seleccione --") {
      finalIdTecnico = null;
      finalIdTecnico2 = null;
      nombreTitularGuardar = null;
    } else if (tecnico) {
      const parts = String(tecnico)
        .split(/\s*[\/,+]\s*|\s+y\s+/i)
        .map(t => t.trim())
        .filter(t => t && t !== "-- Seleccione --" && t !== "-");

      const t1Name = parts[0] || null;
      const t2Name = parts[1] || null;

      nombreTitularGuardar = t1Name || tecnico;

      // Cargar lista de usuarios para resolver IDs con máxima precisión
      let allUsers = [];
      try {
        const [uRows] = await pool.query("SELECT id_usuario, nombres, apellidos, primer_apellido, segundo_apellido FROM usuarios");
        allUsers = uRows || [];
      } catch (e) {}

      const resolveUserId = (nameToFind) => {
        if (!nameToFind || nameToFind.length < 3 || !allUsers.length) return null;
        const norm = nameToFind.toUpperCase().trim();
        const found = allUsers.find((u) => {
          const full1 = `${u.nombres || ''} ${u.apellidos || ''}`.toUpperCase().trim();
          const full2 = `${u.nombres || ''} ${u.primer_apellido || ''} ${u.segundo_apellido || ''}`.toUpperCase().trim();
          if (full1 && (norm === full1 || norm.includes(full1) || full1.includes(norm))) return true;
          if (full2 && (norm === full2 || norm.includes(full2) || full2.includes(norm))) return true;

          const nameParts = (u.nombres || '').toUpperCase().split(/\s+/).filter(p => p.length > 2);
          const apeParts = (u.apellidos || u.primer_apellido || '').toUpperCase().split(/\s+/).filter(p => p.length > 2);
          const hasName = nameParts.some(p => norm.includes(p));
          const hasApe = apeParts.some(p => norm.includes(p));
          return hasName && hasApe;
        });
        return found ? found.id_usuario : null;
      };

      if (!finalIdTecnico && t1Name) {
        finalIdTecnico = resolveUserId(t1Name);
      }
      if (!finalIdTecnico2 && t2Name) {
        finalIdTecnico2 = resolveUserId(t2Name);
      }
    }

    // Actualizar en tabla ordenes: id_tecnico (T1), id_tecnico_reemplazo (T2) y tecnico_asignado (solo Titular T1)
    await pool.query(
      `UPDATE ordenes 
       SET id_tecnico = ?, id_tecnico_reemplazo = ?, tecnico_asignado = ?
       WHERE id_orden = ? OR numero = ?`,
      [finalIdTecnico || null, finalIdTecnico2 || null, nombreTitularGuardar || null, id, searchParam]
    );

    res.json({
      success: true,
      message: "Técnico(s) asignado(s) correctamente",
      id_tecnico: finalIdTecnico,
      id_tecnico_reemplazo: finalIdTecnico2,
      tecnico_asignado: nombreTitularGuardar
    });
  } catch (error) {
    console.error("Error al asignar técnico en BD:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// --- 3. ACTUALIZAR LLAMADA INCONCERT DE UNA ORDEN ---
app.put('/ordenes/:id/inconcert', async (req, res) => {
  try {
    const { id } = req.params;
    const { inconcert, llamada_inconcert, numero } = req.body || {};
    
    // Normalizar a 'Si' / 'No'
    const isSi = 
      llamada_inconcert === true || 
      llamada_inconcert === 'Si' || 
      llamada_inconcert === 'SI' || 
      llamada_inconcert === 'Sí' || 
      llamada_inconcert === 1 || 
      llamada_inconcert === '1' ||
      inconcert === true || 
      inconcert === 'Si' || 
      inconcert === 'SI' || 
      inconcert === 'Sí' || 
      inconcert === 1 || 
      inconcert === '1';

    const valStr = isSi ? 'Si' : 'No';
    const searchParam = numero || id;

    // Actualizar en MySQL
    await pool.query(
      `UPDATE ordenes 
       SET llamada_inconcert = ? 
       WHERE id_orden = ? OR numero = ?`,
      [valStr, id, searchParam]
    );

    res.json({ success: true, message: "Llamada Inconcert actualizada correctamente", valor: valStr });
  } catch (error) {
    console.error("Error al actualizar Inconcert en BD:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// --- 3.1 ACTUALIZAR OBSERVACIÓN DE LLAMADA DE UNA ORDEN ---
app.put('/ordenes/:id/observacion-llamada', async (req, res) => {
  try {
    const { id } = req.params;
    const { observacionLlamada, observacion_llamada, numero } = req.body || {};
    const valor = observacionLlamada !== undefined ? observacionLlamada : observacion_llamada;
    const searchParam = numero || id;
    
    try {
      await pool.query(
        `UPDATE ordenes 
         SET observacion_llamada = ? 
         WHERE id_orden = ? OR numero = ?`,
        [valor || null, id, searchParam]
      );
    } catch (e) {
      await pool.query("ALTER TABLE ordenes ADD COLUMN observacion_llamada TEXT DEFAULT NULL AFTER llamada_inconcert").catch(() => {});
      await pool.query(
        `UPDATE ordenes 
         SET observacion_llamada = ? 
         WHERE id_orden = ? OR numero = ?`,
        [valor || null, id, searchParam]
      );
    }
    res.json({ success: true, message: "Observación de llamada actualizada correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- 3.2 ACTUALIZAR OBSERVACIONES DE LA ATENCIÓN DE UNA ORDEN ---
app.put('/ordenes/:id/observaciones-atencion', async (req, res) => {
  try {
    const { id } = req.params;
    const { observacionesAtencion, observaciones_atencion, observacion, numero } = req.body || {};
    const valor = observacionesAtencion !== undefined ? observacionesAtencion : (observaciones_atencion !== undefined ? observaciones_atencion : observacion);
    const searchParam = numero || id;
    
    try {
      await pool.query(
        `UPDATE ordenes 
         SET observaciones_atencion = ? 
         WHERE id_orden = ? OR numero = ?`,
        [valor || null, id, searchParam]
      );
    } catch (e) {
      await pool.query("ALTER TABLE ordenes ADD COLUMN observaciones_atencion TEXT DEFAULT NULL").catch(() => {});
      await pool.query(
        `UPDATE ordenes 
         SET observaciones_atencion = ? 
         WHERE id_orden = ? OR numero = ?`,
        [valor || null, id, searchParam]
      );
    }
    res.json({ success: true, message: "Observaciones de la atención actualizadas correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Auto-crear columnas observacion_llamada y observaciones_atencion si no existen
(async () => {
  try {
    const [cols1] = await pool.query("SHOW COLUMNS FROM ordenes LIKE 'observacion_llamada'");
    if (cols1.length === 0) {
      await pool.query("ALTER TABLE ordenes ADD COLUMN observacion_llamada TEXT DEFAULT NULL AFTER llamada_inconcert");
      console.log("✅ [DB] Columna 'observacion_llamada' creada exitosamente en tabla 'ordenes'.");
    }

    const [cols2] = await pool.query("SHOW COLUMNS FROM ordenes LIKE 'observaciones_atencion'");
    if (cols2.length === 0) {
      await pool.query("ALTER TABLE ordenes ADD COLUMN observaciones_atencion TEXT DEFAULT NULL");
      console.log("✅ [DB] Columna 'observaciones_atencion' creada exitosamente en tabla 'ordenes'.");
    }

    const [cols3] = await pool.query("SHOW COLUMNS FROM ordenes LIKE 'tipo_trabajo_asignado'");
    if (cols3.length === 0) {
      await pool.query("ALTER TABLE ordenes ADD COLUMN tipo_trabajo_asignado VARCHAR(255) DEFAULT NULL");
      await pool.query("UPDATE ordenes SET tipo_trabajo_asignado = tipo_trabajo WHERE tipo_trabajo_asignado IS NULL AND tipo_trabajo IS NOT NULL").catch(() => {});
      console.log("✅ [DB] Columna 'tipo_trabajo_asignado' creada exitosamente en tabla 'ordenes'.");
    }

    const [cols4] = await pool.query("SHOW COLUMNS FROM ordenes LIKE 'cod_seguimiento_cliente'");
    if (cols4.length === 0) {
      await pool.query("ALTER TABLE ordenes ADD COLUMN cod_seguimiento_cliente VARCHAR(255) DEFAULT NULL AFTER codigo_seguimiento");
      console.log("✅ [DB] Columna 'cod_seguimiento_cliente' creada exitosamente en tabla 'ordenes'.");
    }

    const [cols5] = await pool.query("SHOW COLUMNS FROM ordenes LIKE 'tecnico_asignado'");
    if (cols5.length === 0) {
      await pool.query("ALTER TABLE ordenes ADD COLUMN tecnico_asignado VARCHAR(255) DEFAULT NULL");
      console.log("✅ [DB] Columna 'tecnico_asignado' creada exitosamente en tabla 'ordenes'.");
    }

    const [cols6] = await pool.query("SHOW COLUMNS FROM ordenes LIKE 'id_tecnico_reemplazo'");
    if (cols6.length === 0) {
      await pool.query("ALTER TABLE ordenes ADD COLUMN id_tecnico_reemplazo INT(11) DEFAULT NULL AFTER id_tecnico");
      console.log("✅ [DB] Columna 'id_tecnico_reemplazo' creada exitosamente en tabla 'ordenes'.");
    }
  } catch (e) {}
})();

// --- 5. OBTENER TIPOS DE TRABAJO (TABLA tipos_trabajo) ---
app.get('/tipos-trabajo', async (req, res) => {
  try {
    let rows = [];
    try {
      const [r] = await pool.query("SELECT * FROM tipos_trabajo WHERE estado = 'Activo' ORDER BY nombre ASC");
      rows = r;
    } catch (e1) {
      try {
        const [r] = await pool.query("SELECT * FROM tipos_trabajo ORDER BY 2 ASC");
        rows = r;
      } catch (e1b) {
        try {
          const [r] = await pool.query("SELECT * FROM tipo_trabajo ORDER BY 2 ASC");
          rows = r;
        } catch (e2) {
          try {
            const [r] = await pool.query("SELECT DISTINCT tipo_trabajo as nombre FROM ordenes WHERE tipo_trabajo IS NOT NULL AND tipo_trabajo != '' ORDER BY tipo_trabajo ASC");
            rows = r;
          } catch (e3) {}
        }
      }
    }
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- 5.0 OBTENER MOTIVOS / TIPOS DE LIQUIDACIÓN Y LÍMITES DE MATERIALES (TABLA motivos) ---
app.get(['/api/motivos', '/motivos'], async (req, res) => {
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

// --- 5.1 ACTUALIZAR TIPO DE TRABAJO DE UNA ORDEN ---
app.put('/ordenes/:id/tipo-trabajo', async (req, res) => {
  try {
    const { id } = req.params;
    const { tipoTrabajo, tipo_trabajo, numero } = req.body || {};
    const valor = tipoTrabajo !== undefined ? tipoTrabajo : tipo_trabajo;
    const searchParam = numero || id;
    await pool.query(
      `UPDATE ordenes 
       SET tipo_trabajo_asignado = COALESCE(tipo_trabajo_asignado, tipo_trabajo),
           tipo_trabajo = ? 
       WHERE id_orden = ? OR numero = ?`,
      [valor || null, id, searchParam]
    );
    res.json({ success: true, message: "Tipo de trabajo actualizado correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- 4. OBTENER LISTA DE TÉCNICOS / TRABAJADORES ACTIVOS ---
app.get('/tecnicos', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        u.id_usuario AS id_tecnico,
        u.id_usuario,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''), ' ', COALESCE(u.segundo_apellido, ''))) AS nombre_completo,
        COALESCE(u.cuadrilla, '') AS cuadrilla,
        COALESCE(u.telefono, '') AS telefono,
        r.nombre AS nombre_rol
      FROM usuarios u
      LEFT JOIN roles r ON u.id_rol = r.id_rol
      WHERE (u.estado = 'Activo' OR u.estado = 1 OR u.estado IS NULL)
        AND (r.nombre LIKE '%Tecnico%' OR r.nombre LIKE '%Técnico%' OR u.opcion_personal LIKE '%Tecnic%' OR u.opcion_personal LIKE '%Técnico%' OR u.area LIKE '%Tecnic%' OR u.area LIKE '%Operacion%' OR r.nombre IS NULL)
      ORDER BY nombre_completo ASC
    `);

    const tecnicos = rows.map(u => ({
      idTecnico: u.id_tecnico,
      id_tecnico: u.id_tecnico,
      id_usuario: u.id_usuario,
      nombreCompleto: u.nombre_completo.trim() || `Técnico #${u.id_usuario}`,
      nombre_completo: u.nombre_completo.trim() || `Técnico #${u.id_usuario}`,
      cuadrilla: u.cuadrilla || '',
      telefono: u.telefono || ''
    }));

    res.json(tecnicos);
  } catch (error) {
    console.error("Error al obtener técnicos:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ==============================================================================
// 🚗 AUTO-MIGRACIÓN PARA TABLAS DE MOVILIDAD Y CONTROL DE VEHÍCULOS
// ==============================================================================
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`vehiculo_inspecciones\` (
        \`id_inspeccion\` INT AUTO_INCREMENT PRIMARY KEY,
        \`id_vehiculo\` INT NOT NULL,
        \`id_trabajador\` INT NOT NULL,
        \`fecha\` DATE NOT NULL,
        \`km_inicio\` INT NULL,
        \`hora_inicio\` TIME NULL,
        \`foto_tablero_inicio\` VARCHAR(255) NULL,
        \`foto_aceite\` VARCHAR(255) NULL,
        \`foto_agua\` VARCHAR(255) NULL,
        \`foto_estado_general\` VARCHAR(255) NULL,
        \`km_fin\` INT NULL,
        \`hora_fin\` TIME NULL,
        \`foto_tablero_fin\` VARCHAR(255) NULL,
        \`km_recorridos\` INT NULL,
        \`km_estimados_ordenes\` DECIMAL(8,2) DEFAULT 0.00,
        \`diferencia_km\` DECIMAL(8,2) DEFAULT 0.00,
        \`observaciones_tecnico\` TEXT NULL,
        \`estado_auditoria\` ENUM('Pendiente', 'Aprobado', 'Observado') DEFAULT 'Pendiente',
        \`observaciones_admin\` TEXT NULL,
        \`fecha_auditoria\` DATETIME NULL,
        \`fecha_creacion\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_fecha (\`fecha\`),
        INDEX idx_vehiculo (\`id_vehiculo\`),
        INDEX idx_trabajador (\`id_trabajador\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`vehiculo_combustibles\` (
        \`id_combustible_registro\` INT AUTO_INCREMENT PRIMARY KEY,
        \`id_vehiculo\` INT NOT NULL,
        \`id_trabajador\` INT NULL,
        \`fecha_carga\` DATETIME NOT NULL,
        \`tipo_combustible\` VARCHAR(50) NOT NULL,
        \`monto_total\` DECIMAL(10,2) NOT NULL,
        \`galones_m3\` DECIMAL(10,2) NOT NULL,
        \`km_momento_carga\` INT NOT NULL,
        \`grifo_estacion\` VARCHAR(150) NULL,
        \`numero_comprobante\` VARCHAR(50) NULL,
        \`tipo_comprobante\` VARCHAR(50) DEFAULT 'Factura',
        \`foto_comprobante\` VARCHAR(255) NULL,
        \`rendimiento_km_galon\` DECIMAL(8,2) NULL,
        \`registrado_por\` VARCHAR(100) NULL,
        \`observaciones\` TEXT NULL,
        \`fecha_creacion\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_fecha_carga (\`fecha_carga\`),
        INDEX idx_vehiculo (\`id_vehiculo\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`vehiculo_asignaciones\` (
        \`id_asignacion\` INT AUTO_INCREMENT PRIMARY KEY,
        \`id_vehiculo\` INT NOT NULL,
        \`id_trabajador\` INT NOT NULL,
        \`fecha_inicio\` DATETIME NOT NULL,
        \`fecha_fin\` DATETIME NULL,
        \`motivo_cambio\` VARCHAR(255) NULL,
        \`estado\` ENUM('Activa', 'Finalizada') DEFAULT 'Activa',
        \`registrado_por\` VARCHAR(100) NULL,
        \`fecha_creacion\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("✅ [DB] Tablas de Movilidad inicializadas correctamente.");
  } catch (e) {
    console.error("⚠️ [DB] Aviso al verificar tablas de movilidad:", e.message);
  }
})();

// Multer específico para inspecciones y combustible
const uploadInspeccion = multer({ storage: storage }).fields([
  { name: 'foto_tablero_inicio', maxCount: 1 },
  { name: 'foto_aceite', maxCount: 1 },
  { name: 'foto_agua', maxCount: 1 },
  { name: 'foto_estado_general', maxCount: 1 },
  { name: 'foto_tablero_fin', maxCount: 1 },
  { name: 'foto_comprobante', maxCount: 1 }
]);

// Helper para calcular distancia Haversine entre 2 puntos (km)
function calcularDistanciaHaversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radio de la tierra en KM
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Base central por defecto (Lima Central / Callao)
const BASE_LAT = -12.046374;
const BASE_LNG = -77.042793;

// --- 🚗 1. LISTAR VEHÍCULOS CON TÉCNICO ASIGNADO ---
app.get('/api/movilidad/vehiculos', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        v.id_vehiculo,
        v.placa,
        v.anio,
        v.transmision,
        v.color,
        v.estado,
        v.observaciones,
        m.nombre AS marca,
        mo.nombre AS modelo,
        tv.nombre AS tipo_vehiculo,
        c.nombre AS combustible,
        t.id_trabajador,
        u.id_usuario,
        COALESCE(
          NULLIF(TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''), ' ', COALESCE(u.segundo_apellido, ''))), ''),
          'Sin asignar'
        ) AS tecnico_asignado,
        COALESCE(u.cuadrilla, '') AS cuadrilla,
        (SELECT MAX(km_fin) FROM vehiculo_inspecciones WHERE id_vehiculo = v.id_vehiculo) AS ultimo_km
      FROM vehiculos v
      LEFT JOIN marcas m ON v.id_marca = m.id_marca
      LEFT JOIN modelos mo ON v.id_modelo = mo.id_modelo
      LEFT JOIN tipos_vehiculo tv ON v.id_tipo_vehiculo = tv.id_tipo_vehiculo
      LEFT JOIN combustibles c ON v.id_combustible = c.id_combustible
      LEFT JOIN trabajadores t ON v.id_vehiculo = t.id_vehiculo AND (t.estado = 'Activo' OR t.estado IS NULL)
      LEFT JOIN usuarios u ON t.id_usuario = u.id_usuario
      ORDER BY v.placa ASC
    `);

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- 🚗 2. LISTAR TÉCNICOS PARA ASIGNACIÓN / CHECKLIST ---
app.get(['/api/movilidad/tecnicos', '/api/movilidad/tecnicos-flota'], async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        t.id_trabajador,
        u.id_usuario,
        u.documento,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''), ' ', COALESCE(u.segundo_apellido, ''))) AS nombre_completo,
        COALESCE(u.cuadrilla, '') AS cuadrilla,
        COALESCE(u.telefono, '') AS telefono,
        COALESCE(t.id_vehiculo, va.id_vehiculo) AS id_vehiculo,
        COALESCE(v.placa, va.placa, '') AS vehiculo_placa,
        COALESCE(v.marca, va.marca, '') AS vehiculo_marca,
        COALESCE(v.modelo, va.modelo, '') AS vehiculo_modelo
      FROM trabajadores t
      JOIN usuarios u ON t.id_usuario = u.id_usuario
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
      WHERE (u.id_rol = 2 OR UPPER(COALESCE(r.nombre, '')) LIKE '%TECNIC%')
        AND (t.estado = 'Activo' OR t.estado IS NULL)
        AND (u.estado = 'Activo' OR u.estado IS NULL)
      GROUP BY u.id_usuario
      ORDER BY nombre_completo ASC
    `);

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- 🚗 3. REASIGNAR VEHÍCULO A TÉCNICO (ADMIN) ---
app.put('/api/movilidad/reasignar-vehiculo', async (req, res) => {
  try {
    const { id_vehiculo, id_trabajador, motivo_cambio } = req.body;
    if (!id_vehiculo) {
      return res.status(400).json({ error: "id_vehiculo es requerido" });
    }

    // 1. Quitar vehículo de cualquier trabajador anterior
    await pool.query("UPDATE trabajadores SET id_vehiculo = NULL WHERE id_vehiculo = ?", [id_vehiculo]);

    // 2. Si se asigna a un nuevo trabajador
    if (id_trabajador) {
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

// --- 🚗 4. REGISTRAR CHECKLIST INICIO JORNADA (TÉCNICO 7:00 AM) ---
app.post('/api/movilidad/inspeccion/inicio', uploadInspeccion, async (req, res) => {
  try {
    const { id_vehiculo, id_trabajador, fecha, km_inicio, hora_inicio, observaciones_tecnico, lat_inicio, lng_inicio } = req.body;

    if (!id_vehiculo || !id_trabajador) {
      return res.status(400).json({ error: "id_vehiculo y id_trabajador son requeridos" });
    }

    const fechaInspeccion = fecha || new Date().toISOString().slice(0, 10);
    const horaInicio = hora_inicio || new Date().toTimeString().slice(0, 8);

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
      // Actualizar registro del día
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
          observaciones_tecnico = COALESCE(?, observaciones_tecnico)
        WHERE id_inspeccion = ?
      `, [id_trabajador, km_inicio, horaInicio, lat_inicio || null, lng_inicio || null, foto_tablero_inicio, foto_aceite, foto_agua, foto_estado_general, observaciones_tecnico, existente[0].id_inspeccion]);

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
        observaciones_tecnico, estado_auditoria
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendiente')
    `, [id_vehiculo, id_trabajador, fechaInspeccion, km_inicio, horaInicio, lat_inicio || null, lng_inicio || null, foto_tablero_inicio, foto_aceite, foto_agua, foto_estado_general, observaciones_tecnico]);

    if (lat_inicio && lng_inicio) {
      await registrarLogGps(id_trabajador, id_vehiculo, Number(lat_inicio), Number(lng_inicio), 'CHECKLIST_INICIO', 'INSP-INICIO', 'Checklist de Inicio de Jornada');
    }

    res.json({ success: true, message: "Inspección de inicio registrada correctamente", id_inspeccion: insertResult.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- 🚗 5. REGISTRAR CHECKLIST FIN JORNADA (TÉCNICO 7:00 PM) ---
app.post('/api/movilidad/inspeccion/fin', uploadInspeccion, async (req, res) => {
  try {
    const { id_inspeccion, id_vehiculo, id_trabajador, fecha, km_fin, hora_fin, observaciones_tecnico, lat_fin, lng_fin } = req.body;

    const horaFin = hora_fin || new Date().toTimeString().slice(0, 8);
    const foto_tablero_fin = req.files && req.files['foto_tablero_fin'] ? req.files['foto_tablero_fin'][0].filename : null;

    let targetId = id_inspeccion;
    if (!targetId) {
      const fechaHoy = fecha || new Date().toISOString().slice(0, 10);
      const [found] = await pool.query(
        "SELECT id_inspeccion, km_inicio FROM vehiculo_inspecciones WHERE (id_vehiculo = ? OR id_trabajador = ?) AND fecha = ? ORDER BY id_inspeccion DESC LIMIT 1",
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
        lat_fin = ?,
        lng_fin = ?,
        foto_tablero_fin = COALESCE(?, foto_tablero_fin),
        km_recorridos = ?,
        km_estimados_ordenes = ?,
        diferencia_km = ?,
        observaciones_tecnico = CONCAT(COALESCE(observaciones_tecnico, ''), ' | Fin: ', COALESCE(?, ''))
      WHERE id_inspeccion = ?
    `, [kmFinNum, horaFin, lat_fin || null, lng_fin || null, foto_tablero_fin, kmRecorridos, kmEstimadosOrdenes, diferenciaKm, observaciones_tecnico, targetId]);

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

// --- 🚗 6. LISTAR INSPECCIONES DIARIAS (PANEL ADMIN) ---
app.get('/api/movilidad/inspecciones', async (req, res) => {
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
        u.telefono
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

// --- 🚗 7. AUDITAR / APROBAR / OBSERVAR INSPECCIÓN (ADMIN) ---
app.put('/api/movilidad/inspecciones/:id/auditar', async (req, res) => {
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

// --- ⛽ 8. REGISTRAR CARGA DE COMBUSTIBLE (ADMIN) ---
app.post('/api/movilidad/combustible', uploadInspeccion, async (req, res) => {
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

    // Calcular rendimiento con la carga anterior si existe
    let rendimiento = null;
    const [anterior] = await pool.query(
      "SELECT km_momento_carga FROM vehiculo_combustibles WHERE id_vehiculo = ? AND km_momento_carga < ? ORDER BY km_momento_carga DESC LIMIT 1",
      [id_vehiculo, km_momento_carga]
    );

    if (anterior.length > 0) {
      const kmDelta = Number(km_momento_carga) - Number(anterior[0].km_momento_carga);
      const galones = Number(galones_m3);
      if (galones > 0 && kmDelta > 0) {
        rendimiento = Math.round((kmDelta / galones) * 100) / 100;
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

// --- ⛽ 9. LISTAR CARGAS DE COMBUSTIBLE ---
app.get('/api/movilidad/combustible', async (req, res) => {
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

// --- ⛽ 10. ELIMINAR CARGA DE COMBUSTIBLE ---
app.delete('/api/movilidad/combustible/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM vehiculo_combustibles WHERE id_combustible_registro = ?", [id]);
    res.json({ success: true, message: "Registro de combustible eliminado" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- 📊 11. DASHBOARD DE KILOMETRAJE Y CRUCE DE RUTAS CON ÓRDENES ---
// --- 📊 11. DASHBOARD DE KILOMETRAJE Y CRUCE DE RUTAS CON ÓRDENES ---
app.get('/api/movilidad/dashboard-km', async (req, res) => {
  try {
    const { fecha_desde, fecha_hasta } = req.query;

    const fDesde = fecha_desde || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const fHasta = fecha_hasta || new Date().toISOString().slice(0, 10);
    const hoyStr = new Date().toISOString().slice(0, 10);
    const ahoraMinutos = new Date().getHours() * 60 + new Date().getMinutes();

    // 1. Inspecciones explícitas enviadas en checklist
    const [inspecciones] = await pool.query(`
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
    `, [fDesde, fHasta]);

    // 2. Todos los trabajadores y técnicos con vehículos asignados
    const [allWorkers] = await pool.query(`
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
    `);

    // 3. Órdenes del rango de fechas para calcular ruta y KM estimados por cuadrilla
    const [ordenesRango] = await pool.query(`
      SELECT 
        DATE(COALESCE(fecha_solicitud, fecha_visita, fecha_creacion)) as fecha_orden,
        cuadrilla,
        tecnico_asignado,
        id_tecnico,
        georeferencia,
        direccion
      FROM ordenes
      WHERE (DATE(fecha_solicitud) BETWEEN ? AND ?)
         OR (DATE(fecha_visita) BETWEEN ? AND ?)
         OR (DATE(fecha_creacion) BETWEEN ? AND ?)
    `, [fDesde, fHasta, fDesde, fHasta, fDesde, fHasta]);

    // Agrupar órdenes por fecha y cuadrilla/técnico
    const rutasMap = new Map(); // key: `fecha|cuadrilla_clean`
    for (const ord of ordenesRango) {
      const f = ord.fecha_orden ? String(ord.fecha_orden).slice(0, 10) : hoyStr;
      const ref = (ord.cuadrilla || ord.tecnico_asignado || '').toLowerCase().trim();
      if (!ref) continue;
      const key = `${f}|${ref}`;
      if (!rutasMap.has(key)) rutasMap.set(key, []);

      // Extraer coordenadas
      const match = (ord.georeferencia || ord.direccion || '').match(/(-?\d{1,2}\.\d{4,8})\s*,\s*(-?\d{1,3}\.\d{4,8})/);
      if (match) {
        rutasMap.get(key).push({ lat: Number(match[1]), lng: Number(match[2]) });
      }
    }

    // Mapa de inspecciones existentes para evitar duplicados
    const keyInspSet = new Set(inspecciones.map(i => `${String(i.fecha).slice(0, 10)}|${i.id_trabajador}`));

    // Combinar inspecciones con trabajadores activos que tienen órdenes o vehículos
    const listaCompleta = [...inspecciones];

    // Días en el rango a evaluar
    const fechasAevaluar = [fHasta];
    if (fDesde !== fHasta) fechasAevaluar.push(fDesde);

    for (const f of fechasAevaluar) {
      for (const w of allWorkers) {
        const key = `${f}|${w.id_trabajador}`;
        if (!keyInspSet.has(key)) {
          // Buscar si tuvo órdenes este día
          const wCuad = (w.cuadrilla || '').toLowerCase().trim();
          const wName = (w.nombre_tecnico || '').toLowerCase().trim();

          let puntosRuta = [];
          for (const [rKey, pts] of rutasMap.entries()) {
            if (rKey.startsWith(f)) {
              if (wCuad && rKey.includes(wCuad)) puntosRuta = pts;
              else if (wName && rKey.includes(wName)) puntosRuta = pts;
            }
          }

          // Solo mostrar si tiene vehículo asignado o tuvo órdenes asignadas ese día
          if (w.placa || puntosRuta.length > 0) {
            let kmEstimado = 0;
            if (puntosRuta.length > 1) {
              for (let k = 0; k < puntosRuta.length - 1; k++) {
                kmEstimado += calcularDistanciaHaversine(puntosRuta[k].lat, puntosRuta[k].lng, puntosRuta[k+1].lat, puntosRuta[k+1].lng);
              }
              kmEstimado = Math.round(kmEstimado * 1.35 * 10) / 10;
            } else if (puntosRuta.length === 1) {
              kmEstimado = 7.5;
            }

            listaCompleta.push({
              id_inspeccion: `temp-${w.id_trabajador}-${f}`,
              id_vehiculo: w.id_vehiculo || 0,
              id_trabajador: w.id_trabajador,
              fecha: f,
              km_inicio: 0,
              hora_inicio: null,
              foto_tablero_inicio: null,
              foto_aceite: null,
              foto_agua: null,
              foto_estado_general: null,
              km_fin: 0,
              hora_fin: null,
              foto_tablero_fin: null,
              km_recorridos: 0,
              km_estimados_ordenes: kmEstimado,
              diferencia_km: 0,
              observaciones_tecnico: puntosRuta.length > 0 ? `${puntosRuta.length} órdenes en ruta.` : 'Vehículo asignado en flota.',
              estado_auditoria: 'Pendiente',
              observaciones_admin: 'Sin checklist enviado aún',
              placa: w.placa || 'S/P',
              marca: w.marca || '',
              modelo: w.modelo || '',
              id_usuario: w.id_usuario,
              nombre_tecnico: w.nombre_tecnico,
              cuadrilla: w.cuadrilla || '',
            });
            keyInspSet.add(key);
          }
        }
      }
    }

    // Enriquecer cada fila con los datos de recorrido GPS real y horas dinámicas
    const inspeccionesEnriquecidas = await Promise.all(
      listaCompleta.map(async (insp) => {
        const [gpsLogs] = await pool.query(`
          SELECT lat, lng, fecha_hora, tipo_evento
          FROM tecnico_gps_logs
          WHERE id_trabajador = ? AND DATE(fecha_hora) = ?
          ORDER BY fecha_hora ASC
        `, [insp.id_trabajador, String(insp.fecha).slice(0, 10)]);

        let kmGpsReal = 0;
        for (let i = 0; i < gpsLogs.length - 1; i++) {
          const d = calcularDistanciaHaversine(
            Number(gpsLogs[i].lat),
            Number(gpsLogs[i].lng),
            Number(gpsLogs[i + 1].lat),
            Number(gpsLogs[i + 1].lng)
          );
          kmGpsReal += d;
        }
        // Factor urbano de rutas
        kmGpsReal = Math.round(kmGpsReal * 1.35 * 10) / 10;

        // Horas reales de inicio y cierre dinámicas
        let horaInicioReal = insp.hora_inicio || (gpsLogs.length > 0 ? gpsLogs[0].fecha_hora?.slice(11, 16) : "-");
        let horaCierreReal = insp.hora_fin || (gpsLogs.length > 1 ? gpsLogs[gpsLogs.length - 1].fecha_hora?.slice(11, 16) : "-");

        // Alerta si hoy ya pasaron de las 07:30 AM y no marcaron inicio
        const esHoy = String(insp.fecha).slice(0, 10) === hoyStr;
        const alertaInicioTardio = esHoy && ahoraMinutos > 450 && (!insp.hora_inicio || !insp.foto_tablero_inicio);

        return {
          ...insp,
          km_gps_app: kmGpsReal > 0 ? kmGpsReal : Number(insp.km_estimados_ordenes) || 0,
          puntos_gps_count: gpsLogs.length,
          hora_inicio_real: horaInicioReal,
          hora_cierre_real: horaCierreReal,
          alerta_inicio_tardio: alertaInicioTardio,
        };
      })
    );

    // Resumen de métricas
    const totalKmDeclarados = inspeccionesEnriquecidas.reduce((acc, i) => acc + (Number(i.km_recorridos) || 0), 0);
    const totalKmEstimados = inspeccionesEnriquecidas.reduce((acc, i) => acc + (parseFloat(i.km_estimados_ordenes) || 0), 0);
    const totalKmGpsApp = inspeccionesEnriquecidas.reduce((acc, i) => acc + (parseFloat(i.km_gps_app) || 0), 0);
    const totalInspecciones = inspeccionesEnriquecidas.length;
    const aprobadas = inspeccionesEnriquecidas.filter(i => i.estado_auditoria === 'Aprobado').length;
    const pendientes = inspeccionesEnriquecidas.filter(i => i.estado_auditoria === 'Pendiente').length;
    const observadas = inspeccionesEnriquecidas.filter(i => i.estado_auditoria === 'Observado').length;

    // Alertas por desvío excesivo (>35 km de diferencia)
    const alertasDesvio = inspeccionesEnriquecidas.filter(i => (Number(i.km_recorridos) - Number(i.km_gps_app || i.km_estimados_ordenes)) > 35 && Number(i.km_recorridos) > 0);

    res.json({
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
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- 📍 REGISTRAR EVENTO / PING GPS EN HISTORIAL ---
async function registrarLogGps(idTrabajador, idVehiculo, lat, lng, tipoEvento, referenciaId, descripcion) {
  if (!lat || !lng || !idTrabajador) return;
  try {
    await pool.query(`
      INSERT INTO tecnico_gps_logs (id_trabajador, id_vehiculo, lat, lng, tipo_evento, referencia_id, descripcion, fecha_hora)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `, [idTrabajador, idVehiculo || null, lat, lng, tipoEvento, String(referenciaId || ''), descripcion || '']);
  } catch (e) {
    console.error("Error al registrar log GPS:", e.message);
  }
}

// --- 📍 API PARA GUARDAR PING GPS DESDE EL PORTAL DEL TÉCNICO ---
app.post('/api/movilidad/gps-log', async (req, res) => {
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

// --- 📍 CONSULTAR RECORRIDO Y PARADAS DEL TÉCNICO EN EL DÍA ---
app.get('/api/movilidad/recorrido-tecnico/:idTrabajador', async (req, res) => {
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
        ticket,
        numero_orden,
        ot,
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
          referencia_id: String(ord.ticket || ord.ot || ord.numero_orden || ord.id_orden),
          descripcion: `Cliente #${i + 1}: ${ord.cliente} (${ord.direccion ? ord.direccion.split('||')[0].slice(0, 50) : 'Dirección'})`,
          hora: ord.fecha_visita ? String(ord.fecha_visita).slice(11, 16) : `Cliente #${i + 1}`,
          tramo_km: tramo,
          acumulado_km: Math.round(kmOrdenesAcum * 10) / 10,
          cliente: ord.cliente,
          ticket: ord.ticket || ord.ot,
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

// ==============================================================================
// 📦 MÓDULO DE ALMACÉN & INVENTARIO DE TELECOMUNICACIONES
// ==============================================================================

// --- 📦 1. STOCK GENERAL (ALMACÉN CENTRAL VS STOCK MÓVIL EN TÉCNICOS) ---
app.get('/api/almacen/stock-general', async (req, res) => {
  try {
    // 1. Productos con su stock en almacén central
    const [productos] = await pool.query(`
      SELECT 
        p.id_producto,
        p.codigo,
        p.nombre,
        p.descripcion,
        p.stock_minimo,
        p.maneja_serie,
        p.es_drop,
        p.precio_compra,
        COALESCE((SELECT MAX(ps.fecha_ingreso) FROM producto_series ps WHERE ps.id_producto = p.id_producto), p.fecha_creacion) AS fecha_ingreso,
        c.nombre AS categoria,
        COALESCE((SELECT SUM(s.cantidad) FROM stock s WHERE s.id_producto = p.id_producto AND (s.id_almacen = 1 OR s.id_almacen IS NULL)), 0) AS stock_central,
        COALESCE((
          SELECT SUM(tp.stock) 
          FROM trabajador_productos tp 
          JOIN trabajadores t ON tp.id_trabajador = t.id_trabajador 
          JOIN usuarios u ON t.id_usuario = u.id_usuario 
          LEFT JOIN roles r ON u.id_rol = r.id_rol 
          WHERE tp.id_producto = p.id_producto 
            AND (u.id_rol = 2 OR UPPER(COALESCE(r.nombre, '')) LIKE '%TECNIC%')
        ), 0) AS stock_en_tecnicos,
        COALESCE((SELECT COUNT(*) FROM producto_series ps WHERE ps.id_producto = p.id_producto AND ps.estado = 'DISPONIBLE'), 0) AS series_disponibles
      FROM productos p
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      WHERE p.estado = 'Activo' OR p.estado IS NULL
      ORDER BY c.nombre ASC, p.nombre ASC
    `);

    // 2. Stock detallado por cada técnico (Stock en Carro - Solo Técnicos)
    const [stockPorTecnico] = await pool.query(`
      SELECT 
        tp.id_trabajador,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS tecnico_nombre,
        COALESCE(u.cuadrilla, '') AS cuadrilla,
        COALESCE(v.placa, 'Sin vehículo') AS vehiculo_placa,
        p.id_producto,
        p.nombre AS producto_nombre,
        p.codigo AS producto_codigo,
        p.es_drop,
        c.nombre AS categoria,
        tp.stock,
        COALESCE(
          (SELECT MAX(ts.fecha_asignacion) FROM trabajador_series ts WHERE ts.id_trabajador = tp.id_trabajador AND ts.id_producto = tp.id_producto),
          tp.fecha_creacion
        ) AS fecha_entrega
      FROM trabajador_productos tp
      JOIN trabajadores t ON tp.id_trabajador = t.id_trabajador
      JOIN usuarios u ON t.id_usuario = u.id_usuario
      LEFT JOIN roles r ON u.id_rol = r.id_rol
      JOIN productos p ON tp.id_producto = p.id_producto
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      LEFT JOIN vehiculos v ON t.id_vehiculo = v.id_vehiculo
      WHERE tp.stock > 0 
        AND (u.id_rol = 2 OR UPPER(COALESCE(r.nombre, '')) LIKE '%TECNIC%')
      ORDER BY tecnico_nombre ASC, p.nombre ASC
    `);

    // 3. Series activas y liquidadas de técnicos (Solo Técnicos)
    const [seriesTecnicos] = await pool.query(`
      SELECT 
        ts.id_trabajador_serie,
        ts.id_trabajador,
        ts.id_producto,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS tecnico_nombre,
        ps.numero_serie,
        p.nombre AS equipo_nombre,
        p.codigo AS equipo_codigo,
        c.nombre AS categoria,
        ts.estado,
        ts.fecha_asignacion,
        ol.id_orden,
        o.numero AS orden_numero,
        ol.fecha_liquidacion
      FROM trabajador_series ts
      JOIN trabajadores t ON ts.id_trabajador = t.id_trabajador
      JOIN usuarios u ON t.id_usuario = u.id_usuario
      LEFT JOIN roles r ON u.id_rol = r.id_rol
      JOIN producto_series ps ON ts.id_producto_serie = ps.id_producto_serie
      JOIN productos p ON ts.id_producto = p.id_producto
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      LEFT JOIN orden_liquidaciones ol ON (
        ol.id_trabajador = ts.id_trabajador AND 
        (ol.numero_acta = ps.numero_serie OR ol.numero_guia = ps.numero_serie)
      )
      LEFT JOIN ordenes o ON ol.id_orden = o.id_orden
      WHERE (ts.estado = 'Asignada' OR ts.estado = 'Usada' OR ts.estado = 'Liquidada')
        AND (u.id_rol = 2 OR UPPER(COALESCE(r.nombre, '')) LIKE '%TECNIC%')
      ORDER BY ts.id_trabajador ASC, ps.numero_serie ASC
    `);

    // 4. Enlazar series y rangos a cada fila de stockPorTecnico
    const stockPorTecnicoEnriquecido = stockPorTecnico.map((st) => {
      const seriesDelItem = seriesTecnicos.filter(
        (s) => s.id_trabajador === st.id_trabajador && s.id_producto === st.id_producto
      );

      const seriesDisponibles = seriesDelItem.filter((s) => s.estado === 'Asignada');
      const seriesUsadas = seriesDelItem.filter((s) => s.estado === 'Usada' || s.estado === 'Liquidada');

      // Calcular rangos correlativos si es Acta o Talonario
      let rangos = [];
      const esActa =
        (st.categoria || '').toUpperCase().includes('TALONARIO') ||
        (st.categoria || '').toUpperCase().includes('ACTA') ||
        (st.categoria || '').toUpperCase().includes('GUIA') ||
        (st.producto_nombre || '').toUpperCase().includes('ACTA') ||
        (st.producto_nombre || '').toUpperCase().includes('GUIA');

      if (esActa && seriesDelItem.length > 0) {
        const sorted = [...seriesDelItem].sort((a, b) =>
          a.numero_serie.localeCompare(b.numero_serie, undefined, { numeric: true })
        );
        let rangoInicio = sorted[0].numero_serie;
        let anteriorNum = parseInt(rangoInicio.replace(/\D/g, ''), 10);
        let cantEnRango = 1;

        for (let i = 1; i < sorted.length; i++) {
          const actualStr = sorted[i].numero_serie;
          const actualNum = parseInt(actualStr.replace(/\D/g, ''), 10);
          if (!isNaN(anteriorNum) && !isNaN(actualNum) && actualNum === anteriorNum + 1) {
            cantEnRango++;
            anteriorNum = actualNum;
          } else {
            const finStr = sorted[i - 1].numero_serie;
            rangos.push(rangoInicio === finStr ? rangoInicio : `${rangoInicio} → ${finStr} (${cantEnRango} actas)`);
            rangoInicio = actualStr;
            anteriorNum = actualNum;
            cantEnRango = 1;
          }
        }
        const ultimoStr = sorted[sorted.length - 1].numero_serie;
        rangos.push(rangoInicio === ultimoStr ? rangoInicio : `${rangoInicio} → ${ultimoStr} (${cantEnRango} actas)`);
      }

      return {
        ...st,
        series: seriesDelItem,
        series_disponibles: seriesDisponibles.map((s) => s.numero_serie),
        series_liquidadas: seriesUsadas.map((s) => s.numero_serie),
        total_asignadas: seriesDelItem.length,
        total_en_carro: seriesDisponibles.length || st.stock,
        total_liquidadas: seriesUsadas.length,
        rangos: rangos,
      };
    });

    res.json({
      productos,
      stockPorTecnico: stockPorTecnicoEnriquecido,
      seriesTecnicos
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- 📦 CATEGORÍAS DE PRODUCTOS ---
app.get('/api/almacen/categorias', async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT id_categoria, nombre, descripcion FROM categorias WHERE estado = 'Activo' OR estado IS NULL ORDER BY nombre ASC");
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- 📦 CREAR NUEVO PRODUCTO EN CATÁLOGO ---
app.post('/api/almacen/productos', async (req, res) => {
  try {
    const { nombre, id_categoria, categoria, codigo, stock_minimo, maneja_serie, es_drop, precio_compra } = req.body;

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ error: "El nombre del producto es obligatorio." });
    }

    let catId = id_categoria;
    let catNombre = categoria;

    if (!catId && categoria) {
      const [cRows] = await pool.query("SELECT id_categoria, nombre FROM categorias WHERE UPPER(nombre) = UPPER(?) LIMIT 1", [categoria.trim()]);
      if (cRows.length > 0) {
        catId = cRows[0].id_categoria;
        catNombre = cRows[0].nombre;
      }
    } else if (catId && !catNombre) {
      const [cRows] = await pool.query("SELECT nombre FROM categorias WHERE id_categoria = ? LIMIT 1", [catId]);
      if (cRows.length > 0) {
        catNombre = cRows[0].nombre;
      }
    }

    // Generar código automático inteligente (Brand Prefix + Letra Modelo + 001)
    let codProd = (codigo || '').trim().toUpperCase();
    if (!codProd) {
      const nom = nombre.trim().toUpperCase();
      let prefix = '';

      if (nom.includes('ZTE')) {
        prefix = 'ZT';
      } else if (nom.includes('HUAWEI')) {
        prefix = 'HW';
      } else if (nom.includes('FIBERHOME')) {
        prefix = 'FH';
      } else if (nom.includes('WIN TV') || nom.includes('DECODIFICADOR') || nom.includes('DECO')) {
        prefix = 'WT';
      } else if (nom.includes('TP-LINK') || nom.includes('TPLINK')) {
        prefix = 'TP';
      } else if (nom.includes('MERCUSYS')) {
        prefix = 'MC';
      } else if (nom.includes('ROSETA')) {
        prefix = 'ROS';
      } else if (nom.includes('CONECTOR')) {
        prefix = 'CON';
      } else if (nom.includes('DROP') || nom.includes('CABLE')) {
        prefix = 'DRP';
      } else if (nom.includes('PATCH')) {
        prefix = 'PCH';
      } else if (catNombre.includes('EQUIPO')) {
        const palabras = nom.replace(/[^A-Z0-9\s]/g, '').split(/\s+/).filter(w => w.length >= 2);
        prefix = (palabras[0] || 'EQ').slice(0, 2);
      } else {
        const palabras = nom.replace(/[^A-Z0-9\s]/g, '').split(/\s+/).filter(w => w.length >= 2);
        prefix = (palabras[0] || 'PR').slice(0, 3);
      }

      // Consultar productos existentes con ese prefijo para calcular la siguiente letra correlativa (A, B, C...)
      const [existentes] = await pool.query(
        "SELECT codigo FROM productos WHERE codigo LIKE ?",
        [`${prefix}%`]
      );

      const letrasUsadas = new Set();
      existentes.forEach(p => {
        const resto = String(p.codigo || '').slice(prefix.length);
        const match = resto.match(/^([A-Z])/);
        if (match) letrasUsadas.add(match[1]);
      });

      const abecedario = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      let letraAsignada = 'A';
      for (let i = 0; i < abecedario.length; i++) {
        if (!letrasUsadas.has(abecedario[i])) {
          letraAsignada = abecedario[i];
          break;
        }
      }

      codProd = `${prefix}${letraAsignada}`;
    }

    const manejaSerieVal = maneja_serie !== undefined ? (maneja_serie ? 1 : 0) : (catNombre === 'EQUIPOS' ? 1 : 0);
    const esDropVal = es_drop ? 1 : 0;
    const stockMinVal = Number(stock_minimo) || 5;
    const precVal = Number(precio_compra) || 0;

    const [insResult] = await pool.query(`
      INSERT INTO productos (codigo, nombre, id_categoria, stock_minimo, maneja_serie, es_drop, precio_compra, estado)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Activo')
    `, [codProd, nombre.trim().toUpperCase(), catId || null, stockMinVal, manejaSerieVal, esDropVal, precVal]);

    const newProdId = insResult.insertId;

    // Inicializar registro en stock almacén central
    await pool.query(`
      INSERT INTO stock (id_producto, id_almacen, cantidad)
      VALUES (?, 1, 0)
      ON DUPLICATE KEY UPDATE id_stock = id_stock
    `, [newProdId]);

    const nuevoProducto = {
      id_producto: newProdId,
      codigo: codProd,
      nombre: nombre.trim().toUpperCase(),
      categoria: catNombre || 'GENERAL',
      stock_minimo: stockMinVal,
      maneja_serie: manejaSerieVal,
      es_drop: esDropVal,
      precio_compra: precVal,
      stock_central: 0,
      stock_en_tecnicos: 0,
      series_disponibles: 0
    };

    res.json({
      success: true,
      message: `Producto ${nuevoProducto.nombre} (${nuevoProducto.codigo}) creado exitosamente.`,
      producto: nuevoProducto
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- 📦 2. PROVEEDORES (LISTAR & AUTOLLENADO POR RUC) ---
app.get('/api/almacen/proveedores', async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM proveedores WHERE estado = 'Activo' OR estado IS NULL ORDER BY razon_social ASC");
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- 📦 3. REGISTRAR COMPRA CON FACTURA/BOLETA, PROVEEDOR INTELIGENTE & PISTOLEO DE SERIES ---
app.post('/api/almacen/compras', async (req, res) => {
  try {
    const {
      id_proveedor,
      ruc_proveedor,
      razon_social_proveedor,
      direccion_proveedor,
      telefono_proveedor,
      tipo_comprobante,
      numero_comprobante,
      fecha,
      items, // Array de { id_producto, cantidad, precio, series: ['SN1', 'SN2'] }
      observaciones
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: "Debe ingresar al menos un producto en la compra." });
    }

    let provId = id_proveedor;

    // A. Auto-guardar proveedor si es nuevo
    if (!provId && ruc_proveedor) {
      const [provExistente] = await pool.query("SELECT id_proveedor FROM proveedores WHERE ruc = ?", [ruc_proveedor.trim()]);
      if (provExistente.length > 0) {
        provId = provExistente[0].id_proveedor;
      } else {
        const [nuevoProv] = await pool.query(`
          INSERT INTO proveedores (ruc, razon_social, nombre_comercial, direccion, telefono, estado)
          VALUES (?, ?, ?, ?, ?, 'Activo')
        `, [
          ruc_proveedor.trim(),
          razon_social_proveedor || `PROVEEDOR RUC ${ruc_proveedor}`,
          razon_social_proveedor || `PROVEEDOR RUC ${ruc_proveedor}`,
          direccion_proveedor || '',
          telefono_proveedor || ''
        ]);
        provId = nuevoProv.insertId;
      }
    }

    const fechaCompra = fecha || new Date().toISOString().slice(0, 10);
    const totalCompra = items.reduce((acc, it) => acc + (Number(it.cantidad) * Number(it.precio || 0)), 0);

    // B1. Validar regla de negocio: Productos serializados deben tener exactamente la misma cantidad de series y sin duplicados
    const todasLasSeriesCompra = [];

    for (const item of items) {
      const prodId = Number(item.id_producto);
      const cant = Number(item.cantidad) || 0;
      const seriesList = Array.isArray(item.series)
        ? item.series.map((s) => String(s).trim().toUpperCase()).filter((s) => s.length >= 3)
        : [];

      // Validar duplicados dentro de la misma compra
      for (const s of seriesList) {
        if (todasLasSeriesCompra.includes(s)) {
          return res.status(400).json({
            error: `La serie "${s}" está duplicada dentro de esta misma compra. Cada equipo debe tener un número de serie único e irrepetible.`,
          });
        }
        todasLasSeriesCompra.push(s);
      }

      const [prodRows] = await pool.query(
        "SELECT id_producto, nombre, maneja_serie, id_categoria FROM productos WHERE id_producto = ?",
        [prodId]
      );
      if (prodRows.length > 0) {
        const prod = prodRows[0];
        const esSerializado = Boolean(prod.maneja_serie || prod.id_categoria === 7 || prod.id_categoria === 11);
        if (esSerializado && seriesList.length !== cant) {
          return res.status(400).json({
            error: `El producto "${prod.nombre}" requiere exactamente ${cant} series registradas, pero se ingresaron ${seriesList.length}. Por favor completa las ${cant - seriesList.length} series faltantes.`,
          });
        }
      }
    }

    // B2. Validar que las series no existan previamente registradas en la base de datos
    if (todasLasSeriesCompra.length > 0) {
      const [seriesExistentes] = await pool.query(
        "SELECT ps.numero_serie, p.nombre as producto_nombre FROM producto_series ps JOIN productos p ON ps.id_producto = p.id_producto WHERE ps.numero_serie IN (?)",
        [todasLasSeriesCompra]
      );
      if (seriesExistentes.length > 0) {
        const repetidas = seriesExistentes.map((r) => `"${r.numero_serie}" (${r.producto_nombre})`).join(", ");
        return res.status(400).json({
          error: `Las siguientes series ya se encuentran registradas previamente en el almacén: ${repetidas}. No se permiten series duplicadas.`,
        });
      }
    }

    // B3. Crear registro de Compra
    const [compraResult] = await pool.query(`
      INSERT INTO compras (id_proveedor, id_almacen, fecha, total, tipo_comprobante, numero_comprobante, estado, observaciones)
      VALUES (?, 1, ?, ?, ?, ?, 'COMPLETADO', ?)
    `, [provId || null, fechaCompra, totalCompra, tipo_comprobante || 'Factura', numero_comprobante || '', observaciones || '']);

    const idCompra = compraResult.insertId;

    // C. Procesar cada ítem
    for (const item of items) {
      const prodId = Number(item.id_producto);
      const cant = Number(item.cantidad) || 0;
      const prec = Number(item.precio) || 0;
      const subtotal = cant * prec;
      const seriesList = Array.isArray(item.series) ? item.series : [];

      // 1. Detalle de compra
      await pool.query(`
        INSERT INTO detalle_compras (id_compra, id_producto, cantidad, precio, subtotal, series_ingresadas)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [idCompra, prodId, cant, prec, subtotal, seriesList.join(',')]);

      // 2. Incrementar stock en Almacén Central (id_almacen = 1)
      const [stockExistente] = await pool.query("SELECT id_stock, cantidad FROM stock WHERE id_producto = ? AND id_almacen = 1", [prodId]);
      if (stockExistente.length > 0) {
        await pool.query("UPDATE stock SET cantidad = cantidad + ? WHERE id_stock = ?", [cant, stockExistente[0].id_stock]);
      } else {
        await pool.query("INSERT INTO stock (id_producto, id_almacen, cantidad) VALUES (?, 1, ?)", [prodId, cant]);
      }

      // 3. Registrar Movimiento Kardex
      await pool.query(`
        INSERT INTO movimientos (id_producto, id_almacen, tipo, cantidad, referencia, fecha_creacion)
        VALUES (?, 1, 'ENTRADA', ?, ?, NOW())
      `, [prodId, cant, `Compra #${idCompra} - ${tipo_comprobante || 'Fac'} ${numero_comprobante || ''}`]);

      // 4. Si el producto maneja series (ONT, Mesh, etc.), registrar cada serie pistoleada con su código correlativo
      if (seriesList.length > 0) {
        const [prodInfo] = await pool.query("SELECT codigo FROM productos WHERE id_producto = ?", [prodId]);
        const modelCode = (prodInfo[0]?.codigo || 'EQA').trim();

        // Obtener el último número correlativo asignado a este producto
        const [lastSerie] = await pool.query(
          "SELECT codigo_serie FROM producto_series WHERE id_producto = ? AND codigo_serie IS NOT NULL ORDER BY id_producto_serie DESC LIMIT 1",
          [prodId]
        );
        let nextNum = 1;
        if (lastSerie.length > 0 && lastSerie[0].codigo_serie) {
          const m = lastSerie[0].codigo_serie.match(/-S(\d+)$/i);
          if (m) nextNum = parseInt(m[1], 10) + 1;
        }

        for (const serie of seriesList) {
          const cleanSerie = serie.trim().toUpperCase();
          if (cleanSerie.length > 2) {
            const codigoSerie = `${modelCode}-S${String(nextNum).padStart(3, '0')}`;
            nextNum++;

            await pool.query(`
              INSERT INTO producto_series (id_producto, id_almacen, codigo_serie, numero_serie, estado, fecha_ingreso)
              VALUES (?, 1, ?, ?, 'DISPONIBLE', NOW())
              ON DUPLICATE KEY UPDATE codigo_serie = COALESCE(codigo_serie, VALUES(codigo_serie)), estado = 'DISPONIBLE', id_almacen = 1
            `, [prodId, codigoSerie, cleanSerie]);
          }
        }
      }
    }

    res.json({
      success: true,
      message: `Compra #${idCompra} registrada con éxito. Stock y series cargados al Almacén Central.`,
      id_compra: idCompra
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- 📦 4. DESPACHO / DOTACIÓN A TÉCNICOS (TRANSFERENCIA A STOCK MÓVIL) ---
// --- 📦 4. DESPACHO / DOTACIÓN A TÉCNICOS (TRANSFERENCIA A STOCK MÓVIL) ---
app.post('/api/almacen/despacho-tecnico', async (req, res) => {
  try {
    const { id_trabajador, items, series_pistoleadas, observaciones } = req.body;

    if (!id_trabajador) {
      return res.status(400).json({ error: "Debe seleccionar el técnico al que se entrega el material." });
    }

    // 1. Asignar Insumos / Materiales (Conectores, Cable Drop, Rosetas, etc.)
    if (Array.isArray(items)) {
      for (const item of items) {
        const prodId = Number(item.id_producto);
        const cant = Number(item.cantidad) || 0;
        if (cant <= 0) continue;

        // Descontar de Almacén Central
        await pool.query("UPDATE stock SET cantidad = GREATEST(0, cantidad - ?) WHERE id_producto = ? AND id_almacen = 1", [cant, prodId]);

        // Aumentar en Stock del Técnico
        const [tpExistente] = await pool.query("SELECT id_trabajador_producto FROM trabajador_productos WHERE id_trabajador = ? AND id_producto = ?", [id_trabajador, prodId]);
        if (tpExistente.length > 0) {
          await pool.query("UPDATE trabajador_productos SET stock = stock + ? WHERE id_trabajador_producto = ?", [cant, tpExistente[0].id_trabajador_producto]);
        } else {
          await pool.query("INSERT INTO trabajador_productos (id_trabajador, id_producto, stock) VALUES (?, ?, ?)", [id_trabajador, prodId, cant]);
        }

        // Kardex Salida
        await pool.query(`
          INSERT INTO movimientos (id_producto, id_almacen, tipo, cantidad, referencia, fecha_creacion)
          VALUES (?, 1, 'SALIDA', ?, ?, NOW())
        `, [prodId, cant, `Despacho a Técnico #${id_trabajador} (${observaciones || 'Dotación operativa'})`]);
      }
    }

    // 2. Asignar Equipos Serializados o Talonarios de Actas / Guías
    if (Array.isArray(series_pistoleadas) && series_pistoleadas.length > 0) {
      const prodIdsSeries = new Set();

      for (const itemSerie of series_pistoleadas) {
        const cleanSerie = String(itemSerie.numero_serie || itemSerie).trim().toUpperCase();
        if (!cleanSerie) continue;

        let targetProdId = itemSerie.id_producto || (items && items[0] ? items[0].id_producto : null);

        // Buscar serie en producto_series
        let [serieRows] = await pool.query("SELECT id_producto_serie, id_producto FROM producto_series WHERE numero_serie = ?", [cleanSerie]);
        let idProdSerie = null;
        let actualProdId = targetProdId;

        if (serieRows.length > 0) {
          idProdSerie = serieRows[0].id_producto_serie;
          actualProdId = serieRows[0].id_producto;
          await pool.query("UPDATE producto_series SET estado = 'RESERVADO', id_almacen = NULL WHERE id_producto_serie = ?", [idProdSerie]);
          await pool.query("UPDATE stock SET cantidad = GREATEST(0, cantidad - 1) WHERE id_producto = ? AND id_almacen = 1", [actualProdId]);
        } else if (actualProdId) {
          // Si la serie no existía previamente (ej: lote de talonarios asignado directamente)
          const [insRes] = await pool.query(`
            INSERT INTO producto_series (id_producto, id_almacen, numero_serie, estado, fecha_ingreso)
            VALUES (?, NULL, ?, 'RESERVADO', NOW())
            ON DUPLICATE KEY UPDATE estado = 'RESERVADO', id_almacen = NULL
          `, [actualProdId, cleanSerie]);
          idProdSerie = insRes.insertId || insRes.id_producto_serie;
          if (!idProdSerie) {
            const [findRes] = await pool.query("SELECT id_producto_serie FROM producto_series WHERE numero_serie = ?", [cleanSerie]);
            if (findRes.length > 0) idProdSerie = findRes[0].id_producto_serie;
          }
        }

        if (idProdSerie && actualProdId) {
          prodIdsSeries.add(actualProdId);
          await pool.query(`
            INSERT INTO trabajador_series (id_trabajador, id_producto, id_producto_serie, estado, fecha_asignacion)
            VALUES (?, ?, ?, 'Asignada', NOW())
            ON DUPLICATE KEY UPDATE estado = 'Asignada', id_trabajador = ?
          `, [id_trabajador, actualProdId, idProdSerie, id_trabajador]);
        }
      }

      // Asegurar que el stock en trabajador_productos refleje las series asignadas
      for (const pId of prodIdsSeries) {
        const [cntRows] = await pool.query(`
          SELECT COUNT(*) as totalAsig 
          FROM trabajador_series 
          WHERE id_trabajador = ? AND id_producto = ? AND estado = 'Asignada'
        `, [id_trabajador, pId]);
        const totalAsig = cntRows[0]?.totalAsig || 0;

        const [tpExistente] = await pool.query("SELECT id_trabajador_producto FROM trabajador_productos WHERE id_trabajador = ? AND id_producto = ?", [id_trabajador, pId]);
        if (tpExistente.length > 0) {
          await pool.query("UPDATE trabajador_productos SET stock = ? WHERE id_trabajador_producto = ?", [totalAsig, tpExistente[0].id_trabajador_producto]);
        } else {
          await pool.query("INSERT INTO trabajador_productos (id_trabajador, id_producto, stock) VALUES (?, ?, ?)", [id_trabajador, pId, totalAsig]);
        }
      }
    }

    res.json({ success: true, message: "Dotación, materiales y actas asignados exitosamente al técnico." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- 📋 4.1 AUDITORÍA Y CONTROL DE ACTAS / GUÍAS ASIGNADAS A TÉCNICOS ---
app.get('/api/almacen/actas-tecnicos', async (req, res) => {
  try {
    // 1. Obtener todos los técnicos
    const [tecnicos] = await pool.query(`
      SELECT 
        t.id_trabajador,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS tecnico_nombre,
        COALESCE(u.cuadrilla, 'S/C') AS cuadrilla,
        COALESCE(v.placa, 'Sin vehículo') AS vehiculo_placa,
        COALESCE(u.telefono, '') AS telefono
      FROM trabajadores t
      JOIN usuarios u ON t.id_usuario = u.id_usuario
      LEFT JOIN roles r ON u.id_rol = r.id_rol
      LEFT JOIN vehiculos v ON t.id_vehiculo = v.id_vehiculo
      WHERE (u.id_rol = 2 OR UPPER(COALESCE(r.nombre, '')) LIKE '%TECNIC%')
        AND (t.estado = 'Activo' OR t.estado IS NULL)
      ORDER BY tecnico_nombre ASC
    `);

    // 2. Obtener todas las series de actas / talonarios
    const [actasSeries] = await pool.query(`
      SELECT 
        ts.id_trabajador_serie,
        ts.id_trabajador,
        ps.id_producto_serie,
        ps.numero_serie,
        p.id_producto,
        p.nombre AS producto_nombre,
        ts.estado,
        ts.fecha_asignacion,
        ol.id_orden,
        o.numero AS orden_numero,
        ol.fecha_liquidacion
      FROM trabajador_series ts
      JOIN producto_series ps ON ts.id_producto_serie = ps.id_producto_serie
      JOIN productos p ON ts.id_producto = p.id_producto
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      LEFT JOIN orden_liquidaciones ol ON (
        ol.id_trabajador = ts.id_trabajador AND 
        (ol.numero_acta = ps.numero_serie OR ol.numero_guia = ps.numero_serie OR ol.numero_acta LIKE CONCAT('%', ps.numero_serie) OR ps.numero_serie LIKE CONCAT('%', ol.numero_acta))
      )
      LEFT JOIN ordenes o ON ol.id_orden = o.id_orden
      WHERE (UPPER(COALESCE(c.nombre, '')) LIKE '%TALONARIO%' 
          OR UPPER(COALESCE(c.nombre, '')) LIKE '%ACTA%' 
          OR UPPER(COALESCE(c.nombre, '')) LIKE '%GUIA%' 
          OR UPPER(p.nombre) LIKE '%ACTA%' 
          OR UPPER(p.nombre) LIKE '%GUIA%')
      ORDER BY ts.id_trabajador ASC, ps.numero_serie ASC
    `);

    // 3. Consolidar por técnico y agrupar correlativos consecutivos en rangos claros
    const resultado = tecnicos.map((tec) => {
      const actasDelTecnico = actasSeries.filter((a) => a.id_trabajador === tec.id_trabajador);
      const totalAsignadas = actasDelTecnico.length;
      const totalUsadas = actasDelTecnico.filter((a) => a.estado === 'Usada').length;
      const totalDisponibles = totalAsignadas - totalUsadas;

      // Agrupar números correlativos consecutivos
      const rangos = [];
      if (actasDelTecnico.length > 0) {
        const sorted = [...actasDelTecnico].sort((a, b) => a.numero_serie.localeCompare(b.numero_serie, undefined, { numeric: true }));
        let rangoInicio = sorted[0].numero_serie;
        let rangoFin = sorted[0].numero_serie;
        let count = 1;

        for (let i = 1; i < sorted.length; i++) {
          const prevMatch = sorted[i - 1].numero_serie.match(/^(.*?)(\d+)$/);
          const currMatch = sorted[i].numero_serie.match(/^(.*?)(\d+)$/);

          if (
            prevMatch &&
            currMatch &&
            prevMatch[1] === currMatch[1] &&
            parseInt(currMatch[2], 10) === parseInt(prevMatch[2], 10) + 1
          ) {
            rangoFin = sorted[i].numero_serie;
            count++;
          } else {
            rangos.push(`${rangoInicio} → ${rangoFin} (${count} actas)`);
            rangoInicio = sorted[i].numero_serie;
            rangoFin = sorted[i].numero_serie;
            count = 1;
          }
        }
        rangos.push(`${rangoInicio} → ${rangoFin} (${count} actas)`);
      }

      return {
        id_trabajador: tec.id_trabajador,
        tecnico_nombre: tec.tecnico_nombre,
        cuadrilla: tec.cuadrilla,
        vehiculo_placa: tec.vehiculo_placa,
        telefono: tec.telefono,
        total_asignadas: totalAsignadas,
        total_usadas: totalUsadas,
        total_disponibles: totalDisponibles,
        rangos: rangos.length > 0 ? rangos : ['Sin talonarios asignados'],
        actas: actasDelTecnico
      };
    });

    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- 📦 5. CONSULTAR STOCK EN CAMIONETA DEL TÉCNICO (APP MÓVIL / OPERATIVO) ---
// Muestra materiales y equipos asignados en campo a técnicos
app.get('/api/almacen/tecnico-stock/:idTrabajador', async (req, res) => {
  try {
    const paramId = req.params.idTrabajador;

    // Obtener el id_trabajador real y su rol
    const [tRows] = await pool.query(`
      SELECT t.id_trabajador, u.id_usuario, u.id_rol, r.nombre AS rol_nombre
      FROM trabajadores t 
      JOIN usuarios u ON t.id_usuario = u.id_usuario 
      LEFT JOIN roles r ON u.id_rol = r.id_rol
      WHERE (t.id_trabajador = ? OR t.id_usuario = ?)
      LIMIT 1
    `, [paramId, paramId]);

    if (tRows.length === 0) {
      return res.json({ permitido: true, materiales: [], seriesAsignadas: [] });
    }

    const idTrabajador = tRows[0].id_trabajador;
    const idRol = tRows[0].id_rol;

    // 🔒 Verificar si el rol del técnico tiene permiso para ver su stock (ordenes.ver_stock)
    let permitido = true;
    if (idRol && idRol !== 1) { // Si no es SuperAdmin, verificar en roles_permisos
      const [permRows] = await pool.query(`
        SELECT rp.id_rol_permiso
        FROM roles_permisos rp
        JOIN permisos p ON rp.id_permiso = p.id_permiso
        WHERE rp.id_rol = ? AND p.clave = 'ordenes.ver_stock' AND p.estado = 'Activo'
        LIMIT 1
      `, [idRol]);
      permitido = permRows.length > 0;
    }

    const [materiales] = await pool.query(`
      SELECT 
        tp.id_producto,
        p.codigo,
        p.nombre,
        p.es_drop,
        p.maneja_serie,
        COALESCE(c.nombre, 'MATERIALES') AS categoria,
        tp.stock
      FROM trabajador_productos tp
      JOIN productos p ON tp.id_producto = p.id_producto
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      WHERE tp.id_trabajador = ? AND tp.stock > 0
        AND (
          UPPER(COALESCE(c.nombre, '')) = 'MATERIALES' 
          OR p.id_categoria = 1
        )
      ORDER BY p.nombre ASC
    `, [idTrabajador]);

    const [seriesAsignadas] = await pool.query(`
      SELECT 
        ts.id_trabajador_serie,
        ps.id_producto_serie,
        ps.numero_serie,
        p.id_producto,
        p.nombre AS equipo_nombre,
        COALESCE(c.nombre, 'EQUIPOS') AS categoria,
        ts.estado
      FROM trabajador_series ts
      JOIN producto_series ps ON ts.id_producto_serie = ps.id_producto_serie
      JOIN productos p ON ts.id_producto = p.id_producto
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      WHERE ts.id_trabajador = ? AND ts.estado = 'Asignada'
        AND (
          UPPER(COALESCE(c.nombre, '')) IN ('EQUIPOS', 'TALONARIOS Y GUIAS', 'MATERIALES')
          OR p.id_categoria IN (1, 7, 11)
        )
      ORDER BY p.nombre ASC
    `, [idTrabajador]);

    res.json({ permitido, materiales, seriesAsignadas });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- 🏷️ 5.1 CONSULTAR LISTADO Y ESTADO DE TODAS LAS SERIES DE UN PRODUCTO ---
app.get('/api/almacen/producto-series/:idProducto', async (req, res) => {
  try {
    const idProducto = req.params.idProducto;

    const [productoRows] = await pool.query(`
      SELECT p.id_producto, p.codigo, p.nombre, p.descripcion, c.nombre AS categoria, p.stock_minimo
      FROM productos p
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      WHERE p.id_producto = ?
    `, [idProducto]);

    if (productoRows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const producto = productoRows[0];

    const [series] = await pool.query(`
      SELECT 
        ps.id_producto_serie,
        ps.id_producto,
        ps.codigo_serie,
        ps.numero_serie,
        ps.estado AS estado_serie,
        ps.fecha_ingreso,
        ts.id_trabajador,
        ts.estado AS estado_en_tecnico,
        ts.fecha_asignacion,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS tecnico_nombre,
        COALESCE(u.cuadrilla, '') AS tecnico_cuadrilla,
        COALESCE(v.placa, '') AS vehiculo_placa
      FROM producto_series ps
      LEFT JOIN trabajador_series ts ON ps.id_producto_serie = ts.id_producto_serie AND ts.estado = 'Asignada'
      LEFT JOIN trabajadores t ON ts.id_trabajador = t.id_trabajador
      LEFT JOIN usuarios u ON t.id_usuario = u.id_usuario
      LEFT JOIN vehiculos v ON t.id_vehiculo = v.id_vehiculo
      WHERE ps.id_producto = ?
      ORDER BY 
        CASE 
          WHEN ps.estado = 'DISPONIBLE' THEN 1
          WHEN ts.id_trabajador IS NOT NULL THEN 2
          ELSE 3
        END,
        ps.numero_serie ASC
    `, [idProducto]);

    res.json({
      producto,
      total_series: series.length,
      disponibles_almacen: series.filter(s => s.estado_serie === 'DISPONIBLE').length,
      asignadas_tecnicos: series.filter(s => s.id_trabajador !== null).length,
      defectuosos: series.filter(s => s.estado_serie === 'DEFECTUOSO').length,
      series
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- 🏷️ 5.2 ACTUALIZAR ESTADO DE UNA SERIE (DISPONIBLE / DEFECTUOSO / BAJA) ---
app.put('/api/almacen/producto-series/:idProductoSerie/estado', async (req, res) => {
  try {
    const { idProductoSerie } = req.params;
    const { nuevo_estado } = req.body;

    const estadosValidos = ['DISPONIBLE', 'RESERVADO', 'DEFECTUOSO', 'BAJA', 'VENDIDO'];
    if (!estadosValidos.includes(nuevo_estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    await pool.query(
      'UPDATE producto_series SET estado = ? WHERE id_producto_serie = ?',
      [nuevo_estado, idProductoSerie]
    );

    res.json({ success: true, message: `Estado de la serie actualizado a ${nuevo_estado}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- 📦 6. CONSULTAR DOTACIÓN COMPLETA DEL TÉCNICO (ADMINISTRATIVO / MODAL DESPACHO) ---
// Muestra todo el inventario entregado al técnico: Materiales, Equipos, Herramientas, Uniformes y Vehículo
app.get('/api/almacen/tecnico-dotacion-completa/:idTrabajador', async (req, res) => {
  try {
    const paramId = req.params.idTrabajador;

    const [tRows] = await pool.query(`
      SELECT t.id_trabajador 
      FROM trabajadores t 
      JOIN usuarios u ON t.id_usuario = u.id_usuario 
      LEFT JOIN roles r ON u.id_rol = r.id_rol
      WHERE (t.id_trabajador = ? OR t.id_usuario = ?)
        AND (u.id_rol = 2 OR UPPER(COALESCE(r.nombre, '')) LIKE '%TECNIC%')
      LIMIT 1
    `, [paramId, paramId]);

    if (tRows.length === 0) {
      return res.json({
        id_trabajador: paramId,
        materiales: [],
        equipos: [],
        herramientas: [],
        uniformes: [],
        vehiculo: [],
        todosLosItems: [],
        seriesAsignadas: []
      });
    }
    const idTrabajador = tRows[0].id_trabajador;

    const [items] = await pool.query(`
      SELECT 
        tp.id_producto,
        p.codigo,
        p.nombre,
        p.es_drop,
        p.maneja_serie,
        COALESCE(c.nombre, 'GENERAL') AS categoria,
        tp.stock
      FROM trabajador_productos tp
      JOIN productos p ON tp.id_producto = p.id_producto
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      WHERE tp.id_trabajador = ? AND tp.stock > 0
      ORDER BY c.nombre ASC, p.nombre ASC
    `, [idTrabajador]);

    const [seriesAsignadas] = await pool.query(`
      SELECT 
        ts.id_trabajador_serie,
        ps.id_producto_serie,
        ps.numero_serie,
        p.id_producto,
        p.nombre AS equipo_nombre,
        COALESCE(c.nombre, 'EQUIPOS') AS categoria,
        ts.estado,
        ts.fecha_asignacion
      FROM trabajador_series ts
      JOIN producto_series ps ON ts.id_producto_serie = ps.id_producto_serie
      JOIN productos p ON ts.id_producto = p.id_producto
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      WHERE ts.id_trabajador = ? AND ts.estado = 'Asignada'
      ORDER BY p.nombre ASC
    `, [idTrabajador]);

    res.json({
      id_trabajador: idTrabajador,
      materiales: items.filter(i => i.categoria === 'MATERIALES'),
      equipos: items.filter(i => i.categoria === 'EQUIPOS'),
      herramientas: items.filter(i => i.categoria === 'HERRAMIENTAS'),
      uniformes: items.filter(i => i.categoria === 'UNIFORMES'),
      vehiculo: items.filter(i => i.categoria === 'VEHICULO'),
      todosLosItems: items,
      seriesAsignadas
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- 📋 CONSULTAR ACTA WIN GUARDADA (SOLO LECTURA / AUDITORÍA ADMIN) ---
app.get('/api/ordenes/:id/acta-liquidacion', async (req, res) => {
  try {
    const idOrden = req.params.id;

    // 1. Cabecera de liquidación
    const [liqRows] = await pool.query(`
      SELECT 
        ol.*,
        COALESCE(ol.numero_acta, ol.numero_guia) AS numero_guia,
        COALESCE(ol.numero_acta, ol.numero_guia) AS numero_acta,
        o.ticket,
        o.cliente,
        o.dni,
        o.direccion,
        o.distrito,
        o.tipo_trabajo,
        o.cuadrilla,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS tecnico_nombre
      FROM orden_liquidaciones ol
      JOIN ordenes o ON ol.id_orden = o.id_orden
      LEFT JOIN trabajadores t ON ol.id_trabajador = t.id_trabajador
      LEFT JOIN usuarios u ON t.id_usuario = u.id_usuario
      WHERE ol.id_orden = ?
      ORDER BY ol.id_liquidacion DESC
      LIMIT 1
    `, [idOrden]);

    if (liqRows.length === 0) {
      return res.status(404).json({ error: "Esta orden aún no cuenta con un Acta WIN llenada por el técnico." });
    }

    const acta = liqRows[0];
    const liqId = acta.id_liquidacion;

    // 2. Materiales consumidos
    const [materiales] = await pool.query(`
      SELECT 
        old.id_detalle_liq,
        old.cantidad,
        p.id_producto,
        p.codigo,
        p.nombre,
        p.es_drop,
        c.nombre AS categoria
      FROM orden_liquidacion_detalle old
      JOIN productos p ON old.id_producto = p.id_producto
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      WHERE old.id_liquidacion = ?
    `, [liqId]);

    // 3. Equipos retirados / recogidos
    const [equiposRetirados] = await pool.query(`
      SELECT * FROM orden_equipos_retirados WHERE id_orden = ?
    `, [idOrden]);

    res.json({
      acta,
      materiales,
      equiposRetirados
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- 📋 6. LIQUIDACIÓN DIGITAL DE ORDEN CON ACTA WIN Y DESCUENTO AUTOMÁTICO ---
app.post('/api/ordenes/:id/liquidar-acta', async (req, res) => {
  try {
    const idOrden = req.params.id;
    const {
      id_trabajador,
      numero_guia,
      numero_acta,
      tipo_trabajo_acta,
      cto,
      puerto,
      speedtest_download,
      speedtest_upload,
      tipo_conexion,
      drop_metro_inicio,
      drop_metro_fin,
      drop_total_metros,
      lat_liquidacion,
      lng_liquidacion,
      observaciones_tecnico,
      firma_cliente,
      firma_tecnico,
      materiales_utilizados, // Array de { id_producto, cantidad }
      equipos_instalados,    // Array de { id_producto_serie, numero_serie, tipo_equipo }
      equipos_retirados      // Array de { tipo_equipo, numero_serie, motivo_retiro }
    } = req.body;

    const numActaFinal = numero_acta || numero_guia || '001-000000';

    // A. Guardar Cabecera de Liquidación
    const [liqResult] = await pool.query(`
      INSERT INTO orden_liquidaciones (
        id_orden, id_trabajador, numero_acta, numero_guia, tipo_trabajo_acta,
        cto, puerto, speedtest_download, speedtest_upload, tipo_conexion,
        drop_metro_inicio, drop_metro_fin, drop_total_metros,
        lat_liquidacion, lng_liquidacion, observaciones_tecnico,
        firma_cliente, firma_tecnico, fecha_liquidacion
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      idOrden, id_trabajador || null, numActaFinal, numActaFinal, tipo_trabajo_acta || 'Visita Técnica',
      cto || '', puerto || '', speedtest_download || null, speedtest_upload || null, tipo_conexion || 'Inalámbrica',
      drop_metro_inicio || null, drop_metro_fin || null, drop_total_metros || 0,
      lat_liquidacion || null, lng_liquidacion || null, observaciones_tecnico || '',
      firma_cliente || '', firma_tecnico || ''
    ]);

    const idLiquidacion = liqResult.insertId;

    // B. Actualizar Orden a 'Liquidada'
    await pool.query("UPDATE ordenes SET estado = 'Liquidada', fecha_liquidacion = NOW() WHERE id_orden = ?", [idOrden]);

    // C. Descontar Insumos y Materiales del Stock Móvil del Técnico
    if (Array.isArray(materiales_utilizados) && id_trabajador) {
      for (const mat of materiales_utilizados) {
        const prodId = Number(mat.id_producto);
        const cantUsada = Number(mat.cantidad) || 0;
        if (cantUsada <= 0) continue;

        // 1. Guardar detalle de liquidación
        await pool.query(`
          INSERT INTO orden_liquidacion_detalle (id_liquidacion, id_producto, cantidad)
          VALUES (?, ?, ?)
        `, [idLiquidacion, prodId, cantUsada]);

        // 2. Descontar del técnico
        await pool.query(`
          UPDATE trabajador_productos 
          SET stock = GREATEST(0, stock - ?)
          WHERE id_trabajador = ? AND id_producto = ?
        `, [cantUsada, id_trabajador, prodId]);
      }
    }

    // D. Registrar Equipos Nuevos Instalados
    if (Array.isArray(equipos_instalados)) {
      for (const eqInst of equipos_instalados) {
        const serieInst = String(eqInst.numero_serie || '').trim().toUpperCase();
        if (serieInst) {
          // Actualizar serie a VENDIDO / INSTALADO
          await pool.query(`
            UPDATE producto_series 
            SET estado = 'VENDIDO'
            WHERE numero_serie = ?
          `, [serieInst]);

          // Actualizar en trabajador_series si estaba asignado
          if (id_trabajador) {
            await pool.query(`
              UPDATE trabajador_series 
              SET estado = 'Usada'
              WHERE id_trabajador = ? AND id_producto_serie = (SELECT id_producto_serie FROM producto_series WHERE numero_serie = ? LIMIT 1)
            `, [id_trabajador, serieInst]);
          }
        }
      }
    }

    // E. Registrar Equipos Retirados / Recogidos de Clientes (S/N Retirado)
    if (Array.isArray(equipos_retirados)) {
      for (const eqRet of equipos_retirados) {
        const serieRet = String(eqRet.numero_serie || '').trim().toUpperCase();
        if (serieRet) {
          await pool.query(`
            INSERT INTO orden_equipos_retirados (
              id_orden, id_trabajador, tipo_equipo, numero_serie,
              motivo_retiro, estado, fecha_recojo, observaciones
            ) VALUES (?, ?, ?, ?, ?, 'En_Poder_Tecnico', NOW(), ?)
          `, [
            idOrden, id_trabajador || 0, eqRet.tipo_equipo || 'ONT',
            serieRet, eqRet.motivo_retiro || 'Cambio por avería / postventa',
            observaciones_tecnico || 'Recogido en domicilio del cliente'
          ]);
        }
      }
    }

    // F. Descontar la Guía / Acta Física del Stock del Técnico
    if (numero_guia && id_trabajador) {
      const cleanGuiaNum = String(numero_guia).trim();
      const numSinPrefijo = cleanGuiaNum.replace(/^001-?/i, '');

      try {
        const [serieRows] = await pool.query(`
          SELECT ps.id_producto_serie, ps.id_producto
          FROM producto_series ps
          JOIN trabajador_series ts ON ps.id_producto_serie = ts.id_producto_serie
          WHERE ts.id_trabajador = ? 
            AND (ps.numero_serie = ? OR ps.numero_serie = ? OR ps.numero_serie = ?)
            AND ts.estado = 'Asignada'
          LIMIT 1
        `, [id_trabajador, cleanGuiaNum, numSinPrefijo, `001-${numSinPrefijo}`]);

        if (serieRows.length > 0) {
          const idProdSerie = serieRows[0].id_producto_serie;
          const idProd = serieRows[0].id_producto;

          await pool.query("UPDATE producto_series SET estado = 'CONSUMIDO' WHERE id_producto_serie = ?", [idProdSerie]);
          await pool.query("UPDATE trabajador_series SET estado = 'Usada' WHERE id_trabajador = ? AND id_producto_serie = ?", [id_trabajador, idProdSerie]);
          await pool.query("UPDATE trabajador_productos SET stock = GREATEST(0, stock - 1) WHERE id_trabajador = ? AND id_producto = ?", [id_trabajador, idProd]);
        }
      } catch (errGuia) {
        console.warn("Aviso al descontar serie de guía:", errGuia.message);
      }
    }

    res.json({
      success: true,
      message: `Acta #${numero_guia || idLiquidacion} guardada y orden liquidada con éxito. Materiales descontados del inventario móvil.`,
      id_liquidacion: idLiquidacion
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- 📦 7. LISTAR EQUIPOS RECOGIDOS POR TÉCNICOS (BANDEJA DE INTERNAMIENTO) ---
app.get('/api/almacen/equipos-recogidos', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        er.id_equipo_retirado,
        er.id_orden,
        er.tipo_equipo,
        er.numero_serie,
        er.motivo_retiro,
        er.estado,
        er.fecha_recojo,
        er.fecha_internamiento,
        er.recibido_por,
        er.observaciones,
        o.ticket,
        o.cliente,
        o.direccion,
        o.distrito,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS tecnico_nombre,
        u.cuadrilla
      FROM orden_equipos_retirados er
      JOIN ordenes o ON er.id_orden = o.id_orden
      LEFT JOIN trabajadores t ON er.id_trabajador = t.id_trabajador
      LEFT JOIN usuarios u ON t.id_usuario = u.id_usuario
      ORDER BY er.fecha_recojo DESC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- 📦 8. CONFIRMAR INTERNAMIENTO FÍSICO EN ALMACÉN CENTRAL ---
app.post('/api/almacen/internar-equipo', async (req, res) => {
  try {
    const { id_equipo_retirado, estado_destino, recibido_por, observaciones } = req.body;

    if (!id_equipo_retirado) {
      return res.status(400).json({ error: "id_equipo_retirado es requerido" });
    }

    const estadoFinal = estado_destino || 'Internado_Almacen'; // 'Internado_Almacen', 'Defectuoso', 'Baja'

    await pool.query(`
      UPDATE orden_equipos_retirados SET
        estado = ?,
        id_almacen_destino = 1,
        recibido_por = ?,
        fecha_internamiento = NOW(),
        observaciones = CONCAT(COALESCE(observaciones, ''), ' | Internado: ', COALESCE(?, ''))
      WHERE id_equipo_retirado = ?
    `, [estadoFinal, recibido_por || 'Almacén Central', observaciones || 'Recepción confirmada', id_equipo_retirado]);

    res.json({ success: true, message: "Equipo retirado internado en Almacén Central exitosamente." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- 🔍 9. TRAZABILIDAD COMPLETA DE UNA SERIE (BUSCADOR UNIVERSAL) ---
app.get('/api/almacen/trazabilidad-serie/:serie', async (req, res) => {
  try {
    const serie = req.params.serie.trim().toUpperCase();

    // 1. Estado en producto_series
    const [serieInfo] = await pool.query(`
      SELECT ps.*, p.nombre AS producto_nombre, p.codigo AS producto_codigo, a.nombre AS almacen_nombre
      FROM producto_series ps
      JOIN productos p ON ps.id_producto = p.id_producto
      LEFT JOIN almacenes a ON ps.id_almacen = a.id_almacen
      WHERE ps.numero_serie = ?
    `, [serie]);

    // 2. Historial de compras
    const [compraInfo] = await pool.query(`
      SELECT c.*, pr.razon_social AS proveedor_nombre, pr.ruc AS proveedor_ruc
      FROM detalle_compras dc
      JOIN compras c ON dc.id_compra = c.id_compra
      LEFT JOIN proveedores pr ON c.id_proveedor = pr.id_proveedor
      WHERE dc.series_ingresadas LIKE ?
    `, [`%${serie}%`]);

    // 3. Asignación a técnico
    const [asignaciones] = await pool.query(`
      SELECT ts.*, TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS tecnico_nombre, u.cuadrilla
      FROM trabajador_series ts
      JOIN trabajadores t ON ts.id_trabajador = t.id_trabajador
      JOIN usuarios u ON t.id_usuario = u.id_usuario
      WHERE ts.id_producto_serie = (SELECT id_producto_serie FROM producto_series WHERE numero_serie = ? LIMIT 1)
    `, [serie]);

    // 4. Si fue retirado de algún cliente
    const [retiros] = await pool.query(`
      SELECT er.*, o.ticket, o.cliente, o.direccion, o.distrito
      FROM orden_equipos_retirados er
      JOIN ordenes o ON er.id_orden = o.id_orden
      WHERE er.numero_serie = ?
    `, [serie]);

    res.json({
      serie,
      existe: serieInfo.length > 0 || retiros.length > 0,
      detalle: serieInfo[0] || null,
      compra: compraInfo[0] || null,
      asignaciones,
      retiros
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// 🛡️ MÓDULO DE AUDITORÍA, CONTROL DE ACTIVIDAD Y USUARIOS EN LÍNEA
// ============================================================================

// --- 🛡️ 1. HEARTBEAT / REGISTRAR PRESENCIA EN LÍNEA ---
app.post(['/api/auditoria/heartbeat', '/auditoria/heartbeat'], async (req, res) => {
  try {
    const { id_usuario, usuario_nombre, modulo, distrito_conexion, lat_conexion, lng_conexion } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';

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
      await pool.query(`
        UPDATE usuarios 
        SET ultimo_acceso = NOW(), 
            esta_online = 1,
            distrito_conexion = COALESCE(?, distrito_conexion),
            lat_conexion = COALESCE(?, lat_conexion),
            lng_conexion = COALESCE(?, lng_conexion),
            ip_conexion = ?
        WHERE (TRIM(CONCAT(COALESCE(nombres, ''), ' ', COALESCE(primer_apellido, apellidos, ''))) LIKE ? OR nombres LIKE ? OR usuario = ?)
        LIMIT 1
      `, [distrito_conexion || null, lat_conexion || null, lng_conexion || null, ip, `%${usuario_nombre.trim()}%`, `%${usuario_nombre.trim()}%`, usuario_nombre.trim()]);
    }
    res.json({ success: true, timestamp: new Date() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// 💬 MÓDULO DE CHAT INTERNO Y MENSAJERÍA DE EQUIPO
// ============================================================================

// --- 💬 1. LISTAR MENSAJES (CANAL GENERAL O CHAT PRIVADO) ---
app.get(['/api/chat/mensajes', '/chat/mensajes'], async (req, res) => {
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

// --- 💬 1.1 OBTENER CONTEO DE MENSAJES NO LEÍDOS ---
app.get(['/api/chat/noleidos', '/chat/noleidos'], async (req, res) => {
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

// --- 💬 2. ENVIAR MENSAJE DE CHAT ---
app.post(['/api/chat/enviar', '/chat/enviar'], async (req, res) => {
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

// --- 🛡️ 2. REGISTRAR LOG DE AUDITORÍA EXPLÍCITO ---
app.post(['/api/auditoria/registrar', '/auditoria/registrar'], async (req, res) => {
  try {
    const { id_usuario, usuario_nombre, modulo, accion, id_referencia, descripcion } = req.body;
    await registrarAuditoria(pool, { id_usuario, usuario_nombre, modulo, accion, id_referencia, descripcion, req });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- 🛡️ 3. LISTAR USUARIOS DEL PERSONAL EN LÍNEA (NO TÉCNICOS) ---
app.get(['/api/auditoria/usuarios-online', '/auditoria/usuarios-online'], async (req, res) => {
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

// --- 🛡️ 4. FEED DE LOGS DE AUDITORÍA CON FILTROS ---
app.get(['/api/auditoria/logs', '/auditoria/logs'], async (req, res) => {
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
      sql += ` AND modulo = ?`;
      params.push(modulo);
    }
    if (id_usuario && id_usuario !== 'Todos') {
      sql += ` AND id_usuario = ?`;
      params.push(id_usuario);
    }

    const limitVal = Math.min(200, Math.max(1, Number(limite) || 60));
    sql += ` ORDER BY fecha_creacion DESC LIMIT ${limitVal}`;

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- 🛡️ 5. MÉTRICAS DE PRODUCTIVIDAD POR GESTOR ---
app.get(['/api/auditoria/metricas-gestores', '/auditoria/metricas-gestores'], async (req, res) => {
  try {
    const { fecha, desde, hasta } = req.query;
    let sql = `
      SELECT 
        COALESCE(a.id_usuario, 0) AS id_usuario,
        COALESCE(a.usuario_nombre, 'Gestor de Órdenes') AS usuario_nombre,
        COALESCE(a.rol_nombre, 'GESTION') AS rol_nombre,
        COALESCE(a.area, 'Operaciones') AS area,
        COUNT(*) AS total_acciones,
        SUM(CASE WHEN a.accion = 'OBSERVACION_LLAMADA' OR a.accion = 'INCONCERT_TOGGLE' THEN 1 ELSE 0 END) AS llamadas_gestionadas,
        SUM(CASE WHEN a.accion = 'ASIGNACION_TECNICO' THEN 1 ELSE 0 END) AS ordenes_asignadas,
        SUM(CASE WHEN a.accion LIKE '%ESTADO%' THEN 1 ELSE 0 END) AS cambios_estado,
        MAX(a.fecha_creacion) AS ultima_actividad
      FROM auditoria_actividad a
      WHERE 1=1
    `;
    const params = [];

    if (desde && hasta) {
      sql += ` AND DATE(a.fecha_creacion) >= ? AND DATE(a.fecha_creacion) <= ?`;
      params.push(desde, hasta);
    } else if (fecha) {
      sql += ` AND DATE(a.fecha_creacion) = ?`;
      params.push(fecha);
    } else {
      sql += ` AND DATE(a.fecha_creacion) = CURDATE()`;
    }

    sql += `
      GROUP BY COALESCE(a.id_usuario, 0), a.usuario_nombre, a.rol_nombre, a.area
      ORDER BY total_acciones DESC
    `;

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// 📊 DASHBOARD GENERAL EJECUTIVO 24/7 (KPIs + GRÁFICOS + RESÚMENES)
// ============================================================================
app.get(['/api/dashboard/estadisticas', '/dashboard/estadisticas'], async (req, res) => {
  try {
    let { desde, hasta, anio, periodo } = req.query;
    const yearVal = anio || new Date().getFullYear();

    if (!desde && !hasta && periodo) {
      const hoy = new Date();
      const fmt = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      if (periodo === 'hoy') {
        desde = fmt(hoy);
        hasta = fmt(hoy);
      } else if (periodo === 'semana') {
        const lunes = new Date(hoy);
        lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
        const domingo = new Date(lunes);
        domingo.setDate(lunes.getDate() + 6);
        desde = fmt(lunes);
        hasta = fmt(domingo);
      } else if (periodo === 'mes') {
        const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        const ultimo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
        desde = fmt(primero);
        hasta = fmt(ultimo);
      } else if (periodo === 'anio') {
        desde = `${yearVal}-01-01`;
        hasta = `${yearVal}-12-31`;
      }
    }

    let dateCondOrdenes = '';
    let dateCondCompras = '';
    const paramsOrdenes = [];
    const paramsCompras = [];

    if (desde && hasta) {
      dateCondOrdenes = ' WHERE DATE(fecha_visita) >= ? AND DATE(fecha_visita) <= ?';
      dateCondCompras = ' WHERE DATE(fecha) >= ? AND DATE(fecha) <= ?';
      paramsOrdenes.push(desde, hasta);
      paramsCompras.push(desde, hasta);
    } else if (desde) {
      dateCondOrdenes = ' WHERE DATE(fecha_visita) >= ?';
      dateCondCompras = ' WHERE DATE(fecha) >= ?';
      paramsOrdenes.push(desde);
      paramsCompras.push(desde);
    } else if (hasta) {
      dateCondOrdenes = ' WHERE DATE(fecha_visita) <= ?';
      dateCondCompras = ' WHERE DATE(fecha) <= ?';
      paramsOrdenes.push(hasta);
      paramsCompras.push(hasta);
    }

    // 1. KPIs
    const [ordenesCount] = await pool.query(`SELECT COUNT(*) AS total FROM ordenes ${dateCondOrdenes}`, paramsOrdenes);
    const [finalizadasCount] = await pool.query(`SELECT COUNT(*) AS total FROM ordenes ${dateCondOrdenes ? dateCondOrdenes + " AND estado = 'Finalizada'" : "WHERE estado = 'Finalizada'"}`, paramsOrdenes);
    const [canceladasCount] = await pool.query(`
      SELECT COUNT(*) AS total 
      FROM ordenes 
      ${dateCondOrdenes ? dateCondOrdenes + " AND estado IN ('Cancelada', 'Regestión', 'Anulada', 'Observada', 'Suspendida')" : "WHERE estado IN ('Cancelada', 'Regestión', 'Anulada', 'Observada', 'Suspendida')"}
    `, paramsOrdenes);
    const [enProcesoCount] = await pool.query(`
      SELECT COUNT(*) AS total 
      FROM ordenes 
      ${dateCondOrdenes ? dateCondOrdenes + " AND estado IN ('Iniciada', 'En camino', 'Agendada', 'Revisión')" : "WHERE estado IN ('Iniciada', 'En camino', 'Agendada', 'Revisión')"}
    `, paramsOrdenes);
    const [liquidacionesCount] = await pool.query(`SELECT COUNT(*) AS total FROM orden_liquidaciones`);
    const [productosCount] = await pool.query(`SELECT COUNT(*) AS total FROM productos WHERE estado = 'Activo'`);
    const [tecnicosCount] = await pool.query(`
      SELECT COUNT(*) AS total 
      FROM trabajadores t
      LEFT JOIN usuarios u ON t.id_usuario = u.id_usuario
      WHERE u.id_rol = 2 OR t.estado = 'Activo'
    `);
    
    // Total compras del mes actual
    const [comprasSum] = await pool.query(`
      SELECT COALESCE(SUM(total), 0) AS total 
      FROM compras 
      WHERE MONTH(fecha) = MONTH(CURRENT_DATE()) AND YEAR(fecha) = YEAR(CURRENT_DATE()) AND estado != 'ANULADA'
    `);

    // Personal online
    const [onlineCount] = await pool.query(`
      SELECT COUNT(*) AS total 
      FROM usuarios 
      WHERE ultimo_acceso >= DATE_SUB(NOW(), INTERVAL 15 MINUTE) AND (id_rol != 2 OR id_rol IS NULL)
    `);

    // 2. Órdenes por estado
    const [estadosRows] = await pool.query(`
      SELECT COALESCE(estado, 'Sin estado') AS estado, COUNT(*) AS total 
      FROM ordenes ${dateCondOrdenes}
      GROUP BY estado 
      ORDER BY total DESC
    `, paramsOrdenes);

    // 3. Órdenes por mes del año
    const [mesesRows] = await pool.query(`
      SELECT 
        MONTH(fecha_visita) AS mes, 
        COUNT(*) AS total, 
        SUM(CASE WHEN estado = 'Finalizada' THEN 1 ELSE 0 END) AS finalizadas 
      FROM ordenes 
      WHERE YEAR(fecha_visita) = ? 
      GROUP BY MONTH(fecha_visita) 
      ORDER BY mes ASC
    `, [yearVal]);

    // 4. Stock por almacén (Top 15)
    const [stockRows] = await pool.query(`
      SELECT 
        a.nombre AS almacen_nombre,
        p.nombre AS producto_nombre,
        COALESCE(c.nombre, p.categoria_liquidar, 'General') AS categoria,
        s.cantidad AS stock,
        p.stock_minimo AS stock_minimo,
        CASE 
          WHEN s.cantidad <= 0 THEN 'Sin stock'
          WHEN s.cantidad <= COALESCE(p.stock_minimo, 5) THEN 'Bajo'
          ELSE 'OK'
        END AS estado_stock
      FROM stock s
      JOIN productos p ON s.id_producto = p.id_producto
      JOIN almacenes a ON s.id_almacen = a.id_almacen
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      ORDER BY s.cantidad DESC
      LIMIT 15
    `);

    res.json({
      success: true,
      kpis: {
        total_ordenes: ordenesCount[0]?.total || 0,
        ordenes_finalizadas: finalizadasCount[0]?.total || 0,
        ordenes_canceladas_observadas: canceladasCount[0]?.total || 0,
        ordenes_en_proceso: enProcesoCount[0]?.total || 0,
        total_liquidaciones: liquidacionesCount[0]?.total || 0,
        total_productos: productosCount[0]?.total || 0,
        total_tecnicos: tecnicosCount[0]?.total || 0,
        compras_mes: parseFloat(comprasSum[0]?.total || 0),
        personal_online: onlineCount[0]?.total || 0,
      },
      ordenes_por_estado: estadosRows,
      ordenes_por_mes: mesesRows,
      stock_almacen: stockRows,
    });
  } catch (error) {
    console.error("Error en dashboard estadisticas:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// 📡 ENDPOINTS LOOKER STUDIO: TARJETAS Y ALERTAS ZONA SUR
// ============================================================
const lookerService = require('./looker_alert_service');

app.get(['/api/looker/resumen', '/looker/resumen'], async (req, res) => {
  try {
    const orders = await lookerService.fetchLookerOrders();
    const result = lookerService.processCardsAndAlerts(orders);
    res.json({ success: true, ...result });
  } catch (error) {
    // Si falla la consulta en vivo, intentar devolver el último resultado guardado en cache
    try {
      const cachePath = path.join(__dirname, 'cards_and_alerts.json');
      if (fs.existsSync(cachePath)) {
        const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        return res.json({ success: true, fromCache: true, ...cached });
      }
    } catch {}
    // 🛡️ Fallback seguro (200 OK) si no hay conexión a Looker
    res.json({
      success: true,
      fromCache: false,
      timestamp: new Date().toISOString(),
      totalGeneral: 0,
      totalAlertasSur: 0,
      cards: {
        "AVERIAS PREFERENTE": { total: 0, zonas: {}, ordenes: [] },
        "AVERIAS ALTO VALOR": { total: 0, zonas: {}, ordenes: [] },
        "MOTOWIN ZONAS": { total: 0, zonas: {}, ordenes: [] }
      },
      alertasSur: []
    });
  }
});

app.get(['/api/looker/alertas-sur', '/looker/alertas-sur'], async (req, res) => {
  try {
    const orders = await lookerService.fetchLookerOrders();
    const result = lookerService.processCardsAndAlerts(orders);
    res.json({
      success: true,
      totalAlertas: result.totalAlertasSur,
      alertas: result.alertasSur
    });
  } catch (error) {
    try {
      const cachePath = path.join(__dirname, 'cards_and_alerts.json');
      if (fs.existsSync(cachePath)) {
        const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        return res.json({
          success: true,
          fromCache: true,
          totalAlertas: cached.totalAlertasSur || cached.alertasSur?.length || 0,
          alertas: cached.alertasSur || []
        });
      }
    } catch {}
    res.json({
      success: true,
      fromCache: false,
      totalAlertas: 0,
      alertas: []
    });
  }
});

app.post(['/api/looker/launch-login', '/looker/launch-login'], async (req, res) => {
  try {
    const puppeteer = require('puppeteer-core');
    const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
    const REAL_USER_DATA = path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data');
    const FALLBACK_USER_DATA = path.join(__dirname, 'chrome_looker_profile');
    const USER_DATA_DIR = (fs.existsSync(REAL_USER_DATA)) ? REAL_USER_DATA : FALLBACK_USER_DATA;
    const SESSION_FILE = path.join(__dirname, 'looker_session.json');
    const TARGET_URL = 'https://datastudio.google.com/u/0/reporting/15ece5ee-2129-40d6-8122-d83aebc89318/page/p_lfut5i1r5d';

    console.log('🚀 Abriendo ventana de Chrome con tu sesión de usuario activa...');

    let browser;
    try {
      browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        userDataDir: USER_DATA_DIR,
        headless: false,
        defaultViewport: null,
        args: [
          '--profile-directory=Default',
          '--start-maximized',
          '--disable-notifications'
        ]
      });
    } catch (launchErr) {
      console.warn('Usando perfil de respaldo por bloqueo de Chrome:', launchErr.message);
      browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        userDataDir: FALLBACK_USER_DATA,
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized', '--disable-notifications']
      });
    }

    const page = await browser.newPage();
    await page.setRequestInterception(true);

    let captured = false;

    page.on('request', async (request) => {
      const url = request.url();
      if (url.includes('batchedDataV2')) {
        const headers = request.headers();
        const cookie = headers['cookie'];
        const xsrf = headers['x-rap-xsrf-token'];

        if (cookie && xsrf && !captured) {
          captured = true;
          const urlObj = new URL(url);
          const appVersion = urlObj.searchParams.get('appVersion') || '20260823_0000';

          const sessionData = {
            appVersion: appVersion,
            url: url,
            x_rap_xsrf_token: xsrf,
            cookie: cookie,
            updated_at: new Date().toISOString()
          };

          fs.writeFileSync(SESSION_FILE, JSON.stringify(sessionData, null, 2));

          try {
            await pool.query(
              `INSERT INTO configuracion (clave, valor, grupo, descripcion, updated_at)
               VALUES ('LOOKER_SESSION', ?, 'tiempo_real', 'Sesión / Cookies Google Looker Studio', NOW())
               ON DUPLICATE KEY UPDATE valor = VALUES(valor), updated_at = NOW()`,
              [JSON.stringify(sessionData)]
            );
          } catch (e) {
            console.error('Error guardando en BD:', e.message);
          }

          console.log('🎉 ¡Sesión capturada y guardada en MySQL y disco!');
          setTimeout(async () => {
            try { await browser.close(); } catch {}
          }, 2000);
        }
      }
      request.continue();
    });

    await page.goto(TARGET_URL);

    res.json({
      success: true,
      mensaje: 'Ventana de inicio de sesión de Google abierta. Por favor, ingresa tu cuenta en la ventana de Chrome.'
    });
  } catch (error) {
    console.error('Error al abrir navegador de login:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));

// Servidor Telecom API listo
module.exports = app;