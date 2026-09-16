const https = require('https');
const pool = require('../db');
const { loginWin, parsearHtmlFenix } = require('../services/fenixScraper');

const TR_USER = process.env.WIN_USER || 'CESPEDES';
const TR_PASSWORD = process.env.WIN_PASSWORD || 'CESPEDES2026AVERIAS';
const TR_COD_SUS = process.env.WIN_COD_SUS || 'WIN';
const cookieJar = new Map();

function updateCookies(setCookieArray) {
  if (!setCookieArray || !Array.isArray(setCookieArray)) return;
  for (const cookieStr of setCookieArray) {
    const parts = cookieStr.split(';')[0].split('=');
    const name = parts[0].trim();
    const value = parts.slice(1).join('=').trim();
    if (name) cookieJar.set(name, value);
  }
}

function getCookieHeader() {
  const list = [];
  for (const [name, value] of cookieJar.entries()) {
    list.push(`${name}=${value}`);
  }
  return list.join('; ');
}

function requestWin(urlStr, payload = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const postData = payload ? JSON.stringify(payload) : '';
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Requested-With': 'XMLHttpRequest',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Origin': 'https://winbo-phx.azurewebsites.net',
      'Referer': urlStr,
      'Cookie': getCookieHeader()
    };
    if (payload) headers['Content-Length'] = Buffer.byteLength(postData, 'utf8');

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
      if (res.headers['set-cookie']) updateCookies(res.headers['set-cookie']);
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const fullBuffer = Buffer.concat(chunks);
        const data = fullBuffer.toString('utf8');
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout Fenix'));
    });
    if (payload) req.write(postData, 'utf8');
    req.end();
  });
}

async function login() {
  const payload = {
    CodiUsua: TR_USER,
    Contraseña: TR_PASSWORD,
    CodiSuscrip: TR_COD_SUS,
    Navegador: 'PHP cURL',
    Query: '',
    AutenDoblePasoCodi: '',
    LoginInterno: 'S'
  };
  await requestWin('https://winbo-phx.azurewebsites.net/login.aspx/IniciarSesion', payload);
  console.log("🔑 Sesión iniciada con éxito en WIN / Fénix.");
}

async function fetchGrillaPagina(pag, fDesde, fHasta) {
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
    pagiActu: pag,
    producto: null,
    provincia: "0",
    region: "0",
    suscrip: "",
    tipoOrden: 0, // 0 = Averías + Postventa + Todas las órdenes
    tipoProduc: "0",
    tipoTraba: "0",
    tipoUbi: "",
    ubi: "",
    zona: "0"
  };
  const res = await requestWin('https://winbo-phx.azurewebsites.net/Paginas/OperadoresBO/misOrdenes.aspx/cargarGrilla', payload);
  return res.data;
}

const LOTES_2026 = [
  { nombre: "Enero 2026", desde: "01/01/2026", hasta: "31/01/2026" },
  { nombre: "Febrero 2026", desde: "01/02/2026", hasta: "28/02/2026" },
  { nombre: "Marzo 2026", desde: "01/03/2026", hasta: "31/03/2026" },
  { nombre: "Abril 2026", desde: "01/04/2026", hasta: "30/04/2026" },
  { nombre: "Mayo 2026", desde: "01/05/2026", hasta: "31/05/2026" },
  { nombre: "Junio 2026", desde: "01/06/2026", hasta: "30/06/2026" },
  { nombre: "Julio 2026", desde: "01/07/2026", hasta: "31/07/2026" },
  { nombre: "Agosto 2026", desde: "01/08/2026", hasta: "31/08/2026" },
  { nombre: "Septiembre 2026", desde: "01/09/2026", hasta: "16/09/2026" },
];

async function syncAllMonths() {
  console.log("==================================================================");
  console.log("🚀 ACTUALIZANDO COLUMNA PRODUCTO DESDE FÉNIX (ENERO - SEPTIEMBRE 2026)");
  console.log("==================================================================");

  await login();

  let totalActualizadas = 0;

  for (let i = 0; i < LOTES_2026.length; i++) {
    const lote = LOTES_2026[i];
    console.log(`\n📅 [${i + 1}/${LOTES_2026.length}] Procesando ${lote.nombre} (${lote.desde} al ${lote.hasta})...`);
    
    let pag = 1;
    let totalPaginas = 1;
    let totalRegistros = 0;
    let ordenesMes = [];

    while (pag <= totalPaginas && pag <= 100) {
      let resPag = null;
      try {
        resPag = await fetchGrillaPagina(pag, lote.desde, lote.hasta);
      } catch (err) {
        console.warn(`⚠️ Reintentando página ${pag}...`);
        await login();
        resPag = await fetchGrillaPagina(pag, lote.desde, lote.hasta);
      }

      if (!resPag || !resPag.d) {
        console.warn(`⚠️ Sin respuesta en pág ${pag}`);
        break;
      }

      const decoded = Buffer.from(resPag.d, 'base64').toString('utf-8');
      const dataJson = JSON.parse(decoded);

      if (pag === 1 && dataJson.registros) {
        const decReg = Buffer.from(dataJson.registros, 'base64').toString('utf-8');
        totalRegistros = parseInt(JSON.parse(decReg), 10) || 0;
        totalPaginas = Math.ceil(totalRegistros / 30) || 1;
        console.log(`   📊 Total órdenes en Fénix para ${lote.nombre}: ${totalRegistros} (${totalPaginas} páginas).`);
      }

      if (dataJson.html) {
        const html = Buffer.from(dataJson.html, 'base64').toString('utf-8');
        const parsed = parsearHtmlFenix(html);
        ordenesMes = ordenesMes.concat(parsed);
      }

      pag++;
    }

    console.log(`   📦 ${ordenesMes.length} órdenes obtenidas de Fénix. Actualizando en BD Local...`);

    // Actualizar producto en la base de datos local
    let updatedThisMonth = 0;
    for (const ord of ordenesMes) {
      if (!ord.numero) continue;
      
      const prodVal = ord.producto || null;
      if (prodVal) {
        const [resUpd] = await pool.query(`
          UPDATE ordenes 
          SET producto = ?,
              suscripcion = COALESCE(NULLIF(?, ''), NULLIF(suscripcion, ''))
          WHERE numero = ?
        `, [prodVal, ord.suscripcion || null, ord.numero]);
        
        if (resUpd.affectedRows > 0) updatedThisMonth++;
      }
    }

    console.log(`   ✅ ${lote.nombre} completado: ${updatedThisMonth} órdenes actualizadas con producto.`);
    totalActualizadas += updatedThisMonth;
  }

  console.log("\n==================================================================");
  console.log(`🎉 SINCRONIZACIÓN FINALIZADA: ${totalActualizadas} órdenes actualizadas.`);
  console.log("==================================================================");

  // Mostrar distribución final por mes
  const [resumen] = await pool.query(`
    SELECT 
      MONTH(fecha_visita) as mes,
      COUNT(*) as total_ordenes,
      SUM(CASE WHEN producto LIKE '%POST%VENTA%' THEN 1 ELSE 0 END) as post_venta,
      SUM(CASE WHEN producto NOT LIKE '%POST%VENTA%' AND producto IS NOT NULL AND TRIM(producto) != '' THEN 1 ELSE 0 END) as averias_y_otros,
      SUM(CASE WHEN producto IS NULL OR TRIM(producto) = '' THEN 1 ELSE 0 END) as sin_producto
    FROM ordenes
    WHERE YEAR(fecha_visita) = 2026
    GROUP BY MONTH(fecha_visita)
    ORDER BY mes ASC
  `);
  console.log("\n📊 Distribución de columna `producto` en BD Local tras la actualización:");
  console.table(resumen);

  await pool.end();
  process.exit(0);
}

syncAllMonths().catch(err => {
  console.error("❌ Error en sincronización:", err);
  process.exit(1);
});
