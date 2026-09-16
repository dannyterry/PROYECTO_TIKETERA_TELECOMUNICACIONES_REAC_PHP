const { loginWin, requestWin, parsearHtmlFenix } = require('../services/fenixScraper');

async function testParsing() {
  await loginWin();
  const res = await require('../services/fenixScraper').cargarGrillaWin(1, "15/05/2026", "15/05/2026");
  const decoded = JSON.parse(Buffer.from(res.d, 'base64').toString('utf-8'));
  const html = Buffer.from(decoded.html, 'base64').toString('utf-8');

  // Let's see parsed orders
  const { sincronizarFenix } = require('../services/fenixScraper');
  console.log("Parsing HTML from May 15, 2026...");
  
  // Test parse
  const fenixScraper = require('../services/fenixScraper');
  const rows = [];
  const thRegex = /<th[^>]*>([\s\S]*?)<\/th>/gi;
  const headers = [];
  let m;
  while ((m = thRegex.exec(html)) !== null) {
    headers.push(m[1].replace(/<[^>]+>/g, '').trim());
  }
  console.log("Extracted headers count:", headers.length);
  console.log("Headers:", headers);

  // Parse table
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let count = 0;
  while ((m = trRegex.exec(html)) !== null) {
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const tds = [];
    let tdm;
    while ((tdm = tdRegex.exec(m[1])) !== null) {
      tds.push(tdm[1].replace(/<[^>]+>/g, '').trim());
    }
    if (tds.length > 5) {
      count++;
      console.log(`\nRow ${count}:`);
      console.log(`Numero: ${tds[1]} | Cliente: ${tds[4]} | MotivoFin: ${tds[13]} | TipoTraba: ${tds[14]} | Suscrip: ${tds[23]} | Producto: ${tds[25] || tds[26]}`);
    }
  }

  process.exit(0);
}

testParsing().catch(console.error);
