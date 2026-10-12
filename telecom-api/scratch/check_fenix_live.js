const { obtenerHistorialEstados } = require('../services/fenixScraper.js');

async function testOrder() {
  try {
    const res = await obtenerHistorialEstados('3506538');
    console.log("=== HISTORIAL REAL EN VIVO FENIX ===");
    console.log(JSON.stringify(res, null, 2));
    process.exit(0);
  } catch (e) {
    console.error("Error:", e.message);
    process.exit(1);
  }
}

testOrder();
