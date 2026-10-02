const mysql = require('mysql2/promise');

const localConfig = {
  host: '127.0.0.1', port: 3306, user: 'root', password: '', database: 'corporacioncespe_cespedes'
};
const remoteConfig = {
  host: 'corporacioncespedes.com', port: 3306, user: 'corporacioncespe_miguel', password: 'corporacioncespe_123', database: 'corporacioncespe_cespedes'
};

async function getSchema(pool, label) {
  const [tables] = await pool.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
  const tableNames = tables.map(t => Object.values(t)[0]);
  const schema = {};

  for (const table of tableNames) {
    const [cols] = await pool.query(`SHOW FULL COLUMNS FROM \`${table}\``);
    schema[table] = cols.map(c => ({
      Field: c.Field,
      Type: c.Type,
      Null: c.Null,
      Default: c.Default,
      Extra: c.Extra
    }));
  }
  return { tableNames, schema };
}

async function main() {
  console.log('🔍 Auditando y comparando esquema completo: Local vs Hosting...');
  const localPool = mysql.createPool(localConfig);
  const remotePool = mysql.createPool(remoteConfig);

  const local = await getSchema(localPool, 'Local');
  const remote = await getSchema(remotePool, 'Hosting');

  console.log(`\n📊 Tablas en Local: ${local.tableNames.length}`);
  console.log(`📊 Tablas en Hosting: ${remote.tableNames.length}`);

  // 1. Tablas faltantes en hosting
  const missingTablesInRemote = local.tableNames.filter(t => !remote.tableNames.includes(t));
  console.log('\n❌ Tablas que están en Local pero FALTAN en Hosting:', missingTablesInRemote);

  // 2. Columnas faltantes por tabla en hosting
  const missingColsInRemote = [];

  for (const table of local.tableNames) {
    if (!remote.tableNames.includes(table)) continue;
    const localCols = local.schema[table];
    const remoteCols = remote.schema[table];
    const remoteColNames = remoteCols.map(c => c.Field);

    for (const lc of localCols) {
      if (!remoteColNames.includes(lc.Field)) {
        missingColsInRemote.push({
          table,
          column: lc.Field,
          type: lc.Type,
          null: lc.Null,
          default: lc.Default
        });
      }
    }
  }

  console.log(`\n❌ Columnas que están en Local pero FALTAN en Hosting: ${missingColsInRemote.length}`);
  if (missingColsInRemote.length > 0) {
    console.table(missingColsInRemote);
  }

  // 3. Crear tablas faltantes en Hosting si hubiera
  for (const table of missingTablesInRemote) {
    console.log(`🚀 Creando tabla faltante [${table}] en Hosting...`);
    const [createTable] = await localPool.query(`SHOW CREATE TABLE \`${table}\``);
    const createSql = Object.values(createTable[0])[1];
    await remotePool.query(createSql);
    console.log(`✅ Tabla [${table}] creada exitosamente en Hosting.`);
  }

  // 4. Crear columnas faltantes en Hosting si hubiera
  for (const item of missingColsInRemote) {
    console.log(`🚀 Agregando columna faltante [${item.table}.${item.column}] en Hosting...`);
    const nullStr = item.null === 'NO' ? 'NOT NULL' : 'NULL';
    const defStr = item.default !== null ? `DEFAULT '${item.default}'` : (item.null === 'YES' ? 'DEFAULT NULL' : '');
    const alterSql = `ALTER TABLE \`${item.table}\` ADD COLUMN \`${item.column}\` ${item.type} ${nullStr} ${defStr}`;
    try {
      await remotePool.query(alterSql);
      console.log(`✅ Columna [${item.table}.${item.column}] agregada en Hosting.`);
    } catch (e) {
      console.log(`⚠️ Error agregando columna ${item.table}.${item.column}:`, e.message);
    }
  }

  console.log('\n✨ Verificación y homologación de base de datos terminada.');

  await localPool.end();
  await remotePool.end();
}

main().catch(console.error);
