const { sincronizarFenix } = require('./services/fenixScraper.js');

async function main() {
  console.log("🚀 Probando sincronización en vivo con Fénix...");
  const res = await sincronizarFenix();
  console.log("Resultado de sincronización:", res);
  process.exit(0);
}

main().catch(err => {
  console.error("Error en sincronización:", err);
  process.exit(1);
});
