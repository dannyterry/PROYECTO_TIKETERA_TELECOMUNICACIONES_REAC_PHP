const mysql = require('mysql2/promise');

const localConfig = {
  host: '127.0.0.1', port: 3306, user: 'root', password: '', database: 'corporacioncespe_cespedes'
};
const remoteConfig = {
  host: 'corporacioncespedes.com', port: 3306, user: 'corporacioncespe_miguel', password: 'corporacioncespe_123', database: 'corporacioncespe_cespedes'
};

async function main() {
  const localPool = mysql.createPool(localConfig);
  const remotePool = mysql.createPool(remoteConfig);

  const [localTickets] = await localPool.query(`
    SELECT numero, estado, cliente, cuadrilla, fecha_visita 
    FROM ordenes 
    WHERE (fecha_visita >= '2026-09-01 00:00:00' AND fecha_visita <= '2026-09-29 23:59:59')
       OR (fecha_visita IS NULL AND fecha_solicitud >= '2026-09-01 00:00:00' AND fecha_solicitud <= '2026-09-29 23:59:59')
  `);
  const [remoteTickets] = await remotePool.query(`
    SELECT numero, estado, cliente, cuadrilla, fecha_visita 
    FROM ordenes 
    WHERE (fecha_visita >= '2026-09-01 00:00:00' AND fecha_visita <= '2026-09-29 23:59:59')
       OR (fecha_visita IS NULL AND fecha_solicitud >= '2026-09-01 00:00:00' AND fecha_solicitud <= '2026-09-29 23:59:59')
  `);

  const localSet = new Set(localTickets.map(t => t.numero));
  const missingInLocal = remoteTickets.filter(t => !localSet.has(t.numero));
  console.log('Orden en Hosting que faltaba en Local:', missingInLocal);

  // Check state differences detail
  const localMap = new Map(localTickets.map(t => [t.numero, t]));
  const diffs = [];
  for (const r of remoteTickets) {
    const l = localMap.get(r.numero);
    if (l && l.estado !== r.estado) {
      diffs.push({
        numero: r.numero,
        cliente: r.cliente,
        cuadrilla: r.cuadrilla,
        localEstado: l.estado,
        hostingEstado: r.estado
      });
    }
  }
  console.log('Total diferencias de estado:', diffs.length);
  console.table(diffs);

  await localPool.end();
  await remotePool.end();
}

main().catch(console.error);
