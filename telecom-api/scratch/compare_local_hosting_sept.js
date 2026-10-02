const mysql = require('mysql2/promise');

const localConfig = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: '',
  database: 'corporacioncespe_cespedes',
  connectTimeout: 10000
};

const remoteConfig = {
  host: 'corporacioncespedes.com',
  port: 3306,
  user: 'corporacioncespe_miguel',
  password: 'corporacioncespe_123',
  database: 'corporacioncespe_cespedes',
  connectTimeout: 15000
};

async function main() {
  let localPool, remotePool;

  try {
    localPool = mysql.createPool(localConfig);
  } catch (e) {
    console.log('Error local pool:', e.message);
  }

  let hasRemote = false;
  try {
    remotePool = mysql.createPool(remoteConfig);
    await remotePool.query('SELECT 1');
    hasRemote = true;
    console.log('✅ Conectado a Hosting Remoto (Producción)');
  } catch (e) {
    console.log('⚠️ No se pudo conectar directo al hosting remoto:', e.message);
  }

  console.log('\n=============================================');
  console.log('📊 CONTEO LOCAL - SEPTIEMBRE (01 al 29 Sep)');
  console.log('=============================================');

  const [localCounts] = await localPool.query(`
    SELECT estado, count(*) as cantidad 
    FROM ordenes 
    WHERE (
      (fecha_visita >= '2026-09-01 00:00:00' AND fecha_visita <= '2026-09-29 23:59:59')
      OR (fecha_visita IS NULL AND fecha_solicitud >= '2026-09-01 00:00:00' AND fecha_solicitud <= '2026-09-29 23:59:59')
    )
    GROUP BY estado
    ORDER BY cantidad DESC
  `);
  console.table(localCounts);

  const [localTotal] = await localPool.query(`
    SELECT count(*) as total 
    FROM ordenes 
    WHERE (
      (fecha_visita >= '2026-09-01 00:00:00' AND fecha_visita <= '2026-09-29 23:59:59')
      OR (fecha_visita IS NULL AND fecha_solicitud >= '2026-09-01 00:00:00' AND fecha_solicitud <= '2026-09-29 23:59:59')
    )
  `);
  console.log('Total Local (01-29 Sep):', localTotal[0].total);

  if (hasRemote) {
    console.log('\n=============================================');
    console.log('🌐 CONTEO HOSTING / REMOTO - SEPTIEMBRE (01 al 29 Sep)');
    console.log('=============================================');

    const [remoteCounts] = await remotePool.query(`
      SELECT estado, count(*) as cantidad 
      FROM ordenes 
      WHERE (
        (fecha_visita >= '2026-09-01 00:00:00' AND fecha_visita <= '2026-09-29 23:59:59')
        OR (fecha_visita IS NULL AND fecha_solicitud >= '2026-09-01 00:00:00' AND fecha_solicitud <= '2026-09-29 23:59:59')
      )
      GROUP BY estado
      ORDER BY cantidad DESC
    `);
    console.table(remoteCounts);

    const [remoteTotal] = await remotePool.query(`
      SELECT count(*) as total 
      FROM ordenes 
      WHERE (
        (fecha_visita >= '2026-09-01 00:00:00' AND fecha_visita <= '2026-09-29 23:59:59')
        OR (fecha_visita IS NULL AND fecha_solicitud >= '2026-09-01 00:00:00' AND fecha_solicitud <= '2026-09-29 23:59:59')
      )
    `);
    console.log('Total Hosting (01-29 Sep):', remoteTotal[0].total);

    // Comparar diferencias de tickets
    const [localTickets] = await localPool.query(`
      SELECT numero, estado, motivo_finalizacion 
      FROM ordenes 
      WHERE (
        (fecha_visita >= '2026-09-01 00:00:00' AND fecha_visita <= '2026-09-29 23:59:59')
        OR (fecha_visita IS NULL AND fecha_solicitud >= '2026-09-01 00:00:00' AND fecha_solicitud <= '2026-09-29 23:59:59')
      )
    `);
    const [remoteTickets] = await remotePool.query(`
      SELECT numero, estado, motivo_finalizacion 
      FROM ordenes 
      WHERE (
        (fecha_visita >= '2026-09-01 00:00:00' AND fecha_visita <= '2026-09-29 23:59:59')
        OR (fecha_visita IS NULL AND fecha_solicitud >= '2026-09-01 00:00:00' AND fecha_solicitud <= '2026-09-29 23:59:59')
      )
    `);

    const remoteMap = new Map(remoteTickets.map(r => [r.numero, r]));
    const localMap = new Map(localTickets.map(r => [r.numero, r]));

    const missingInRemote = localTickets.filter(l => !remoteMap.has(l.numero));
    const missingInLocal = remoteTickets.filter(r => !localMap.has(r.numero));
    const stateDiffs = [];

    for (const l of localTickets) {
      const r = remoteMap.get(l.numero);
      if (r && r.estado !== l.estado) {
        stateDiffs.push({ numero: l.numero, localEstado: l.estado, remoteEstado: r.estado });
      }
    }

    console.log('\n--- DIFERENCIAS LOCAL VS HOSTING ---');
    console.log('En Local pero no en Hosting:', missingInRemote.length);
    console.log('En Hosting pero no en Local:', missingInLocal.length);
    console.log('Diferencias de Estado:', stateDiffs.length);
    if (stateDiffs.length > 0) console.table(stateDiffs.slice(0, 10));
  }

  if (localPool) await localPool.end();
  if (remotePool) await remotePool.end();
}

main().catch(console.error);
