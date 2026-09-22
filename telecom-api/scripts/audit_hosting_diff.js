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

async function checkDiffs() {
  console.log('🔍 Conectando a Base de Datos Local y Hosting...');
  const localPool = mysql.createPool(localConfig);
  const remotePool = mysql.createPool(remoteConfig);

  const [localTablesRaw] = await localPool.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
  const localTables = localTablesRaw.map(t => Object.values(t)[0]);

  const [remoteTablesRaw] = await remotePool.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
  const remoteTables = remoteTablesRaw.map(t => Object.values(t)[0]);

  const missingInRemote = localTables.filter(t => !remoteTables.includes(t));
  const missingInLocal = remoteTables.filter(t => !localTables.includes(t));

  console.log('\n======================================================');
  console.log('📌 1. TABLAS NUEVAS EN LOCAL (FALTAN EN HOSTING / PRODUCCIÓN):');
  console.log('======================================================');
  if (missingInRemote.length > 0) {
    for (const t of missingInRemote) {
      const [[createRes]] = await localPool.query(`SHOW CREATE TABLE \`${t}\``);
      console.log(`\n--- TABLA: ${t} ---`);
      console.log(createRes['Create Table']);
    }
  } else {
    console.log('✅ Ninguna tabla falta en Hosting.');
  }

  console.log('\n======================================================');
  console.log('📌 2. TABLAS EN HOSTING QUE NO ESTÁN EN LOCAL:');
  console.log('======================================================');
  console.log(missingInLocal.length ? missingInLocal : '✅ Ninguna');

  console.log('\n======================================================');
  console.log('📌 3. COLUMNAS NUEVAS EN LOCAL (FALTAN EN HOSTING):');
  console.log('======================================================');
  const commonTables = localTables.filter(t => remoteTables.includes(t));
  const columnDiffs = [];
  const alterStatements = [];

  for (const table of commonTables) {
    const [localCols] = await localPool.query(`SHOW FULL COLUMNS FROM \`${table}\``);
    const [remoteCols] = await remotePool.query(`SHOW FULL COLUMNS FROM \`${table}\``);

    const remoteColMap = new Map(remoteCols.map(c => [c.Field, c]));
    for (const lc of localCols) {
      if (!remoteColMap.has(lc.Field)) {
        columnDiffs.push({
          tabla: table,
          columna: lc.Field,
          tipo: lc.Type,
          nulo: lc.Null === 'YES' ? 'NULL' : 'NOT NULL',
          defecto: lc.Default !== null ? lc.Default : (lc.Null === 'YES' ? 'NULL' : 'None'),
          extra: lc.Extra
        });

        let defaultClause = '';
        if (lc.Default !== null) {
          defaultClause = ` DEFAULT '${lc.Default}'`;
        } else if (lc.Null === 'YES') {
          defaultClause = ' DEFAULT NULL';
        }

        const nullClause = lc.Null === 'YES' ? 'NULL' : 'NOT NULL';
        alterStatements.push(`ALTER TABLE \`${table}\` ADD COLUMN \`${lc.Field}\` ${lc.Type} ${nullClause}${defaultClause};`);
      }
    }
  }

  if (columnDiffs.length > 0) {
    console.table(columnDiffs);
    console.log('\n📜 Sentencias SQL sugeridas para agregar las columnas faltantes en Hosting:');
    alterStatements.forEach(stmt => console.log(stmt));
  } else {
    console.log('✅ Todas las columnas coinciden entre Local y Hosting.');
  }

  console.log('\n======================================================');
  console.log('📌 4. REVISIÓN DE TRIGGERS / PROCEDIMIENTOS:');
  console.log('======================================================');
  const [localTriggers] = await localPool.query("SHOW TRIGGERS");
  const [remoteTriggers] = await remotePool.query("SHOW TRIGGERS");
  const localTriggerNames = localTriggers.map(t => t.Trigger);
  const remoteTriggerNames = remoteTriggers.map(t => t.Trigger);

  const missingTriggers = localTriggerNames.filter(t => !remoteTriggerNames.includes(t));
  if (missingTriggers.length > 0) {
    console.log('⚠️ Triggers presentes en Local pero NO en Hosting:', missingTriggers);
  } else {
    console.log('✅ Triggers sincronizados o no hay triggers faltantes.');
  }

  console.log('\n======================================================');
  console.log('📌 5. REVISIÓN DE VISTAS (VIEWS):');
  console.log('======================================================');
  const [localViewsRaw] = await localPool.query("SHOW FULL TABLES WHERE Table_type = 'VIEW'");
  const [remoteViewsRaw] = await remotePool.query("SHOW FULL TABLES WHERE Table_type = 'VIEW'");
  const localViews = localViewsRaw.map(t => Object.values(t)[0]);
  const remoteViews = remoteViewsRaw.map(t => Object.values(t)[0]);
  const missingViews = localViews.filter(v => !remoteViews.includes(v));
  if (missingViews.length > 0) {
    console.log('⚠️ Vistas presentes en Local pero NO en Hosting:', missingViews);
  } else {
    console.log('✅ Vistas sincronizadas.');
  }

  await localPool.end();
  await remotePool.end();
  process.exit(0);
}

checkDiffs().catch(e => {
  console.error('Error durante la auditoría:', e);
  process.exit(1);
});
