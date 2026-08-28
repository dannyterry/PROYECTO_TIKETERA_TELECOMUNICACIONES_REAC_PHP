const pool = require('./db');
const fs = require('fs');
const path = require('path');

async function exportCleanOrdenes() {
  const connection = await pool.getConnection();
  try {
    console.log("Exportando tabla ordenes limpia para cPanel...");

    const [createTableRows] = await connection.query("SHOW CREATE TABLE `ordenes`");
    const createTableSql = createTableRows[0]['Create Table'];

    const [rows] = await connection.query("SELECT * FROM `ordenes`");
    console.log(`Total de filas a exportar: ${rows.length}`);

    let sql = "";
    sql += "-- Exportación limpia de la tabla `ordenes` para Producción (cPanel)\n";
    sql += "SET FOREIGN_KEY_CHECKS = 0;\n";
    sql += "SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';\n";
    sql += "SET time_zone = '+00:00';\n\n";

    sql += "DROP TABLE IF EXISTS `ordenes`;\n\n";
    sql += createTableSql + ";\n\n";

    if (rows.length > 0) {
      const columns = Object.keys(rows[0]).map(c => `\`${c}\``).join(', ');
      
      const batchSize = 100;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const valuesList = batch.map(row => {
          const vals = Object.values(row).map(val => {
            if (val === null || val === undefined) return "NULL";
            if (typeof val === 'number') return val;
            if (typeof val === 'boolean') return val ? 1 : 0;
            if (val instanceof Date) {
              return connection.escape(val.toISOString().slice(0, 19).replace('T', ' '));
            }
            return connection.escape(String(val));
          });
          return `(${vals.join(', ')})`;
        });

        sql += `INSERT INTO \`ordenes\` (${columns}) VALUES\n${valuesList.join(',\n')};\n\n`;
      }
    }

    sql += "SET FOREIGN_KEY_CHECKS = 1;\n";

    const targetPath = path.join(__dirname, '..', 'ordenes_para_hosting.sql');
    fs.writeFileSync(targetPath, sql, 'utf8');
    console.log(`✅ Archivo exportado exitosamente en: ${targetPath}`);
  } catch (error) {
    console.error("Error al exportar:", error);
  } finally {
    connection.release();
    process.exit(0);
  }
}

exportCleanOrdenes();
