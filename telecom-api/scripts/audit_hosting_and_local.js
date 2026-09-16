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

async function getTablesAndColumns(pool, label) {
  console.log(`\n🔍 Obteniendo estructura de [${label}]...`);
  const [tables] = await pool.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
  const tableNames = tables.map(t => Object.values(t)[0]);
  
  const schema = {};
  for (const table of tableNames) {
    const [cols] = await pool.query(`SHOW FULL COLUMNS FROM \`${table}\``);
    schema[table] = cols.map(c => ({
      Field: c.Field,
      Type: c.Type,
      Null: c.Null,
      Key: c.Key,
      Default: c.Default,
      Extra: c.Extra
    }));
  }
  return { tableNames, schema };
}

async function audit() {
  console.log("🚀 Iniciando auditoría y comparación Local vs Hosting...");
  
  let localPool, remotePool;
  try {
    localPool = mysql.createPool(localConfig);
    const [localTest] = await localPool.query("SELECT DATABASE() as db");
    console.log(`✅ Conexión Local OK: ${localTest[0].db}`);
  } catch (err) {
    console.error("❌ Error conectando a Local:", err.message);
    process.exit(1);
  }

  try {
    remotePool = mysql.createPool(remoteConfig);
    const [remoteTest] = await remotePool.query("SELECT DATABASE() as db");
    console.log(`✅ Conexión Hosting (Producción) OK: ${remoteTest[0].db}`);
  } catch (err) {
    console.error("❌ Error conectando a Hosting:", err.message);
    process.exit(1);
  }

  const localData = await getTablesAndColumns(localPool, "LOCAL (Desarrollo)");
  const remoteData = await getTablesAndColumns(remotePool, "HOSTING (Producción)");

  console.log("\n=======================================================");
  console.log("📊 1. COMPARACIÓN DE TABLAS");
  console.log("=======================================================");
  console.log(`Total tablas Local: ${localData.tableNames.length}`);
  console.log(`Total tablas Hosting: ${remoteData.tableNames.length}`);

  const missingTablesInRemote = localData.tableNames.filter(t => !remoteData.tableNames.includes(t));
  const missingTablesInLocal = remoteData.tableNames.filter(t => !localData.tableNames.includes(t));

  if (missingTablesInRemote.length > 0) {
    console.log(`⚠️ Tablas que existen en LOCAL pero FALTAN en HOSTING:`, missingTablesInRemote);
  } else {
    console.log(`✅ Todas las tablas de Local existen en Hosting.`);
  }

  if (missingTablesInLocal.length > 0) {
    console.log(`ℹ️ Tablas que existen en HOSTING pero no en LOCAL:`, missingTablesInLocal);
  }

  console.log("\n=======================================================");
  console.log("📊 2. COMPARACIÓN DE COLUMNAS POR TABLA");
  console.log("=======================================================");
  const missingColumnsInRemote = [];
  const typeDifferences = [];

  for (const table of localData.tableNames) {
    if (!remoteData.schema[table]) continue;

    const localCols = localData.schema[table];
    const remoteCols = remoteData.schema[table];
    const remoteColMap = new Map(remoteCols.map(c => [c.Field.toLowerCase(), c]));

    for (const lCol of localCols) {
      const rCol = remoteColMap.get(lCol.Field.toLowerCase());
      if (!rCol) {
        missingColumnsInRemote.push({
          table,
          column: lCol.Field,
          type: lCol.Type,
          nullable: lCol.Null,
          default: lCol.Default
        });
      } else {
        // Verificar si los tipos difieren de forma relevante
        const lType = lCol.Type.toLowerCase();
        const rType = rCol.Type.toLowerCase();
        if (lType !== rType) {
          typeDifferences.push({
            table,
            column: lCol.Field,
            localType: lCol.Type,
            remoteType: rCol.Type
          });
        }
      }
    }
  }

  if (missingColumnsInRemote.length > 0) {
    console.log(`⚠️ Columnas que existen en LOCAL pero FALTAN en HOSTING (${missingColumnsInRemote.length}):`);
    console.table(missingColumnsInRemote);
  } else {
    console.log(`✅ Todas las columnas de Local existen en Hosting.`);
  }

  if (typeDifferences.length > 0) {
    console.log(`ℹ️ Diferencias de tipo/longitud en columnas (${typeDifferences.length}):`);
    console.table(typeDifferences);
  }

  console.log("\n=======================================================");
  console.log("📊 3. ANÁLISIS DE COLUMNAS EN TABLA 'ordenes'");
  console.log("=======================================================");
  
  // Revisar distribución de tipo_trabajo en Hosting vs Local
  const [localDistrib] = await localPool.query(`
    SELECT tipo_trabajo, COUNT(*) as cantidad 
    FROM ordenes 
    GROUP BY tipo_trabajo 
    ORDER BY cantidad DESC 
    LIMIT 15
  `);
  console.log("🟢 Distribución 'tipo_trabajo' en LOCAL (Top 15):");
  console.table(localDistrib);

  const [remoteDistrib] = await remotePool.query(`
    SELECT tipo_trabajo, COUNT(*) as cantidad 
    FROM ordenes 
    GROUP BY tipo_trabajo 
    ORDER BY cantidad DESC 
    LIMIT 15
  `);
  console.log("🔴 Distribución 'tipo_trabajo' en HOSTING (Top 15):");
  console.table(remoteDistrib);

  // Revisar motivos en Hosting
  const [remoteMotivos] = await remotePool.query(`
    SELECT id_motivo, nombre, tipo_trabajo, estado FROM motivos LIMIT 10
  `);
  console.log(`📌 Muestra de tabla 'motivos' en HOSTING:`);
  console.table(remoteMotivos);

  // Revisar si en hosting hay registros donde motivo_finalizacion tenga match con motivos
  const [mismatchCheck] = await remotePool.query(`
    SELECT COUNT(*) as total_finalizadas,
           SUM(CASE WHEN tipo_trabajo IS NULL OR tipo_trabajo = '' THEN 1 ELSE 0 END) as sin_tipo,
           SUM(CASE WHEN motivo_finalizacion IS NOT NULL AND motivo_finalizacion != '' THEN 1 ELSE 0 END) as con_motivo_fin
    FROM ordenes
    WHERE estado LIKE '%finaliz%' OR estado LIKE '%liquid%' OR estado LIKE '%termin%' OR estado LIKE '%cerrad%'
  `);
  console.log("📌 Estadísticas de órdenes finalizadas en HOSTING:");
  console.table(mismatchCheck);

  await localPool.end();
  await remotePool.end();
  console.log("\n🏁 Auditoría completada.");
}

audit().catch(err => {
  console.error("Error en auditoría:", err);
  process.exit(1);
});
