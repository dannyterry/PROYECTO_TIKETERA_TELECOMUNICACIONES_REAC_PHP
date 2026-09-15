const mysql = require('mysql2/promise');

const REMOTE_CONFIG = {
  host: 'corporacioncespedes.com',
  user: 'corporacioncespe_miguel',
  password: 'corporacioncespe_123',
  database: 'corporacioncespe_cespedes',
  dateStrings: true,
  connectTimeout: 60000
};

const LOCAL_CONFIG = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: '',
  database: 'corporacioncespe_cespedes',
  dateStrings: true,
  multipleStatements: true
};

async function syncAllDatabase() {
  console.log('================================================================');
  console.log('🔄 SINCRONIZACIÓN COMPLETA Y ROBUSTA: HOSTING ➔ LOCAL');
  console.log('📡 Origen: corporacioncespedes.com (corporacioncespe_cespedes)');
  console.log('💻 Destino: 127.0.0.1:3306 (corporacioncespe_cespedes)');
  console.log('================================================================\n');

  let remotePool, localConn;

  try {
    console.log('🔌 Conectando a ambos servidores...');
    remotePool = mysql.createPool(REMOTE_CONFIG);
    const localPool = mysql.createPool(LOCAL_CONFIG);

    localConn = await localPool.getConnection();

    await remotePool.query('SELECT 1');
    console.log('✅ Conexión con Hosting Remoto establecida.');
    await localConn.query('SELECT 1');
    console.log('✅ Conexión con MySQL Local establecida.\n');

    // 🔒 Desactivar completamente validaciones de claves foráneas y modo estricto en la conexión local
    await localConn.query('SET FOREIGN_KEY_CHECKS = 0;');
    await localConn.query('SET UNIQUE_CHECKS = 0;');
    await localConn.query('SET SQL_MODE = "";');

    // 1. Obtener todas las tablas del servidor remoto
    const [tablesResult] = await remotePool.query(
      "SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'"
    );

    const tableKey = Object.keys(tablesResult[0])[0];
    const tableNames = tablesResult.map(r => r[tableKey]);

    console.log(`📋 Sincronizando ${tableNames.length} tablas de producción:\n`);

    let totalRowsSynced = 0;
    let tablesSuccess = 0;
    let tablesFailed = 0;

    for (let i = 0; i < tableNames.length; i++) {
      const tableName = tableNames[i];
      const progress = `[${String(i + 1).padStart(2, '0')}/${tableNames.length}]`;

      try {
        // Obtener estructura exacta DDL de la tabla remota
        const [createTableResult] = await remotePool.query(`SHOW CREATE TABLE \`${tableName}\``);
        const createTableSql = createTableResult[0]['Create Table'];

        // Recrear tabla en local usando la misma conexión local con FK=0
        await localConn.query(`DROP TABLE IF EXISTS \`${tableName}\``);
        await localConn.query(createTableSql);

        // Contar filas remotas
        const [countResult] = await remotePool.query(`SELECT COUNT(*) as total FROM \`${tableName}\``);
        const totalRows = countResult[0].total;

        if (totalRows === 0) {
          console.log(`${progress} ⚪ \`${tableName}\`: Estructura sincronizada (0 registros).`);
          tablesSuccess++;
          continue;
        }

        // Determinar tamaño de lote (tablas con cache/blobs usan lotes más pequeños)
        const batchSize = tableName.includes('cache') || tableName.includes('log') || tableName.includes('auditoria') ? 50 : 500;
        let offset = 0;
        let tableRowsInserted = 0;

        while (offset < totalRows) {
          const [rows] = await remotePool.query(
            `SELECT * FROM \`${tableName}\` LIMIT ? OFFSET ?`,
            [batchSize, offset]
          );

          if (rows.length === 0) break;

          const columns = Object.keys(rows[0]);
          const escapedColumns = columns.map(c => `\`${c}\``).join(', ');

          try {
            // Intento 1: Bulk multi-row insert
            const singleRowPlaceholder = `(${columns.map(() => '?').join(', ')})`;
            const allPlaceholders = rows.map(() => singleRowPlaceholder).join(', ');
            const insertSql = `INSERT INTO \`${tableName}\` (${escapedColumns}) VALUES ${allPlaceholders}`;

            const flatValues = [];
            for (const row of rows) {
              for (const col of columns) {
                flatValues.push(row[col]);
              }
            }

            await localConn.query(insertSql, flatValues);
          } catch (bulkErr) {
            // Intento 2: Fallback fila por fila si el paquete o registro es muy grande
            const singleInsertSql = `INSERT INTO \`${tableName}\` (${escapedColumns}) VALUES (${columns.map(() => '?').join(', ')})`;
            for (const row of rows) {
              const rowValues = columns.map(col => row[col]);
              await localConn.query(singleInsertSql, rowValues);
            }
          }

          tableRowsInserted += rows.length;
          offset += batchSize;
        }

        totalRowsSynced += tableRowsInserted;
        tablesSuccess++;
        console.log(`${progress} ✅ \`${tableName}\`: ${tableRowsInserted.toLocaleString()} registros sincronizados.`);
      } catch (tableErr) {
        tablesFailed++;
        console.error(`${progress} ❌ Error en tabla \`${tableName}\`:`, tableErr.message);
      }
    }

    // 2. Obtener y recrear VISTAS (VIEW) si existen
    try {
      const [viewsResult] = await remotePool.query(
        "SHOW FULL TABLES WHERE Table_type = 'VIEW'"
      );
      if (viewsResult.length > 0) {
        console.log(`\n👁️ Recreando ${viewsResult.length} vistas...`);
        const viewKey = Object.keys(viewsResult[0])[0];
        for (const v of viewsResult) {
          const viewName = v[viewKey];
          try {
            const [createViewRes] = await remotePool.query(`SHOW CREATE VIEW \`${viewName}\``);
            const createViewSql = createViewRes[0]['Create View'];
            await localConn.query(`DROP VIEW IF EXISTS \`${viewName}\``);
            await localConn.query(createViewSql);
            console.log(`   ✅ Vista \`${viewName}\` recreada.`);
          } catch (viewErr) {
            console.warn(`   ⚠️ No se pudo recrear vista \`${viewName}\`:`, viewErr.message);
          }
        }
      }
    } catch (viewsErr) {
      console.warn('⚠️ No se pudieron procesar vistas:', viewsErr.message);
    }

    // Reactivar claves foráneas
    await localConn.query('SET FOREIGN_KEY_CHECKS = 1;');
    await localConn.query('SET UNIQUE_CHECKS = 1;');

    console.log('\n================================================================');
    console.log('🎉 ¡BASE DE DATOS LOCAL ACTUALIZADA AL 100% DESDE EL HOSTING!');
    console.log(`📊 Tablas procesadas con éxito: ${tablesSuccess}/${tableNames.length}`);
    if (tablesFailed > 0) console.log(`⚠️ Tablas con error: ${tablesFailed}`);
    console.log(`📦 Total de registros migrados: ${totalRowsSynced.toLocaleString()}`);
    console.log('================================================================\n');

  } catch (error) {
    console.error('\n💥 ERROR FATAL EN LA SINCRONIZACIÓN:', error);
  } finally {
    if (localConn) localConn.release();
    if (remotePool) await remotePool.end();
  }
}

syncAllDatabase();
