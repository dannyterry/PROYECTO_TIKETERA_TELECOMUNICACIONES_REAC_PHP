const fenix = require('./fenixScraper');
const fs = require('fs');

async function test() {
  await fenix.loginWin();
  const res = await fenix.obtenerDetalleTarea('71141355', 27);
  console.log('Result:', JSON.stringify(res, null, 2));
  process.exit(0);
}
test();
