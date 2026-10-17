const mysql = require('mysql2/promise');

async function syncSingleTable() {
  const remote = await mysql.createConnection({
    host: 'corporacioncespedes.com',
    user: 'corporacioncespe_miguel',
    password: 'corporacioncespe_123',
    database: 'corporacioncespe_cespedes',
    dateStrings: true
  });
  const local = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes',
    dateStrings: true
  });

  try {
    const [create] = await remote.query('SHOW CREATE TABLE `orden_tareas_cache`');
    await local.query('DROP TABLE IF EXISTS `orden_tareas_cache`');
    await local.query(create[0]['Create Table']);

    const [rows] = await remote.query('SELECT * FROM `orden_tareas_cache`');
    console.log('Filas a sincronizar:', rows.length);

    for (let i = 0; i < rows.length; i += 50) {
      const slice = rows.slice(i, i + 50);
      for (const r of slice) {
        const cols = Object.keys(r);
        const sql = `INSERT INTO \`orden_tareas_cache\` (${cols.map(c => `\`${c}\``).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`;
        await local.query(sql, cols.map(c => r[c]));
      }
    }
    console.log('✅ orden_tareas_cache sincronizada al 100%!');
  } finally {
    await remote.end();
    await local.end();
  }
}

syncSingleTable().catch(e => console.error(e));
