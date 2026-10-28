const mysql = require('mysql2/promise');

const REMOTE_CONFIG = {
  host: 'corporacioncespedes.com',
  user: 'corporacioncespe_miguel',
  password: 'corporacioncespe_123',
  database: 'corporacioncespe_cespedes',
  connectTimeout: 30000
};

const LOCAL_CONFIG = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: '',
  database: 'corporacioncespe_cespedes',
  connectTimeout: 30000
};

async function compareDatabases() {
  console.log('🔍 Conectando a BD Local y BD Producción...');
  let localConn, remoteConn;
  try {
    localConn = await mysql.createConnection(LOCAL_CONFIG);
    console.log('✅ Conectado a Local (127.0.0.1)');
  } catch (e) {
    console.error('❌ Error conectando a Local:', e.message);
    return;
  }

  try {
    remoteConn = await mysql.createConnection(REMOTE_CONFIG);
    console.log('✅ Conectado a Producción (corporacioncespedes.com)');
  } catch (e) {
    console.error('❌ Error conectando a Producción:', e.message);
    if (localConn) await localConn.end();
    return;
  }

  try {
    // 1. Obtener tablas de ambas bases de datos
    const [localTablesRows] = await localConn.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = 'corporacioncespe_cespedes' AND TABLE_TYPE = 'BASE TABLE'
    `);
    const localTables = new Set(localTablesRows.map(r => r.TABLE_NAME));

    const [remoteTablesRows] = await remoteConn.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = 'corporacioncespe_cespedes' AND TABLE_TYPE = 'BASE TABLE'
    `);
    const remoteTables = new Set(remoteTablesRows.map(r => r.TABLE_NAME));

    console.log(`\n📊 Tablas en Local: ${localTables.size} | Tablas en Producción: ${remoteTables.size}`);

    // Tablas que faltan en producción
    const missingTablesInProd = [...localTables].filter(t => !remoteTables.has(t));
    // Tablas que solo están en producción
    const onlyInProd = [...remoteTables].filter(t => !localTables.has(t));

    if (missingTablesInProd.length > 0) {
      console.log('\n⚠️ TABLAS PRESENTES EN LOCAL PERO FALTANTES EN PRODUCCIÓN:');
      missingTablesInProd.forEach(t => console.log(`  - ❌ ${t}`));
    } else {
      console.log('\n✅ Todas las tablas locales existen en Producción.');
    }

    if (onlyInProd.length > 0) {
      console.log('\nℹ️ Tablas en Producción que no están en Local (informativo):');
      onlyInProd.forEach(t => console.log(`  - ${t}`));
    }

    // 2. Comparar columnas en tablas comunes
    console.log('\n🔍 Comparando columnas en tablas comunes...');
    const [localColsRows] = await localConn.query(`
      SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = 'corporacioncespe_cespedes'
      ORDER BY TABLE_NAME, ORDINAL_POSITION
    `);

    const [remoteColsRows] = await remoteConn.query(`
      SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = 'corporacioncespe_cespedes'
      ORDER BY TABLE_NAME, ORDINAL_POSITION
    `);

    const remoteColsMap = new Map();
    remoteColsRows.forEach(c => {
      const key = `${c.TABLE_NAME}.${c.COLUMN_NAME}`.toLowerCase();
      remoteColsMap.set(key, c);
    });

    const localColsMap = new Map();
    localColsRows.forEach(c => {
      const key = `${c.TABLE_NAME}.${c.COLUMN_NAME}`.toLowerCase();
      localColsMap.set(key, c);
    });

    const missingColsInProd = [];
    localColsRows.forEach(c => {
      if (remoteTables.has(c.TABLE_NAME)) {
        const key = `${c.TABLE_NAME}.${c.COLUMN_NAME}`.toLowerCase();
        if (!remoteColsMap.has(key)) {
          missingColsInProd.push(c);
        }
      }
    });

    if (missingColsInProd.length > 0) {
      console.log(`\n⚠️ COLUMNAS QUE EXISTEN EN LOCAL PERO FALTAN EN PRODUCCIÓN (${missingColsInProd.length}):`);
      missingColsInProd.forEach(c => {
        console.log(`  - ❌ Tabla '${c.TABLE_NAME}': Columna '${c.COLUMN_NAME}' (${c.COLUMN_TYPE})`);
      });
    } else {
      console.log('\n✅ Todas las columnas de las tablas locales existen en Producción.');
    }

    // Retornar detalle
    return {
      missingTablesInProd,
      missingColsInProd
    };

  } finally {
    if (localConn) await localConn.end();
    if (remoteConn) await remoteConn.end();
  }
}

compareDatabases();

