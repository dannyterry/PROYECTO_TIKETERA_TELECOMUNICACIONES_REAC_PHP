const mysql = require('mysql2/promise');
const { obtenerHistorialEstados, loginWin } = require('../services/fenixScraper');

(async () => {
  await loginWin();
  const pool = mysql.createPool({ host: '127.0.0.1', user: 'root', password: '', database: 'corporacioncespe_cespedes' });
  const [rows] = await pool.query("SELECT numero, cliente, estado, motivo_regestion, motivo_cancelacion FROM ordenes WHERE fecha_visita >= '2026-10-14'");
  
  console.log(`Comparando ${rows.length} órdenes de hoy...`);
  for (const r of rows) {
    try {
      const hist = await obtenerHistorialEstados(r.numero);
      const ultHist = hist && hist[0] ? hist[0].estado : 'Sin historial';
      if (r.estado !== ultHist) {
        console.log(`⚠️ Ticket #${r.numero} (${r.cliente}): DB=[${r.estado}] vs Historial=[${ultHist}] | reg=[${r.motivo_regestion}] | can=[${r.motivo_cancelacion}]`);
      }
    } catch (e) {
      console.log('Err:', r.numero, e.message);
    }
    await new Promise(res => setTimeout(res, 200));
  }
  pool.end();
  process.exit(0);
})();
