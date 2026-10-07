const mysql = require('mysql2/promise');

const localConfig = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: '',
  database: 'corporacioncespe_cespedes'
};

const prodConfig = {
  host: 'corporacioncespedes.com',
  port: 3306,
  user: 'corporacioncespe_miguel',
  password: 'corporacioncespe_123',
  database: 'corporacioncespe_cespedes',
  connectTimeout: 30000
};

async function auditAndSync() {
  console.log('🔍 Conectando a Local y Producción...');
  const localConn = await mysql.createConnection(localConfig);
  const prodConn = await mysql.createConnection(prodConfig);

  console.log('✅ Ambas conexiones establecidas con éxito.\n');

  // Obtener tablas de Local
  const [localTablesRows] = await localConn.query(
    'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?',
    [localConfig.database]
  );
  const localTables = localTablesRows.map(r => r.TABLE_NAME);

  // Obtener tablas de Producción
  const [prodTablesRows] = await prodConn.query(
    'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?',
    [prodConfig.database]
  );
  const prodTables = prodTablesRows.map(r => r.TABLE_NAME);

  console.log(`📊 Local: ${localTables.length} tablas | Producción: ${prodTables.length} tablas`);

  // 1. Tablas faltantes en Producción
  const missingTablesInProd = localTables.filter(t => !prodTables.includes(t));
  if (missingTablesInProd.length > 0) {
    console.log('\n⚠️ Tablas presentes en Local pero faltantes en Producción:', missingTablesInProd);
    for (const t of missingTablesInProd) {
      const [createRes] = await localConn.query(`SHOW CREATE TABLE \`${t}\``);
      const createSql = createRes[0]['Create Table'];
      console.log(`⚙️ Creando tabla [${t}] en Producción...`);
      await prodConn.query(createSql);
      console.log(`✅ Tabla [${t}] creada en Producción.`);
    }
  } else {
    console.log('✅ Todas las tablas de Local existen en Producción.');
  }

  // 2. Comparar columnas de cada tabla
  console.log('\n🔬 Comparando columnas tabla por tabla...');
  let totalMissingCols = 0;
  const synchronizedCols = [];

  for (const t of localTables) {
    const [localCols] = await localConn.query(
      'SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION',
      [localConfig.database, t]
    );

    const [prodCols] = await prodConn.query(
      'SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION',
      [prodConfig.database, t]
    );

    const prodColNames = prodCols.map(c => c.COLUMN_NAME);

    for (const lc of localCols) {
      if (!prodColNames.includes(lc.COLUMN_NAME)) {
        totalMissingCols++;
        console.log(`⚠️ Columna faltante en Producción -> Tabla: [${t}], Columna: [${lc.COLUMN_NAME}] (${lc.COLUMN_TYPE})`);
        
        // Construir sentencia ALTER TABLE ADD COLUMN
        let defStr = '';
        if (lc.COLUMN_DEFAULT !== null) {
          defStr = (typeof lc.COLUMN_DEFAULT === 'string' && lc.COLUMN_DEFAULT !== 'CURRENT_TIMESTAMP')
            ? `DEFAULT '${lc.COLUMN_DEFAULT}'`
            : `DEFAULT ${lc.COLUMN_DEFAULT}`;
        } else if (lc.IS_NULLABLE === 'YES') {
          defStr = 'DEFAULT NULL';
        }

        const nullability = lc.IS_NULLABLE === 'NO' ? 'NOT NULL' : 'NULL';
        const alterSql = `ALTER TABLE \`${t}\` ADD COLUMN \`${lc.COLUMN_NAME}\` ${lc.COLUMN_TYPE} ${nullability} ${defStr}`.trim();
        
        try {
          console.log(`  ⚙️ Ejecutando: ${alterSql}`);
          await prodConn.query(alterSql);
          console.log(`  ✅ Columna [${lc.COLUMN_NAME}] agregada exitosamente a [${t}] en Producción.`);
          synchronizedCols.push({ table: t, column: lc.COLUMN_NAME, type: lc.COLUMN_TYPE });
        } catch (alterErr) {
          console.error(`  ❌ Error agregando columna: ${alterErr.message}`);
        }
      }
    }
  }

  console.log('\n--------------------------------------------------');
  if (totalMissingCols === 0) {
    console.log('🎉 ¡EXCELENTE! Todas las tablas y columnas están 100% IDÉNTICAS entre Local y Producción.');
  } else {
    console.log(`🎉 ¡SINCRONIZACIÓN EXITOSA! Se sincronizaron ${synchronizedCols.length} columnas faltantes en Producción:`);
    console.table(synchronizedCols);
  }
  console.log('--------------------------------------------------');

  await localConn.end();
  await prodConn.end();
  process.exit(0);
}

auditAndSync().catch(err => {
  console.error('❌ Error fatal en auditoría de esquemas:', err);
  process.exit(1);
});
