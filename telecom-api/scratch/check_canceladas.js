const mysql = require('mysql2/promise');
const { obtenerHistorialEstados, loginWin } = require('../services/fenixScraper');

(async () => {
  await loginWin();
  const pool = mysql.createPool({ host: '127.0.0.1', user: 'root', password: '', database: 'corporacioncespe_cespedes' });
  const [rows] = await pool.query("SELECT numero, cliente, estado, motivo_cancelacion FROM ordenes WHERE fecha_visita >= '2026-10-14' AND estado = 'Cancelada'");
  console.log(`Órdenes canceladas de hoy en DB (${rows.length}):`);
  for (const r of rows) {
    const hist = await obtenerHistorialEstados(r.numero);
    console.log(r.numero, r.cliente, '| DB:', r.estado, '| Historial[0]:', hist && hist[0] ? hist[0].estado : 'none', '| Historial[0] texto:', hist && hist[0] ? hist[0].datosAdicionales : '');
  }
  pool.end();
  process.exit(0);
})();
