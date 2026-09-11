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
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const { sincronizarTareasOrdenSeguro, getTareasDeBD, sincronizarTareasOrdenesActivas, guardarDetalleTareaEnBD, getMetrajeDeclaradoFenix } = require('./services/taskSyncService');

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

// --- 🔐 AUTENTICACIÓN / LOGIN DIRECTO EN API ---
app.post(['/login', '/api/login'], async (req, res) => {
  try {
    const { usuario, password } = req.body;
    if (!usuario || !password) {
      return res.status(400).json({ success: false, mensaje: "Ingrese usuario y contraseña." });
    }

    const [rows] = await pool.query(`
      SELECT 
        u.id_usuario,
        u.id_rol,
        u.usuario,
        u.password,
        u.nombres,
        u.primer_apellido,
        u.segundo_apellido,
        u.apellidos,
        u.email,
        u.area,
        u.foto_personal,
        u.estado,
        r.nombre as nombre_rol
      FROM usuarios u
      LEFT JOIN roles r ON u.id_rol = r.id_rol
      WHERE u.usuario = ?
      LIMIT 1
    `, [usuario.trim()]);

    if (rows.length === 0) {
      return res.status(401).json({ success: false, mensaje: "Usuario o contraseña incorrectos." });
    }

    const u = rows[0];

    if (u.estado !== 'Activo') {
      return res.status(403).json({ success: false, mensaje: "El usuario se encuentra inactivo. Consulte con RRHH." });
    }

    // Validación de contraseña (soporta texto plano o hash si aplica)
    if (String(u.password).trim() !== String(password).trim()) {
      return res.status(401).json({ success: false, mensaje: "Usuario o contraseña incorrectos." });
    }

    // Obtener permisos del rol
    let permisos = [];
    if (Number(u.id_rol) === 1 || (u.nombre_rol && u.nombre_rol.toUpperCase().includes('ADMIN'))) {
      const [allPerms] = await pool.query("SELECT clave FROM permisos WHERE estado = 'Activo'");
      permisos = allPerms.map(p => p.clave);
    } else {
      const [permRows] = await pool.query(`
        SELECT p.clave, p.modulo
        FROM permisos p
        INNER JOIN roles_permisos rp ON rp.id_permiso = p.id_permiso
        WHERE rp.id_rol = ? AND p.estado = 'Activo'
      `, [u.id_rol]);
      permisos = permRows.map(p => p.clave);
    }

    // Marcar usuario online
    await pool.query("UPDATE usuarios SET ultimo_acceso = NOW(), esta_online = 1, ultima_accion = 'Inicio de sesión' WHERE id_usuario = ?", [u.id_usuario]);

    const nombreCompleto = `${u.nombres} ${u.primer_apellido || u.apellidos || ''}`.trim();

    res.json({
      success: true,
      user: {
        id_usuario: u.id_usuario,
        id_rol: u.id_rol,
        usuario: u.usuario,
        nombres: u.nombres,
        apellidos: u.apellidos || `${u.primer_apellido || ''} ${u.segundo_apellido || ''}`.trim(),
        nombreCompleto,
        email: u.email,
        rol: u.nombre_rol || 'Usuario',
        area: u.area || '',
        foto_personal: u.foto_personal || null,
        permisos
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, mensaje: error.message });
  }
});

app.post(['/logout', '/api/logout'], async (req, res) => {
  try {
    const { id_usuario } = req.body;
    if (id_usuario) {
      await pool.query("UPDATE usuarios SET esta_online = 0, ultima_accion = 'Cierre de sesión' WHERE id_usuario = ?", [id_usuario]);
    }
    res.json({ success: true, message: "Sesión cerrada correctamente." });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

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

    // Vincular automáticamente en la tabla trabajadores
    await connection.query(
      `INSERT INTO trabajadores (id_usuario, id_horario, fecha_ingreso, estado) VALUES (?, 1, COALESCE(?, CURDATE()), 'Activo') ON DUPLICATE KEY UPDATE estado = 'Activo'`,
      [r.insertId, dateOrNull(d.fechaIngreso)]
    );

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

// --- 👥 ROLES CRUD ---
app.get(['/roles', '/api/roles'], async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT id_rol, nombre, descripcion, estado FROM roles ORDER BY id_rol ASC");
    res.json(rows);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/roles', async (req, res) => {
  try {
    const { nombre, descripcion, estado = 'Activo' } = req.body;
    if (!nombre || !nombre.trim()) return res.status(400).json({ error: "El nombre del rol es requerido." });
    const [result] = await pool.query(
      "INSERT INTO roles (nombre, descripcion, estado) VALUES (?, ?, ?)",
      [nombre.trim().toUpperCase(), descripcion?.trim() || null, estado]
    );
    res.json({ success: true, id_rol: result.insertId, message: "Rol creado con éxito." });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/api/roles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, estado } = req.body;
    await pool.query(
      "UPDATE roles SET nombre = COALESCE(?, nombre), descripcion = COALESCE(?, descripcion), estado = COALESCE(?, estado) WHERE id_rol = ?",
      [nombre?.trim()?.toUpperCase() || null, descripcion !== undefined ? descripcion?.trim() : null, estado || null, id]
    );
    res.json({ success: true, message: "Rol actualizado con éxito." });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/roles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("UPDATE roles SET estado = 'Inactivo' WHERE id_rol = ?", [id]);
    res.json({ success: true, message: "Rol desactivado con éxito." });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- 🏢 ÁREAS CRUD ---
app.get(['/areas', '/api/areas'], async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        a.id_area, 
        a.nombre, 
        a.estado, 
        a.fecha_creacion,
        (SELECT COUNT(*) FROM usuarios u WHERE LOWER(TRIM(u.area)) = LOWER(TRIM(a.nombre))) AS total_empleados
      FROM areas a 
      ORDER BY a.nombre ASC
    `);
    res.json(rows);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/areas', async (req, res) => {
  try {
    const { nombre, estado = 'Activo' } = req.body;
    if (!nombre || !nombre.trim()) return res.status(400).json({ error: "El nombre del área es requerido." });
    const [result] = await pool.query(
      "INSERT INTO areas (nombre, estado) VALUES (?, ?)",
      [nombre.trim(), estado]
    );
    res.json({ success: true, id_area: result.insertId, message: "Área creada con éxito." });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/api/areas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, estado } = req.body;
    await pool.query(
      "UPDATE areas SET nombre = COALESCE(?, nombre), estado = COALESCE(?, estado) WHERE id_area = ?",
      [nombre?.trim() || null, estado || null, id]
    );
    res.json({ success: true, message: "Área actualizada con éxito." });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/areas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("UPDATE areas SET estado = 'Inactivo' WHERE id_area = ?", [id]);
    res.json({ success: true, message: "Área desactivada con éxito." });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ==========================================
// ⚙️ CONFIGURACIÓN: MOTIVOS, TIPOS DE TRABAJO, SISTEMA Y PERMISOS
// ==========================================

// --- 1. MOTIVOS CRUD ---
app.get(['/motivos', '/api/motivos'], async (req, res) => {
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

app.post('/api/motivos', async (req, res) => {
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

app.put('/api/motivos/:id', async (req, res) => {
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

app.delete('/api/motivos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("UPDATE motivos SET estado = 'Inactivo' WHERE id_motivo = ?", [id]);
    res.json({ success: true, message: "Motivo desactivado con éxito." });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- 2. TIPOS DE TRABAJO CRUD ---
app.get(['/tipos-trabajo', '/api/tipos-trabajo'], async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT id_tipo_trabajo, nombre, COALESCE(precio_cespedes, 0.00) AS precio_cespedes, estado FROM tipos_trabajo ORDER BY nombre ASC");
    res.json(rows);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/tipos-trabajo', async (req, res) => {
  try {
    const { nombre, precio_cespedes = 0.00, estado = 'Activo' } = req.body;
    if (!nombre || !nombre.trim()) return res.status(400).json({ error: "El nombre es requerido." });
    const pCespedes = parseFloat(precio_cespedes) || 0.00;
    const [result] = await pool.query(
      "INSERT INTO tipos_trabajo (nombre, precio_cespedes, estado) VALUES (?, ?, ?)",
      [nombre.trim().toUpperCase(), pCespedes, estado]
    );
    res.json({ success: true, id_tipo_trabajo: result.insertId, message: "Tipo de trabajo creado con éxito." });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/api/tipos-trabajo/:id', async (req, res) => {
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

app.delete('/api/tipos-trabajo/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("UPDATE tipos_trabajo SET estado = 'Inactivo' WHERE id_tipo_trabajo = ?", [id]);
    res.json({ success: true, message: "Tipo de trabajo desactivado con éxito." });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- 3. CONFIGURACIÓN DEL SISTEMA (Variables Globales) ---
app.get('/api/configuracion/sistema', async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT id, clave, valor, descripcion, grupo, updated_at FROM configuracion ORDER BY grupo ASC, clave ASC");
    res.json(rows);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/configuracion/sistema', async (req, res) => {
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

// --- 4. ROLES Y PERMISOS MATRIZ ---
app.get('/api/permisos/resumen', async (req, res) => {
  try {
    const [roles] = await pool.query(`
      SELECT 
        r.id_rol, 
        r.nombre AS nombre_rol, 
        r.estado,
        COUNT(rp.id_permiso) AS total_permisos,
        GROUP_CONCAT(DISTINCT SUBSTRING_INDEX(p.clave, '.', 1) ORDER BY SUBSTRING_INDEX(p.clave, '.', 1) SEPARATOR ',') AS modulos_activos
      FROM roles r
      LEFT JOIN roles_permisos rp ON rp.id_rol = r.id_rol
      LEFT JOIN permisos p ON p.id_permiso = rp.id_permiso AND p.estado = 'Activo'
      GROUP BY r.id_rol
      ORDER BY r.id_rol ASC
    `);

    const [todosPermisos] = await pool.query("SELECT id_permiso, nombre, clave, modulo, estado FROM permisos WHERE estado = 'Activo'");

    res.json({ success: true, roles, permisos: todosPermisos });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/permisos/rol/:id_rol', async (req, res) => {
  try {
    const { id_rol } = req.params;
    let rows;
    if (Number(id_rol) === 1) {
      const [allRows] = await pool.query(`
        SELECT id_permiso, clave, nombre, modulo
        FROM permisos
        WHERE estado = 'Activo'
      `);
      rows = allRows;
    } else {
      const [permRows] = await pool.query(`
        SELECT p.id_permiso, p.clave, p.nombre, p.modulo
        FROM permisos p
        JOIN roles_permisos rp ON rp.id_permiso = p.id_permiso
        WHERE rp.id_rol = ? AND p.estado = 'Activo'
      `, [id_rol]);
      rows = permRows;
    }
    res.json({ success: true, claves: rows.map(r => r.clave), permisos: rows });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/permisos/guardar', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { id_rol, claves } = req.body;
    if (!id_rol) return res.status(400).json({ error: "id_rol es requerido." });

    const clavesArr = Array.isArray(claves) ? claves : (typeof claves === 'string' ? JSON.parse(claves || '[]') : []);

    // 1. Eliminar permisos anteriores del rol
    await connection.query("DELETE FROM roles_permisos WHERE id_rol = ?", [id_rol]);

    // 2. Insertar cada permiso
    for (const clv of clavesArr) {
      const cleanClave = String(clv).trim();
      if (!cleanClave || !cleanClave.includes('.')) continue;

      const [modulo, accion] = cleanClave.split('.');
      const nombre = `${accion.charAt(0).toUpperCase() + accion.slice(1)} ${modulo.charAt(0).toUpperCase() + modulo.slice(1)}`;

      let [perm] = await connection.query("SELECT id_permiso FROM permisos WHERE clave = ?", [cleanClave]);
      let idPermiso;
      if (perm.length > 0) {
        idPermiso = perm[0].id_permiso;
      } else {
        const [ins] = await connection.query(
          "INSERT INTO permisos (nombre, clave, modulo, estado) VALUES (?, ?, ?, 'Activo')",
          [nombre, cleanClave, modulo]
        );
        idPermiso = ins.insertId;
      }

      await connection.query(
        "INSERT IGNORE INTO roles_permisos (id_rol, id_permiso) VALUES (?, ?)",
        [id_rol, idPermiso]
      );
    }

    await connection.commit();
    res.json({ success: true, message: "Permisos del rol actualizados con éxito." });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

app.delete('/api/permisos/rol/:id_rol', async (req, res) => {
  try {
    const { id_rol } = req.params;
    await pool.query("DELETE FROM roles_permisos WHERE id_rol = ?", [id_rol]);
    res.json({ success: true, message: "Permisos eliminados del rol." });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- 📧 MÓDULO DE CORREOS / SMTP ---
const nodemailer = require('nodemailer');

// 1. Obtener configuración SMTP
app.get('/api/correos/config', async (req, res) => {
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

// 2. Guardar configuración SMTP
app.post('/api/correos/config', async (req, res) => {
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

// 3. Obtener técnicos con correo registrado
app.get('/api/correos/tecnicos', async (req, res) => {
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

// 4. Enviar correo de prueba
app.post('/api/correos/enviar-prueba', async (req, res) => {
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

// --- 💰 MÓDULO DE PAGOS Y LIQUIDACIÓN FINANCIERA A TÉCNICOS ---
app.get('/api/pagos/resumen', async (req, res) => {
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

    const tecnicos = Object.values(tecnicosMap).sort((a, b) => b.pago_tecnico - a.pago_tecnico);

    res.json({
      success: true,
      fecha_desde: desde,
      fecha_hasta: hasta,
      estado,
      totales,
      tecnicos
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/pagos/detalle/:id_trabajador', async (req, res) => {
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

    res.json({
      success: true,
      id_trabajador: Number(id_trabajador),
      tecnico: nombreTecnico,
      totales,
      ordenes
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- ⏱️ ASISTENCIAS & DESCANSOS (RRHH) ---

// 1. Obtener pase de asistencia por fecha (con lista completa de trabajadores y su estado)
app.get('/api/asistencias/diaria', async (req, res) => {
  try {
    const fecha = req.query.fecha || new Date().toISOString().slice(0, 10);
    const idRol = req.query.id_rol;

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
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''), ' ', COALESCE(u.segundo_apellido, ''))) AS nombre_completo,
        COALESCE(u.cuadrilla, '') AS cuadrilla,
        COALESCE(v.placa, '') AS vehiculo_placa,
        a.id_asistencia,
        a.fecha,
        COALESCE(a.hora_entrada, '') AS hora_entrada,
        COALESCE(a.hora_salida, '') AS hora_salida,
        a.estado,
        COALESCE(a.minutos_tarde, 0) AS minutos_tarde,
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
      WHERE (u.estado = 'Activo' OR u.estado IS NULL)
        ${rolFilter}
      ORDER BY u.cuadrilla ASC, nombre_completo ASC
    `, [fecha, ...params]);

    res.json({ fecha, asistencias: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Registrar o Actualizar Asistencia de un Trabajador (1-Clic o cambio de hora)
app.post('/api/asistencias/marcar', async (req, res) => {
  try {
    const { id_trabajador, id_usuario, fecha, estado, hora_entrada, hora_salida, minutos_tarde, observacion } = req.body;

    let targetTrabajadorId = null;

    // Prioridad 1: Si viene id_usuario, SIEMPRE resolver el id_trabajador real correspondiente
    if (id_usuario) {
      const [tRows] = await pool.query("SELECT id_trabajador FROM trabajadores WHERE id_usuario = ? LIMIT 1", [id_usuario]);
      if (tRows.length > 0) {
        targetTrabajadorId = tRows[0].id_trabajador;
      } else {
        const [insT] = await pool.query("INSERT INTO trabajadores (id_usuario, id_horario, fecha_ingreso, estado) VALUES (?, 1, CURDATE(), 'Activo')", [id_usuario]);
        targetTrabajadorId = insT.insertId;
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
    const defaultHoraEntrada = isNoWorkStatus ? null : '07:30:00';
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

// 3. Matriz de asistencias por rango de fechas (Semana o Mes para auditoría visual)
app.get('/api/asistencias/matriz', async (req, res) => {
  try {
    const { desde, hasta, id_rol } = req.query;
    if (!desde || !hasta) {
      return res.status(400).json({ error: "Fechas desde y hasta son requeridas." });
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
        r.nombre AS rol_nombre,
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
      SELECT a.id_asistencia, a.id_trabajador, t.id_usuario, a.fecha, a.hora_entrada, a.estado, a.minutos_tarde, a.observacion
      FROM asistencias a
      LEFT JOIN trabajadores t ON a.id_trabajador = t.id_trabajador
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

// 4. Descansos Programados (CRUD)
app.get('/api/asistencias/descansos', async (req, res) => {
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
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS nombre_completo,
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

app.post('/api/asistencias/descansos', async (req, res) => {
  try {
    const { id_trabajador, id_usuario, fecha_inicio, fecha_fin, motivo, estado = 'Programado' } = req.body;

    let targetTrabajadorId = null;
    if (id_usuario) {
      const [tRows] = await pool.query("SELECT id_trabajador FROM trabajadores WHERE id_usuario = ? LIMIT 1", [id_usuario]);
      if (tRows.length > 0) {
        targetTrabajadorId = tRows[0].id_trabajador;
      } else {
        const [insT] = await pool.query("INSERT INTO trabajadores (id_usuario, id_horario, fecha_ingreso, estado) VALUES (?, 1, CURDATE(), 'Activo')", [id_usuario]);
        targetTrabajadorId = insT.insertId;
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

app.delete('/api/asistencias/descansos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("UPDATE trabajador_descansos SET estado = 'Cancelado' WHERE id_descanso = ?", [id]);
    res.json({ success: true, message: "Descanso cancelado con éxito." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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
        TRIM(CONCAT(COALESCE(u2.nombres, ''), ' ', COALESCE(u2.primer_apellido, u2.apellidos, ''), ' ', COALESCE(u2.segundo_apellido, ''))) AS nombre_tecnico_2,
        tc.total_tareas,
        tc.tareas_finalizadas,
        tc.progreso_porcentaje
      FROM ordenes o
      LEFT JOIN usuarios u ON o.id_tecnico = u.id_usuario
      LEFT JOIN usuarios u2 ON o.id_tecnico_reemplazo = u2.id_usuario
      LEFT JOIN orden_tareas_cache tc ON o.numero = tc.numero_orden
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

    // Disparar en segundo plano la actualización de tareas para órdenes activas de hoy
    setTimeout(() => {
      sincronizarTareasOrdenesActivas().catch(e => console.error("Aviso tareas activas:", e.message));
    }, 1000);
  } catch (error) {
    ultimoErrorFenixTime = Date.now();
    console.error("❌ Error o timeout en sincronización Fénix:", error.message);
    res.status(500).json({ error: error.message });
  } finally {
    estaSincronizandoFenix = false; // Siempre liberar el candado
  }
});

// --- 1.2 OBTENER TAREAS EN TIEMPO REAL DE UNA ORDEN (BD CON PROTECCIÓN ANTI-BAN) ---
app.get('/ordenes/:numero/tareas', async (req, res) => {
  try {
    const { numero } = req.params;
    const forzar = req.query.fresh === 'true' || req.query.forceFresh === 'true';
    const result = await sincronizarTareasOrdenSeguro(numero, null, forzar);
    res.json({
      success: true,
      numero,
      fuente: result.fuente,
      total_tareas: result.total || (result.tareas ? result.tareas.length : 0),
      tareas_finalizadas: result.finalizadas || 0,
      progreso_porcentaje: result.pct || 0,
      ordeVisiId: null,
      tareas: result.tareas || []
    });
  } catch (error) {
    console.error("Error al obtener tareas de la orden:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- 1.3 ALERTAS OPERATIVAS PARA GESTIÓN (TÉCNICOS SIN ORDEN, ACTAS PENDIENTES, TRAMOS EN RIESGO) ---
app.get(['/api/ordenes/alertas-gestion', '/ordenes/alertas-gestion'], async (req, res) => {
  try {
    const fecha = req.query.fecha || new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());

    const normalizeStr = (str) => {
      if (!str) return '';
      return String(str).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
    };

    // Helper para extraer la clave canónica de cuadrilla (ej: "K 14 CESPEDES", "O 4 CESPEDES", "K 5 TRASLADO")
    const extractCuadrillaKey = (cuadStr) => {
      if (!cuadStr) return '';
      let clean = String(cuadStr)
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[-_.,]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      clean = clean.replace(/^CUADRILLA\s+/i, '');
      clean = clean.replace(/\b([A-Z])\s*0*(\d+)\b/g, '$1 $2');
      const tokens = clean.split(' ');
      if (tokens.length === 0) return '';
      const cleanWord = (w) => (w === 'TRASLADOS' ? 'TRASLADO' : w);
      if (tokens.length >= 3 && /^[A-Z]{1,3}$/.test(tokens[0]) && /^\d+$/.test(tokens[1])) {
        return tokens[0] + ' ' + parseInt(tokens[1], 10) + ' ' + cleanWord(tokens[2]);
      }
      if (tokens.length >= 2) {
        const match = tokens[0].match(/^([A-Z]+)(\d+)$/);
        if (match) return match[1] + ' ' + parseInt(match[2], 10) + ' ' + cleanWord(tokens[1]);
        return tokens[0] + ' ' + cleanWord(tokens[1]);
      }
      return cleanWord(tokens[0]);
    };

    // 1. Técnicos de rol 2 (TECNICO) en estado ACTIVO y su estado de asistencia de hoy
    const [tecnicos] = await pool.query(`
      SELECT 
        u.id_usuario,
        u.documento,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''), ' ', COALESCE(u.segundo_apellido, ''))) AS nombre_completo,
        COALESCE(u.cuadrilla, '') AS cuadrilla,
        COALESCE(v.placa, '') AS vehiculo_placa,
        a.estado AS estado_asistencia,
        a.hora_entrada,
        (
          SELECT COUNT(*) FROM trabajador_descansos td
          JOIN trabajadores t2 ON td.id_trabajador = t2.id_trabajador
          WHERE t2.id_usuario = u.id_usuario
            AND ? BETWEEN td.fecha_inicio AND td.fecha_fin
            AND td.estado != 'Cancelado'
        ) AS tiene_descanso_programado
      FROM usuarios u
      LEFT JOIN trabajadores t ON u.id_usuario = t.id_usuario
      LEFT JOIN vehiculos v ON t.id_vehiculo = v.id_vehiculo
      LEFT JOIN asistencias a ON t.id_trabajador = a.id_trabajador AND a.fecha = ?
      WHERE u.id_rol = 2 AND u.estado = 'Activo'
      ORDER BY u.cuadrilla ASC, nombre_completo ASC
    `, [fecha, fecha]);

    // 2. Órdenes del día
    const [ordenes] = await pool.query(`
      SELECT 
        o.id_orden, o.numero, o.cliente, o.id_tecnico, o.tecnico_asignado, o.cuadrilla, o.estado,
        o.hora_asignacion, o.hora_en_camino, o.inicio_visita, o.fin_visita, o.fecha_visita, o.fecha_solicitud,
        tc.total_tareas, tc.tareas_finalizadas, tc.progreso_porcentaje, tc.tareas_json, tc.fecha_sincronizacion
      FROM ordenes o
      LEFT JOIN orden_tareas_cache tc ON o.numero = tc.numero_orden
      WHERE (
        (o.fecha_solicitud >= ? AND o.fecha_solicitud <= ?)
        OR (o.fecha_solicitud IS NULL AND o.fecha_visita >= ? AND o.fecha_visita <= ?)
        OR (o.fecha_solicitud IS NULL AND o.fecha_visita IS NULL AND o.fecha_creacion >= ? AND o.fecha_creacion <= ?)
      )
    `, [
      `${fecha} 00:00:00`, `${fecha} 23:59:59`,
      `${fecha} 00:00:00`, `${fecha} 23:59:59`,
      `${fecha} 00:00:00`, `${fecha} 23:59:59`
    ]);

    // 3. Mapear cuadrillas y técnicos que YA tienen órdenes hoy (Trabajando)
    const cuadrillasTrabajando = new Set();
    const tecnicosTrabajando = new Set();

    for (const o of ordenes) {
      if (o.id_tecnico) tecnicosTrabajando.add(String(o.id_tecnico));
      if (o.tecnico_asignado) tecnicosTrabajando.add(normalizeStr(o.tecnico_asignado));
      if (o.cuadrilla) {
        const cKey = extractCuadrillaKey(o.cuadrilla);
        if (cKey) cuadrillasTrabajando.add(cKey);
      }
    }

    // Si un técnico asignado en las órdenes pertenece a una cuadrilla, esa cuadrilla también está trabajando
    for (const t of tecnicos) {
      const normNom = normalizeStr(t.nombre_completo);
      const tieneOrden = tecnicosTrabajando.has(String(t.id_usuario)) ||
        Array.from(tecnicosTrabajando).some(nom => nom && (normNom.includes(nom) || nom.includes(normNom)));

      if (tieneOrden && t.cuadrilla) {
        const cKey = extractCuadrillaKey(t.cuadrilla);
        if (cKey) cuadrillasTrabajando.add(cKey);
      }
    }

    // --- ALERTA 1: Técnicos sin órdenes / Técnicos que completaron sus órdenes (Desocupados) ---
    const tecnicos_sin_orden = [];

    const esTerminal = (est) => {
      const s = normalizeStr(est || '');
      return s.includes('fin') || s.includes('liquid') || s.includes('cancel') || s.includes('anul') || s.includes('regest');
    };
    const esCompletada = (est) => {
      const s = normalizeStr(est || '');
      return s.includes('fin') || s.includes('liquid');
    };

    // Determinar próximo tramo según la hora actual en Lima
    const nowLimaAlert = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Lima" }));
    const currentHourAlert = nowLimaAlert.getHours();
    let proximoTramoTexto = "16:00 - 20:00";
    if (currentHourAlert < 12) {
      proximoTramoTexto = "12:00 - 16:00";
    } else if (currentHourAlert >= 12 && currentHourAlert < 16) {
      proximoTramoTexto = "16:00 - 20:00";
    } else {
      proximoTramoTexto = "tramo final de la tarde";
    }

    for (const t of tecnicos) {
      const normNom = normalizeStr(t.nombre_completo);
      const tCuadKey = extractCuadrillaKey(t.cuadrilla);

      const noTieneDescanso = !t.tiene_descanso_programado && t.estado_asistencia !== 'Descanso' && t.estado_asistencia !== 'Falta';
      if (!noTieneDescanso) continue;

      // Buscar todas las órdenes asignadas a este técnico o su cuadrilla hoy
      const misOrdenes = ordenes.filter(o => {
        const oNom = normalizeStr(o.tecnico_asignado);
        const matchTec = (o.id_tecnico && String(o.id_tecnico) === String(t.id_usuario)) ||
                         (oNom && (normNom.includes(oNom) || oNom.includes(normNom)));
        const matchCuad = tCuadKey && (extractCuadrillaKey(o.cuadrilla) === tCuadKey);
        return matchTec || matchCuad;
      });

      const totalOrdenes = misOrdenes.length;
      const ordenesActivas = misOrdenes.filter(o => !esTerminal(o.estado));
      const ordenesCompletadas = misOrdenes.filter(o => esCompletada(o.estado));

      const asistio = t.estado_asistencia === 'Asistio' || t.estado_asistencia === 'Tardanza';

      // 🔴 CASO A: El técnico NO tiene ninguna orden asignada en todo el día
      if (totalOrdenes === 0) {
        tecnicos_sin_orden.push({
          id_usuario: t.id_usuario,
          documento: t.documento,
          nombre_completo: t.nombre_completo,
          cuadrilla: t.cuadrilla || 'Sin cuadrilla asignada',
          estado_asistencia: t.estado_asistencia || 'Turno Regular (Sin marcar)',
          hora_entrada: t.hora_entrada || null,
          asistio_hoy: asistio,
          tipo_alerta: 'sin_orden',
          total_ordenes: 0,
          ordenes_finalizadas: 0,
          hora_fin: null,
          proximo_tramo: proximoTramoTexto,
          mensaje: asistio
            ? `Marcó asistencia a las ${t.hora_entrada ? t.hora_entrada.slice(0, 5) : '07:30'}, pero su cuadrilla (${t.cuadrilla || 'S/C'}) y técnico no registran órdenes asignadas hoy.`
            : `Tiene turno activo hoy, pero su cuadrilla (${t.cuadrilla || 'S/C'}) y técnico no registran órdenes en el sistema.`,
          whatsapp_msg: `🚨 *AVISO DE GESTIÓN*: El técnico *${t.nombre_completo}* (DNI: ${t.documento || "S/D"}, Cuadrilla: ${t.cuadrilla || "S/C"}) ${asistio ? `marcó asistencia a las ${t.hora_entrada?.slice(0, 5) || "07:30"}` : "tiene turno activo hoy"} pero *NO TIENE ÓRDENES ASIGNADAS* en el sistema. Favor de verificar y asignarle trabajo.`
        });
      }
      // 🟢 CASO B: El técnico completó todas sus órdenes asignadas y está libre / desocupado
      else if (ordenesActivas.length === 0 && ordenesCompletadas.length > 0) {
        let horaFin = '';
        for (const o of ordenesCompletadas) {
          const f = o.fin_visita || o.fecha_sincronizacion;
          if (f) {
            const d = new Date(f);
            if (!isNaN(d.getTime())) {
              const hStr = d.toLocaleTimeString('en-GB', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' });
              if (!horaFin || hStr > horaFin) horaFin = hStr;
            }
          }
        }

        const ordenesTexto = ordenesCompletadas.length === 1 ? 'su orden' : `sus ${ordenesCompletadas.length} órdenes`;
        const ordenesTextoWA = ordenesCompletadas.length === 1 ? 'su orden asignada' : `sus ${ordenesCompletadas.length} órdenes asignadas`;
        const horaFinTexto = horaFin ? ` a las ${horaFin}` : '';

        tecnicos_sin_orden.push({
          id_usuario: t.id_usuario,
          documento: t.documento,
          nombre_completo: t.nombre_completo,
          cuadrilla: t.cuadrilla || 'Sin cuadrilla asignada',
          estado_asistencia: t.estado_asistencia || 'Turno Regular (Sin marcar)',
          hora_entrada: t.hora_entrada || null,
          asistio_hoy: asistio,
          tipo_alerta: 'desocupado',
          total_ordenes: totalOrdenes,
          ordenes_finalizadas: ordenesCompletadas.length,
          hora_fin: horaFin || null,
          proximo_tramo: proximoTramoTexto,
          mensaje: `Completó ${ordenesTexto} del día${horaFinTexto}. Actualmente se encuentra libre sin órdenes pendientes para el tramo ${proximoTramoTexto}.`,
          whatsapp_msg: `🚨 *AVISO DE GESTIÓN*: El técnico *${t.nombre_completo}* (Cuadrilla: ${t.cuadrilla || "S/C"}) ya culminó ${ordenesTextoWA}${horaFinTexto} y se encuentra *DISPONIBLE* para asignación en el tramo de la tarde (${proximoTramoTexto}).`
        });
      }
    }

    // Ordenar: primero los desocupados (alta prioridad de asignación), luego los que marcaron asistencia sin orden, luego el resto
    tecnicos_sin_orden.sort((a, b) => {
      if (a.tipo_alerta === 'desocupado' && b.tipo_alerta !== 'desocupado') return -1;
      if (a.tipo_alerta !== 'desocupado' && b.tipo_alerta === 'desocupado') return 1;
      return (b.asistio_hoy ? 1 : 0) - (a.asistio_hoy ? 1 : 0);
    });

    // --- ALERTA 2: Actas de Conformidad Pendientes (> 10 min o tareas terminadas) ---
    const actas_pendientes = [];
    const nowMs = Date.now();
    for (const o of ordenes) {
      if (!o.tareas_json) continue;
      try {
        const tareas = JSON.parse(o.tareas_json);
        if (!Array.isArray(tareas) || tareas.length === 0) continue;

        const acta = tareas.find(t => {
          const tit = (t.titulo || '').toUpperCase();
          return tit.includes('ACTA') || tit.includes('CONFORMIDAD');
        });
        if (!acta) continue;

        const actaPendiente = (acta.estado || '').toLowerCase().includes('pend');
        if (!actaPendiente) continue;

        const otrasTareas = tareas.filter(t => t !== acta);
        const otrasFinalizadas = otrasTareas.filter(t => !(t.estado || '').toLowerCase().includes('pend')).length;
        const pctOtras = otrasTareas.length > 0 ? (otrasFinalizadas / otrasTareas.length) : 0;

        // 🛡️ REGLA OPERATIVA ESTRICTA:
        // Solo debe alertar si la orden YA figura como FINALIZADA en el sistema,
        // y su tarea Acta de Conformidad sigue Pendiente.
        // Si la orden está Iniciada, En camino o Asignada, el técnico sigue trabajando en campo y NO debe alertar.
        const esOrdenFinalizada = ['Finalizada', 'Finalizados', 'Liquidada', 'Liquidado'].includes(o.estado) || (o.estado || '').toLowerCase().includes('fin');
        if (!esOrdenFinalizada) continue;

        let minutosEspera = 0;
        if (o.fecha_sincronizacion) {
          minutosEspera = Math.max(1, Math.round((nowMs - new Date(o.fecha_sincronizacion).getTime()) / 60000));
        }

        actas_pendientes.push({
          id_orden: o.id_orden,
          numero_orden: o.numero,
          cliente: o.cliente,
          tecnico: o.tecnico_asignado || 'Sin técnico asignado',
          cuadrilla: o.cuadrilla || '',
          estado_orden: o.estado,
          total_tareas: tareas.length,
          tareas_finalizadas: otrasFinalizadas,
          porcentaje_avance: Math.round(pctOtras * 100),
          minutos_espera: minutosEspera,
          fecha_sincronizacion: o.fecha_sincronizacion,
          mensaje: `La orden figura Finalizada pero el Acta de Conformidad sigue Pendiente (${otrasFinalizadas} de ${otrasTareas.length} tareas registradas).`
        });
      } catch {}
    }

    // Ordenar actas pendientes: las de mayor tiempo de espera o mayor avance primero
    actas_pendientes.sort((a, b) => b.porcentaje_avance - a.porcentaje_avance || b.minutos_espera - a.minutos_espera);

    // --- ALERTA 3: Riesgo de Tramo Horario ---
    const tramos_riesgo = [];
    const nowLima = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Lima" }));
    const currentMinutes = nowLima.getHours() * 60 + nowLima.getMinutes();

    for (const o of ordenes) {
      const normEstado = normalizeStr(o.estado || '');
      // Solo órdenes operativas pendientes de atención (se excluyen finalizadas, canceladas, anuladas, regestión y liquidadas)
      if (
        normEstado.includes('fin') || 
        normEstado.includes('cancel') || 
        normEstado.includes('anul') || 
        normEstado.includes('regest') || 
        normEstado.includes('liquid')
      ) continue;

      let tramoHour = -1;
      const refDate = o.fecha_visita || o.fecha_solicitud || o.hora_asignacion;
      if (refDate) {
        const d = new Date(refDate);
        if (!isNaN(d.getTime())) tramoHour = d.getHours();
      }

      let tramoLabel = "-";
      let tramoEndMin = -1;
      let tramoStartMin = -1;

      if (tramoHour >= 6 && tramoHour < 12) {
        tramoLabel = "08:00 - 12:00";
        tramoStartMin = 8 * 60;
        tramoEndMin = 12 * 60;
      } else if (tramoHour >= 12 && tramoHour < 16) {
        tramoLabel = "12:00 - 16:00";
        tramoStartMin = 12 * 60;
        tramoEndMin = 16 * 60;
      } else if (tramoHour >= 16 && tramoHour <= 22) {
        tramoLabel = "16:00 - 20:00";
        tramoStartMin = 16 * 60;
        tramoEndMin = 20 * 60;
      }

      if (tramoEndMin !== -1) {
        const noIniciada = !o.inicio_visita && !normEstado.includes('inic');
        // Alerta si faltan 30 minutos o ya venció el tramo
        if (noIniciada && currentMinutes >= (tramoEndMin - 30)) {
          const diff = currentMinutes - tramoEndMin;
          const vencido = diff > 0;

          tramos_riesgo.push({
            id_orden: o.id_orden,
            numero_orden: o.numero,
            cliente: o.cliente,
            tecnico: o.tecnico_asignado || 'Sin técnico asignado',
            cuadrilla: o.cuadrilla || '',
            estado_orden: o.estado,
            tramo: tramoLabel,
            vencido,
            minutos_diferencia: Math.abs(diff),
            mensaje: vencido
              ? `El tramo ${tramoLabel} venció hace ${diff} minutos y la visita no ha sido iniciada.`
              : `Faltan solo ${Math.abs(diff)} minutos para que finalice el tramo ${tramoLabel} y la orden aún no inicia.`
          });
        }
      }
    }

    // Ordenar: primero los tramos ya vencidos
    tramos_riesgo.sort((a, b) => (b.vencido ? 1 : 0) - (a.vencido ? 1 : 0) || b.minutos_diferencia - a.minutos_diferencia);

    res.json({
      success: true,
      fecha,
      resumen: {
        total_alertas: tecnicos_sin_orden.length + actas_pendientes.length + tramos_riesgo.length,
        tecnicos_sin_orden_count: tecnicos_sin_orden.length,
        actas_pendientes_count: actas_pendientes.length,
        tramos_riesgo_count: tramos_riesgo.length
      },
      alertas: {
        tecnicos_sin_orden,
        actas_pendientes,
        tramos_riesgo
      }
    });
  } catch (error) {
    console.error("Error al obtener alertas de gestión:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- 1.2.0 BARRIDO AUTOMÁTICO DE TAREAS PARA ÓRDENES ACTIVAS (CRON HOY) ---
app.post('/ordenes/sincronizar-tareas-activas', async (req, res) => {
  try {
    const result = await sincronizarTareasOrdenesActivas();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- 1.2.1 OBTENER METRAJE SUGERIDO DECLARADO EN FÉNIX (TAREA METRAJE TOTAL) ---
app.get('/ordenes/:numero/metraje-sugerido', async (req, res) => {
  try {
    const { numero } = req.params;
    const metraje = await getMetrajeDeclaradoFenix(numero);
    res.json({ success: true, numero, metraje });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- 1.3 OBTENER DETALLE DE UNA TAREA ESPECÍFICA (FOTOS, COORDENADAS, TIEMPOS, OBSERVACIONES) ---
app.post('/ordenes/tarea-detalle', async (req, res) => {
  try {
    const { idTarea, index, numeroOrden } = req.body || {};

    // 1. Si vino numeroOrden, verificar si ya está guardado en orden_tareas_cache (0ms)
    if (numeroOrden) {
      const cleanNum = String(numeroOrden).trim();
      const [rows] = await pool.query(
        "SELECT tareas_json FROM orden_tareas_cache WHERE numero_orden = ? LIMIT 1",
        [cleanNum]
      );
      if (rows.length > 0 && rows[0].tareas_json) {
        try {
          const tasks = JSON.parse(rows[0].tareas_json);
          const t = tasks.find(x => String(x.id) === String(idTarea));
          if (t && (t.detalle || (t.campos && Object.keys(t.campos).length > 0))) {
            return res.json({
              success: true,
              fuente: 'BD_LOCAL',
              detalle: t.detalle || {
                descripcion: t.descripcion,
                campos: t.campos,
                tiempos: t.tiempos,
                coordenadas_inicio: t.coordenadas_inicio,
                coordenadas_fin: t.coordenadas_fin
              }
            });
          }
        } catch (eJson) {
          // Continuar a Fénix si hay error de parseo
        }
      }
    }

    // 2. Si no está en BD local, consultar Fénix
    const detalle = await obtenerDetalleTarea(idTarea, index);

    // 3. Si se obtuvo con éxito y vino numeroOrden, persistirlo en la BD para siempre
    if (detalle && numeroOrden) {
      await guardarDetalleTareaEnBD(numeroOrden, idTarea, detalle);
    }

    res.json({ success: true, fuente: 'FENIX', detalle });
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
    const { id_tecnico, id_tecnico_reemplazo, tecnico, cuadrilla, numero } = req.body || {};
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
        const [uRows] = await pool.query("SELECT id_usuario, nombres, apellidos, primer_apellido, segundo_apellido, cuadrilla FROM usuarios");
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

    // Resolver cuadrilla si no vino explícita pero tenemos al técnico
    let finalCuadrilla = cuadrilla || null;
    if (!finalCuadrilla && finalIdTecnico) {
      try {
        const [uCuad] = await pool.query("SELECT cuadrilla FROM usuarios WHERE id_usuario = ? LIMIT 1", [finalIdTecnico]);
        if (uCuad.length > 0 && uCuad[0].cuadrilla) {
          finalCuadrilla = uCuad[0].cuadrilla;
        }
      } catch (eCuad) {}
    }

    // Actualizar en tabla ordenes: id_tecnico (T1), id_tecnico_reemplazo (T2), tecnico_asignado y blindaje manual
    // Preservar la cuadrilla_origen_fenix si aún no estaba respaldada
    await pool.query(
      `UPDATE ordenes 
       SET 
         cuadrilla_origen_fenix = COALESCE(cuadrilla_origen_fenix, cuadrilla),
         id_tecnico = ?, 
         id_tecnico_reemplazo = ?, 
         tecnico_asignado = ?,
         cuadrilla = COALESCE(?, cuadrilla),
         asignacion_manual = 1,
         fecha_asignacion_manual = NOW()
       WHERE id_orden = ? OR numero = ?`,
      [finalIdTecnico || null, finalIdTecnico2 || null, nombreTitularGuardar || null, finalCuadrilla || null, id, searchParam]
    );

    res.json({
      success: true,
      message: "Técnico(s) asignado(s) y blindado(s) contra sobreescritura de Fénix",
      id_tecnico: finalIdTecnico,
      id_tecnico_reemplazo: finalIdTecnico2,
      tecnico_asignado: nombreTitularGuardar,
      cuadrilla: finalCuadrilla,
      asignacion_manual: 1
    });
  } catch (error) {
    console.error("Error al asignar técnico en BD:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// --- 2.1 RESTAURAR TÉCNICO Y CUADRILLA ORIGINAL DE FÉNIX (QUITAR BLINDAJE MANUAL) ---
app.post('/ordenes/:id/restaurar-cuadrilla-fenix', async (req, res) => {
  try {
    const { id } = req.params;
    const { numero } = req.body || {};
    const searchParam = numero || id;

    // Obtener orden y su cuadrilla_origen_fenix
    const [rows] = await pool.query(
      "SELECT id_orden, numero, cuadrilla_origen_fenix, cuadrilla FROM ordenes WHERE id_orden = ? OR numero = ? LIMIT 1",
      [id, searchParam]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Orden no encontrada" });
    }

    const orden = rows[0];
    const targetCuadrilla = orden.cuadrilla_origen_fenix || orden.cuadrilla;

    // Obtener técnicos de la BD para resolver quién correspondía a esa cuadrilla
    let autoIdTecnico = null;
    let autoNombreTecnico = null;

    if (targetCuadrilla) {
      const [techUsers] = await pool.query("SELECT id_usuario, nombres, apellidos, primer_apellido, segundo_apellido FROM usuarios");
      let str = String(targetCuadrilla).trim();
      const sgaMatch = str.match(/\bSGA[\s-_:•|/\\]+(.+)$/i);
      if (sgaMatch && sgaMatch[1] && sgaMatch[1].trim().length > 2) {
        str = sgaMatch[1].trim();
      }
      const rawName = str
        .replace(/^(?:[A-Z]\s*\d+\s*(?:MOTOWIN|CESPEDES|TRASLADO|SGA|WIN)?|CESPEDES|SGA|MOTOWIN|WIN|CONTRATISTA|MIGRACION|TRASLADO|INSTALACION)[\s-_:•|/\\]+/gi, '')
        .replace(/^(?:CESPEDES|SGA|MOTOWIN|WIN|CONTRATISTA|MIGRACION|TRASLADO|INSTALACION)[\s-_:•|/\\]+/gi, '')
        .replace(/^[-_:•|/\\.\s]+/, '')
        .replace(/[-_:•|/\\.\s]+$/, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (rawName && rawName.length > 2) {
        const normRaw = rawName.toUpperCase();
        const found = (techUsers || []).find((u) => {
          const full1 = `${u.nombres || ''} ${u.apellidos || ''}`.toUpperCase().trim();
          const full2 = `${u.nombres || ''} ${u.primer_apellido || ''} ${u.segundo_apellido || ''}`.toUpperCase().trim();
          if (full1 && (normRaw === full1 || normRaw.includes(full1) || full1.includes(normRaw))) return true;
          if (full2 && (normRaw === full2 || normRaw.includes(full2) || full2.includes(normRaw))) return true;

          const nameParts = (u.nombres || '').toUpperCase().split(/\s+/).filter(p => p.length > 2);
          const apeParts = (u.apellidos || u.primer_apellido || '').toUpperCase().split(/\s+/).filter(p => p.length > 2);
          const hasName = nameParts.some(p => normRaw.includes(p));
          const hasApe = apeParts.some(p => normRaw.includes(p));
          return hasName && hasApe;
        });

        if (found) {
          autoIdTecnico = found.id_usuario;
          autoNombreTecnico = `${found.nombres} ${found.apellidos || found.primer_apellido || ''}`.trim();
        } else {
          autoNombreTecnico = rawName;
        }
      }
    }

    await pool.query(
      `UPDATE ordenes 
       SET 
         asignacion_manual = 0,
         fecha_asignacion_manual = NULL,
         cuadrilla = COALESCE(?, cuadrilla),
         id_tecnico = ?,
         id_tecnico_reemplazo = NULL,
         tecnico_asignado = ?
       WHERE id_orden = ? OR numero = ?`,
      [targetCuadrilla || null, autoIdTecnico, autoNombreTecnico, id, searchParam]
    );

    res.json({
      success: true,
      message: "Orden restaurada a la cuadrilla y técnico original de Fénix",
      cuadrilla: targetCuadrilla,
      id_tecnico: autoIdTecnico,
      tecnico_asignado: autoNombreTecnico,
      asignacion_manual: 0
    });
  } catch (error) {
    console.error("Error al restaurar cuadrilla Fénix en BD:", error.message);
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

    const [cols7] = await pool.query("SHOW COLUMNS FROM ordenes LIKE 'asignacion_manual'");
    if (cols7.length === 0) {
      await pool.query("ALTER TABLE ordenes ADD COLUMN asignacion_manual TINYINT(1) DEFAULT 0");
      console.log("✅ [DB] Columna 'asignacion_manual' creada exitosamente en tabla 'ordenes'.");
    }

    const [cols8] = await pool.query("SHOW COLUMNS FROM ordenes LIKE 'fecha_asignacion_manual'");
    if (cols8.length === 0) {
      await pool.query("ALTER TABLE ordenes ADD COLUMN fecha_asignacion_manual DATETIME DEFAULT NULL");
      console.log("✅ [DB] Columna 'fecha_asignacion_manual' creada exitosamente en tabla 'ordenes'.");
    }

    const [cols9] = await pool.query("SHOW COLUMNS FROM ordenes LIKE 'cuadrilla_origen_fenix'");
    if (cols9.length === 0) {
      await pool.query("ALTER TABLE ordenes ADD COLUMN cuadrilla_origen_fenix VARCHAR(255) DEFAULT NULL");
      console.log("✅ [DB] Columna 'cuadrilla_origen_fenix' creada exitosamente en tabla 'ordenes'.");
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
        v.id_marca,
        v.id_modelo,
        v.id_tipo_vehiculo,
        v.id_combustible,
        v.placa,
        v.anio,
        v.transmision,
        v.color,
        v.estado,
        v.observaciones,
        v.fecha_ven_soat,
        v.fecha_ven_revision,
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
      LEFT JOIN trabajadores t ON v.id_vehiculo = t.id_vehiculo
        AND (t.estado = 'Activo' OR t.estado IS NULL)
        AND EXISTS (
          SELECT 1
          FROM usuarios tu
          LEFT JOIN roles tr ON tu.id_rol = tr.id_rol
          WHERE tu.id_usuario = t.id_usuario
            AND (tu.id_rol = 2 OR UPPER(COALESCE(tr.nombre, '')) LIKE '%TECNIC%')
        )
      LEFT JOIN usuarios u ON t.id_usuario = u.id_usuario
      ORDER BY v.placa ASC
    `);

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- 🚗 CATALOGOS DE FLOTA (Marcas, Modelos, Tipos, Combustibles) ---
app.get('/api/movilidad/catalogos', async (req, res) => {
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

// CRUD Marcas
app.post('/api/movilidad/marcas', async (req, res) => {
  try {
    const { nombre, estado = 'Activo' } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre de la marca es requerido' });
    const [result] = await pool.query('INSERT INTO marcas (nombre, estado) VALUES (?, ?)', [nombre.trim(), estado]);
    res.json({ success: true, id_marca: result.insertId, message: 'Marca creada con éxito' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/movilidad/marcas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, estado } = req.body;
    await pool.query('UPDATE marcas SET nombre = COALESCE(?, nombre), estado = COALESCE(?, estado) WHERE id_marca = ?', [nombre?.trim(), estado, id]);
    res.json({ success: true, message: 'Marca actualizada con éxito' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/movilidad/marcas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("UPDATE marcas SET estado = 'Inactivo' WHERE id_marca = ?", [id]);
    res.json({ success: true, message: 'Marca desactivada con éxito' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CRUD Modelos
app.post('/api/movilidad/modelos', async (req, res) => {
  try {
    const { nombre, estado = 'Activo' } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre del modelo es requerido' });
    const [result] = await pool.query('INSERT INTO modelos (nombre, estado) VALUES (?, ?)', [nombre.trim(), estado]);
    res.json({ success: true, id_modelo: result.insertId, message: 'Modelo creado con éxito' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/movilidad/modelos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, estado } = req.body;
    await pool.query('UPDATE modelos SET nombre = COALESCE(?, nombre), estado = COALESCE(?, estado) WHERE id_modelo = ?', [nombre?.trim(), estado, id]);
    res.json({ success: true, message: 'Modelo actualizado con éxito' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/movilidad/modelos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("UPDATE modelos SET estado = 'Inactivo' WHERE id_modelo = ?", [id]);
    res.json({ success: true, message: 'Modelo desactivado con éxito' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CRUD Tipos de Vehículo
app.post('/api/movilidad/tipos-vehiculo', async (req, res) => {
  try {
    const { nombre, estado = 'Activo' } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre del tipo es requerido' });
    const [result] = await pool.query('INSERT INTO tipos_vehiculo (nombre, estado) VALUES (?, ?)', [nombre.trim(), estado]);
    res.json({ success: true, id_tipo_vehiculo: result.insertId, message: 'Tipo de vehículo creado con éxito' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/movilidad/tipos-vehiculo/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, estado } = req.body;
    await pool.query('UPDATE tipos_vehiculo SET nombre = COALESCE(?, nombre), estado = COALESCE(?, estado) WHERE id_tipo_vehiculo = ?', [nombre?.trim(), estado, id]);
    res.json({ success: true, message: 'Tipo de vehículo actualizado con éxito' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/movilidad/tipos-vehiculo/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("UPDATE tipos_vehiculo SET estado = 'Inactivo' WHERE id_tipo_vehiculo = ?", [id]);
    res.json({ success: true, message: 'Tipo de vehículo desactivado con éxito' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CRUD Vehículos (Crear y Editar)
app.post('/api/movilidad/vehiculos', async (req, res) => {
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

app.put('/api/movilidad/vehiculos/:id', async (req, res) => {
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
        COALESCE(v.modelo, va.modelo, '') AS vehiculo_modelo,
        (
          SELECT COUNT(*) FROM trabajador_descansos td
          WHERE td.id_trabajador = t.id_trabajador
            AND CURDATE() BETWEEN td.fecha_inicio AND td.fecha_fin
            AND td.estado != 'Cancelado'
        ) AS descanso_hoy
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

    if (id_trabajador) {
      const [rolRows] = await pool.query(`
        SELECT u.id_rol, r.nombre AS rol_nombre
        FROM trabajadores t
        JOIN usuarios u ON t.id_usuario = u.id_usuario
        LEFT JOIN roles r ON u.id_rol = r.id_rol
        WHERE t.id_trabajador = ?
      `, [id_trabajador]);
      const rol = rolRows[0];
      const esTecnico = rol && (Number(rol.id_rol) === 2 || String(rol.rol_nombre || '').toUpperCase().includes('TECNIC'));
      if (!esTecnico) {
        return res.status(400).json({ error: "Solo se pueden asignar vehículos a usuarios con rol Técnico." });
      }
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
        p.id_categoria,
        p.codigo,
        p.nombre,
        p.descripcion,
        p.stand,
        p.fila,
        CASE 
          WHEN p.stand IS NOT NULL AND p.fila IS NOT NULL THEN CONCAT('Stand ', p.stand, ' · Fila ', p.fila)
          WHEN p.stand IS NOT NULL THEN CONCAT('Stand ', p.stand)
          ELSE NULL 
        END AS ubicacion,
        p.proid,
        p.stock_minimo,
        p.maneja_serie,
        p.es_drop,
        p.precio_compra,
        p.categoria_liquidar,
        COALESCE((SELECT MAX(ps.fecha_ingreso) FROM producto_series ps WHERE ps.id_producto = p.id_producto), p.fecha_creacion) AS fecha_ingreso,
        c.nombre AS categoria,
        COALESCE((SELECT SUM(s.cantidad) FROM stock s WHERE s.id_producto = p.id_producto AND (s.id_almacen = 1 OR s.id_almacen IS NULL)), 0) AS stock_central,
        COALESCE((SELECT SUM(s.cantidad_segundo_uso) FROM stock s WHERE s.id_producto = p.id_producto AND (s.id_almacen = 1 OR s.id_almacen IS NULL)), 0) AS stock_segundo_uso,
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
        COALESCE(u.documento, '') AS tecnico_dni,
        COALESCE(u.cuadrilla, '') AS cuadrilla,
        COALESCE(v.placa, 'Sin vehículo') AS vehiculo_placa,
        p.id_producto,
        p.nombre AS producto_nombre,
        p.codigo AS producto_codigo,
        p.proid,
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
        ps.codigo_serie,
        ps.id_equipo,
        ps.proid AS equipo_proid,
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
    const [rows] = await pool.query("SELECT id_categoria, nombre, descripcion, estado FROM categorias ORDER BY nombre ASC");
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/almacen/categorias', async (req, res) => {
  try {
    const { nombre, descripcion, estado = 'Activo' } = req.body;
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ error: "El nombre de la categoría es obligatorio." });
    }
    const [result] = await pool.query(
      "INSERT INTO categorias (nombre, descripcion, estado) VALUES (?, ?, ?)",
      [nombre.trim().toUpperCase(), descripcion?.trim() || null, estado]
    );
    res.json({ success: true, id_categoria: result.insertId, message: "Categoría creada con éxito." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/almacen/categorias/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, estado } = req.body;
    await pool.query(
      "UPDATE categorias SET nombre = COALESCE(?, nombre), descripcion = COALESCE(?, descripcion), estado = COALESCE(?, estado) WHERE id_categoria = ?",
      [nombre?.trim()?.toUpperCase() || null, descripcion !== undefined ? descripcion?.trim() : null, estado || null, id]
    );
    res.json({ success: true, message: "Categoría actualizada con éxito." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/almacen/categorias/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("UPDATE categorias SET estado = 'Inactivo' WHERE id_categoria = ?", [id]);
    res.json({ success: true, message: "Categoría desactivada con éxito." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- 📦 CREAR NUEVO PRODUCTO EN CATÁLOGO ---
app.post('/api/almacen/productos', async (req, res) => {
  try {
    const { nombre, id_categoria, categoria, codigo, stock_minimo, maneja_serie, es_drop, precio_compra, stand, fila, proid } = req.body;

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
    const cleanStand = stand ? String(stand).trim().toUpperCase() : null;
    const cleanFila = fila ? Number(fila) : null;
    const cleanProid = proid ? String(proid).trim().toUpperCase() : null;

    const [insResult] = await pool.query(`
      INSERT INTO productos (codigo, nombre, id_categoria, stock_minimo, maneja_serie, es_drop, precio_compra, stand, fila, proid, estado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Activo')
    `, [codProd, nombre.trim().toUpperCase(), catId || null, stockMinVal, manejaSerieVal, esDropVal, precVal, cleanStand, cleanFila, cleanProid]);

    const newProdId = insResult.insertId;

    // Inicializar registro en stock almacén central
    await pool.query(`
      INSERT INTO stock (id_producto, id_almacen, cantidad, cantidad_segundo_uso)
      VALUES (?, 1, 0, 0)
      ON DUPLICATE KEY UPDATE id_stock = id_stock
    `, [newProdId]);

    const nuevoProducto = {
      id_producto: newProdId,
      codigo: codProd,
      nombre: nombre.trim().toUpperCase(),
      categoria: catNombre || 'GENERAL',
      stand: cleanStand,
      fila: cleanFila,
      ubicacion: cleanStand && cleanFila ? `Stand ${cleanStand} · Fila ${cleanFila}` : (cleanStand ? `Stand ${cleanStand}` : null),
      proid: cleanProid,
      stock_minimo: stockMinVal,
      maneja_serie: manejaSerieVal,
      es_drop: esDropVal,
      precio_compra: precVal,
      stock_central: 0,
      stock_segundo_uso: 0,
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

// --- 📦 1.1 ACTUALIZAR UBICACIÓN DE PRODUCTO (STAND A-H, FILA 1-10, PROID) ---
app.put('/api/almacen/productos/:id/ubicacion', async (req, res) => {
  try {
    const { id } = req.params;
    const { stand, fila, proid, id_usuario, usuario_nombre } = req.body;

    const cleanStand = stand ? String(stand).trim().toUpperCase() : null;
    const cleanFila = fila ? Number(fila) : null;
    const cleanProid = proid !== undefined ? (proid && String(proid).trim() ? String(proid).trim().toUpperCase() : null) : undefined;

    const [pRows] = await pool.query('SELECT nombre, codigo FROM productos WHERE id_producto = ?', [id]);
    const prod = pRows[0] || {};

    if (cleanProid !== undefined) {
      await pool.query(`
        UPDATE productos SET
          stand = ?,
          fila = ?,
          proid = ?
        WHERE id_producto = ?
      `, [cleanStand, cleanFila, cleanProid, id]);
    } else {
      await pool.query(`
        UPDATE productos SET
          stand = ?,
          fila = ?
        WHERE id_producto = ?
      `, [cleanStand, cleanFila, id]);
    }

    const ubicacionStr = cleanStand && cleanFila ? `Stand ${cleanStand} · Fila ${cleanFila}` : (cleanStand ? `Stand ${cleanStand}` : 'Sin asignar');

    // 🛡️ Registrar Auditoría y actualizar última acción
    await registrarAuditoria(pool, {
      id_usuario: id_usuario || null,
      usuario_nombre: usuario_nombre || null,
      modulo: 'ALMACEN',
      accion: 'ACTUALIZAR_UBICACION',
      id_referencia: prod.codigo || `PROD-${id}`,
      descripcion: `Asignó ubicación "${ubicacionStr}" a ${prod.nombre || 'Producto #' + id}`,
      req
    });

    res.json({
      success: true,
      message: "Ubicación y Product ID actualizados correctamente.",
      stand: cleanStand,
      fila: cleanFila,
      proid: cleanProid !== undefined ? cleanProid : null,
      ubicacion: ubicacionStr
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- 📦 1.1.0 ACTUALIZAR PRODUCTO (NOMBRE, CATEGORIA, CODIGO, DESCRIPCION, ESTADO) ---
app.put('/api/almacen/productos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, id_categoria, codigo, descripcion, stock_minimo, estado, id_usuario, usuario_nombre } = req.body;

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ error: "El nombre del producto es obligatorio." });
    }

    const cleanNombre = nombre.trim().toUpperCase();
    const cleanCodigo = codigo ? codigo.trim().toUpperCase() : null;
    const cleanDesc = descripcion !== undefined ? (descripcion ? descripcion.trim() : null) : undefined;
    const cleanCatId = id_categoria ? Number(id_categoria) : null;
    const cleanStockMin = stock_minimo !== undefined ? Number(stock_minimo) : null;
    const cleanEstado = estado || 'Activo';

    const [prev] = await pool.query('SELECT nombre, codigo FROM productos WHERE id_producto = ?', [id]);
    if (prev.length === 0) {
      return res.status(404).json({ error: "Producto no encontrado." });
    }
    const nombreAnterior = prev[0].nombre;

    await pool.query(`
      UPDATE productos SET
        nombre = ?,
        codigo = COALESCE(?, codigo),
        id_categoria = COALESCE(?, id_categoria),
        descripcion = COALESCE(?, descripcion),
        stock_minimo = COALESCE(?, stock_minimo),
        estado = COALESCE(?, estado)
      WHERE id_producto = ?
    `, [cleanNombre, cleanCodigo, cleanCatId, cleanDesc, cleanStockMin, cleanEstado, id]);

    await registrarAuditoria(pool, {
      id_usuario: id_usuario || null,
      usuario_nombre: usuario_nombre || null,
      modulo: 'ALMACEN',
      accion: 'ACTUALIZAR_PRODUCTO',
      id_referencia: cleanCodigo || `PROD-${id}`,
      descripcion: `Actualizó producto de "${nombreAnterior}" a "${cleanNombre}"`,
      req
    });

    res.json({
      success: true,
      message: `Producto actualizado a "${cleanNombre}" correctamente.`,
      id_producto: Number(id),
      nombre: cleanNombre
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- 📦 1.1.1 ACTUALIZAR PRECIO DE COMPRA DE PRODUCTO ---
app.put('/api/almacen/productos/:id/precio', async (req, res) => {
  try {
    const { id } = req.params;
    const { precio_compra, id_usuario, usuario_nombre } = req.body;
    const precio = Math.max(0, parseFloat(precio_compra) || 0);

    const [pRows] = await pool.query('SELECT nombre, codigo, precio_compra FROM productos WHERE id_producto = ?', [id]);
    const prod = pRows[0] || {};
    const precioAnt = Number(prod.precio_compra || 0).toFixed(2);
    const precioNuevo = Number(precio).toFixed(2);

    await pool.query('UPDATE productos SET precio_compra = ? WHERE id_producto = ?', [precio, id]);

    // 🛡️ Registrar Auditoría y actualizar última acción
    await registrarAuditoria(pool, {
      id_usuario: id_usuario || null,
      usuario_nombre: usuario_nombre || null,
      modulo: 'ALMACEN',
      accion: 'ACTUALIZAR_PRECIO',
      id_referencia: prod.codigo || `PROD-${id}`,
      descripcion: `Modificó costo de compra de "${prod.nombre || 'Producto #' + id}" de S/ ${precioAnt} a S/ ${precioNuevo}`,
      req
    });

    res.json({
      success: true,
      message: 'Precio de compra actualizado correctamente.',
      id_producto: Number(id),
      precio_compra: precio
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper: Segundo uso solo aplica a HERRAMIENTAS, UNIFORMES, VEHICULO
const esCategoriaSegundoUso = (categoria) => {
  if (!categoria) return false;
  const c = String(categoria).trim().toUpperCase();
  return c.includes("HERRAMIENTA") || c.includes("UNIFORME") || c.includes("VEHICUL");
};

// --- 📦 1.2 ACTUALIZAR O INGRESAR STOCK DE SEGUNDO USO DIRECTAMENTE ---
app.put('/api/almacen/productos/:id/stock-segundo-uso', async (req, res) => {
  try {
    const { id } = req.params;
    const { cantidad_segundo_uso, motivo, tecnico_nombre } = req.body;
    const cant = Math.max(0, parseInt(cantidad_segundo_uso, 10) || 0);

    const [pRow] = await pool.query(
      "SELECT c.nombre AS categoria FROM productos p LEFT JOIN categorias c ON p.id_categoria = c.id_categoria WHERE p.id_producto = ?",
      [id]
    );
    const cat = pRow[0]?.categoria || "";
    if (!esCategoriaSegundoUso(cat)) {
      return res.status(400).json({ error: "El stock de Segundo Uso solo aplica para categorías: HERRAMIENTAS, UNIFORMES y VEHICULO." });
    }

    const [upd] = await pool.query(
      "UPDATE stock SET cantidad_segundo_uso = ? WHERE id_producto = ? AND (id_almacen = 1 OR id_almacen IS NULL)",
      [cant, id]
    );
    if (upd.affectedRows === 0) {
      await pool.query(
        "INSERT INTO stock (id_producto, id_almacen, cantidad, cantidad_segundo_uso) VALUES (?, 1, 0, ?)",
        [id, cant]
      );
    }

    await pool.query(`
      INSERT INTO movimientos (id_producto, id_almacen, tipo, cantidad, referencia, fecha_creacion)
      VALUES (?, 1, 'AJUSTE', ?, ?, NOW())
    `, [id, cant, `Ajuste 2do Uso (${cant} unds): ${motivo || 'Devolución / Ajuste'} ${tecnico_nombre ? '(' + tecnico_nombre + ')' : ''}`]);

    res.json({
      success: true,
      message: `Stock de segundo uso actualizado a ${cant} unidades.`,
      cantidad_segundo_uso: cant
    });
  } catch (error) {
    console.error("Error al actualizar stock de segundo uso:", error);
    res.status(500).json({ error: error.message });
  }
});

// --- 📦 2. PROVEEDORES (LISTAR, CREAR, EDITAR, ELIMINAR) ---
app.get('/api/almacen/proveedores', async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM proveedores ORDER BY razon_social ASC");
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/almacen/proveedores', async (req, res) => {
  try {
    const { razon_social, nombre_comercial, ruc, telefono, email, direccion, estado = 'Activo' } = req.body;
    if (!razon_social || !razon_social.trim()) {
      return res.status(400).json({ error: "La Razón Social es requerida." });
    }
    if (ruc) {
      const [exist] = await pool.query("SELECT id_proveedor FROM proveedores WHERE ruc = ?", [ruc.trim()]);
      if (exist.length > 0) {
        return res.status(400).json({ error: `El RUC ${ruc} ya se encuentra registrado.` });
      }
    }
    const [result] = await pool.query(
      `INSERT INTO proveedores (razon_social, nombre_comercial, ruc, telefono, email, direccion, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [razon_social.trim().toUpperCase(), nombre_comercial?.trim() || null, ruc?.trim() || null, telefono?.trim() || null, email?.trim() || null, direccion?.trim() || null, estado]
    );
    res.json({ success: true, id_proveedor: result.insertId, message: "Proveedor registrado con éxito." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/almacen/proveedores/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { razon_social, nombre_comercial, ruc, telefono, email, direccion, estado } = req.body;
    if (ruc) {
      const [exist] = await pool.query("SELECT id_proveedor FROM proveedores WHERE ruc = ? AND id_proveedor != ?", [ruc.trim(), id]);
      if (exist.length > 0) {
        return res.status(400).json({ error: `El RUC ${ruc} ya está asignado a otro proveedor.` });
      }
    }
    await pool.query(
      `UPDATE proveedores SET
        razon_social = COALESCE(?, razon_social),
        nombre_comercial = COALESCE(?, nombre_comercial),
        ruc = COALESCE(?, ruc),
        telefono = COALESCE(?, telefono),
        email = COALESCE(?, email),
        direccion = COALESCE(?, direccion),
        estado = COALESCE(?, estado)
       WHERE id_proveedor = ?`,
      [
        razon_social?.trim()?.toUpperCase() || null,
        nombre_comercial !== undefined ? nombre_comercial?.trim() : null,
        ruc !== undefined ? ruc?.trim() : null,
        telefono !== undefined ? telefono?.trim() : null,
        email !== undefined ? email?.trim() : null,
        direccion !== undefined ? direccion?.trim() : null,
        estado || null,
        id
      ]
    );
    res.json({ success: true, message: "Proveedor actualizado con éxito." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/almacen/proveedores/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("UPDATE proveedores SET estado = 'Inactivo' WHERE id_proveedor = ?", [id]);
    res.json({ success: true, message: "Proveedor desactivado con éxito." });
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

    let provId = id_proveedor ? Number(id_proveedor) : null;

    // A. Auto-guardar proveedor si es nuevo y se proporcionó RUC
    const rucLimpio = ruc_proveedor ? String(ruc_proveedor).trim() : '';
    if (!provId && rucLimpio) {
      const [provExistente] = await pool.query("SELECT id_proveedor FROM proveedores WHERE ruc = ?", [rucLimpio]);
      if (provExistente.length > 0) {
        provId = provExistente[0].id_proveedor;
      } else {
        const [nuevoProv] = await pool.query(`
          INSERT INTO proveedores (ruc, razon_social, nombre_comercial, direccion, telefono, estado)
          VALUES (?, ?, ?, ?, ?, 'Activo')
        `, [
          rucLimpio,
          razon_social_proveedor || `PROVEEDOR RUC ${rucLimpio}`,
          razon_social_proveedor || `PROVEEDOR RUC ${rucLimpio}`,
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
    const todosLosIdEquiposCompra = [];

    for (const item of items) {
      const prodId = Number(item.id_producto);
      const cant = Number(item.cantidad) || 0;
      const rawSeries = Array.isArray(item.series) ? item.series : [];

      const seriesNormalizadas = [];
      for (const s of rawSeries) {
        let sn = '';
        let id_equipo = null;
        let proid = null;
        if (typeof s === 'object' && s !== null) {
          sn = String(s.numero_serie || '').trim().toUpperCase();
          id_equipo = s.id_equipo ? String(s.id_equipo).trim().toUpperCase() : null;
          proid = s.proid ? String(s.proid).trim().toUpperCase() : null;
        } else {
          const rawStr = String(s).trim();
          const parts = rawStr.split(/[\t,;]+/);
          sn = parts[0].trim().toUpperCase();
          if (parts.length >= 3) {
            id_equipo = parts[1].trim().toUpperCase() || null;
            proid = parts[2].trim().toUpperCase() || null;
          } else if (parts.length === 2) {
            id_equipo = parts[1].trim().toUpperCase() || null;
          } else if (item.proid && String(item.proid).trim()) {
            proid = String(item.proid).trim().toUpperCase();
          }
        }
        if (sn.length >= 3) {
          seriesNormalizadas.push({ numero_serie: sn, id_equipo, proid });
        }
      }

      // Validar duplicados de Serie y de ID Equipo dentro de la misma compra
      for (const sObj of seriesNormalizadas) {
        const s = sObj.numero_serie;
        if (todasLasSeriesCompra.includes(s)) {
          return res.status(400).json({
            error: `La serie "${s}" está duplicada dentro de esta misma compra. Cada equipo debe tener un número de serie único e irrepetible.`,
          });
        }
        todasLasSeriesCompra.push(s);

        if (sObj.id_equipo) {
          if (todosLosIdEquiposCompra.includes(sObj.id_equipo)) {
            return res.status(400).json({
              error: `El ID de equipo "${sObj.id_equipo}" está duplicado dentro de esta misma compra. Cada equipo debe tener un ID de equipo único e irrepetible.`,
            });
          }
          todosLosIdEquiposCompra.push(sObj.id_equipo);
        }
      }

      const [prodRows] = await pool.query(
        "SELECT id_producto, nombre, maneja_serie, id_categoria FROM productos WHERE id_producto = ?",
        [prodId]
      );
      if (prodRows.length > 0) {
        const prod = prodRows[0];
        const esSerializado = Boolean(prod.maneja_serie || prod.id_categoria === 7 || prod.id_categoria === 11);
        if (esSerializado && seriesNormalizadas.length !== cant) {
          return res.status(400).json({
            error: `El producto "${prod.nombre}" requiere exactamente ${cant} series registradas, pero se ingresaron ${seriesNormalizadas.length}. Por favor completa las ${cant - seriesNormalizadas.length} series faltantes.`,
          });
        }
      }
    }

    // B2. Validar que las series y los ID de equipo no existan previamente registrados en la base de datos
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

    if (todosLosIdEquiposCompra.length > 0) {
      const [idEquiposExistentes] = await pool.query(
        "SELECT ps.id_equipo, p.nombre as producto_nombre FROM producto_series ps JOIN productos p ON ps.id_producto = p.id_producto WHERE ps.id_equipo IN (?)",
        [todosLosIdEquiposCompra]
      );
      if (idEquiposExistentes.length > 0) {
        const repetidos = idEquiposExistentes.map((r) => `"${r.id_equipo}" (${r.producto_nombre})`).join(", ");
        return res.status(400).json({
          error: `Los siguientes ID de Equipo ya se encuentran registrados previamente en el almacén: ${repetidos}. No se permiten ID de Equipo duplicados.`,
        });
      }
    }

    // B2.1 Nota: El ID de Modelo (proid) puede repetirse válidamente en varios equipos del mismo modelo
    // Solo las series físicas / MAC (numero_serie) y el ID de Equipo (id_equipo) son estrictamente únicos.

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
      const rawSeries = Array.isArray(item.series) ? item.series : [];

      const seriesNormalizadas = [];
      for (const s of rawSeries) {
        let sn = '';
        let id_equipo = null;
        let proid = null;
        if (typeof s === 'object' && s !== null) {
          sn = String(s.numero_serie || '').trim().toUpperCase();
          id_equipo = s.id_equipo ? String(s.id_equipo).trim().toUpperCase() : null;
          proid = s.proid ? String(s.proid).trim().toUpperCase() : null;
        } else {
          const rawStr = String(s).trim();
          const parts = rawStr.split(/[\t,;]+/);
          sn = parts[0].trim().toUpperCase();
          if (parts.length >= 3) {
            id_equipo = parts[1].trim().toUpperCase() || null;
            proid = parts[2].trim().toUpperCase() || null;
          } else if (parts.length === 2) {
            id_equipo = parts[1].trim().toUpperCase() || null;
          } else if (item.proid && String(item.proid).trim()) {
            proid = String(item.proid).trim().toUpperCase();
          }
        }
        if (sn.length >= 3) {
          seriesNormalizadas.push({ numero_serie: sn, id_equipo, proid });
        }
      }

      // 1. Detalle de compra
      await pool.query(`
        INSERT INTO detalle_compras (id_compra, id_producto, cantidad, precio, subtotal, series_ingresadas)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [idCompra, prodId, cant, prec, subtotal, seriesNormalizadas.map(s => s.numero_serie).join(',')]);

      // 1.1 Si se especificó stand o fila en la compra, actualizar la ubicación del producto
      if (item.stand || item.fila) {
        await pool.query(`
          UPDATE productos SET
            stand = COALESCE(?, stand),
            fila = COALESCE(?, fila)
          WHERE id_producto = ?
        `, [
          item.stand ? String(item.stand).trim().toUpperCase() : null,
          item.fila ? Number(item.fila) : null,
          prodId
        ]);
      }

      // 2. Incrementar stock en Almacén Central (id_almacen = 1)
      const [stockExistente] = await pool.query("SELECT id_stock, cantidad FROM stock WHERE id_producto = ? AND id_almacen = 1", [prodId]);
      if (stockExistente.length > 0) {
        await pool.query("UPDATE stock SET cantidad = cantidad + ? WHERE id_stock = ?", [cant, stockExistente[0].id_stock]);
      } else {
        await pool.query("INSERT INTO stock (id_producto, id_almacen, cantidad, cantidad_segundo_uso) VALUES (?, 1, ?, 0)", [prodId, cant]);
      }

      // 3. Registrar Movimiento Kardex
      await pool.query(`
        INSERT INTO movimientos (id_producto, id_almacen, tipo, cantidad, referencia, fecha_creacion)
        VALUES (?, 1, 'ENTRADA', ?, ?, NOW())
      `, [prodId, cant, `Compra #${idCompra} - ${tipo_comprobante || 'Fac'} ${numero_comprobante || ''}`]);

      // 4. Si el producto maneja series (ONT, Mesh, etc.), registrar cada serie pistoleada con su código correlativo
      if (seriesNormalizadas.length > 0) {
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

        for (const sObj of seriesNormalizadas) {
          const cleanSerie = sObj.numero_serie;
          const serieIdEquipo = sObj.id_equipo || null;
          const serieProid = sObj.proid || null;

          if (cleanSerie.length > 2) {
            const codigoSerie = `${modelCode}-S${String(nextNum).padStart(3, '0')}`;
            nextNum++;

            await pool.query(`
              INSERT INTO producto_series (id_producto, id_almacen, codigo_serie, id_equipo, proid, numero_serie, estado, fecha_ingreso)
              VALUES (?, 1, ?, ?, ?, ?, 'DISPONIBLE', NOW())
              ON DUPLICATE KEY UPDATE 
                codigo_serie = COALESCE(codigo_serie, VALUES(codigo_serie)),
                id_equipo = COALESCE(VALUES(id_equipo), id_equipo),
                proid = COALESCE(VALUES(proid), proid),
                estado = 'DISPONIBLE', 
                id_almacen = 1
            `, [prodId, codigoSerie, serieIdEquipo, serieProid, cleanSerie]);
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

// --- 📦 3.1 HISTORIAL DE COMPRAS REGISTRADAS CON DETALLES & SERIES ---
app.get('/api/almacen/compras', async (req, res) => {
  try {
    const [compras] = await pool.query(`
      SELECT 
        c.id_compra,
        c.id_proveedor,
        c.id_almacen,
        c.fecha,
        c.total,
        c.estado,
        c.tipo_comprobante,
        c.numero_comprobante,
        c.observaciones,
        c.fecha_creacion,
        pr.razon_social AS proveedor_nombre,
        pr.ruc AS proveedor_ruc,
        pr.telefono AS proveedor_telefono
      FROM compras c
      LEFT JOIN proveedores pr ON c.id_proveedor = pr.id_proveedor
      ORDER BY c.id_compra DESC
    `);

    if (compras.length === 0) {
      return res.json([]);
    }

    const idsCompras = compras.map(c => c.id_compra);
    const [detalles] = await pool.query(`
      SELECT 
        dc.id_detalle_compra,
        dc.id_compra,
        dc.id_producto,
        dc.cantidad,
        dc.precio,
        dc.subtotal,
        dc.series_ingresadas,
        p.codigo AS producto_codigo,
        p.nombre AS producto_nombre,
        cat.nombre AS categoria_nombre
      FROM detalle_compras dc
      JOIN productos p ON dc.id_producto = p.id_producto
      LEFT JOIN categorias cat ON p.id_categoria = cat.id_categoria
      WHERE dc.id_compra IN (?)
    `, [idsCompras]);

    // Mapear detalles a cada compra
    const detallesPorCompra = {};
    for (const d of detalles) {
      if (!detallesPorCompra[d.id_compra]) {
        detallesPorCompra[d.id_compra] = [];
      }
      detallesPorCompra[d.id_compra].push({
        ...d,
        series_array: d.series_ingresadas ? d.series_ingresadas.split(',').map(s => s.trim()).filter(Boolean) : []
      });
    }

    const resultado = compras.map(c => ({
      ...c,
      items: detallesPorCompra[c.id_compra] || [],
      total_items: (detallesPorCompra[c.id_compra] || []).reduce((acc, it) => acc + Number(it.cantidad || 0), 0)
    }));

    res.json(resultado);
  } catch (error) {
    console.error("Error al obtener historial de compras:", error);
    res.status(500).json({ error: error.message });
  }
});

// --- 📦 3.2 ANULAR COMPRA CON VALIDACIÓN ESTRICTA Y REVERSIÓN DE KARDEX ---
app.post('/api/almacen/compras/:id/anular', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const idCompra = Number(req.params.id);
    const { motivo } = req.body || {};

    if (!idCompra) {
      connection.release();
      return res.status(400).json({ error: "ID de compra inválido." });
    }

    // 1. Obtener la compra
    const [compraRows] = await connection.query("SELECT * FROM compras WHERE id_compra = ?", [idCompra]);
    if (compraRows.length === 0) {
      connection.release();
      return res.status(404).json({ error: "La compra no existe." });
    }

    const compra = compraRows[0];
    if (compra.estado === 'ANULADA') {
      connection.release();
      return res.status(400).json({ error: "Esta compra ya se encuentra ANULADA previamente." });
    }

    // 2. Obtener los detalles de la compra
    const [detalles] = await connection.query(`
      SELECT dc.*, p.nombre AS producto_nombre, p.maneja_serie 
      FROM detalle_compras dc
      JOIN productos p ON dc.id_producto = p.id_producto
      WHERE dc.id_compra = ?
    `, [idCompra]);

    if (detalles.length === 0) {
      connection.release();
      return res.status(400).json({ error: "La compra no tiene ítems asociados." });
    }

    // 3. Extraer todas las series ingresadas en esta compra
    const todasSeries = [];
    for (const d of detalles) {
      if (d.series_ingresadas) {
        const sns = d.series_ingresadas.split(',').map(s => s.trim()).filter(Boolean);
        todasSeries.push(...sns);
      }
    }

    // 4. VALIDACIÓN DE SEGURIDAD ESTRICTA PARA LAS SERIES
    // Las series NO deben haber sido despachadas a técnicos ni liquidadas en órdenes
    if (todasSeries.length > 0) {
      const [seriesEnUso] = await connection.query(`
        SELECT 
          ps.numero_serie,
          ps.estado,
          p.nombre AS producto_nombre,
          ts.id_trabajador,
          TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS tecnico_nombre
        FROM producto_series ps
        JOIN productos p ON ps.id_producto = p.id_producto
        LEFT JOIN trabajador_series ts ON ps.id_producto_serie = ts.id_producto_serie AND ts.estado = 'Asignada'
        LEFT JOIN trabajadores t ON ts.id_trabajador = t.id_trabajador
        LEFT JOIN usuarios u ON t.id_usuario = u.id_usuario
        WHERE ps.numero_serie IN (?)
          AND (ps.estado != 'DISPONIBLE' OR ps.id_almacen != 1 OR ts.id_trabajador_serie IS NOT NULL)
      `, [todasSeries]);

      if (seriesEnUso.length > 0) {
        const listaDetalles = seriesEnUso.map(s => {
          const motivoUso = s.tecnico_nombre ? `asignada a ${s.tecnico_nombre}` : `en estado '${s.estado}'`;
          return `• Serie "${s.numero_serie}" (${s.producto_nombre}): ${motivoUso}`;
        }).join('\\n');

        connection.release();
        return res.status(400).json({
          error: `🚫 No se puede anular la compra porque ${seriesEnUso.length} equipo(s) ya no están disponibles en Almacén Central:\n\n${listaDetalles}\n\nPara anular esta compra, primero el técnico debe devolver las series o deben desvincularse.`
        });
      }
    }

    // 5. Iniciar Transacción de Anulación
    await connection.beginTransaction();

    const motivoFinal = motivo ? `Motivo: ${String(motivo).trim()}` : "Anulación de ingreso de compra";

    for (const d of detalles) {
      const prodId = d.id_producto;
      const cant = Number(d.cantidad) || 0;

      // Descontar stock en Almacén Central (id_almacen = 1)
      await connection.query(`
        UPDATE stock 
        SET cantidad = GREATEST(0, cantidad - ?)
        WHERE id_producto = ? AND id_almacen = 1
      `, [cant, prodId]);

      // Si tenía series, eliminarlas de producto_series
      if (d.series_ingresadas) {
        const sns = d.series_ingresadas.split(',').map(s => s.trim()).filter(Boolean);
        if (sns.length > 0) {
          await connection.query(`
            DELETE FROM producto_series 
            WHERE numero_serie IN (?) AND id_producto = ? AND id_almacen = 1
          `, [sns, prodId]);
        }
      }

      // Registrar movimiento de SALIDA por Anulación en Kardex
      await connection.query(`
        INSERT INTO movimientos (id_producto, id_almacen, tipo, cantidad, referencia, fecha_creacion)
        VALUES (?, 1, 'SALIDA', ?, ?, NOW())
      `, [prodId, cant, `Anulación Compra #${idCompra} (${compra.tipo_comprobante || 'Comp'} ${compra.numero_comprobante || ''}) - ${motivoFinal}`]);
    }

    // Actualizar estado de la compra a ANULADA
    const observacionAnulacion = compra.observaciones 
      ? `${compra.observaciones} | [ANULADA: ${motivoFinal}]`
      : `[ANULADA: ${motivoFinal}]`;

    await connection.query(`
      UPDATE compras 
      SET estado = 'ANULADA', observaciones = ?
      WHERE id_compra = ?
    `, [observacionAnulacion, idCompra]);

    await connection.commit();
    connection.release();

    res.json({
      success: true,
      message: `✅ Compra #${idCompra} anulada exitosamente. Se revirtió el stock y se retiraron las series de Almacén Central.`
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error("Error al anular compra:", error);
    res.status(500).json({ error: error.message });
  }
});

// --- 📦 3.3 REASIGNAR SERIE INDIVIDUAL A OTRO PRODUCTO (CORRECCIÓN DE DIGITACIÓN) ---
app.post('/api/almacen/producto-series/:id/reasignar-producto', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const idProductoSerie = Number(req.params.id);
    const { nuevo_id_producto, motivo } = req.body || {};

    if (!idProductoSerie || !nuevo_id_producto) {
      connection.release();
      return res.status(400).json({ error: "Datos incompletos para reasignar el producto." });
    }

    // 1. Obtener la serie
    const [serieRows] = await connection.query(`
      SELECT ps.*, p.nombre AS producto_origen_nombre, p.codigo AS producto_origen_codigo
      FROM producto_series ps
      JOIN productos p ON ps.id_producto = p.id_producto
      WHERE ps.id_producto_serie = ?
    `, [idProductoSerie]);

    if (serieRows.length === 0) {
      connection.release();
      return res.status(404).json({ error: "La serie no existe." });
    }

    const serie = serieRows[0];

    // Verificar que esté en Almacén Central y DISPONIBLE
    if (serie.estado !== 'DISPONIBLE' || serie.id_almacen !== 1) {
      connection.release();
      return res.status(400).json({ 
        error: `La serie "${serie.numero_serie}" está en estado '${serie.estado}'. Solo se pueden reasignar series disponibles en Almacén Central.` 
      });
    }

    if (serie.id_producto === Number(nuevo_id_producto)) {
      connection.release();
      return res.status(400).json({ error: "La serie ya pertenece a este producto." });
    }

    // 2. Obtener producto destino
    const [prodDestinoRows] = await connection.query("SELECT id_producto, nombre, codigo FROM productos WHERE id_producto = ?", [nuevo_id_producto]);
    if (prodDestinoRows.length === 0) {
      connection.release();
      return res.status(404).json({ error: "El producto de destino no existe." });
    }
    const prodDestino = prodDestinoRows[0];

    // 3. Iniciar Transacción
    await connection.beginTransaction();

    // Descontar 1 al producto anterior en Almacén Central
    await connection.query(`
      UPDATE stock 
      SET cantidad = GREATEST(0, cantidad - 1) 
      WHERE id_producto = ? AND id_almacen = 1
    `, [serie.id_producto]);

    // Incrementar 1 al nuevo producto en Almacén Central
    const [stockDestino] = await connection.query("SELECT id_stock FROM stock WHERE id_producto = ? AND id_almacen = 1", [nuevo_id_producto]);
    if (stockDestino.length > 0) {
      await connection.query("UPDATE stock SET cantidad = cantidad + 1 WHERE id_stock = ?", [stockDestino[0].id_stock]);
    } else {
      await connection.query("INSERT INTO stock (id_producto, id_almacen, cantidad, cantidad_segundo_uso) VALUES (?, 1, 1, 0)", [nuevo_id_producto]);
    }

    // Generar nuevo correlativo para el nuevo producto
    const modelCode = (prodDestino.codigo || 'EQ').trim();
    const [lastSerie] = await connection.query(
      "SELECT codigo_serie FROM producto_series WHERE id_producto = ? AND codigo_serie IS NOT NULL ORDER BY id_producto_serie DESC LIMIT 1",
      [nuevo_id_producto]
    );
    let nextNum = 1;
    if (lastSerie.length > 0 && lastSerie[0].codigo_serie) {
      const m = lastSerie[0].codigo_serie.match(/-S(\d+)$/i);
      if (m) nextNum = parseInt(m[1], 10) + 1;
    }
    const nuevoCodigoSerie = `${modelCode}-S${String(nextNum).padStart(3, '0')}`;

    // Actualizar producto_series
    await connection.query(`
      UPDATE producto_series 
      SET id_producto = ?, codigo_serie = ?
      WHERE id_producto_serie = ?
    `, [nuevo_id_producto, nuevoCodigoSerie, idProductoSerie]);

    // Registrar en movimientos
    const ref = `Corrección: Serie ${serie.numero_serie} movida de [${serie.producto_origen_nombre}] a [${prodDestino.nombre}]. ${motivo || ''}`;
    await connection.query(`
      INSERT INTO movimientos (id_producto, id_almacen, tipo, cantidad, referencia, fecha_creacion)
      VALUES (?, 1, 'SALIDA', 1, ?, NOW())
    `, [serie.id_producto, ref]);

    await connection.query(`
      INSERT INTO movimientos (id_producto, id_almacen, tipo, cantidad, referencia, fecha_creacion)
      VALUES (?, 1, 'ENTRADA', 1, ?, NOW())
    `, [nuevo_id_producto, ref]);

    await connection.commit();
    connection.release();

    res.json({
      success: true,
      message: `✅ Serie "${serie.numero_serie}" reasignada exitosamente a "${prodDestino.nombre}". Stock de ambos productos actualizado.`,
      nuevo_codigo_serie: nuevoCodigoSerie
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error("Error al reasignar serie a producto:", error);
    res.status(500).json({ error: error.message });
  }
});

// --- 🔍 3.9 VERIFICACIÓN EN TIEMPO REAL DE SERIES PARA DESPACHO A TÉCNICOS ---
app.get('/api/almacen/verificar-serie-despacho/:serie', async (req, res) => {
  try {
    const rawSerie = req.params.serie;
    const cleanSerie = String(rawSerie || '').trim().toUpperCase();
    const idProducto = req.query.id_producto ? Number(req.query.id_producto) : null;

    if (!cleanSerie) {
      return res.status(400).json({ disponible: false, error: "Debe ingresar o pistolear un número de serie válido." });
    }

    const [rows] = await pool.query(`
      SELECT 
        ps.id_producto_serie,
        ps.id_producto,
        ps.numero_serie,
        ps.codigo_serie,
        ps.id_equipo,
        ps.proid,
        ps.estado,
        ps.id_almacen,
        p.nombre AS producto_nombre,
        p.proid AS producto_proid,
        c.nombre AS categoria,
        ts.id_trabajador,
        ts.estado AS estado_trabajador,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS tecnico_nombre,
        u.cuadrilla,
        COALESCE(v.placa, '') AS vehiculo_placa
      FROM producto_series ps
      JOIN productos p ON ps.id_producto = p.id_producto
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      LEFT JOIN trabajador_series ts ON ps.id_producto_serie = ts.id_producto_serie AND ts.estado = 'Asignada'
      LEFT JOIN trabajadores t ON ts.id_trabajador = t.id_trabajador
      LEFT JOIN usuarios u ON t.id_usuario = u.id_usuario
      LEFT JOIN vehiculos v ON t.id_vehiculo = v.id_vehiculo
      WHERE ps.numero_serie = ? OR ps.codigo_serie = ? OR ps.id_equipo = ? OR ps.proid = ?
      ORDER BY (ps.estado = 'DISPONIBLE') DESC, ps.id_producto_serie DESC
      LIMIT 1
    `, [cleanSerie, cleanSerie, cleanSerie, cleanSerie]);

    if (rows.length === 0) {
      return res.status(404).json({
        disponible: false,
        error: `⛔ La serie o código "${cleanSerie}" no existe en el catálogo ni en Almacén Central.`
      });
    }

    const item = rows[0];

    // Si se especificó un producto (ej: desde QuickDispatchModal) y no coincide
    if (idProducto && item.id_producto !== idProducto) {
      return res.status(400).json({
        disponible: false,
        error: `⚠️ La serie pertenece a "${item.producto_nombre}", no al producto seleccionado.`
      });
    }

    // Validar estado de la serie
    if (item.estado !== 'DISPONIBLE') {
      if (item.estado === 'RESERVADO' || item.estado_trabajador === 'Asignada') {
        const detTec = item.tecnico_nombre
          ? `asignada a ${item.tecnico_nombre}${item.cuadrilla ? ` (Cuadrilla: ${item.cuadrilla})` : ''}${item.vehiculo_placa ? ` [Placa: ${item.vehiculo_placa}]` : ''}`
          : 'ya asignada a otra cuadrilla';
        return res.status(400).json({
          disponible: false,
          error: `⚠️ La serie "${item.numero_serie}" (${item.producto_nombre}) está ${detTec}. No se puede despachar.`
        });
      }

      if (item.estado === 'DEFECTUOSO') {
        return res.status(400).json({
          disponible: false,
          error: `⚠️ La serie "${item.numero_serie}" (${item.producto_nombre}) está en estado DEFECTUOSO / AVERIADO.`
        });
      }

      if (item.estado === 'BAJA') {
        return res.status(400).json({
          disponible: false,
          error: `⚠️ La serie "${item.numero_serie}" (${item.producto_nombre}) fue dada de BAJA.`
        });
      }

      if (item.estado === 'VENDIDO') {
        return res.status(400).json({
          disponible: false,
          error: `⚠️ La serie "${item.numero_serie}" (${item.producto_nombre}) ya fue liquidada e instalada a un cliente.`
        });
      }

      return res.status(400).json({
        disponible: false,
        error: `⚠️ La serie "${item.numero_serie}" (${item.producto_nombre}) no está disponible (Estado actual: ${item.estado}).`
      });
    }

    // Validar que esté en Almacén Central (id_almacen = 1)
    if (item.id_almacen !== 1) {
      return res.status(400).json({
        disponible: false,
        error: `⚠️ La serie "${item.numero_serie}" (${item.producto_nombre}) no se encuentra en Almacén Central.`
      });
    }

    // Serie válida y 100% disponible
    return res.json({
      disponible: true,
      equipo: {
        id_producto_serie: item.id_producto_serie,
        id_producto: item.id_producto,
        numero_serie: item.numero_serie,
        codigo_serie: item.codigo_serie,
        id_equipo: item.id_equipo || null,
        proid: item.proid || item.producto_proid || null,
        producto_nombre: item.producto_nombre,
        categoria: item.categoria
      }
    });
  } catch (error) {
    console.error("Error al verificar serie para despacho:", error);
    res.status(500).json({ disponible: false, error: "Error en el servidor al verificar serie: " + error.message });
  }
});

// --- 📦 4. DESPACHO / DOTACIÓN A TÉCNICOS (TRANSFERENCIA A STOCK MÓVIL) ---
app.post('/api/almacen/despacho-tecnico', async (req, res) => {
  try {
    const { id_trabajador, items, series_pistoleadas, observaciones } = req.body;

    if (!id_trabajador) {
      return res.status(400).json({ error: "Debe seleccionar el técnico al que se entrega el material." });
    }

    const productosConSeries = new Set(
      (Array.isArray(series_pistoleadas) ? series_pistoleadas : [])
        .map((serie) => Number(serie.id_producto || (items && items[0] ? items[0].id_producto : 0)))
        .filter(Boolean)
    );

    // VALIDACIÓN PREVIA ESTRICTA:
    // Todas las series de equipos que no sean talonarios autogenerados deben existir y estar DISPONIBLES en Almacén Central
    if (Array.isArray(series_pistoleadas) && series_pistoleadas.length > 0) {
      for (const itemSerie of series_pistoleadas) {
        const cleanSerie = String(itemSerie.numero_serie || itemSerie).trim().toUpperCase();
        if (!cleanSerie) continue;
        const esTalonario = Boolean(itemSerie.es_talonario);

        if (!esTalonario) {
          const [serieRows] = await pool.query(`
            SELECT ps.id_producto_serie, ps.id_producto, ps.numero_serie, ps.estado, ps.id_almacen, p.nombre AS producto_nombre
            FROM producto_series ps
            JOIN productos p ON ps.id_producto = p.id_producto
            WHERE ps.numero_serie = ? OR ps.codigo_serie = ? OR ps.id_equipo = ? OR ps.proid = ?
          `, [cleanSerie, cleanSerie, cleanSerie, cleanSerie]);

          if (serieRows.length === 0) {
            return res.status(400).json({
              error: `⛔ La serie "${cleanSerie}" no existe en el catálogo de Almacén Central. Despacho cancelado.`
            });
          }

          const s = serieRows[0];
          const productosSolicitados = new Set((Array.isArray(items) ? items : []).map((item) => Number(item.id_producto)));
          if (productosSolicitados.size > 0 && !productosSolicitados.has(Number(s.id_producto))) {
            return res.status(400).json({
              error: `⛔ La serie "${s.numero_serie}" pertenece a otro producto. Despacho cancelado.`
            });
          }
          if (s.estado !== 'DISPONIBLE') {
            return res.status(400).json({
              error: `⛔ El equipo "${s.producto_nombre}" (Serie: ${s.numero_serie}) no está disponible en Almacén Central (Estado: ${s.estado}). Despacho cancelado.`
            });
          }

          if (s.id_almacen !== 1) {
            return res.status(400).json({
              error: `⛔ El equipo "${s.producto_nombre}" (Serie: ${s.numero_serie}) no está en Almacén Central. Despacho cancelado.`
            });
          }
        }
      }
    }

    // 1. Validar disponibilidad de stock de Insumos / Materiales antes de despachar
    if (Array.isArray(items)) {
      for (const item of items) {
        const prodId = Number(item.id_producto);
        const cant = Number(item.cantidad) || 0;
        if (cant <= 0) continue;
        if (productosConSeries.has(prodId)) continue;

        const [stockRows] = await pool.query(
          "SELECT s.cantidad, p.nombre FROM stock s JOIN productos p ON s.id_producto = p.id_producto WHERE s.id_producto = ? AND s.id_almacen = 1",
          [prodId]
        );
        const stockActual = stockRows.length > 0 ? Number(stockRows[0].cantidad) : 0;
        const nombreProd = stockRows.length > 0 ? stockRows[0].nombre : `Producto #${prodId}`;

        if (stockActual <= 0) {
          return res.status(400).json({
            error: `⛔ No hay stock disponible en Almacén Central para "${nombreProd}" (Stock: 0). Despacho cancelado.`
          });
        }
        if (cant > stockActual) {
          return res.status(400).json({
            error: `⛔ Stock insuficiente para "${nombreProd}". Disponible en Almacén Central: ${stockActual}, Solicitado: ${cant}. Despacho cancelado.`
          });
        }
      }
    }

    // 1.1 Asignar Insumos / Materiales (Conectores, Cable Drop, Rosetas, etc.)
    if (Array.isArray(items)) {
      for (const item of items) {
        const prodId = Number(item.id_producto);
        const cant = Number(item.cantidad) || 0;
        if (cant <= 0) continue;
        if (productosConSeries.has(prodId)) continue;

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
        let [serieRows] = await pool.query(
          "SELECT id_producto_serie, id_producto, numero_serie FROM producto_series WHERE numero_serie = ? OR codigo_serie = ? OR id_equipo = ? OR proid = ?",
          [cleanSerie, cleanSerie, cleanSerie, cleanSerie]
        );
        let idProdSerie = null;
        let actualProdId = targetProdId;

        if (serieRows.length > 0) {
          idProdSerie = serieRows[0].id_producto_serie;
          actualProdId = serieRows[0].id_producto;
          await pool.query("UPDATE producto_series SET estado = 'RESERVADO', id_almacen = 2 WHERE id_producto_serie = ?", [idProdSerie]);
          await pool.query("UPDATE stock SET cantidad = GREATEST(0, cantidad - 1) WHERE id_producto = ? AND id_almacen = 1", [actualProdId]);
        } else if (itemSerie.es_talonario && actualProdId) {
          // Si es un lote de talonarios autogenerados
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

// --- ↩️ 4.0.1 DEVOLUCIÓN DE MATERIALES O EQUIPOS DE TÉCNICO A ALMACÉN CENTRAL ---
app.post('/api/almacen/devolucion-tecnico', async (req, res) => {
  try {
    const { id_trabajador, id_producto, cantidad, series_devueltas, motivo, devolver_todo } = req.body;

    if (!id_trabajador) {
      return res.status(400).json({ error: "Debe indicar el técnico que realiza la devolución." });
    }

    const [tecnicoRows] = await pool.query(`
      SELECT TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS tecnico_nombre
      FROM trabajadores t
      JOIN usuarios u ON t.id_usuario = u.id_usuario
      WHERE t.id_trabajador = ?
    `, [id_trabajador]);
    const tecnicoNombre = tecnicoRows[0]?.tecnico_nombre || `Técnico #${id_trabajador}`;

    // CASO A: Devolver toda la dotación completa (cuando el técnico se retira / cese)
    if (devolver_todo) {
      // 1. Devolver todos los productos asignados (trabajador_productos)
      const [prodRows] = await pool.query(`
        SELECT tp.id_producto, tp.stock, c.nombre AS categoria
        FROM trabajador_productos tp
        JOIN productos p ON tp.id_producto = p.id_producto
        LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
        WHERE tp.id_trabajador = ? AND tp.stock > 0
      `, [id_trabajador]);

      for (const p of prodRows) {
        const es2doUso = esCategoriaSegundoUso(p.categoria);
        if (es2doUso) {
          const [upd] = await pool.query("UPDATE stock SET cantidad_segundo_uso = COALESCE(cantidad_segundo_uso, 0) + ? WHERE id_producto = ? AND (id_almacen = 1 OR id_almacen IS NULL)", [p.stock, p.id_producto]);
          if (upd.affectedRows === 0) {
            await pool.query("INSERT INTO stock (id_producto, id_almacen, cantidad, cantidad_segundo_uso) VALUES (?, 1, 0, ?)", [p.id_producto, p.stock]);
          }
          await pool.query(`
            INSERT INTO movimientos (id_producto, id_almacen, tipo, cantidad, referencia, fecha_creacion)
            VALUES (?, 1, 'ENTRADA', ?, ?, NOW())
          `, [p.id_producto, p.stock, `Devolución total por retiro (SEGUNDO USO): ${tecnicoNombre} (${motivo || 'Baja de personal'})`]);
        } else {
          const [upd] = await pool.query("UPDATE stock SET cantidad = COALESCE(cantidad, 0) + ? WHERE id_producto = ? AND (id_almacen = 1 OR id_almacen IS NULL)", [p.stock, p.id_producto]);
          if (upd.affectedRows === 0) {
            await pool.query("INSERT INTO stock (id_producto, id_almacen, cantidad, cantidad_segundo_uso) VALUES (?, 1, ?, 0)", [p.id_producto, p.stock]);
          }
          await pool.query(`
            INSERT INTO movimientos (id_producto, id_almacen, tipo, cantidad, referencia, fecha_creacion)
            VALUES (?, 1, 'ENTRADA', ?, ?, NOW())
          `, [p.id_producto, p.stock, `Devolución total por retiro: ${tecnicoNombre} (${motivo || 'Baja de personal'})`]);
        }
      }
      await pool.query("UPDATE trabajador_productos SET stock = 0 WHERE id_trabajador = ?", [id_trabajador]);

      // 2. Devolver todas las series activas (trabajador_series)
      const [serieRows] = await pool.query(`
        SELECT ts.id_trabajador_serie, ts.id_producto_serie, ps.id_producto, c.nombre AS categoria
        FROM trabajador_series ts
        JOIN producto_series ps ON ts.id_producto_serie = ps.id_producto_serie
        JOIN productos p ON ps.id_producto = p.id_producto
        LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
        WHERE ts.id_trabajador = ? AND ts.estado = 'Asignada'
      `, [id_trabajador]);

      for (const s of serieRows) {
        await pool.query("UPDATE trabajador_series SET estado = 'Devuelta' WHERE id_trabajador_serie = ?", [s.id_trabajador_serie]);
        await pool.query("UPDATE producto_series SET estado = 'DISPONIBLE', id_almacen = 1 WHERE id_producto_serie = ?", [s.id_producto_serie]);
        const es2doUso = esCategoriaSegundoUso(s.categoria);
        if (es2doUso) {
          const [upd] = await pool.query("UPDATE stock SET cantidad_segundo_uso = COALESCE(cantidad_segundo_uso, 0) + 1 WHERE id_producto = ? AND (id_almacen = 1 OR id_almacen IS NULL)", [s.id_producto]);
          if (upd.affectedRows === 0) {
            await pool.query("INSERT INTO stock (id_producto, id_almacen, cantidad, cantidad_segundo_uso) VALUES (?, 1, 0, 1)", [s.id_producto]);
          }
        } else {
          const [upd] = await pool.query("UPDATE stock SET cantidad = COALESCE(cantidad, 0) + 1 WHERE id_producto = ? AND (id_almacen = 1 OR id_almacen IS NULL)", [s.id_producto]);
          if (upd.affectedRows === 0) {
            await pool.query("INSERT INTO stock (id_producto, id_almacen, cantidad, cantidad_segundo_uso) VALUES (?, 1, 1, 0)", [s.id_producto]);
          }
        }
      }

      return res.json({ success: true, message: `Se devolvió exitosamente toda la dotación de ${tecnicoNombre} a Almacén Central.` });
    }

    // CASO B: Devolución específica de un producto o material
    if (id_producto && Number(cantidad) > 0) {
      const cant = Number(cantidad);
      const [tp] = await pool.query("SELECT stock FROM trabajador_productos WHERE id_trabajador = ? AND id_producto = ?", [id_trabajador, id_producto]);
      const stockActual = tp[0]?.stock || 0;
      if (cant > stockActual) {
        return res.status(400).json({ error: `El técnico solo tiene ${stockActual} unidades en su vehículo. No puede devolver ${cant}.` });
      }

      await pool.query("UPDATE trabajador_productos SET stock = GREATEST(0, stock - ?) WHERE id_trabajador = ? AND id_producto = ?", [cant, id_trabajador, id_producto]);

      const [pRow] = await pool.query("SELECT c.nombre AS categoria FROM productos p LEFT JOIN categorias c ON p.id_categoria = c.id_categoria WHERE p.id_producto = ?", [id_producto]);
      const es2doUso = esCategoriaSegundoUso(pRow[0]?.categoria);

      if (es2doUso) {
        const [upd] = await pool.query("UPDATE stock SET cantidad_segundo_uso = COALESCE(cantidad_segundo_uso, 0) + ? WHERE id_producto = ? AND (id_almacen = 1 OR id_almacen IS NULL)", [cant, id_producto]);
        if (upd.affectedRows === 0) {
          await pool.query("INSERT INTO stock (id_producto, id_almacen, cantidad, cantidad_segundo_uso) VALUES (?, 1, 0, ?)", [id_producto, cant]);
        }
        await pool.query(`
          INSERT INTO movimientos (id_producto, id_almacen, tipo, cantidad, referencia, fecha_creacion)
          VALUES (?, 1, 'ENTRADA', ?, ?, NOW())
        `, [id_producto, cant, `Devolución (SEGUNDO USO) de ${tecnicoNombre} (${motivo || 'Retorno de dotación'})`]);
      } else {
        const [upd] = await pool.query("UPDATE stock SET cantidad = COALESCE(cantidad, 0) + ? WHERE id_producto = ? AND (id_almacen = 1 OR id_almacen IS NULL)", [cant, id_producto]);
        if (upd.affectedRows === 0) {
          await pool.query("INSERT INTO stock (id_producto, id_almacen, cantidad, cantidad_segundo_uso) VALUES (?, 1, ?, 0)", [id_producto, cant]);
        }
        await pool.query(`
          INSERT INTO movimientos (id_producto, id_almacen, tipo, cantidad, referencia, fecha_creacion)
          VALUES (?, 1, 'ENTRADA', ?, ?, NOW())
        `, [id_producto, cant, `Devolución de material de ${tecnicoNombre} (${motivo || 'Retorno de material'})`]);
      }
    }

    // Series devueltas
    if (Array.isArray(series_devueltas) && series_devueltas.length > 0) {
      for (const item of series_devueltas) {
        const numSerie = String(item.numero_serie || item).trim().toUpperCase();
        const [sRows] = await pool.query(`
          SELECT ts.id_trabajador_serie, ts.id_producto_serie, ps.id_producto, c.nombre AS categoria
          FROM trabajador_series ts
          JOIN producto_series ps ON ts.id_producto_serie = ps.id_producto_serie
          JOIN productos p ON ps.id_producto = p.id_producto
          LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
          WHERE ts.id_trabajador = ? AND ps.numero_serie = ? AND ts.estado = 'Asignada'
        `, [id_trabajador, numSerie]);

        if (sRows.length > 0) {
          const s = sRows[0];
          await pool.query("UPDATE trabajador_series SET estado = 'Devuelta' WHERE id_trabajador_serie = ?", [s.id_trabajador_serie]);
          await pool.query("UPDATE producto_series SET estado = 'DISPONIBLE', id_almacen = 1 WHERE id_producto_serie = ?", [s.id_producto_serie]);
          const es2doUso = esCategoriaSegundoUso(s.categoria);
          if (es2doUso) {
            const [upd] = await pool.query("UPDATE stock SET cantidad_segundo_uso = COALESCE(cantidad_segundo_uso, 0) + 1 WHERE id_producto = ? AND (id_almacen = 1 OR id_almacen IS NULL)", [s.id_producto]);
            if (upd.affectedRows === 0) {
              await pool.query("INSERT INTO stock (id_producto, id_almacen, cantidad, cantidad_segundo_uso) VALUES (?, 1, 0, 1)", [s.id_producto]);
            }
          } else {
            const [upd] = await pool.query("UPDATE stock SET cantidad = COALESCE(cantidad, 0) + 1 WHERE id_producto = ? AND (id_almacen = 1 OR id_almacen IS NULL)", [s.id_producto]);
            if (upd.affectedRows === 0) {
              await pool.query("INSERT INTO stock (id_producto, id_almacen, cantidad, cantidad_segundo_uso) VALUES (?, 1, 1, 0)", [s.id_producto]);
            }
          }
        }
      }
    }

    res.json({ success: true, message: "Devolución registrada exitosamente en Almacén Central." });
  } catch (error) {
    console.error("Error en devolucion-tecnico:", error);
    res.status(500).json({ error: error.message });
  }
});

// --- 📋 4.0.2 LIQUIDACIÓN FORMAL DE DOTACIÓN (PAZ Y SALVO CON VERIFICACIÓN) ---
app.post('/api/almacen/procesar-liquidacion', async (req, res) => {
  try {
    const {
      id_trabajador,
      tecnico_nombre,
      cuadrilla,
      vehiculo_placa,
      almacenero_nombre,
      motivo,
      observaciones,
      items,
      series_devueltas_todas
    } = req.body;

    if (!id_trabajador) {
      return res.status(400).json({ error: "Debe especificar el técnico a liquidar." });
    }

    let totalItemsDevueltos = 0;
    let totalSeriesDevueltas = Array.isArray(series_devueltas_todas) ? series_devueltas_todas.length : 0;

    // 1. Insertar cabecera de la liquidación
    const [liqResult] = await pool.query(`
      INSERT INTO liquidaciones_tecnicos (
        id_trabajador, tecnico_nombre, cuadrilla, vehiculo_placa, almacenero_nombre,
        motivo, observaciones, total_items_devueltos, total_series_devueltas, fecha_liquidacion
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      id_trabajador,
      tecnico_nombre || `Técnico #${id_trabajador}`,
      cuadrilla || 'S/C',
      vehiculo_placa || 'Sin vehículo',
      almacenero_nombre || 'Almacén Central',
      motivo || 'Baja / Retiro de personal',
      observaciones || '',
      0,
      totalSeriesDevueltas
    ]);

    const idLiquidacion = liqResult.insertId;

    // 2. Procesar ítems y descontar del vehículo / sumar a central
    if (Array.isArray(items)) {
      for (const it of items) {
        const prodId = Number(it.id_producto);
        const cantDevuelta = Number(it.cantidad_devuelta) || 0;
        const cantEsperada = Number(it.cantidad_esperada) || 0;
        const cantFaltante = Math.max(0, cantEsperada - cantDevuelta);

        totalItemsDevueltos += cantDevuelta;

        // Guardar detalle
        await pool.query(`
          INSERT INTO liquidacion_detalles (
            id_liquidacion, id_producto, producto_nombre, producto_codigo, categoria,
            cantidad_esperada, cantidad_devuelta, cantidad_faltante, series_devueltas, observaciones
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          idLiquidacion,
          prodId,
          it.producto_nombre || 'Material',
          it.producto_codigo || null,
          it.categoria || 'MATERIALES',
          cantEsperada,
          cantDevuelta,
          cantFaltante,
          Array.isArray(it.series_devueltas) ? JSON.stringify(it.series_devueltas) : (it.series_devueltas || null),
          it.observaciones || null
        ]);

        // Aumentar en Almacén Central la cantidad devuelta (Segundo Uso solo para HERRAMIENTAS, UNIFORMES y VEHICULO)
        if (cantDevuelta > 0) {
          const esSegundoUso = esCategoriaSegundoUso(it.categoria);
          if (esSegundoUso) {
            const [upd] = await pool.query("UPDATE stock SET cantidad_segundo_uso = COALESCE(cantidad_segundo_uso, 0) + ? WHERE id_producto = ? AND (id_almacen = 1 OR id_almacen IS NULL)", [cantDevuelta, prodId]);
            if (upd.affectedRows === 0) {
              await pool.query("INSERT INTO stock (id_producto, id_almacen, cantidad, cantidad_segundo_uso) VALUES (?, 1, 0, ?)", [prodId, cantDevuelta]);
            }
          } else {
            const [upd] = await pool.query("UPDATE stock SET cantidad = COALESCE(cantidad, 0) + ? WHERE id_producto = ? AND (id_almacen = 1 OR id_almacen IS NULL)", [cantDevuelta, prodId]);
            if (upd.affectedRows === 0) {
              await pool.query("INSERT INTO stock (id_producto, id_almacen, cantidad, cantidad_segundo_uso) VALUES (?, 1, ?, 0)", [prodId, cantDevuelta]);
            }
          }

          // Kardex Entrada
          await pool.query(`
            INSERT INTO movimientos (id_producto, id_almacen, tipo, cantidad, referencia, fecha_creacion)
            VALUES (?, 1, 'ENTRADA', ?, ?, NOW())
          `, [prodId, cantDevuelta, `Liquidación Dotación #${idLiquidacion} (${esSegundoUso ? 'SEGUNDO USO' : 'RETORNO ALMACEN'}): ${tecnico_nombre} (${motivo})`]);
        }

        // Si fue una liquidación total, dejar en 0 el stock asignado en el vehículo
        await pool.query("UPDATE trabajador_productos SET stock = GREATEST(0, stock - ?) WHERE id_trabajador = ? AND id_producto = ?", [cantEsperada, id_trabajador, prodId]);
      }
    }

    // 3. Procesar Equipos / Series devueltas
    if (Array.isArray(series_devueltas_todas) && series_devueltas_todas.length > 0) {
      for (const sn of series_devueltas_todas) {
        const cleanSn = String(sn).trim().toUpperCase();
        if (!cleanSn) continue;

        const [sRows] = await pool.query(`
          SELECT ts.id_trabajador_serie, ts.id_producto_serie, ps.id_producto, c.nombre AS categoria
          FROM trabajador_series ts
          JOIN producto_series ps ON ts.id_producto_serie = ps.id_producto_serie
          JOIN productos p ON ps.id_producto = p.id_producto
          LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
          WHERE ts.id_trabajador = ? AND ps.numero_serie = ? AND ts.estado = 'Asignada'
        `, [id_trabajador, cleanSn]);

        if (sRows.length > 0) {
          const s = sRows[0];
          await pool.query("UPDATE trabajador_series SET estado = 'Devuelta' WHERE id_trabajador_serie = ?", [s.id_trabajador_serie]);
          await pool.query("UPDATE producto_series SET estado = 'DISPONIBLE', id_almacen = 1 WHERE id_producto_serie = ?", [s.id_producto_serie]);
          const es2doUso = esCategoriaSegundoUso(s.categoria);
          if (es2doUso) {
            const [upd] = await pool.query("UPDATE stock SET cantidad_segundo_uso = COALESCE(cantidad_segundo_uso, 0) + 1 WHERE id_producto = ? AND (id_almacen = 1 OR id_almacen IS NULL)", [s.id_producto]);
            if (upd.affectedRows === 0) {
              await pool.query("INSERT INTO stock (id_producto, id_almacen, cantidad, cantidad_segundo_uso) VALUES (?, 1, 0, 1)", [s.id_producto]);
            }
          } else {
            const [upd] = await pool.query("UPDATE stock SET cantidad = COALESCE(cantidad, 0) + 1 WHERE id_producto = ? AND id_almacen = 1", [s.id_producto]);
            if (upd.affectedRows === 0) {
              await pool.query("INSERT INTO stock (id_producto, id_almacen, cantidad, cantidad_segundo_uso) VALUES (?, 1, 1, 0)", [s.id_producto]);
            }
          }
        }
      }
    }

    // Actualizar total devueltos en cabecera
    await pool.query("UPDATE liquidaciones_tecnicos SET total_items_devueltos = ? WHERE id_liquidacion = ?", [totalItemsDevueltos, idLiquidacion]);

    res.json({
      success: true,
      id_liquidacion: idLiquidacion,
      message: `Liquidación de ${tecnico_nombre} procesada exitosamente. Constancia #${idLiquidacion} generada.`
    });
  } catch (error) {
    console.error("Error en procesar-liquidacion:", error);
    res.status(500).json({ error: error.message });
  }
});

// --- 📋 4.0.3 HISTORIAL DE LIQUIDACIONES ---
app.get('/api/almacen/historial-liquidaciones', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        l.id_liquidacion,
        l.id_trabajador,
        l.tecnico_nombre,
        COALESCE(u.documento, '') AS tecnico_dni,
        l.cuadrilla,
        l.vehiculo_placa,
        l.almacenero_nombre,
        l.motivo,
        l.observaciones,
        l.total_items_devueltos,
        l.total_series_devueltas,
        l.fecha_liquidacion,
        COUNT(d.id_detalle) as total_lineas
      FROM liquidaciones_tecnicos l
      LEFT JOIN trabajadores t ON l.id_trabajador = t.id_trabajador
      LEFT JOIN usuarios u ON t.id_usuario = u.id_usuario
      LEFT JOIN liquidacion_detalles d ON l.id_liquidacion = d.id_liquidacion
      GROUP BY l.id_liquidacion
      ORDER BY l.fecha_liquidacion DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error("Error en historial-liquidaciones:", error);
    res.status(500).json({ error: error.message });
  }
});

// --- 📋 4.0.4 DETALLE DE LIQUIDACIÓN ESPECÍFICA (PARA RE-DESCARGAR CONSTANCIA) ---
app.get('/api/almacen/liquidacion/:id', async (req, res) => {
  try {
    const idLiq = req.params.id;
    const [cabecera] = await pool.query(`
      SELECT l.*, COALESCE(u.documento, '') AS tecnico_dni
      FROM liquidaciones_tecnicos l
      LEFT JOIN trabajadores t ON l.id_trabajador = t.id_trabajador
      LEFT JOIN usuarios u ON t.id_usuario = u.id_usuario
      WHERE l.id_liquidacion = ?
    `, [idLiq]);
    if (cabecera.length === 0) {
      return res.status(404).json({ error: "Liquidación no encontrada." });
    }
    const [detalles] = await pool.query("SELECT * FROM liquidacion_detalles WHERE id_liquidacion = ?", [idLiq]);
    res.json({
      ...cabecera[0],
      detalles
    });
  } catch (error) {
    console.error("Error en liquidacion/:id:", error);
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
      SELECT p.id_producto, p.codigo, p.proid, p.nombre, p.descripcion, c.nombre AS categoria, p.stock_minimo
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
        ps.id_equipo,
        ps.proid,
        p.codigo AS producto_codigo,
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
      JOIN productos p ON ps.id_producto = p.id_producto
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

// --- 📦 ACTUALIZAR ID DE EQUIPO DE UNA SERIE ESPECÍFICA ---
app.put('/api/almacen/producto-series/:idProductoSerie/id-equipo', async (req, res) => {
  try {
    const { idProductoSerie } = req.params;
    const { id_equipo } = req.body;
    const cleanIdEquipo = id_equipo && String(id_equipo).trim() ? String(id_equipo).trim().toUpperCase() : null;

    if (cleanIdEquipo) {
      const [dups] = await pool.query(
        "SELECT id_producto_serie, numero_serie FROM producto_series WHERE id_equipo = ? AND id_producto_serie != ?",
        [cleanIdEquipo, idProductoSerie]
      );
      if (dups.length > 0) {
        return res.status(400).json({
          error: `El ID de equipo "${cleanIdEquipo}" ya está registrado en la serie "${dups[0].numero_serie}". Cada ID de equipo debe ser único.`
        });
      }
    }

    await pool.query(
      "UPDATE producto_series SET id_equipo = ? WHERE id_producto_serie = ?",
      [cleanIdEquipo, idProductoSerie]
    );

    res.json({ success: true, message: "ID de equipo actualizado correctamente.", id_equipo: cleanIdEquipo });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- 📦 ACTUALIZAR PROID (ID DE MODELO) DE UNA SERIE ESPECÍFICA ---
app.put('/api/almacen/producto-series/:idProductoSerie/proid', async (req, res) => {
  try {
    const { idProductoSerie } = req.params;
    const { proid } = req.body;
    const cleanProid = proid && String(proid).trim() ? String(proid).trim().toUpperCase() : null;

    await pool.query(
      "UPDATE producto_series SET proid = ? WHERE id_producto_serie = ?",
      [cleanProid, idProductoSerie]
    );

    res.json({ success: true, message: "ID de modelo actualizado correctamente.", proid: cleanProid });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- 🔍 5.1.1 TRAZABILIDAD Y BÚSQUEDA GLOBAL DE CUALQUIER SERIE / MAC / ID EQUIPO ---
app.get('/api/almacen/trazabilidad-serie/:serie', async (req, res) => {
  try {
    const rawSerie = req.params.serie ? req.params.serie.trim() : '';
    if (!rawSerie) {
      return res.json({ success: true, series: [] });
    }

    const [rows] = await pool.query(`
      SELECT 
        ps.id_producto_serie,
        ps.id_producto,
        ps.id_equipo,
        ps.proid,
        p.codigo AS producto_codigo,
        p.nombre AS producto_nombre,
        c.nombre AS categoria,
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
      JOIN productos p ON ps.id_producto = p.id_producto
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      LEFT JOIN trabajador_series ts ON ps.id_producto_serie = ts.id_producto_serie AND ts.estado = 'Asignada'
      LEFT JOIN trabajadores t ON ts.id_trabajador = t.id_trabajador
      LEFT JOIN usuarios u ON t.id_usuario = u.id_usuario
      LEFT JOIN vehiculos v ON t.id_vehiculo = v.id_vehiculo
      WHERE ps.numero_serie LIKE ? OR ps.codigo_serie LIKE ? OR ps.id_equipo LIKE ? OR ps.proid LIKE ?
      ORDER BY ps.id_producto_serie DESC
      LIMIT 15
    `, [`%${rawSerie}%`, `%${rawSerie}%`, `%${rawSerie}%`, `%${rawSerie}%`]);

    res.json({ success: true, series: rows });
  } catch (err) {
    console.error("Error en trazabilidad-serie:", err.message);
    res.status(500).json({ success: false, error: err.message });
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
        cablesDrop: [],
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

    const isDrop = (i) => i.es_drop == 1 || /drop|fibra drop|cable drop/i.test(i.nombre || '');

    res.json({
      id_trabajador: idTrabajador,
      materiales: items.filter(i => i.categoria === 'MATERIALES' && !isDrop(i)),
      cablesDrop: items.filter(i => isDrop(i)),
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
        COALESCE(o.numero, '') AS ticket,
        COALESCE(o.cliente, '') AS cliente,
        COALESCE(o.numero_documento, '') AS dni,
        COALESCE(o.direccion, '') AS direccion,
        COALESCE(o.localidad, '') AS distrito,
        COALESCE(o.tipo_trabajo, '') AS tipo_trabajo,
        COALESCE(o.cuadrilla, '') AS cuadrilla,
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

// --- 📋 5.1 AUDITORÍA DE LIQUIDACIONES DE ÓRDENES EN ALMACÉN (CON INTELIGENCIA Y ALERTAS) ---
app.get('/api/almacen/orden-liquidaciones', async (req, res) => {
  try {
    let { desde, hasta, id_trabajador, estado } = req.query;

    if (!desde && !hasta) {
      const hoy = new Date();
      const pad = n => String(n).padStart(2, '0');
      const hoyStr = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`;
      desde = hoyStr;
      hasta = hoyStr;
    }

    let dateCondLiq = "";
    let dateCondOrd = "";
    const paramsLiq = [];
    const paramsTec = [];

    if (desde) {
      dateCondLiq += " AND ol.fecha_liquidacion >= ?";
      paramsLiq.push(`${desde} 00:00:00`);
      dateCondOrd += " AND o2.fecha_visita >= ?";
      paramsTec.push(`${desde} 00:00:00`);
    }
    if (hasta) {
      dateCondLiq += " AND ol.fecha_liquidacion <= ?";
      paramsLiq.push(`${hasta} 23:59:59`);
      dateCondOrd += " AND o2.fecha_visita <= ?";
      paramsTec.push(`${hasta} 23:59:59`);
    }

    let workerCondLiq = "";
    if (id_trabajador && id_trabajador !== 'todos') {
      workerCondLiq = " AND (ol.id_trabajador = ? OR o.id_tecnico = ?)";
      paramsLiq.push(Number(id_trabajador), Number(id_trabajador));
    }

    let estadoCond = "";
    if (estado && estado !== 'todos') {
      estadoCond = " AND ol.estado = ?";
      paramsLiq.push(estado);
    }

    const paramsResumen = [...paramsTec];
    let dateCondLiqJoin = "";
    if (desde) {
      dateCondLiqJoin += " AND ol.fecha_liquidacion >= ?";
      paramsResumen.push(`${desde} 00:00:00`);
    }
    if (hasta) {
      dateCondLiqJoin += " AND ol.fecha_liquidacion <= ?";
      paramsResumen.push(`${hasta} 23:59:59`);
    }

    // 1. Resumen por técnico (con id_usuario real correspondiente a id_tecnico de ordenes)
    const [tecnicos] = await pool.query(`
      SELECT
        u.id_usuario AS id_trabajador,
        CONCAT(u.nombres, ' ', u.apellidos) AS tecnico,
        u.foto_personal,
        u.documento AS tecnico_dni,
        u.cuadrilla,
        (SELECT COUNT(*) FROM ordenes o2 WHERE o2.id_tecnico = u.id_usuario ${dateCondOrd}) AS total_ordenes,
        COUNT(DISTINCT CASE WHEN ol.estado <> 'Rechazada' THEN ol.id_liquidacion END) AS total_liquidaciones,
        COUNT(DISTINCT CASE WHEN ol.estado = 'Pendiente' THEN ol.id_liquidacion END) AS total_pendientes,
        COUNT(DISTINCT CASE WHEN ol.estado = 'Aprobada' THEN ol.id_liquidacion END) AS total_aprobadas,
        COUNT(DISTINCT CASE WHEN ol.estado = 'Rechazada' THEN ol.id_liquidacion END) AS total_rechazadas,
        COALESCE(SUM(
          CASE WHEN ol.estado = 'Rechazada' THEN 0
               ELSE d.cantidad * COALESCE(p.precio_compra, 0)
          END
        ), 0) AS total_costo,
        MAX(ol.fecha_liquidacion) AS ultima_liquidacion
      FROM usuarios u
      LEFT JOIN orden_liquidaciones ol ON (ol.id_trabajador = u.id_usuario) ${dateCondLiqJoin}
      LEFT JOIN orden_liquidacion_detalle d ON d.id_liquidacion = ol.id_liquidacion
      LEFT JOIN productos p ON p.id_producto = d.id_producto
      GROUP BY u.id_usuario
      HAVING total_ordenes > 0 OR total_liquidaciones > 0
      ORDER BY tecnico ASC
    `, paramsResumen);

    // 2. Detalle de liquidaciones individuales
    const [liquidaciones] = await pool.query(`
      SELECT
        ol.id_liquidacion,
        ol.id_orden,
        COALESCE(o.id_tecnico, ol.id_trabajador) AS id_trabajador,
        COALESCE(CONCAT(u.nombres, ' ', u.apellidos), o.tecnico_asignado, o.cuadrilla) AS tecnico,
        u.documento AS tecnico_dni,
        ol.numero_acta,
        ol.numero_guia,
        ol.tipo_trabajo_acta,
        ol.cto,
        ol.puerto,
        ol.speedtest_download,
        ol.speedtest_upload,
        ol.tipo_conexion,
        ol.drop_metro_inicio,
        ol.drop_metro_fin,
        ol.drop_total_metros,
        ol.observaciones,
        ol.observaciones_tecnico,
        ol.estado AS estado_liquidacion,
        ol.motivo_rechazo,
        ol.fecha_liquidacion,
        o.numero AS numero_orden,
        o.cliente,
        o.direccion,
        o.tipo_trabajo,
        COALESCE(
          NULLIF(TRIM(o.motivo_finalizacion), ''),
          NULLIF(TRIM(o.motivo_cancelacion), '')
        ) AS tipo_averia,
        o.fecha_visita,
        COUNT(d.id_detalle_liq) AS total_items,
        COALESCE(SUM(
          CASE WHEN ol.estado = 'Rechazada' THEN 0
               ELSE d.cantidad * COALESCE(p.precio_compra, 0)
          END
        ), 0) AS total_costo
      FROM orden_liquidaciones ol
      INNER JOIN ordenes o ON o.id_orden = ol.id_orden
      LEFT JOIN usuarios u ON u.id_usuario = COALESCE(o.id_tecnico, ol.id_trabajador)
      LEFT JOIN orden_liquidacion_detalle d ON d.id_liquidacion = ol.id_liquidacion
      LEFT JOIN productos p ON p.id_producto = d.id_producto
      WHERE 1=1 ${dateCondLiq} ${workerCondLiq} ${estadoCond}
      GROUP BY ol.id_liquidacion
      ORDER BY ol.fecha_liquidacion DESC
    `, paramsLiq);

    // 3. Enriquecer con materiales, metraje de Fénix y cálculo de alertas
    for (const liq of liquidaciones) {
      const [mats] = await pool.query(`
        SELECT
          d.id_detalle_liq,
          d.id_producto,
          d.numero_serie,
          d.cantidad,
          d.drop_inicio,
          d.drop_fin,
          p.nombre AS nombre_producto,
          p.categoria_liquidar,
          p.precio_compra,
          (d.cantidad * COALESCE(p.precio_compra, 0)) AS costo
        FROM orden_liquidacion_detalle d
        JOIN productos p ON p.id_producto = d.id_producto
        WHERE d.id_liquidacion = ?
        ORDER BY p.categoria_liquidar DESC, p.nombre ASC
      `, [liq.id_liquidacion]);
      liq.materiales = mats;

      // Buscar si Fénix reportó metraje en orden_tareas
      const [fenixTask] = await pool.query(`
        SELECT metraje, valor_texto, titulo
        FROM orden_tareas
        WHERE numero_orden = ? AND titulo LIKE '%METRAJE%'
        LIMIT 1
      `, [liq.numero_orden]);
      liq.metraje_fenix = fenixTask.length > 0 && fenixTask[0].metraje ? Number(fenixTask[0].metraje) : null;

      // REGLAS INTELIGENTES DE ALERTA:
      const trabTexto = ((liq.tipo_trabajo || '') + ' ' + (liq.tipo_averia || '') + ' ' + (liq.tipo_trabajo_acta || '')).toUpperCase();
      const esRecableado = trabTexto.includes('RECABLEADO') || trabTexto.includes('ALTA') || trabTexto.includes('NUEV') || trabTexto.includes('TENDIDO');
      const maxDropPermitido = esRecableado ? 500 : 120; // 500m en recableado, 120m en averías normales

      const totalDrop = Number(liq.drop_total_metros) || 0;
      const totalEquipos = mats.filter(m => (m.categoria_liquidar || '').toUpperCase() === 'EQUIPO' || (m.nombre_producto || '').toUpperCase().includes('ONT')).reduce((acc, m) => acc + (Number(m.cantidad) || 0), 0);

      const motivosAlerta = [];
      if (totalDrop > maxDropPermitido) {
        motivosAlerta.push(`Drop declarado (${totalDrop}m) supera el límite permitido (${maxDropPermitido}m) para ${esRecableado ? 'recableado' : 'avería'}.`);
      }
      if (totalEquipos > 1) {
        motivosAlerta.push(`Se liquidaron ${totalEquipos} equipos ONT en una sola orden.`);
      }
      if (liq.metraje_fenix && Math.abs(totalDrop - liq.metraje_fenix) > 25) {
        motivosAlerta.push(`Discrepancia con Fénix: Declaró ${totalDrop}m pero tarea Fénix reporta ${liq.metraje_fenix}m.`);
      }

      liq.es_alerta = motivosAlerta.length > 0;
      liq.motivo_alerta = motivosAlerta.join(' | ');
      liq.max_drop_permitido = maxDropPermitido;
    }

    res.json({
      success: true,
      desde,
      hasta,
      tecnicos,
      liquidaciones
    });
  } catch (error) {
    console.error("Error al obtener liquidaciones para almacén:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- 📋 5.2 APROBAR LIQUIDACIÓN INDIVIDUAL ---
app.post('/api/almacen/orden-liquidaciones/:id/aprobar', async (req, res) => {
  try {
    const idLiquidacion = req.params.id;
    await pool.query("UPDATE orden_liquidaciones SET estado = 'Aprobada', motivo_rechazo = NULL WHERE id_liquidacion = ?", [idLiquidacion]);
    res.json({ success: true, message: 'Liquidación aprobada correctamente.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- 📋 5.3 RECHAZAR LIQUIDACIÓN INDIVIDUAL (CON MOTIVO) ---
app.post('/api/almacen/orden-liquidaciones/:id/rechazar', async (req, res) => {
  try {
    const idLiquidacion = req.params.id;
    const { motivo } = req.body || {};
    if (!motivo || !motivo.trim()) {
      return res.status(400).json({ success: false, error: 'Debe especificar el motivo del rechazo.' });
    }
    await pool.query("UPDATE orden_liquidaciones SET estado = 'Rechazada', motivo_rechazo = ? WHERE id_liquidacion = ?", [motivo.trim(), idLiquidacion]);
    res.json({ success: true, message: 'Liquidación rechazada.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- 📋 5.4 APROBACIÓN MASIVA DE LIQUIDACIONES ---
app.post('/api/almacen/orden-liquidaciones/aprobar-masivo', async (req, res) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Debe enviar una lista de IDs a aprobar.' });
    }
    await pool.query("UPDATE orden_liquidaciones SET estado = 'Aprobada', motivo_rechazo = NULL WHERE id_liquidacion IN (?)", [ids]);
    res.json({ success: true, message: `${ids.length} liquidaciones aprobadas con éxito.` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
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
        COALESCE(er.proid, '') AS proid,
        COALESCE(er.codigo_producto, '') AS codigo_producto,
        COALESCE(er.guia_remision_win, '') AS guia_remision_win,
        er.motivo_retiro,
        er.estado,
        er.fecha_recojo,
        er.fecha_internamiento,
        er.recibido_por,
        er.observaciones,
        COALESCE(o.numero, '') AS ticket,
        COALESCE(o.cliente, '') AS cliente,
        COALESCE(o.direccion, '') AS direccion,
        COALESCE(o.localidad, '') AS distrito,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS tecnico_nombre,
        u.cuadrilla
      FROM orden_equipos_retirados er
      LEFT JOIN ordenes o ON er.id_orden = o.id_orden
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
    const { id_equipo_retirado, estado_destino, recibido_por, observaciones, guia_remision_win, proid, codigo_producto } = req.body;

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
        guia_remision_win = COALESCE(?, guia_remision_win),
        proid = COALESCE(?, proid),
        codigo_producto = COALESCE(?, codigo_producto),
        observaciones = CONCAT(COALESCE(observaciones, ''), ' | Internado: ', COALESCE(?, ''))
      WHERE id_equipo_retirado = ?
    `, [
      estadoFinal,
      recibido_por || 'Almacén Central',
      guia_remision_win !== undefined ? guia_remision_win : null,
      proid !== undefined ? proid : null,
      codigo_producto !== undefined ? codigo_producto : null,
      observaciones || 'Recepción confirmada',
      id_equipo_retirado
    ]);

    res.json({ success: true, message: "Equipo retirado internado en Almacén Central exitosamente." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- 📦 8.1 ACTUALIZAR GUÍA DE REMISIÓN WIN / PROID / CÓDIGO DE PRODUCTO DE EQUIPO RECOGIDO ---
app.put('/api/almacen/equipos-recogidos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { guia_remision_win, proid, codigo_producto, observaciones } = req.body;

    await pool.query(`
      UPDATE orden_equipos_retirados SET
        guia_remision_win = COALESCE(?, guia_remision_win),
        proid = COALESCE(?, proid),
        codigo_producto = COALESCE(?, codigo_producto),
        observaciones = COALESCE(?, observaciones)
      WHERE id_equipo_retirado = ?
    `, [
      guia_remision_win !== undefined ? guia_remision_win : null,
      proid !== undefined ? proid : null,
      codigo_producto !== undefined ? codigo_producto : null,
      observaciones !== undefined ? observaciones : null,
      id
    ]);

    res.json({ success: true, message: "Datos del equipo recogido actualizados correctamente." });
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
      SELECT er.*, COALESCE(o.numero, '') AS ticket, COALESCE(o.cliente, '') AS cliente, COALESCE(o.direccion, '') AS direccion, COALESCE(o.localidad, '') AS distrito
      FROM orden_equipos_retirados er
      LEFT JOIN ordenes o ON er.id_orden = o.id_orden
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

    const limitVal = Math.min(200, Math.max(1, Number(limite) || 60));
    sql += ` ORDER BY fecha_creacion DESC LIMIT ${limitVal}`;

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- 🛡️ 5. MÉTRICAS DE PRODUCTIVIDAD POR GESTOR (EXCLUSIVO ROL GESTIÓN) ---
app.get(['/api/auditoria/metricas-gestores', '/auditoria/metricas-gestores'], async (req, res) => {
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

// --- 📊 6. GRÁFICO DE PRODUCCIÓN Y AVANCE DE GESTIÓN (LLAMADAS, OBSERVACIONES, ASIGNACIONES) ---
app.get(['/api/auditoria/grafico-gestion', '/auditoria/grafico-gestion'], async (req, res) => {
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

// --- 📊 ANALÍTICA AVANZADA: RENDIMIENTO DE TÉCNICOS & MATRIZ DE CRUCES ---
app.get(['/api/dashboard/rendimiento-tecnicos', '/dashboard/rendimiento-tecnicos'], async (req, res) => {
  try {
    let { desde, hasta, periodo, tecnico } = req.query;
    const hoy = new Date();
    const fmt = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    if (periodo && (!desde || !hasta)) {
      if (periodo === 'hoy') {
        desde = fmt(hoy);
        hasta = fmt(hoy);
      } else if (periodo === 'ayer') {
        const ayer = new Date(hoy);
        ayer.setDate(hoy.getDate() - 1);
        desde = fmt(ayer);
        hasta = fmt(ayer);
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
      } else if (periodo === 'mes_anterior') {
        const primeroAnt = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
        const ultimoAnt = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
        desde = fmt(primeroAnt);
        hasta = fmt(ultimoAnt);
      }
    }

    // Por defecto: mes actual si no se especifica nada
    if (!desde || !hasta) {
      const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      const ultimo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
      desde = desde || fmt(primero);
      hasta = hasta || fmt(ultimo);
    }

    let whereClause = 'WHERE DATE(o.fecha_visita) >= ? AND DATE(o.fecha_visita) <= ?';
    const queryParams = [desde, hasta];

    if (tecnico && String(tecnico).trim().length > 0) {
      whereClause += ' AND (o.cuadrilla LIKE ? OR CONCAT(COALESCE(u.nombres, ""), " ", COALESCE(u.primer_apellido, u.apellidos, "")) LIKE ?)';
      const term = `%${String(tecnico).trim()}%`;
      queryParams.push(term, term);
    }

    const [rows] = await pool.query(`
      SELECT 
        o.id_tecnico,
        COALESCE(
          NULLIF(TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))), ''),
          NULLIF(TRIM(o.cuadrilla), ''),
          'Sin Técnico Asignado'
        ) AS tecnico_nombre,
        COALESCE(NULLIF(TRIM(o.cuadrilla), ''), 'Sin Cuadrilla') AS cuadrilla,
        COALESCE(NULLIF(TRIM(o.tipo_trabajo), ''), 'SIN TIPO') AS tipo_trabajo,
        COALESCE(NULLIF(TRIM(o.estado), ''), 'Sin Estado') AS estado,
        COUNT(*) AS cantidad
      FROM ordenes o
      LEFT JOIN usuarios u ON o.id_tecnico = u.id_usuario
      ${whereClause}
      GROUP BY o.id_tecnico, tecnico_nombre, cuadrilla, tipo_trabajo, estado
    `, queryParams);

    // Obtener catálogo oficial de tipos de trabajo desde la tabla SQL tipos_trabajo
    const [dbTipos] = await pool.query("SELECT id_tipo_trabajo, nombre FROM tipos_trabajo WHERE estado = 'Activo' ORDER BY nombre ASC");
    const catalogoOficial = dbTipos.length > 0
      ? dbTipos.map(t => t.nombre)
      : [
          "ADICIONAL",
          "GARANTIA",
          "GARANTIA NO REALIZADA",
          "NORMALIZACIÓN",
          "PEX",
          "RECABLEADO",
          "RECABLEADO EN CONDOMINIO",
          "REUBICACIÓN CON RESERVA",
          "REUBICACIÓN SIN RESERVA",
          "TRASALDO EN CONDOMINIO",
          "TRASLADO",
          "VISITA EXTERNA"
        ];

    // Función de homologación hacia la tabla tipos_trabajo de SQL
    const homologarTipoTrabajo = (rawTipo) => {
      if (!rawTipo) return null;
      const s = String(rawTipo).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      if (!s || s === "SIN TIPO" || s === "NULL") return null;

      if (s === "RECABLEADO EN CONDOMINIO") return "RECABLEADO EN CONDOMINIO";
      if (s === "TRASALDO EN CONDOMINIO" || s === "TRASLADO EN CONDOMINIO" || s === "TRASLADO CONDOMINIO") return "TRASALDO EN CONDOMINIO";
      if (s === "REUBICACION CON RESERVA") return "REUBICACIÓN CON RESERVA";
      if (s === "REUBICACION SIN RESERVA") return "REUBICACIÓN SIN RESERVA";
      if (s === "REUBICACION") return "REUBICACIÓN CON RESERVA";
      if (s === "GARANTIA NO REALIZADA") return "GARANTIA NO REALIZADA";
      if (s === "GARANTIA" || s === "GARANTIA REALIZADA") return "GARANTIA";
      if (s === "NORMALIZACION" || s === "NORMALIZACION FIBRA") return "NORMALIZACIÓN";
      if (s === "RECABLEADO") return "RECABLEADO";
      if (s === "TRASLADO") return "TRASLADO";
      if (s === "PEX" || s === "PEXT" || s === "CONJUNTA PEXT") return "PEX";
      if (s === "ADICIONAL" || s.includes("MESH") || s.includes("WIN BOX") || s.includes("WINBOX") || s.includes("APARATO") || s.includes("WIFI PRO")) return "ADICIONAL";
      if (s.includes("RECABLEADO")) return "RECABLEADO";
      if (s.includes("NORMALIZ")) return "NORMALIZACIÓN";
      if (s.includes("TRASLAD")) return "TRASLADO";
      if (s.includes("GARANTIA")) return "GARANTIA";
      if (s.includes("VISITA") || s.includes("EXTERNA")) return "VISITA EXTERNA";

      return null;
    };

    const techMap = new Map();
    const tipoCountsGlobal = {};
    for (const c of catalogoOficial) {
      tipoCountsGlobal[c] = 0;
    }
    const estadoCountsGlobal = {};

    let grandTotal = 0;
    let grandFinalizadas = 0;
    let grandCanceladas = 0;
    let grandReagendadas = 0;
    let grandIniciadas = 0;

    for (const r of rows) {
      let techName = r.tecnico_nombre;
      if (techName.includes('CESPEDES SGA')) {
        const parts = techName.split('CESPEDES SGA');
        techName = parts[parts.length - 1].trim();
      } else if (techName.includes('MOTOWIN CESPEDES')) {
        const parts = techName.split('MOTOWIN CESPEDES');
        techName = parts[parts.length - 1].trim();
      }

      // Homologar siempre a la tabla oficial tipos_trabajo de SQL
      const tipo = homologarTipoTrabajo(r.tipo_trabajo);
      const estado = (r.estado || 'Sin Estado').trim();
      const cant = Number(r.cantidad) || 0;

      grandTotal += cant;
      estadoCountsGlobal[estado] = (estadoCountsGlobal[estado] || 0) + cant;

      if (!techMap.has(techName)) {
        const initTipos = {};
        for (const c of catalogoOficial) initTipos[c] = 0;

        techMap.set(techName, {
          id_tecnico: r.id_tecnico,
          tecnico: techName,
          cuadrilla: r.cuadrilla,
          total: 0,
          finalizadas: 0,
          canceladas: 0,
          reagendadas: 0,
          iniciadas: 0,
          otras: 0,
          efectividad: 0,
          tipos_trabajo: initTipos,
          estados: {}
        });
      }

      const t = techMap.get(techName);
      t.total += cant;
      t.estados[estado] = (t.estados[estado] || 0) + cant;

      const estLower = estado.toLowerCase();
      const esFinalizada = estLower.includes('finaliz') || estLower.includes('liquid');

      if (esFinalizada) {
        t.finalizadas += cant;
        grandFinalizadas += cant;
        // Solo las órdenes FINALIZADAS se contabilizan en la matriz de tipos de trabajo
        if (tipo && t.tipos_trabajo[tipo] !== undefined) {
          t.tipos_trabajo[tipo] = (t.tipos_trabajo[tipo] || 0) + cant;
        }
        if (tipo && tipoCountsGlobal[tipo] !== undefined) {
          tipoCountsGlobal[tipo] = (tipoCountsGlobal[tipo] || 0) + cant;
        }
      } else if (estLower.includes('cancel') || estLower.includes('anul')) {
        t.canceladas += cant;
        grandCanceladas += cant;
      } else if (estLower.includes('regest') || estLower.includes('suspend') || estLower.includes('observ') || estLower.includes('reint')) {
        t.reagendadas += cant;
        grandReagendadas += cant;
      } else if (estLower.includes('inic') || estLower.includes('camino')) {
        t.iniciadas += cant;
        grandIniciadas += cant;
      } else {
        t.otras += cant;
      }
    }

    const tecnicos = Array.from(techMap.values()).map(t => {
      const ef = t.total > 0 ? Math.round((t.finalizadas / t.total) * 1000) / 10 : 0;
      return { ...t, efectividad: ef };
    }).sort((a, b) => b.total - a.total);

    const globalEfectividad = grandTotal > 0 ? Math.round((grandFinalizadas / grandTotal) * 1000) / 10 : 0;

    res.json({
      success: true,
      filtros: { desde, hasta, periodo, tecnico: tecnico || '' },
      kpis: {
        total_tecnicos: tecnicos.length,
        total_ordenes: grandTotal,
        total_finalizadas: grandFinalizadas,
        total_canceladas: grandCanceladas,
        total_reagendadas: grandReagendadas,
        total_iniciadas: grandIniciadas,
        tasa_efectividad_global: globalEfectividad,
        tecnico_top: tecnicos[0] ? {
          nombre: tecnicos[0].tecnico,
          total: tecnicos[0].total,
          finalizadas: tecnicos[0].finalizadas,
          efectividad: tecnicos[0].efectividad
        } : null
      },
      tipos_trabajo_columnas: catalogoOficial,
      totales_columnas_tipo: tipoCountsGlobal,
      totales_estados: estadoCountsGlobal,
      tecnicos
    });
  } catch (error) {
    console.error("Error en /api/dashboard/rendimiento-tecnicos:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// 📡 ENDPOINTS LOOKER STUDIO: TARJETAS Y ALERTAS ZONA SUR
// ============================================================
let lookerService = null;
try {
  lookerService = require('./looker_alert_service');
} catch (err) {
  console.warn("⚠️ [Looker Service] No se pudo cargar './looker_alert_service':", err.message);
}

app.get(['/api/looker/resumen', '/looker/resumen'], async (req, res) => {
  const cachePath = path.join(__dirname, 'cards_and_alerts.json');
  const live = req.query.live === 'true';

  // ⚡ Respuesta ultra rápida instantánea desde cache si no se exige live=true
  if (!live && fs.existsSync(cachePath)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      return res.json({ success: true, fromCache: true, ...cached });
    } catch {}
  }

  try {
    if (!lookerService) {
      return res.json({ success: true, fromCache: false, message: 'Servicio Looker no disponible' });
    }
    // Si se pide live, intentar consulta rápida SIN bloquear en puppeteer (retry = false)
    const orders = await lookerService.fetchLookerOrders(null, false);
    const result = lookerService.processCardsAndAlerts(orders);
    try {
      fs.writeFileSync(cachePath, JSON.stringify(result, null, 2));
    } catch {}
    res.json({ success: true, fromCache: false, ...result });
  } catch (error) {
    if (fs.existsSync(cachePath)) {
      try {
        const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        return res.json({ success: true, fromCache: true, ...cached });
      } catch {}
    }
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
  const cachePath = path.join(__dirname, 'cards_and_alerts.json');
  if (fs.existsSync(cachePath)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      return res.json({
        success: true,
        fromCache: true,
        totalAlertas: cached.totalAlertasSur || cached.alertasSur?.length || 0,
        alertas: cached.alertasSur || []
      });
    } catch {}
  }
  res.json({
    success: true,
    fromCache: false,
    totalAlertas: 0,
    alertas: []
  });
});

// 📡 ESTADO DE LA SESIÓN DE LOOKER STUDIO
app.get(['/api/looker/estado-sesion', '/looker/estado-sesion'], async (req, res) => {
  try {
    let activo = false;
    let ultimaSincronizacion = null;
    let appVersion = '20260823_0000';
    let totalGeneral = 0;
    let totalAlertasSur = 0;

    // 1. Verificar si hay sesión en BD
    try {
      const [rows] = await pool.query("SELECT valor, updated_at FROM configuracion WHERE clave = 'LOOKER_SESSION' LIMIT 1");
      if (rows.length > 0 && rows[0].valor) {
        activo = true;
        ultimaSincronizacion = rows[0].updated_at;
        try {
          const parsed = JSON.parse(rows[0].valor);
          if (parsed.appVersion) appVersion = parsed.appVersion;
        } catch {}
      }
    } catch {}

    // 2. Verificar datos en cache de tarjetas
    const cachePath = path.join(__dirname, 'cards_and_alerts.json');
    if (fs.existsSync(cachePath)) {
      try {
        const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        totalGeneral = cached.totalGeneral || 0;
        totalAlertasSur = cached.totalAlertasSur || 0;
        if (!ultimaSincronizacion && cached.timestamp) {
          ultimaSincronizacion = cached.timestamp;
          activo = true;
        }
      } catch {}
    }

    res.json({
      success: true,
      activo,
      totalGeneral,
      totalAlertasSur,
      ultimaSincronizacion,
      appVersion
    });
  } catch (err) {
    res.json({ success: true, activo: false, totalGeneral: 0, totalAlertasSur: 0, error: err.message });
  }
});

// ⚡ SINCRONIZAR SESIÓN Y ÓRDENES DESDE EL NAVEGADOR DEL CLIENTE (BOOKMARKLET / MANUAL)
app.post(['/api/looker/sync-browser', '/looker/sync-browser'], async (req, res) => {
  console.log("📥 [Looker Sync] Recibida petición en /api/looker/sync-browser:", req.body ? Object.keys(req.body) : "vacío");
  try {
    let body = req.body || {};
    if (typeof body.payload === 'string') {
      try { body = JSON.parse(body.payload); } catch {}
    }
    console.log("📦 [Looker Sync Payload]:", {
      cardsSummary: body.cardsSummary,
      domOrdersCount: body.domOrders ? body.domOrders.length : 0
    });
    const { cookie, x_rap_xsrf_token, appVersion, url, domOrders, cardsSummary } = body;
    const SESSION_FILE = path.join(__dirname, 'looker_session.json');

    if (!cookie && (!domOrders || domOrders.length === 0) && !cardsSummary) {
      return res.status(400).json({ success: false, error: 'No se recibieron datos de sesión ni órdenes' });
    }

    let extractedXsrf = x_rap_xsrf_token;
    if (!extractedXsrf && cookie) {
      const match = cookie.match(/RAP_XSRF_TOKEN=([^;]+)/);
      if (match) extractedXsrf = match[1];
    }

    const safeUrl = (url && !url.includes('localhost'))
      ? url
      : 'https://datastudio.google.com/u/0/reporting/15ece5ee-2129-40d6-8122-d83aebc89318/page/p_lfut5i1r5d';

    if (cookie) {
      const sessionData = {
        appVersion: appVersion || '20260823_0000',
        url: safeUrl,
        x_rap_xsrf_token: extractedXsrf || '',
        cookie: cookie || '',
        updated_at: new Date().toISOString()
      };

      try {
        fs.writeFileSync(SESSION_FILE, JSON.stringify(sessionData, null, 2));
      } catch (e) {
        console.warn('No se pudo escribir looker_session.json:', e.message);
      }

      try {
        await pool.query(
          `INSERT INTO configuracion (clave, valor, grupo, descripcion, updated_at)
           VALUES ('LOOKER_SESSION', ?, 'tiempo_real', 'Sesión / Cookies Google Looker Studio', NOW())
           ON DUPLICATE KEY UPDATE valor = VALUES(valor), updated_at = NOW()`,
          [JSON.stringify(sessionData)]
        );
      } catch (e) {
        console.error('Error guardando LOOKER_SESSION en BD:', e.message);
      }
    }

    let processedCount = 0;

    if (domOrders && Array.isArray(domOrders)) {
      try {
        if (lookerService) {
          const result = lookerService.processCardsAndAlerts(domOrders);
          if (cardsSummary) {
            result.totalGeneral = Number(cardsSummary.total || 0);
            if (result.cards['AVERIAS PREFERENTE']) result.cards['AVERIAS PREFERENTE'].total = Number(cardsSummary.preferente || 0);
            if (result.cards['AVERIAS ALTO VALOR']) result.cards['AVERIAS ALTO VALOR'].total = Number(cardsSummary.altoValor || 0);
            if (result.cards['MOTOWIN ZONAS']) result.cards['MOTOWIN ZONAS'].total = Number(cardsSummary.motowin || 0);
          }
          const cachePath = path.join(__dirname, 'cards_and_alerts.json');
          fs.writeFileSync(cachePath, JSON.stringify(result, null, 2));

          const ordersPath = path.join(__dirname, 'looker_orders_parsed.json');
          fs.writeFileSync(ordersPath, JSON.stringify(domOrders, null, 2));

          processedCount = domOrders.length;
        }
      } catch (err) {
        console.error('Error procesando domOrders:', err.message);
      }
    } else if (cardsSummary) {
      const cachePath = path.join(__dirname, 'cards_and_alerts.json');
      let currentCache = {};
      try { currentCache = JSON.parse(fs.readFileSync(cachePath, 'utf8')); } catch {}
      const prefCount = Number(cardsSummary.preferente || 0);
      const altoCount = Number(cardsSummary.altoValor || 0);
      const motoCount = Number(cardsSummary.motowin || 0);
      const total = Number(cardsSummary.total || (prefCount + altoCount + motoCount));
      currentCache.totalGeneral = total;

      if (!currentCache.cards) {
        currentCache.cards = {
          'AVERIAS PREFERENTE': { total: 0, zonas: {}, ordenes: [] },
          'AVERIAS ALTO VALOR': { total: 0, zonas: {}, ordenes: [] },
          'MOTOWIN ZONAS': { total: 0, zonas: {}, ordenes: [] }
        };
      }

      currentCache.cards['AVERIAS PREFERENTE'].total = prefCount;
      if (prefCount === 0) {
        currentCache.cards['AVERIAS PREFERENTE'].zonas = {};
        currentCache.cards['AVERIAS PREFERENTE'].ordenes = [];
      }

      currentCache.cards['AVERIAS ALTO VALOR'].total = altoCount;
      if (altoCount === 0) {
        currentCache.cards['AVERIAS ALTO VALOR'].zonas = {};
        currentCache.cards['AVERIAS ALTO VALOR'].ordenes = [];
      }

      currentCache.cards['MOTOWIN ZONAS'].total = motoCount;
      if (motoCount === 0) {
        currentCache.cards['MOTOWIN ZONAS'].zonas = {};
        currentCache.cards['MOTOWIN ZONAS'].ordenes = [];
      }

      if (currentCache.alertasSur && Array.isArray(currentCache.alertasSur)) {
        currentCache.alertasSur = currentCache.alertasSur.filter(a => {
          if ((a.tarjeta === 'AVERIAS PREFERENTE' || a.tarjeta === 'AVERIAS') && prefCount === 0) return false;
          if ((a.tarjeta === 'AVERIAS ALTO VALOR' || a.tarjeta === 'ALTO VALOR') && altoCount === 0) return false;
          if ((a.tarjeta === 'MOTOWIN ZONAS' || a.tarjeta === 'MOTOWIN') && motoCount === 0) return false;
          return true;
        });
      } else {
        currentCache.alertasSur = [];
      }
      currentCache.totalAlertasSur = currentCache.alertasSur.length;

      // Reconstruir resumenZonas desde alertasSur
      const nuevoResumen = {};
      for (const a of currentCache.alertasSur) {
        const z = a.zona || 'ZONA SUR';
        nuevoResumen[z] = (nuevoResumen[z] || 0) + 1;
      }
      currentCache.resumenZonas = nuevoResumen;
      currentCache.timestamp = new Date().toISOString();
      fs.writeFileSync(cachePath, JSON.stringify(currentCache, null, 2));
      processedCount = total;
    } else if (cookie && lookerService) {
      try {
        const freshOrders = await lookerService.fetchLookerOrders(null, false);
        if (freshOrders && freshOrders.length > 0) {
          const result = lookerService.processCardsAndAlerts(freshOrders);
          const cachePath = path.join(__dirname, 'cards_and_alerts.json');
          fs.writeFileSync(cachePath, JSON.stringify(result, null, 2));
          processedCount = freshOrders.length;
        }
      } catch (err) {
        console.warn('Aviso: Cookie guardada, pero la consulta de fondo falló:', err.message);
      }
    }

    res.json({
      success: true,
      count: processedCount,
      message: processedCount > 0
        ? `¡Éxito! Se vincularon ${processedCount} órdenes en tiempo real con Céspedes.`
        : 'Datos recibidos correctamente.'
    });
  } catch (error) {
    console.error('Error en /api/looker/sync-browser:', error);
    res.status(500).json({ success: false, error: error.message });
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

// ============================================================
// ✉️ ENDPOINTS CORREOS / SMTP & ENVÍO DE REPORTES A TÉCNICOS
// ============================================================
app.get(['/api/correos/config', '/correos/config'], async (req, res) => {
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

app.post(['/api/correos/config', '/correos/config'], async (req, res) => {
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

app.get(['/api/correos/tecnicos', '/correos/tecnicos'], async (req, res) => {
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

app.post(['/api/correos/enviar-prueba', '/correos/enviar-prueba'], async (req, res) => {
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));

// Servidor Telecom API listo
module.exports = app;