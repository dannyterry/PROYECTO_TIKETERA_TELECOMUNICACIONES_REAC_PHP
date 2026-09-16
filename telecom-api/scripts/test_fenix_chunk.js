const { loginWin, cargarGrillaWin, parsearHtmlFenix } = require('../services/fenixScraper');
const pool = require('../db');

async function testChunk() {
  console.log("Iniciando sesión...");
  await loginWin();
  
  console.log("Consultando del 01/05/2026 al 05/05/2026...");
  const t0 = Date.now();
  const res = await cargarGrillaWin(1, "01/05/2026", "05/05/2026");
  console.log(`Respuesta en ${(Date.now() - t0)}ms`);
  
  const decoded = JSON.parse(Buffer.from(res.d, 'base64').toString('utf-8'));
  let reg = 0;
  if (decoded.registros) {
    reg = JSON.parse(Buffer.from(decoded.registros, 'base64').toString('utf-8'));
  }
  console.log(`Total registros en el rango: ${reg}`);
  
  if (decoded.html) {
    const html = Buffer.from(decoded.html, 'base64').toString('utf-8');
    const orders = parsearHtmlFenix(html);
    console.log(`Órdenes parseadas en pág 1: ${orders.length}`);
    const productos = orders.map(o => `${o.numero}: ${o.producto}`).slice(0, 10);
    console.log("Muestra de productos extraídos:", productos);
  }
  
  process.exit(0);
}

testChunk().catch(console.error);
