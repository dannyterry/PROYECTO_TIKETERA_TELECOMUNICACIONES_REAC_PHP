const { cargarGrillaWin, loginWin } = require('./services/fenixScraper');

async function main() {
  await loginWin();
  const res = await cargarGrillaWin(1, '01/09/2026', '01/09/2026');
  const decoded = Buffer.from(res.d, 'base64').toString('utf-8');
  const dataJson = JSON.parse(decoded);
  const htmlDecoded = Buffer.from(dataJson.html, 'base64').toString('utf-8');

  const thRegex = /<th[^>]*>([\s\S]*?)<\/th>/gi;
  const ths = [];
  let thMatch;
  while ((thMatch = thRegex.exec(htmlDecoded)) !== null) {
    ths.push(thMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
  }
  console.log(`\n=== HEADERS REALES (${ths.length}) ===`);
  ths.forEach((t, i) => console.log(`TH[${i}] = "${t}"`));

  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;

  let trMatch;
  let rowIdx = 0;
  while ((trMatch = trRegex.exec(htmlDecoded)) !== null && rowIdx < 2) {
    const rowContent = trMatch[1];
    const tds = [];
    let tdMatch;
    while ((tdMatch = tdRegex.exec(rowContent)) !== null) {
      tds.push(tdMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
    }
    if (tds.length < 5) continue;

    console.log(`\n=== ROW ${rowIdx} (${tds.length} TDs) ===`);
    tds.forEach((td, i) => {
      const h = ths[i] || `Col_${i}`;
      console.log(`TD[${i}] (Header: "${h}") = "${td}"`);
    });
    rowIdx++;
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
