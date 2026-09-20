const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// ============================================================
// CONFIGURACIONES
// ============================================================
const prodConfig = {
  host: 'corporacioncespedes.com',
  port: 3306,
  user: 'corporacioncespe_miguel',
  password: 'corporacioncespe_123',
  database: 'corporacioncespe_cespedes',
  dateStrings: true,
  connectTimeout: 60000
};

const localConfig = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: '',
  dateStrings: true,
  multipleStatements: true,
  connectTimeout: 30000
};

async function syncProductionToLocal() {
  console.log('===============================================================');
  console.log('🚀 INICIANDO DESCARGA Y SINCRONIZACIÓN DE DATOS DESDE PRODUCCIÓN');
  console.log('🛡️ Producción solo se leerá con SELECT (No se modifica nada en el servidor)');
  console.log('===============================================================');

  let prodConn, localConn;

  try {
    console.log('\n📡 Conectando a Producción (corporacioncespedes.com)...');
    prodConn = await mysql.createConnection(prodConfig);
    console.log('✅ Conexión con Producción establecida exitosamente.');

    console.log('💻 Conectando a MySQL Local (XAMPP 127.0.0.1)...');
    localConn = await mysql.createConnection(localConfig);
    console.log('✅ Conexión con Local establecida exitosamente.');

    // 1. Preparar base de datos local
    console.log('\n🔄 Preparando base de datos local `corporacioncespe_cespedes`...');
    await localConn.query('CREATE DATABASE IF NOT EXISTS `corporacioncespe_cespedes` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci');
    await localConn.changeUser({ database: 'corporacioncespe_cespedes' });

    await localConn.query('SET FOREIGN_KEY_CHECKS = 0');
    await localConn.query("SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO'");

    // 2. Obtener lista de tablas
    const [tables] = await prodConn.query('SHOW FULL TABLES WHERE Table_type = "BASE TABLE"');
    const tableKey = Object.keys(tables[0])[0];
    const tableNames = tables.map(t => t[tableKey]);

    console.log(`📋 Total de tablas a procesar: ${tableNames.length}`);

    // Crear directorio de backup local
    const backupDir = path.join(__dirname, '..', 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const dumpFileName = path.join(backupDir, `backup_prod_${new Date().toISOString().slice(0, 10)}.sql`);
    const dumpStream = fs.createWriteStream(dumpFileName, { encoding: 'utf8' });
    dumpStream.write(`-- BACKUP DESCARGADO DE PRODUCCION ${new Date().toLocaleString()}\nSET FOREIGN_KEY_CHECKS = 0;\n\n`);

    for (let i = 0; i < tableNames.length; i++) {
      const tableName = tableNames[i];
      const percent = Math.round(((i + 1) / tableNames.length) * 100);

      // 2.1 Obtener DDL (CREATE TABLE)
      const [createResult] = await prodConn.query(`SHOW CREATE TABLE \`${tableName}\``);
      let createTableSql = createResult[0]['Create Table'];

      // Normalizar collations de MySQL 8.0 a compatibilidad MariaDB / MySQL 5.7/8.0 local
      createTableSql = createTableSql.replace(/utf8mb4_0900_ai_ci/g, 'utf8mb4_general_ci');

      // Recrear tabla en local
      await localConn.query(`DROP TABLE IF EXISTS \`${tableName}\``);
      await localConn.query(createTableSql);

      dumpStream.write(`DROP TABLE IF EXISTS \`${tableName}\`;\n${createTableSql};\n\n`);

      // 2.2 Obtener conteo de registros para paginar
      const [countRes] = await prodConn.query(`SELECT COUNT(*) as total FROM \`${tableName}\``);
      const totalRows = countRes[0].total;

      console.log(`⏳ [${percent}%] (${i + 1}/${tableNames.length}) Sincronizando ${tableName} (${totalRows} filas)...`);

      if (totalRows > 0) {
        // Para tablas con columnas pesadas como LONGTEXT o JSON grande, usamos batch unitario o pequeño
        const isHeavyTable = tableName === 'orden_tareas_cache';
        const PAGE_SIZE = isHeavyTable ? 10 : 250;
        let offset = 0;

        while (offset < totalRows) {
          const [rows] = await prodConn.query(`SELECT * FROM \`${tableName}\` LIMIT ${PAGE_SIZE} OFFSET ${offset}`);
          if (rows.length === 0) break;

          const columns = Object.keys(rows[0]).map(c => `\`${c}\``).join(', ');

          if (isHeavyTable) {
            // Inserción individual fila a fila para evitar sobrecarga de socket en tablas de megabytes por fila
            for (const row of rows) {
              const placeholders = `(${Object.keys(row).map(() => '?').join(', ')})`;
              await localConn.query(`INSERT INTO \`${tableName}\` (${columns}) VALUES ${placeholders}`, Object.values(row));
            }
          } else {
            const placeholders = rows.map(() => `(${Object.keys(rows[0]).map(() => '?').join(', ')})`).join(', ');
            const flatValues = rows.map(r => Object.values(r)).flat();
            await localConn.query(`INSERT INTO \`${tableName}\` (${columns}) VALUES ${placeholders}`, flatValues);
          }

          offset += rows.length;
        }
      }
    }

    console.log('\n🔒 Reactivando comprobaciones en base de datos local...');
    await localConn.query('SET FOREIGN_KEY_CHECKS = 1');
    dumpStream.write('SET FOREIGN_KEY_CHECKS = 1;\n');
    dumpStream.end();

    console.log('===============================================================');
    console.log('🎉 ¡DESCARGA Y ACTUALIZACIÓN LOCAL COMPLETADA EXITOSAMENTE!');
    console.log(`📁 Respaldo guardado en: ${dumpFileName}`);
    console.log('✅ Tu MySQL local (XAMPP) ahora tiene toda la data de producción.');
    console.log('🛡️ Producción nunca fue alterada.');
    console.log('===============================================================');

  } catch (error) {
    console.error('\n❌ ERROR DURANTE LA SINCRONIZACIÓN:', error);
  } finally {
    if (prodConn) await prodConn.end();
    if (localConn) await localConn.end();
  }
}

syncProductionToLocal();
