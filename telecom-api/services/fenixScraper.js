const https = require('https');
const fs = require('fs');
const pool = require('../db');
const { resolverTipoTrabajoOficial } = require('./tipoTrabajoHelper');

// URLs del servicio WIN / Fénix
const TR_URL_LOGIN = 'https://winbo-phx.azurewebsites.net/login.aspx/IniciarSesion';
const TR_URL_GRILLA = 'https://winbo-phx.azurewebsites.net/Paginas/OperadoresBO/misOrdenes.aspx/cargarGrilla';
const TR_URL_ESTADO = 'https://winbo-phx.azurewebsites.net/Paginas/OrdenTrabajo/Formulario.aspx/CargarHistoEstaGrilla';

// Credenciales por defecto
const TR_USER = process.env.WIN_USER || 'CESPEDES';
const TR_PASSWORD = process.env.WIN_PASSWORD || 'CESPEDES2026AVERIAS';
const TR_COD_SUS = process.env.WIN_COD_SUS || 'WIN';
const TR_NAVEGADOR = 'PHP cURL';
const TR_LOGIN_IN = 'S';

// Almacén dinámico de cookies en memoria
const cookieJar = new Map();

function updateCookies(setCookieArray) {
  if (!setCookieArray || !Array.isArray(setCookieArray)) return;
  for (const cookieStr of setCookieArray) {
    const parts = cookieStr.split(';')[0].split('=');
    const name = parts[0].trim();
    const value = parts.slice(1).join('=').trim();
    if (name) {
      cookieJar.set(name, value);
    }
  }
}

function getCookieHeader() {
  const list = [];
  for (const [name, value] of cookieJar.entries()) {
    list.push(`${name}=${value}`);
  }
  return list.join('; ');
}

/**
 * Obtiene las credenciales actualizadas desde la tabla `configuracion`
 */
async function getWinCredentials() {
  let user = TR_USER;
  let password = TR_PASSWORD;
  let suscrip = TR_COD_SUS;
  let query = '';
  let auth = '';

  try {
    const [rows] = await pool.query("SELECT clave, valor FROM configuracion WHERE clave LIKE 'TR_%'");
    if (rows && rows.length > 0) {
      rows.forEach(r => {
        const k = (r.clave || '').trim();
        const v = (r.valor || '').trim();
        if (k === 'TR_USER' && v) user = v;
        if (k === 'TR_PASSWORD' && v) password = v;
        if (k === 'TR_COD_SUS' && v) suscrip = v;
        if (k === 'TR_QUERY') query = v;
        if (k === 'TR_AUTH') auth = v;
      });
    }
  } catch (e) {
    console.warn("Aviso al consultar tabla configuracion:", e.message);
  }

  return { user, password, suscrip, query, auth };
}

/**
 * Realiza peticiones HTTPS con manejo estricto de Headers, Cookies y Codificación
 */
function requestWin(urlStr, payload = null, cookieHeader = '') {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const postData = payload ? JSON.stringify(payload) : '';

    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Requested-With': 'XMLHttpRequest',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Origin': 'https://winbo-phx.azurewebsites.net',
      'Referer': urlStr
    };

    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }
    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(postData, 'utf8');
    }

    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: payload ? 'POST' : 'GET',
      headers: headers,
      timeout: 30000
    };

    const req = https.request(options, (res) => {
      const chunks = [];

      const setCookie = res.headers['set-cookie'];
      let newCookies = [];
      if (setCookie) {
        newCookies = Array.isArray(setCookie) ? setCookie : [setCookie];
        updateCookies(newCookies);
      }

      res.on('data', (chunk) => {
        chunks.push(chunk);
      });

      res.on('end', () => {
        const fullBuffer = Buffer.concat(chunks);
        const data = fullBuffer.toString('utf8');
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json, raw: data, setCookie: newCookies });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data, setCookie: newCookies });
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout de conexión con WIN / Fénix'));
    });

    if (payload) {
      req.write(postData, 'utf8');
    }
    req.end();
  });
}

let currentLoginPromise = null;

/**
 * 1. Iniciar sesión en WIN / Fénix
 */
async function loginWin() {
  if (currentLoginPromise) {
    return currentLoginPromise;
  }

  currentLoginPromise = (async () => {
    try {
      const creds = await getWinCredentials();

      const payload = {
        CodiUsua: creds.user,
        Contraseña: creds.password,
        CodiSuscrip: creds.suscrip,
        Navegador: TR_NAVEGADOR,
        Query: creds.query || '',
        AutenDoblePasoCodi: creds.auth || '',
        LoginInterno: TR_LOGIN_IN
      };

      console.log(`🔐 [Fénix Scraper] Conectando a WIN con usuario '${creds.user}'...`);
      const res = await requestWin(TR_URL_LOGIN, payload, getCookieHeader());

      // Decodificar mensaje de login si viene en Base64
      let mensajeLogin = '';
      let codigoLogin = '';
      if (res.data && res.data.d) {
        try {
          const decodedLogin = Buffer.from(res.data.d, 'base64').toString('utf-8');
          const jsonLogin = JSON.parse(decodedLogin);
          codigoLogin = jsonLogin.codigo || '';
          if (jsonLogin.mensaje) {
            mensajeLogin = Buffer.from(jsonLogin.mensaje, 'base64').toString('utf-8');
          }
          console.log(`🔐 [Fénix Scraper] Estado Login WIN: Código '${codigoLogin}' - Mensaje: '${mensajeLogin}'`);
        } catch (e) {}
      }

      // En WIN / Fénix, el código '99' o redirección a default.aspx indica inicio de sesión exitoso
      const esExitoso = 
        codigoLogin === '99' || 
        codigoLogin === '0' || 
        codigoLogin === '1' || 
        mensajeLogin.includes('default.aspx') || 
        mensajeLogin.includes('location.href');

      if (codigoLogin && !esExitoso && mensajeLogin) {
        throw new Error(`WIN / Fénix rechazó el inicio de sesión (${codigoLogin}): ${mensajeLogin}`);
      }

      const cookieHeader = getCookieHeader();
      if (!cookieHeader) {
        throw new Error(`No se recibieron cookies de sesión desde WIN. Mensaje: ${mensajeLogin || 'Sesión no iniciada'}`);
      }

      console.log('🔑 [Fénix Scraper] ¡Sesión iniciada con éxito en WIN / Fénix!');
      return cookieHeader;
    } finally {
      currentLoginPromise = null;
    }
  })();

  return currentLoginPromise;
}

/**
 * Formatea fechas a formato DD/MM/YYYY
 */
function formatDateToDMY(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/**
 * Parsea string de fecha a formato MySQL YYYY-MM-DD HH:mm:ss
 */
function parseDateToMySQL(val) {
  if (!val || typeof val !== 'string') return null;
  const clean = val.trim();
  if (!clean) return null;

  // Formato con AM/PM (ej: 8/19/2026 8:42:03 AM o 8/19/2026 1:11:05 PM)
  const ampmMatch = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?\s*(AM|PM|am|pm)?/i);
  if (ampmMatch) {
    let p1 = parseInt(ampmMatch[1], 10);
    let p2 = parseInt(ampmMatch[2], 10);
    const year = ampmMatch[3];
    let hour = parseInt(ampmMatch[4], 10);
    const min = ampmMatch[5].padStart(2, '0');
    const sec = ampmMatch[6] ? ampmMatch[6].padStart(2, '0') : '00';
    const meridian = (ampmMatch[7] || '').toUpperCase();

    // Convertir 12h a 24h
    if (meridian === 'PM' && hour < 12) hour += 12;
    if (meridian === 'AM' && hour === 12) hour = 0;

    const hourStr = String(hour).padStart(2, '0');

    // Determinar si p1 es mes o día (Prioridad DD/MM/YYYY formato peruano)
    let day, month;
    if (p1 > 12) {
      day = String(p1).padStart(2, '0');
      month = String(p2).padStart(2, '0');
    } else if (p2 > 12) {
      month = String(p1).padStart(2, '0');
      day = String(p2).padStart(2, '0');
    } else {
      // Estándar peruano / Fenix: Día/Mes/Año
      day = String(p1).padStart(2, '0');
      month = String(p2).padStart(2, '0');
    }

    return `${year}-${month}-${day} ${hourStr}:${min}:${sec}`;
  }

  // DD/MM/YYYY HH:mm:ss o DD/MM/YYYY HH:mm (24 horas)
  const match = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (match) {
    let p1 = parseInt(match[1], 10);
    let p2 = parseInt(match[2], 10);
    const year = match[3];
    const hour = match[4] ? match[4].padStart(2, '0') : '00';
    const min = match[5] ? match[5].padStart(2, '0') : '00';
    const sec = match[6] ? match[6].padStart(2, '0') : '00';

    let day, month;
    if (p2 > 12) {
      month = String(p1).padStart(2, '0');
      day = String(p2).padStart(2, '0');
    } else {
      day = String(p1).padStart(2, '0');
      month = String(p2).padStart(2, '0');
    }

    return `${year}-${month}-${day} ${hour}:${min}:${sec}`;
  }

  // Si viene en formato ISO (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
    return clean.replace('T', ' ').substring(0, 19);
  }

  return null;
}

function toDMY(dateInput) {
  if (!dateInput) return null;
  if (typeof dateInput === 'string') {
    const s = dateInput.trim();
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const [y, m, d] = s.split('T')[0].split(' ')[0].split('-');
      return `${d}/${m}/${y}`;
    }
    if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(s)) {
      return s;
    }
  }
  if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
    return formatDateToDMY(dateInput);
  }
  return null;
}

/**
 * 2. Cargar grilla de órdenes para una página específica
 */
async function cargarGrillaWin(pagina = 1, fechaDesdeStr = null, fechaHastaStr = null) {
  const hoy = new Date();
  const fHoy = formatDateToDMY(hoy);

  // 🚀 Por defecto: sincronizar únicamente la fecha de HOY (máxima velocidad y actualización automática de la jornada)
  const fDesde = toDMY(fechaDesdeStr) || fHoy;
  const fHasta = toDMY(fechaHastaStr) || fDesde;

  const payload = {
    Empresa: "0",
    IdProyec: "",
    Motivo: "0",
    MotivosReproId: "0",
    Nombre: "",
    NumeDocu: "",
    OrdenId: "",
    Pais: "0",
    conexion: "0",
    cuadrilla: "0",
    estado: "0",
    fechaEstaDesde: "",
    fechaEstaHasta: "",
    fechaSoliDesde: "",
    fechaSoliHasta: "",
    fechaVisiDesde: fDesde,
    fechaVisiHasta: fHasta,
    idPage: 74,
    localidad: "0",
    pagiActu: pagina,
    producto: null,
    provincia: "0",
    region: "0",
    suscrip: "",
    tipoOrden: 1,
    tipoProduc: "0",
    tipoTraba: "0",
    tipoUbi: "",
    ubi: "",
    zona: "0"
  };

  console.log(`📡 [Fénix Scraper] Consultando página ${pagina} (Rango: ${fDesde} a ${fHasta})...`);
  const res = await requestWin(TR_URL_GRILLA, payload, getCookieHeader());
  return res.data;
}

let cachedTableHeaders = [
  'Nº',
  'Cod Seguimiento Cliente',
  'Código De Seguimiento',
  'Móvil',
  'Número Documento',
  'Cliente',
  'Fecha Visita',
  'Inicio de Visita',
  'Fin de Visita',
  'Estado',
  'Dirección',
  'Región / Zona',
  'Cuadrilla',
  'Motivo de Finalización',
  'Tipo Trabajo',
  'Tipo Orden',
  'Fecha Solicitud',
  'Fecha Estado',
  'Motivo Regestión',
  'Motivo de Cancelación',
  'Motivo de Anulación',
  'Georeferencia',
  'Producto',
  'Suscripción',
  'Prioridad',
  'Datos Técnicos'
];

function normalizeKey(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * 3. Parser HTML de la tabla devuelta por Fénix
 */
function parsearHtmlFenix(htmlDecoded) {
  const thRegex = /<th[^>]*>([\s\S]*?)<\/th>/gi;
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;

  const extractedHeaders = [];
  let thMatch;
  while ((thMatch = thRegex.exec(htmlDecoded)) !== null) {
    const text = thMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (text) extractedHeaders.push(text);
  }

  if (extractedHeaders.length > 0) {
    cachedTableHeaders = extractedHeaders;
    console.log(`📋 [Fénix Scraper] Headers reales extraídos de Fénix (${extractedHeaders.length} columnas):`, extractedHeaders);
  }

  const filas = [];
  let trMatch;
  while ((trMatch = trRegex.exec(htmlDecoded)) !== null) {
    const rowContent = trMatch[1];
    const tds = [];
    let tdMatch;
    while ((tdMatch = tdRegex.exec(rowContent)) !== null) {
      tds.push(tdMatch[1]);
    }

    // Una fila de orden real en Fénix tiene al menos 10 columnas
    if (tds.length < 10) continue;

    // Detectar si la primera columna es la acción/botón (offset)
    const cleanTd0 = (tds[0] || '').replace(/<[^>]+>/g, '').trim();
    const cleanTd1 = (tds[1] || '').replace(/<[^>]+>/g, '').trim();
    let offset = 0;
    if (!/^\d{5,12}$/.test(cleanTd0) && /^\d{5,12}$/.test(cleanTd1)) {
      offset = 1;
    }

    const filaObj = {};
    tds.forEach((tdHtml, idx) => {
      let val = tdHtml.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      filaObj[`col_${idx}`] = val;

      const headerIdx = idx - offset;
      if (headerIdx >= 0 && headerIdx < cachedTableHeaders.length) {
        const rawHeader = cachedTableHeaders[headerIdx];
        const normKey = normalizeKey(rawHeader);

        if (normKey === 'cliente' || rawHeader.toLowerCase().includes('cliente')) {
          const clientDivMatch = tdHtml.match(/class=["'][^"']*tx-inverse[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
          if (clientDivMatch) {
            val = clientDivMatch[1].replace(/<[^>]+>/g, '').trim();
          }
        }

        filaObj[normKey] = val;
        filaObj[rawHeader] = val;
      }
    });

    // Validar número de ticket
    const ticketRaw = filaObj['n_'] || filaObj['n'] || filaObj['numero'] || (offset === 1 ? cleanTd1 : cleanTd0);
    if (!/^\d{5,12}$/.test(ticketRaw)) {
      continue;
    }

    filaObj['n_'] = ticketRaw;
    filas.push(mapearOrden(filaObj, tds, offset));
  }

  return filas;
}

/**
 * 4. Mapeo de columnas del HTML a los campos de la tabla `ordenes`
 */
function mapearOrden(f, rawTds = [], offset = 0) {
  const getVal = (...keys) => {
    for (const k of keys) {
      if (f[k] !== undefined && f[k] !== null && f[k] !== '') return f[k];
    }
    return null;
  };

  const getCol = (index) => {
    const actualIdx = index + offset;
    if (rawTds[actualIdx] !== undefined) {
      return rawTds[actualIdx].replace(/<[^>]+>/g, '').trim();
    }
    return null;
  };

  const ticket = getVal('n_', 'n', 'numero') || getCol(0);

  let rawMovil = getVal('movil', 'celular') || getCol(3);
  let rawNumDoc = getVal('numero_documento', 'documento') || getCol(4);
  let rawCodSeg = getVal('codigo_de_seguimiento', 'codigo_seguimiento') || getCol(2);
  let rawCodSegCli = getVal('cod_seguimiento_cliente', 'cod_seguimiento') || getCol(1);
  let rawCuadrilla = getVal('cuadrilla') || getCol(12);
  let rawTipoOrden = getVal('tipo_orden', 'tipo_de_orden') || getCol(15);

  const rawDatosTecnicos = getVal('datos_tecnicos') || getCol(25);

  // 🛡️ Detección de grilla Fénix con columnas de avería/postventa desplazadas
  if (rawMovil && /^(AVERIAS|MOTOWIN|POSTVENTA|REITERADA|PLANTA EXTERNA)/i.test(rawMovil.trim())) {
    rawTipoOrden = rawMovil;
    rawMovil = null;
  }
  // Si no hay móvil o vino desplazado, extraerlo de datos_tecnicos si existe
  if (!rawMovil && rawDatosTecnicos) {
    const dtMatch = rawDatosTecnicos.match(/MOVIL\s+(?:ULTIMO\s+CONTACTO|REFERENCIA)[^\/]*\/[^\/]*\/(\d{7,11})/i) ||
                    rawDatosTecnicos.match(/MOVIL[^\/]*\/[^\/]*\/(\d{7,11})/i);
    if (dtMatch && dtMatch[1]) {
      rawMovil = dtMatch[1];
    }
  }
  if (rawNumDoc && /(CESPEDES|SGA|^[KO]\s*\d+)/i.test(rawNumDoc.trim())) {
    rawCuadrilla = rawNumDoc;
    rawNumDoc = null;
  }
  if (rawCodSeg && /(Residencial|Condominio|Edificio)/i.test(rawCodSeg.trim())) {
    rawCodSeg = ticket;
  }
  if (rawCodSegCli && /(WI-NET|Perú|Peru|TELECOM)/i.test(rawCodSegCli.trim())) {
    rawCodSegCli = null;
  }

  // 🚀 Extracción inteligente de Suscripción (Ancho de Banda)
  const rawSuscripcion = (() => {
    const v = getVal('suscripcion', 'suscripci_n', 'plan', 'ancho_banda', 'ancho_de_banda') || getCol(23);
    if (v && /(1GBPS|500MBPS|300\s*Mbps|650|1000\s*Mbps|WIN\s*PRO|RET|Up\s*To|\b\d+\s*Mbps|\b\d+\s*Gbps|PLANTA\s*EXTERNA)/i.test(String(v).trim())) {
      return String(v).trim();
    }
    for (let i = 0; i < rawTds.length; i++) {
      const clean = (rawTds[i] || '').replace(/<[^>]+>/g, '').trim();
      if (/(1GBPS|500MBPS|300\s*Mbps|650|1000\s*Mbps|WIN\s*PRO|RET|Up\s*To|\b\d+\s*Mbps|\b\d+\s*Gbps)/i.test(clean)) {
        return clean;
      }
    }
    return v ? String(v).trim() : null;
  })();

  // 🚀 Extracción inteligente de Georeferencia
  const rawGeo = (() => {
    const v = getVal('georeferencia', 'coordenadas') || getCol(21);
    if (v && /^-?\d{1,3}\.\d+.*,\s*-?\d{1,3}\.\d+/.test(String(v).trim())) {
      return String(v).trim();
    }
    for (let i = 0; i < rawTds.length; i++) {
      const clean = (rawTds[i] || '').replace(/<[^>]+>/g, '').trim();
      if (/^-?\d{1,3}\.\d+.*,\s*-?\d{1,3}\.\d+/.test(clean)) {
        return clean;
      }
    }
    return v ? String(v).trim() : null;
  })();

  // 🚀 Extracción inteligente de Producto
  const rawProducto = (() => {
    const v = getVal('producto') || getCol(22);
    if (v && !/(1GBPS|500MBPS|Mbps|Gbps|WIN PRO)/i.test(String(v).trim())) return String(v).trim();
    for (let i = 0; i < rawTds.length; i++) {
      const clean = (rawTds[i] || '').replace(/<[^>]+>/g, '').trim();
      if (/^(AVERIAS|REITERADA|MOTOWIN|POSTVENTA|PLANTA EXTERNA|AVERIAS ALTO VALOR)$/i.test(clean)) {
        return clean;
      }
    }
    return v ? String(v).trim() : null;
  })();

  return {
    numero: ticket,
    cod_seguimiento_cliente: rawCodSegCli,
    codigo_seguimiento: rawCodSeg,
    movil: rawMovil,
    numero_documento: rawNumDoc,
    cliente: getVal('cliente') || getCol(5),
    direccion: getVal('direccion') || getCol(10),
    region_zona: getVal('region_zona', 'region', 'zona') || getCol(11),
    tipo_orden: rawTipoOrden,
    fecha_visita: parseDateToMySQL(getVal('fecha_visita') || getCol(6)),
    inicio_visita: parseDateToMySQL(getVal('inicio_de_visita', 'inicio_visita') || getCol(7)),
    fin_visita: parseDateToMySQL(getVal('fin_de_visita', 'fin_visita') || getCol(8)),
    tipo_trabajo: getVal('tipo_trabajo') || getCol(14),
    estado: getVal('estado') || getCol(9) || 'Agendada',
    fecha_solicitud: parseDateToMySQL(getVal('fecha_solicitud') || getCol(16)),
    motivo_regestion: (() => {
      const v = getVal('motivo_regestion', 'motivo_de_regestion') || getCol(18);
      if (!v || /^(Técnica|Tecnica|Comercial)$/i.test(String(v).trim()) || /^-?\d{1,3}\.\d+/.test(String(v).trim())) return null;
      return String(v).trim();
    })(),
    cuadrilla: rawCuadrilla,
    fecha_estado: parseDateToMySQL(getVal('fecha_estado') || getCol(17)),
    georeferencia: rawGeo,
    motivo_trabajo: getVal('motivo_trabajo', 'tipo_averia') || getCol(14),
    producto: rawProducto,
    motivo_finalizacion: (() => {
      const v = getVal('motivo_de_finalizacion', 'motivo_finalizacion') || getCol(13);
      if (!v || /^-?\d{1,3}\.\d+/.test(String(v).trim())) return null;
      return String(v).trim();
    })(),
    motivo_cancelacion: (() => {
      const v = getVal('motivo_de_cancelacion', 'motivo_cancelacion') || getCol(19);
      if (!v || /^-?\d{1,3}\.\d+/.test(String(v).trim())) return null;
      return String(v).trim();
    })(),
    motivo_anulacion: (() => {
      const v = getVal('motivo_de_anulacion', 'motivo_anulacion') || getCol(20);
      if (!v || /^-?\d{1,3}\.\d+/.test(String(v).trim())) return null;
      return String(v).trim();
    })(),
    suscripcion: rawSuscripcion,
    prioridad: getVal('prioridad') || getCol(24),
    datos_tecnicos: rawDatosTecnicos
  };
}

/**
 * 5. Guardar órdenes masivamente en MySQL (UPSERT)
 */
async function guardarOrdenesEnBD(ordenes) {
  if (!ordenes || ordenes.length === 0) return { totalGuardadas: 0 };

  // Eliminar registros corruptos previos que tengan texto como 'Detalle' en número
  try {
    await pool.query("DELETE FROM ordenes WHERE numero = 'Detalle' OR numero NOT REGEXP '^[0-9]+$'");
  } catch (e) {}

  let guardadas = 0;

  // Cargar lista de técnicos activos desde la BD para auto-vincular id_tecnico
  let techUsers = [];
  try {
    const [rows] = await pool.query(
      `SELECT id_usuario, nombres, apellidos, primer_apellido, segundo_apellido, cuadrilla 
       FROM usuarios`
    );
    techUsers = rows || [];
  } catch (errTech) {
    console.error("⚠️ [Fénix Scraper] No se pudo cargar lista de técnicos para auto-matching:", errTech.message);
  }

  // Función inteligente para encontrar coincidencia de técnico desde el texto de la cuadrilla
  const findTechMatch = (cuadStr) => {
    if (!cuadStr || cuadStr === '-' || !techUsers.length) return null;
    let str = String(cuadStr).trim();
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

    if (!rawName || rawName.length < 3) return null;
    const normRaw = rawName.toUpperCase();

    const found = techUsers.find((u) => {
      const full1 = `${u.nombres || ''} ${u.apellidos || ''}`.toUpperCase().trim();
      const full2 = `${u.nombres || ''} ${u.primer_apellido || ''} ${u.segundo_apellido || ''}`.toUpperCase().trim();
      if (full1 && normRaw === full1) return true;
      if (full2 && normRaw === full2) return true;
      if (full1 && (normRaw.includes(full1) || full1.includes(normRaw))) return true;

      const nameParts = (u.nombres || '').toUpperCase().split(/\s+/).filter(p => p.length > 2);
      const apeParts = (u.apellidos || u.primer_apellido || '').toUpperCase().split(/\s+/).filter(p => p.length > 2);

      const hasName = nameParts.some(p => normRaw.includes(p));
      const hasApe = apeParts.some(p => normRaw.includes(p));
      return hasName && hasApe;
    });

    return found ? { id: found.id_usuario, nombre: `${found.nombres} ${found.apellidos || found.primer_apellido || ''}`.trim() } : (rawName.length > 3 ? { id: null, nombre: rawName } : null);
  };

  for (const o of ordenes) {
    if (!o.numero) continue;

    try {
      const techInfo = findTechMatch(o.cuadrilla);
      const autoIdTecnico = techInfo?.id || null;
      const autoNombreTecnico = techInfo?.nombre || null;
      const autoTipoTrabajo = resolverTipoTrabajoOficial(o.motivo_finalizacion, o.tipo_trabajo || o.motivo_trabajo, o.estado);

      // 1. Intentar UPDATE (preservando id_tecnico / tecnico_asignado si gestión ya lo asignó manualmente)
      const [updateRes] = await pool.query(
        `UPDATE ordenes SET
          fecha_solicitud = COALESCE(?, fecha_solicitud),
          cliente = COALESCE(?, cliente),
          inicio_visita = COALESCE(?, inicio_visita),
          fin_visita = COALESCE(?, fin_visita),
          hora_en_camino = COALESCE(?, hora_en_camino),
          hora_asignacion = COALESCE(?, hora_asignacion),
          motivo_finalizacion = COALESCE(?, motivo_finalizacion),
          datos_tecnicos = COALESCE(?, datos_tecnicos),
          tipo_trabajo_asignado = COALESCE(tipo_trabajo_asignado, ?),
          tipo_trabajo = COALESCE(tipo_trabajo, ?),
          georeferencia = COALESCE(?, georeferencia),
          motivo_cancelacion = COALESCE(?, motivo_cancelacion),
          numero_documento = COALESCE(?, numero_documento),
          movil = COALESCE(?, movil),
          codigo_seguimiento = COALESCE(?, codigo_seguimiento),
          region_zona = COALESCE(?, region_zona),
          fecha_visita = COALESCE(?, fecha_visita),
          cod_seguimiento_cliente = COALESCE(?, cod_seguimiento_cliente),
          direccion = COALESCE(?, direccion),
          estado = COALESCE(?, estado),
          cuadrilla = COALESCE(?, cuadrilla),
          id_tecnico = COALESCE(?, id_tecnico),
          tecnico_asignado = COALESCE(?, tecnico_asignado),
          tipo_orden = COALESCE(?, tipo_orden),
          motivo = COALESCE(?, motivo),
          ubicacion = COALESCE(?, ubicacion),
          fecha_estado = COALESCE(?, fecha_estado),
          motivo_anulacion = COALESCE(?, motivo_anulacion),
          motivo_regestion = COALESCE(?, motivo_regestion),
          motivo_suspension = COALESCE(?, motivo_suspension),
          pais_empresa = COALESCE(?, pais_empresa),
          email = COALESCE(?, email),
          tipo_ubicacion = COALESCE(?, tipo_ubicacion),
          codigo_postal = COALESCE(?, codigo_postal),
          tipo_documento = COALESCE(?, tipo_documento),
          producto = COALESCE(?, producto),
          id_proyecto = COALESCE(?, id_proyecto),
          proveedor = COALESCE(?, proveedor),
          localidad = COALESCE(?, localidad),
          motivo_trabajo = COALESCE(?, motivo_trabajo),
          prioridad = COALESCE(?, prioridad),
          historial_estados = COALESCE(?, historial_estados),
          fijo = COALESCE(?, fijo),
          sector_operativo = COALESCE(?, sector_operativo),
          suscripcion = COALESCE(?, suscripcion)
        WHERE numero = ?`,
        [
          o.fecha_solicitud, o.cliente, o.inicio_visita, o.fin_visita,
          o.hora_en_camino, o.hora_asignacion,
          o.motivo_finalizacion, o.datos_tecnicos, autoTipoTrabajo || o.tipo_trabajo, autoTipoTrabajo, o.georeferencia,
          o.motivo_cancelacion, o.numero_documento, o.movil, o.codigo_seguimiento,
          o.region_zona, o.fecha_visita, o.cod_seguimiento_cliente, o.direccion,
          o.estado, o.cuadrilla, autoIdTecnico, autoNombreTecnico, o.tipo_orden, o.motivo, o.ubicacion, o.fecha_estado,
          o.motivo_anulacion, o.motivo_regestion, o.motivo_suspension, o.pais_empresa,
          o.email, o.tipo_ubicacion, o.codigo_postal, o.tipo_documento, o.producto,
          o.id_proyecto, o.proveedor, o.localidad, o.tipo_trabajo || o.motivo_trabajo, o.prioridad,
          o.historial_estados, o.fijo, o.sector_operativo, o.suscripcion,
          o.numero
        ]
      );

      // 2. Si no existía fila afectada, INSERTAR con el técnico auto-vinculado y tipo de trabajo oficial
      if (updateRes.affectedRows === 0) {
        await pool.query(
          `INSERT INTO ordenes (
            numero, fecha_solicitud, cliente, inicio_visita, fin_visita,
            hora_en_camino, hora_asignacion,
            motivo_finalizacion, datos_tecnicos, tipo_trabajo, tipo_trabajo_asignado, georeferencia,
            motivo_cancelacion, numero_documento, movil, codigo_seguimiento,
            region_zona, fecha_visita, cod_seguimiento_cliente, direccion,
            estado, cuadrilla, id_tecnico, tecnico_asignado, tipo_orden, motivo, ubicacion, fecha_estado,
            motivo_anulacion, motivo_regestion, motivo_suspension, pais_empresa,
            email, tipo_ubicacion, codigo_postal, tipo_documento, producto,
            id_proyecto, proveedor, localidad, motivo_trabajo, prioridad,
            historial_estados, fijo, sector_operativo, suscripcion, fecha_creacion
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            o.numero, o.fecha_solicitud, o.cliente, o.inicio_visita, o.fin_visita,
            o.hora_en_camino, o.hora_asignacion,
            o.motivo_finalizacion, o.datos_tecnicos, autoTipoTrabajo, autoTipoTrabajo || o.tipo_trabajo, o.georeferencia,
            o.motivo_cancelacion, o.numero_documento, o.movil, o.codigo_seguimiento,
            o.region_zona, o.fecha_visita, o.cod_seguimiento_cliente, o.direccion,
            o.estado, o.cuadrilla, autoIdTecnico, autoNombreTecnico, o.tipo_orden, o.motivo, o.ubicacion, o.fecha_estado,
            o.motivo_anulacion, o.motivo_regestion, o.motivo_suspension, o.pais_empresa,
            o.email, o.tipo_ubicacion, o.codigo_postal, o.tipo_documento, o.producto,
            o.id_proyecto, o.proveedor, o.localidad, o.tipo_trabajo || o.motivo_trabajo, o.prioridad,
            o.historial_estados, o.fijo, o.sector_operativo, o.suscripcion
          ]
        );
      }
      guardadas++;
    } catch (err) {
      console.error(`Error al guardar orden ${o.numero}:`, err.message);
    }
  }

  return { totalGuardadas: guardadas };
}

let isSyncing = false;

/**
 * 🚀 PROCESO PRINCIPAL: Ejecuta todo el scraping y sincronización con WIN / Fénix
 */
async function sincronizarFenix({ fechaDesde = null, fechaHasta = null } = {}) {
  if (isSyncing) {
    console.log('⏳ [Fénix Scraper] Sincronización ya en curso. Omitiendo petición duplicada.');
    return { success: true, message: 'Sincronización ya en curso' };
  }

  isSyncing = true;
  try {
    console.log('🔄 [Fénix Scraper] Iniciando sincronización de órdenes...');

    // 1. Login inicial
    await loginWin();

    const porPagina = 30;
    let totalRegistros = 0;
    let totalPaginas = 1;
    let todasLasOrdenes = [];
    let pag = 1;
    let hayMasPaginas = true;

    while (hayMasPaginas && pag <= 100) {
      let resPag = null;
      let intentos = 0;
      let exitoPagina = false;

      while (intentos < 3 && !exitoPagina) {
        intentos++;
        try {
          resPag = await cargarGrillaWin(pag, fechaDesde, fechaHasta);
          
          if (!resPag || !resPag.d) {
            console.log(`⚠️ [Fénix Scraper] Respuesta vacía en página ${pag} (intento ${intentos}/3), renovando sesión...`);
            cookieJar.clear();
            await loginWin();
            continue;
          }

          const decoded = Buffer.from(resPag.d, 'base64').toString('utf-8');
          const dataJson = JSON.parse(decoded);
          if (!dataJson || (!dataJson.html && !dataJson.registros)) {
            console.log(`⚠️ [Fénix Scraper] JSON inválido en página ${pag} (intento ${intentos}/3), renovando sesión...`);
            cookieJar.clear();
            await loginWin();
            continue;
          }

          exitoPagina = true;
        } catch (errPag) {
          console.warn(`⚠️ [Fénix Scraper] Error en página ${pag} (intento ${intentos}/3):`, errPag.message);
          cookieJar.clear();
          await loginWin().catch(() => {});
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      if (!exitoPagina || !resPag || !resPag.d) {
        console.log(`⚠️ [Fénix Scraper] No se pudo obtener la página ${pag} después de 3 intentos.`);
        break;
      }

      try {
        const decodedPag = Buffer.from(resPag.d, 'base64').toString('utf-8');
        const dataJsonPag = JSON.parse(decodedPag);

        // En la página 1, leer el total de registros
        if (pag === 1 && dataJsonPag.registros) {
          try {
            const decReg = Buffer.from(dataJsonPag.registros, 'base64').toString('utf-8');
            const parsedReg = JSON.parse(decReg);
            totalRegistros = typeof parsedReg === 'number' ? parsedReg : parseInt(parsedReg, 10) || 0;
            totalPaginas = Math.ceil(totalRegistros / porPagina) || 1;
            console.log(`📊 [Fénix Scraper] Total órdenes registradas en WIN: ${totalRegistros} (${totalPaginas} páginas).`);
          } catch (e) {
            console.warn("Aviso al leer total registros:", e.message);
          }
        }

        if (dataJsonPag && dataJsonPag.html) {
          const htmlPag = Buffer.from(dataJsonPag.html, 'base64').toString('utf-8');
          const ordenesPag = parsearHtmlFenix(htmlPag);
          console.log(`📄 [Fénix Scraper] Página ${pag} procesada: ${ordenesPag.length} órdenes.`);
          
          if (ordenesPag.length > 0) {
            todasLasOrdenes = todasLasOrdenes.concat(ordenesPag);
          }

          // Si la página devolvió menos del límite de 30 o ya alcanzamos el total de páginas
          if (ordenesPag.length < porPagina || (totalPaginas && pag >= totalPaginas)) {
            hayMasPaginas = false;
          }
        } else {
          hayMasPaginas = false;
        }
      } catch (e) {
        console.error(`Error al procesar página ${pag}:`, e.message);
        hayMasPaginas = false;
      }

      pag++;
    }

    // 2. Enriquecer automáticamente con tiempos de CargarHistoEstaGrilla (En camino, Inicio, Fin)
    if (todasLasOrdenes.length > 0) {
      console.log(`⏱️ [Fénix Scraper] Extrayendo tiempos exactos (En camino, Inicio, Fin) para ${todasLasOrdenes.length} órdenes...`);
      const batchSize = 5;
      for (let i = 0; i < todasLasOrdenes.length; i += batchSize) {
        const batch = todasLasOrdenes.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (ord) => {
            if (!ord.numero) return;
            // ⚡ Optimización: si ya cuenta con inicio y fin de visita, no saturar WIN con peticiones extra
            if (ord.inicio_visita && ord.fin_visita) return;
            try {
              const hist = await obtenerHistorialEstados(ord.numero);
              if (hist && hist.length > 0) {
                const tiempos = extraerTiemposDeHistorial(hist);
                if (tiempos.horaEnCamino) ord.hora_en_camino = tiempos.horaEnCamino;
                if (tiempos.inicioVisita) ord.inicio_visita = tiempos.inicioVisita;
                if (tiempos.finVisita) ord.fin_visita = tiempos.finVisita;
                if (tiempos.horaAsignacion) ord.hora_asignacion = tiempos.horaAsignacion;
              }
            } catch (errHist) {}
          })
        );
      }
    }

    console.log(`💾 [Fénix Scraper] Guardando ${todasLasOrdenes.length} órdenes en la base de datos...`);
    const resultadoBD = await guardarOrdenesEnBD(todasLasOrdenes);

    console.log(`✅ [Fénix Scraper] ¡Sincronización completada con éxito! ${resultadoBD.totalGuardadas} órdenes procesadas.`);

    return {
      success: true,
      totalRegistros: totalRegistros || todasLasOrdenes.length,
      totalPaginas: pag - 1,
      totalOrdenesObtenidas: todasLasOrdenes.length,
      guardadasEnBD: resultadoBD.totalGuardadas
    };
  } finally {
    isSyncing = false;
  }
}

const ordeVisiIdCache = new Map();

/**
 * 6. Obtener ID de Visita (OrdeVisiId) para una orden
 */
async function obtenerOrdeVisiId(numeroOrden) {
  const cleanNum = String(numeroOrden).trim().replace(/^0+/, '');
  if (ordeVisiIdCache.has(cleanNum)) {
    return ordeVisiIdCache.get(cleanNum);
  }

  if (cookieJar.size === 0) {
    await loginWin();
  }

  const url = 'https://winbo-phx.azurewebsites.net/Paginas/OrdenTrabajo/Formulario.aspx/CargarVisitasGrilla';
  const payload = {
    IdPage: "74_Formu",
    OrdenId: cleanNum,
    pagiActu: 1
  };

  console.log(`🔍 [Fénix Tareas] Buscando OrdeVisiId para orden #${cleanNum}...`);
  let res = await requestWin(url, payload, getCookieHeader());
  if (!res || !res.data || !res.data.d) {
    await loginWin();
    res = await requestWin(url, payload, getCookieHeader());
  }

  if (!res || !res.data || !res.data.d) return null;

  try {
    const decodedD = JSON.parse(Buffer.from(res.data.d, 'base64').toString('utf-8'));
    const html = Buffer.from(decodedD.html, 'base64').toString('utf-8');

    const match = html.match(/seleccionarVisita74_Formu\(&quot;\s*(\d+)/i) ||
                  html.match(/seleccionarVisita74_Formu\(['"]\s*(\d+)/i) ||
                  html.match(/seleccionarVisita[^(]*\([^0-9]*(\d+)/i) ||
                  html.match(/OrdeVisiId["']?\s*[:=]\s*["']?(\d+)/i);

    const ordeVisiId = match ? match[1] : null;
    if (ordeVisiId) {
      ordeVisiIdCache.set(cleanNum, ordeVisiId);
      console.log(`✅ [Fénix Tareas] OrdeVisiId encontrado: ${ordeVisiId}`);
    }
    return ordeVisiId;
  } catch (e) {
    console.error("Error al obtener OrdeVisiId:", e.message);
    return null;
  }
}

/**
 * 7. Obtener lista de Tareas / Tarjetas (Validación, Fotos, Diagnóstico, etc.)
 */
async function obtenerTareasOrden(ordeVisiId) {
  if (!ordeVisiId) return [];
  if (cookieJar.size === 0) {
    await loginWin();
  }

  const url = 'https://winbo-phx.azurewebsites.net/Paginas/OrdenTrabajo/Formulario.aspx/CargarVisitasTareasGrilla';
  const payload = {
    EsCliente: "",
    EsSeguimiento: "S",
    IdPage: "74_Formu",
    OrdeVisiId: " " + String(ordeVisiId).trim()
  };

  console.log(`📋 [Fénix Tareas] Consultando tareas para OrdeVisiId: ${ordeVisiId}...`);
  let res = await requestWin(url, payload, getCookieHeader());
  if (!res || !res.data || !res.data.d) {
    await loginWin();
    res = await requestWin(url, payload, getCookieHeader());
  }

  if (!res || !res.data || !res.data.d) return [];

  try {
    const decodedD = JSON.parse(Buffer.from(res.data.d, 'base64').toString('utf-8'));
    const html = Buffer.from(decodedD.html, 'base64').toString('utf-8');

    const cards = html.split(/<div[^>]*class=["'][^"']*card\b[^"']*["'][^>]*>/i);
    cards.shift(); // quitar fragmento antes de la primera card

    const tareas = [];
    let realIndex = 0;

    cards.forEach((cardHtml) => {
      // 1. Extraer título real de la tarea
      const titleMatch = cardHtml.match(/<h[456][^>]*>([\s\S]*?)<\/h[456]>/i) ||
                         cardHtml.match(/<label[^>]*class=["'][^"']*(?:tx-bold|card-title)[^"']*["'][^>]*>([\s\S]*?)<\/label>/i);

      // Si no tiene título es una tarjeta interna secundaria, ignorarla
      if (!titleMatch) return;

      let titulo = titleMatch[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').trim();
      if (!titulo || titulo.length < 2) return;

      // Limpieza de caracteres de codificación (mojibake)
      titulo = titulo
        .replace(/Â¿/g, '¿')
        .replace(/Ã¡/g, 'á')
        .replace(/Ã©/g, 'é')
        .replace(/Ã­/g, 'í')
        .replace(/Ã³/g, 'ó')
        .replace(/Ãº/g, 'ú')
        .replace(/Ã±/g, 'ñ')
        .replace(/Ã/g, 'Í');

      // 2. Extraer id de tarea
      const idMatch = cardHtml.match(/name=["'][^"']*txtOrdeTrabaTareId[^"']*["'][^>]*value=["']([^"']*)["']/i) ||
                      cardHtml.match(/id=["'][^"']*txtOrdeTrabaTareId[^"']*["'][^>]*value=["']([^"']*)["']/i) ||
                      cardHtml.match(/value=["']([^"']*)["'][^>]*id=["'][^"']*txtOrdeTrabaTareId/i);
      const id = idMatch ? idMatch[1] : `task_${realIndex}`;

      // 3. Extraer estado específico (Pendiente vs Finalizada/Realizada)
      let estado = 'Pendiente';
      
      const badgeMatches = cardHtml.match(/<(?:span|label|div)[^>]*class=["'][^"']*(?:badge|label|tag|status|estado)[^"']*["'][^>]*>([\s\S]*?)<\/(?:span|label|div)>/gi) || [];
      
      let foundExact = false;
      for (const bHtml of badgeMatches) {
        const bText = bHtml.replace(/<[^>]+>/g, '').trim();
        if (/^pendiente$/i.test(bText)) {
          estado = 'Pendiente';
          foundExact = true;
          break;
        } else if (/^finalizada$/i.test(bText) || /^realizado?$/i.test(bText) || /^completad[ao]$/i.test(bText)) {
          estado = 'Finalizada';
          foundExact = true;
          break;
        }
      }

      if (!foundExact) {
        if (/\bPendiente\b/i.test(cardHtml) && !/\bFinalizada\b/i.test(cardHtml)) {
          estado = 'Pendiente';
        } else if (/\bFinalizada\b/i.test(cardHtml) || /\bRealizad[ao]\b/i.test(cardHtml)) {
          estado = 'Finalizada';
        }
      }

      // 4. Extraer imagen si existe (solo imágenes de evidencia)
      const imgMatch = cardHtml.match(/<img[^>]*src=["']([^"']+)["']/i);
      let imagen_base64 = null;
      if (imgMatch && !imgMatch[1].includes('Icono') && !imgMatch[1].includes('icon') && !imgMatch[1].includes('default')) {
        imagen_base64 = imgMatch[1];
      }

      tareas.push({
        index: realIndex,
        id,
        titulo,
        estado,
        imagen_base64
      });

      realIndex++;
    });

    console.log(`✅ [Fénix Tareas] Total tareas reales obtenidas: ${tareas.length}`);
    return tareas;
  } catch (e) {
    console.error("Error al obtener tareas:", e.message);
    return [];
  }
}

/**
 * 8. Obtener detalle al expandir la tarjeta (Coordenadas, Tiempos, Fotos)
 */
async function obtenerDetalleTarea(idTarea, index) {
  if (cookieJar.size === 0) {
    await loginWin();
  }

  const url = 'https://winbo-phx.azurewebsites.net/Paginas/OrdenTrabajo/Formulario.aspx/ConsultarTareaDeta';
  const payload = {
    EsCliente: "",
    EsSeguimiento: "S",
    IdPage: "74_Formu",
    Index: Number(index) || 0,
    OrdeTrabaTareId: String(idTarea),
    TipoHora: "2"
  };

  console.log(`🔎 [Fénix Tareas] Consultando detalle tarea ID: ${idTarea} (Index ${index})...`);
  let res = await requestWin(url, payload, getCookieHeader());
  if (!res || !res.data || !res.data.d) {
    await loginWin();
    res = await requestWin(url, payload, getCookieHeader());
  }

  if (!res || !res.data || !res.data.d) return null;

  try {
    const decodedD = JSON.parse(Buffer.from(res.data.d, 'base64').toString('utf-8'));
    const html = Buffer.from(decodedD.html, 'base64').toString('utf-8');
    fs.writeFileSync(require('path').join(__dirname, 'last_task_html.html'), html);

    // Extraer coordenadas de la tabla de spans
    const spanMatches = [];
    const spanRegex = /<span[^>]*>([\s\S]*?)<\/span>/gi;
    let sMatch;
    while ((sMatch = spanRegex.exec(html)) !== null) {
      spanMatches.push(sMatch[1].replace(/<[^>]+>/g, '').trim());
    }

    const coordenadas_inicio = {
      gd: spanMatches[0] || '',
      gms: spanMatches[1] || ''
    };
    const coordenadas_fin = {
      gd: spanMatches[2] || '',
      gms: spanMatches[3] || ''
    };

    // Descripción
    const descMatch = html.match(/<div[^>]*class=["'][^"']*col-12[^"']*["'][^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);
    const descripcion = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : '';

    // Tiempos
    const tiempos = {};
    const tiempoRegex = /(Estimado|Inicio|Fin|Duración|Motivo):?\s*<span[^>]*>([\s\S]*?)<\/span>/gi;
    let tMatch;
    while ((tMatch = tiempoRegex.exec(html)) !== null) {
      const key = tMatch[1].toLowerCase().replace('ó', 'o');
      tiempos[key] = tMatch[2].replace(/<[^>]+>/g, '').trim();
    }

    // Fotografías
    const fotografias = [];
    const cardSplits = html.split(/<div[^>]*class=["'][^"']*card\b[^"']*["'][^>]*>/i);
    cardSplits.shift();
    cardSplits.forEach((cHtml) => {
      const h5Match = cHtml.match(/<h5[^>]*>([\s\S]*?)<\/h5>/i);
      
      let finalImg = null;
      const hrefMatch = cHtml.match(/(?:href|data-src|data-original|data-full)=["']([^"']+\.(?:png|jpg|jpeg|webp)[^"']*)["']/i);
      if (hrefMatch && !hrefMatch[1].startsWith('#') && !hrefMatch[1].startsWith('javascript')) {
        finalImg = hrefMatch[1];
      }

      if (!finalImg) {
        const imgMatch = cHtml.match(/<img[^>]*src=["']([^"']+)["']/i);
        if (imgMatch) finalImg = imgMatch[1];
      }

      // Check if there is an onclick or data-id for high-res photo
      const dataIdMatch = cHtml.match(/ObtenerImagen\s*\(\s*['"]?(\d+)['"]?/i) || cHtml.match(/data-id=["'](\d+)["']/i) || cHtml.match(/id=["'][^"']*(\d{6,})[^"']*["']/i);
      const dataId = dataIdMatch ? dataIdMatch[1] : idTarea;

      if (finalImg || dataId) {
        fotografias.push({
          titulo: h5Match ? h5Match[1].replace(/<[^>]+>/g, '').trim() : 'Fotografía',
          imagen: finalImg,
          dataId: dataId
        });
      }
    });

    // Extraer campos de tabla (CAMPO / VALOR)
    const campos = {};
    const trRegex = /<tr[^>]*>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/gi;
    let trMatch;
    while ((trMatch = trRegex.exec(html)) !== null) {
      const campoKey = trMatch[1].replace(/<[^>]+>/g, '').trim();
      const campoVal = trMatch[2].replace(/<[^>]+>/g, '').trim();
      if (campoKey && !campoKey.toLowerCase().includes('campo') && campoKey !== 'TareaId' && campoKey !== 'NumeRegis') {
        campos[campoKey] = campoVal;
      }
    }

    return {
      coordenadas_inicio,
      coordenadas_fin,
      descripcion,
      tiempos,
      fotografias,
      campos
    };
  } catch (e) {
    console.error("Error al obtener detalle de tarea:", e.message);
    return null;
  }
}

/**
 * 8.1 Obtener Imagen en Alta Resolución (ObtenerImagen)
 */
async function obtenerImagenReal(dataId, opcion = 1, titulo = '') {
  if (cookieJar.size === 0) {
    await loginWin();
  }

  const url = 'https://winbo-phx.azurewebsites.net/default.aspx/ObtenerImagen';
  const payload = {
    DataId: Number(dataId) || dataId,
    Opcion: Number(opcion) || 1,
    Titulo: titulo || ''
  };

  console.log(`🖼️ [Fénix Imagen] Obteniendo imagen de alta resolución para DataId: ${dataId}...`);
  let res = await requestWin(url, payload, getCookieHeader());
  if (!res || !res.data || !res.data.d) {
    await loginWin();
    res = await requestWin(url, payload, getCookieHeader());
  }

  if (!res || !res.data || !res.data.d) return null;

  try {
    let rawStr = res.data.d;
    try {
      rawStr = Buffer.from(res.data.d, 'base64').toString('utf-8');
    } catch (e) {}
    
    const parsed = typeof rawStr === 'string' && rawStr.trim().startsWith('{') ? JSON.parse(rawStr) : res.data.d;
    if (parsed && parsed.resul) {
      let finalImg = parsed.resul;
      try {
        const decoded = Buffer.from(finalImg, 'base64').toString('utf-8');
        if (decoded.startsWith('data:image')) {
          finalImg = decoded;
        }
      } catch (err) {}
      
      if (!finalImg.startsWith('data:image')) {
        finalImg = `data:image/jpeg;base64,${finalImg}`;
      }
      return finalImg;
    }
    return null;
  } catch (e) {
    console.error('Error al procesar imagen de Fénix:', e.message);
    return null;
  }
}

/**
 * 9. Obtener Historial de Estados (CargarHistoEstaGrilla)
 * Extrae la lista de estados, fechas, duraciones, usuarios y observaciones.
 */
async function obtenerHistorialEstados(numeroOrden) {
  if (cookieJar.size === 0) {
    await loginWin();
  }

  const cleanNum = String(numeroOrden).trim().replace(/^0+/, '');
  const url = 'https://winbo-phx.azurewebsites.net/Paginas/OrdenTrabajo/Formulario.aspx/CargarHistoEstaGrilla';
  const payload = {
    IdPage: "74_Formu",
    OrdenId: cleanNum,
    pagiActu: 1
  };

  console.log(`📜 [Fénix Estados] Consultando historial de estados para orden #${cleanNum}...`);
  let res = await requestWin(url, payload, getCookieHeader());
  if (!res || !res.data || !res.data.d) {
    await loginWin();
    res = await requestWin(url, payload, getCookieHeader());
  }

  if (!res || !res.data || !res.data.d) return [];

  try {
    const decodedD = JSON.parse(Buffer.from(res.data.d, 'base64').toString('utf-8'));
    if (!decodedD || !decodedD.html) return [];
    const html = Buffer.from(decodedD.html, 'base64').toString('utf-8');

    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const tdRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;

    const historial = [];
    let trMatch;
    while ((trMatch = trRegex.exec(html)) !== null) {
      const rowContent = trMatch[1];
      const tds = [];
      let tdMatch;
      while ((tdMatch = tdRegex.exec(rowContent)) !== null) {
        const text = tdMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        tds.push(text);
      }
      if (tds.length >= 2 && tds[0].toUpperCase() !== 'FECHA') {
        historial.push({
          fecha: tds[0] || '',
          estado: tds[1] || '',
          duracion: tds[2] || '',
          usuario: tds[3] || '',
          datosAdicionales: tds[4] || '',
          observaciones: tds[5] || tds[6] || ''
        });
      }
    }

    console.log(`✅ [Fénix Estados] Se obtuvieron ${historial.length} registros de historial para orden #${cleanNum}.`);
    return historial;
  } catch (e) {
    console.error("Error al obtener historial de estados:", e.message);
    return [];
  }
}

/**
 * 10. Extrae los hitos de tiempo a partir del historial de estados
 */
function extraerTiemposDeHistorial(historial) {
  let horaAsignacion = null;
  let horaEnCamino = null;
  let inicioVisita = null;
  let finVisita = null;

  for (const h of historial) {
    const st = (h.estado || '').toUpperCase();
    const parsedDate = parseDateToMySQL(h.fecha);
    if (!parsedDate) continue;

    if (st.includes('CAMINO') && !horaEnCamino) {
      horaEnCamino = parsedDate;
    }
    if ((st.includes('INICIA') || st.includes('PROCESO')) && !inicioVisita) {
      inicioVisita = parsedDate;
    }
    if ((st.includes('FINALIZ') || st.includes('LIQUID') || st.includes('TERMIN')) && !finVisita) {
      finVisita = parsedDate;
    }
    if ((st.includes('ASIGNA') || st.includes('AGENDA')) && !horaAsignacion) {
      horaAsignacion = parsedDate;
    }
  }

  return {
    horaAsignacion,
    horaEnCamino,
    inicioVisita,
    finVisita
  };
}

module.exports = {
  sincronizarFenix,
  loginWin,
  cargarGrillaWin,
  obtenerOrdeVisiId,
  obtenerTareasOrden,
  obtenerDetalleTarea,
  obtenerImagenReal,
  obtenerHistorialEstados,
  extraerTiemposDeHistorial
};


