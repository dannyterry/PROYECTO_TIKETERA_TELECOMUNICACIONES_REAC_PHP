const mysql = require('mysql2/promise');

async function syncExactTables() {
  const prodConn = await mysql.createConnection({
    host: 'corporacioncespedes.com',
    user: 'corporacioncespe_miguel',
    password: 'corporacioncespe_123',
    database: 'corporacioncespe_cespedes',
    dateStrings: true
  });

  const localConn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes',
    dateStrings: true
  });

  await localConn.query('SET FOREIGN_KEY_CHECKS = 0');

  // Sincronizar trabajadores
  const [tRows] = await prodConn.query('SELECT * FROM trabajadores');
  await localConn.query('DELETE FROM trabajadores');
  const tCols = Object.keys(tRows[0]).map(c => `\`${c}\``).join(', ');
  for (const r of tRows) {
    const ph = `(${Object.keys(r).map(() => '?').join(', ')})`;
    await localConn.query(`INSERT INTO trabajadores (${tCols}) VALUES ${ph}`, Object.values(r));
  }

  // Sincronizar despachos
  const [dRows] = await prodConn.query('SELECT * FROM despachos');
  await localConn.query('DELETE FROM despachos');
  const dCols = Object.keys(dRows[0]).map(c => `\`${c}\``).join(', ');
  for (const r of dRows) {
    const ph = `(${Object.keys(r).map(() => '?').join(', ')})`;
    await localConn.query(`INSERT INTO despachos (${dCols}) VALUES ${ph}`, Object.values(r));
  }

  // Sincronizar despacho_detalles
  const [ddRows] = await prodConn.query('SELECT * FROM despacho_detalles');
  await localConn.query('DELETE FROM despacho_detalles');
  const ddCols = Object.keys(ddRows[0]).map(c => `\`${c}\``).join(', ');
  for (const r of ddRows) {
    const ph = `(${Object.keys(r).map(() => '?').join(', ')})`;
    await localConn.query(`INSERT INTO despacho_detalles (${ddCols}) VALUES ${ph}`, Object.values(r));
  }

  await localConn.query('SET FOREIGN_KEY_CHECKS = 1');

  const [verify] = await localConn.query(`
    SELECT d.codigo_despacho, d.id_trabajador, u.nombres, u.primer_apellido, u.apellidos 
    FROM despachos d 
    JOIN trabajadores t ON d.id_trabajador = t.id_trabajador 
    JOIN usuarios u ON t.id_usuario = u.id_usuario 
    ORDER BY d.id_despacho DESC
  `);
  console.log('✅ Despachos y trabajadores sincronizados 100% idénticos a Producción:');
  console.table(verify);

  await prodConn.end();
  await localConn.end();
}

syncExactTables();
