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

async function deepAudit() {
  const localPool = mysql.createPool(localConfig);
  const remotePool = mysql.createPool(remoteConfig);

  console.log('=== AUDITORÍA DETALLADA: LOCAL VS HOSTING (PRODUCCIÓN) ===\n');

  // 1. Tablas
  const [localTablesRaw] = await localPool.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
  const localTables = localTablesRaw.map(t => Object.values(t)[0]);

  const [remoteTablesRaw] = await remotePool.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
  const remoteTables = remoteTablesRaw.map(t => Object.values(t)[0]);

  const missingTablesInRemote = localTables.filter(t => !remoteTables.includes(t));
  console.log('1️⃣ TABLAS NUEVAS QUE DEBEN CREARSE EN HOSTING:');
  if (missingTablesInRemote.length > 0) {
    missingTablesInRemote.forEach(t => console.log(`   ➕ ${t}`));
  } else {
    console.log('   ✅ Ninguna tabla nueva pendiente.');
  }

  // 2. Columnas faltantes
  console.log('\n2️⃣ COLUMNAS NUEVAS QUE DEBEN AGREGARSE EN HOSTING:');
  const commonTables = localTables.filter(t => remoteTables.includes(t));
  const missingCols = [];

  for (const table of commonTables) {
    const [localCols] = await localPool.query(`SHOW FULL COLUMNS FROM \`${table}\``);
    const [remoteCols] = await remotePool.query(`SHOW FULL COLUMNS FROM \`${table}\``);

    const remoteColMap = new Map(remoteCols.map(c => [c.Field, c]));
    for (const lc of localCols) {
      if (!remoteColMap.has(lc.Field)) {
        let def = '';
        if (lc.Default !== null) {
          def = ` DEFAULT '${lc.Default}'`;
        } else if (lc.Null === 'YES') {
          def = ' DEFAULT NULL';
        }
        const nullClause = lc.Null === 'YES' ? 'NULL' : 'NOT NULL';
        const extra = lc.Extra ? ` ${lc.Extra}` : '';
        const sql = `ALTER TABLE \`${table}\` ADD COLUMN \`${lc.Field}\` ${lc.Type} ${nullClause}${def}${extra};`;
        missingCols.push({ table, column: lc.Field, type: lc.Type, sql });
      }
    }
  }

  if (missingCols.length > 0) {
    missingCols.forEach(mc => {
      console.log(`   ➕ Tabla \`${mc.table}\` -> Columna \`${mc.column}\` (${mc.type})`);
      console.log(`      SQL: ${mc.sql}`);
    });
  } else {
    console.log('   ✅ No faltan columnas en ninguna tabla existente.');
  }

  // 3. Revisión de Índices
  console.log('\n3️⃣ ÍNDICES FALTANTES EN HOSTING:');
  let missingIndexCount = 0;
  for (const table of commonTables) {
    const [localIdx] = await localPool.query(`SHOW INDEX FROM \`${table}\``);
    const [remoteIdx] = await remotePool.query(`SHOW INDEX FROM \`${table}\``);

    const remoteIdxNames = new Set(remoteIdx.map(i => i.Key_name));
    const localUniqueIdx = Array.from(new Set(localIdx.map(i => i.Key_name)));

    for (const idxName of localUniqueIdx) {
      if (idxName !== 'PRIMARY' && !remoteIdxNames.has(idxName)) {
        const idxCols = localIdx.filter(i => i.Key_name === idxName).map(i => `\`${i.Column_name}\``).join(', ');
        const isUnique = localIdx.find(i => i.Key_name === idxName)?.Non_unique === 0;
        const sql = `ALTER TABLE \`${table}\` ADD ${isUnique ? 'UNIQUE ' : ''}INDEX \`${idxName}\` (${idxCols});`;
        console.log(`   ➕ Tabla \`${table}\` -> Índice \`${idxName}\` (${idxCols})`);
        console.log(`      SQL: ${sql}`);
        missingIndexCount++;
      }
    }
  }
  if (missingIndexCount === 0) {
    console.log('   ✅ Todos los índices están presentes en Hosting.');
  }

  // 4. Datos de referencia indispensables (ej. categorías, etc.)
  console.log('\n4️⃣ CATEGORÍAS EN PRODUCCIÓN / HOSTING:');
  const [remoteCats] = await remotePool.query('SELECT id_categoria, nombre, estado FROM categorias ORDER BY id_categoria');
  console.table(remoteCats);

  await localPool.end();
  await remotePool.end();
  process.exit(0);
}

deepAudit().catch(e => {
  console.error(e);
  process.exit(1);
});
