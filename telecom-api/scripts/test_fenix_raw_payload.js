const https = require('https');
const pool = require('../db');

// Credenciales
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
  const res = await requestWin('https://winbo-phx.azurewebsites.net/login.aspx/IniciarSesion', payload);
  console.log("🔐 Login res status:", res.status);
}

async function testPayloads() {
  await login();

  const fechaTest = "15/05/2026";
  const tests = [
    { name: "tipoOrden: 1 (averias)", tipoOrden: 1 },
    { name: "tipoOrden: 0 (todos)", tipoOrden: 0 },
    { name: "tipoOrden: 2 (postventa)", tipoOrden: 2 },
    { name: "tipoOrden: '0'", tipoOrden: "0" },
    { name: "tipoOrden: null", tipoOrden: null }
  ];

  for (const t of tests) {
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
      fechaVisiDesde: fechaTest,
      fechaVisiHasta: fechaTest,
      idPage: 74,
      localidad: "0",
      pagiActu: 1,
      producto: null,
      provincia: "0",
      region: "0",
      suscrip: "",
      tipoOrden: t.tipoOrden,
      tipoProduc: "0",
      tipoTraba: "0",
      tipoUbi: "",
      ubi: "",
      zona: "0"
    };

    const res = await requestWin('https://winbo-phx.azurewebsites.net/Paginas/OperadoresBO/misOrdenes.aspx/cargarGrilla', payload);
    if (res.data && res.data.d) {
      try {
        const decoded = JSON.parse(Buffer.from(res.data.d, 'base64').toString('utf-8'));
        let reg = 0;
        if (decoded.registros) {
          const decReg = Buffer.from(decoded.registros, 'base64').toString('utf-8');
          reg = JSON.parse(decReg);
        }
        console.log(`✅ [${t.name}] Registros devueltos por Fénix: ${reg}`);
        if (decoded.html) {
          const html = Buffer.from(decoded.html, 'base64').toString('utf-8');
          // Check th headers
          const thRegex = /<th[^>]*>([\s\S]*?)<\/th>/gi;
          const ths = [];
          let thm;
          while ((thm = thRegex.exec(html)) !== null) {
            ths.push(thm[1].replace(/<[^>]+>/g, '').trim());
          }
          console.log(`   Headers (${ths.length}):`, ths.join(' | '));
          
          // Check first 2 rows
          const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
          let rowI = 0;
          let trm;
          while ((trm = trRegex.exec(html)) !== null && rowI < 2) {
            const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
            const tds = [];
            let tdm;
            while ((tdm = tdRegex.exec(trm[1])) !== null) {
              tds.push(tdm[1].replace(/<[^>]+>/g, '').trim());
            }
            if (tds.length > 5) {
              rowI++;
              console.log(`   Fila ${rowI} (${tds.length} cols):`, tds.join(' | '));
            }
          }
        }
      } catch (e) {
        console.log(`❌ [${t.name}] Error decodificando:`, e.message);
      }
    } else {
      console.log(`❌ [${t.name}] Sin datos devueltos`);
    }
  }

  process.exit(0);
}

testPayloads().catch(err => {
  console.error(err);
  process.exit(1);
});
