const mysql = require('mysql2/promise');

async function main() {
  const localConn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  const remoteConn = await mysql.createConnection({
    host: 'corporacioncespedes.com',
    user: 'corporacioncespe_miguel',
    password: 'corporacioncespe_123',
    database: 'corporacioncespe_cespedes'
  });

  console.log('Conexiones establecidas.');

  const [localTables] = await localConn.query('SHOW TABLES');
  const [remoteTables] = await remoteConn.query('SHOW TABLES');

  const lTableNames = localTables.map(r => Object.values(r)[0]);
  const rTableNames = new Set(remoteTables.map(r => Object.values(r)[0]));

  const missingTablesInRemote = lTableNames.filter(t => !rTableNames.has(t));
  console.log('\n--- TABLAS QUE FALTAN EN PRODUCCIÓN (' + missingTablesInRemote.length + ') ---');
  console.log(missingTablesInRemote);

  const columnDiffs = [];

  for (const table of lTableNames) {
    if (rTableNames.has(table)) {
      const [lCols] = await localConn.query(`DESCRIBE \`${table}\``);
      const [rCols] = await remoteConn.query(`DESCRIBE \`${table}\``);

      const rColNames = new Set(rCols.map(c => c.Field));
      for (const col of lCols) {
        if (!rColNames.has(col.Field)) {
          columnDiffs.push({
            table,
            column: col.Field,
            type: col.Type,
            null: col.Null,
            default: col.Default
          });
        }
      }
    }
  }

  console.log('\n--- COLUMNAS QUE FALTAN EN PRODUCCIÓN (' + columnDiffs.length + ') ---');
  console.log(JSON.stringify(columnDiffs, null, 2));

  // Obtener CREATE TABLE para cada tabla que falta en remoto
  console.log('\n--- DDL PARA TABLAS FALTANTES ---');
  for (const table of missingTablesInRemote) {
    const [createRes] = await localConn.query(`SHOW CREATE TABLE \`${table}\``);
    console.log(createRes[0]['Create Table'] + ';\n');
  }

  await localConn.end();
  await remoteConn.end();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
