const db = require('./telecom-api/db');

async function searchActa() {
  const searchTerm = '044827';
  const searchTermShort = '44827';
  console.log(`Buscando acta con número "${searchTerm}" o "${searchTermShort}"...`);

  const [tables] = await db.query('SHOW TABLES');
  const tableKey = Object.keys(tables[0])[0];

  for (const row of tables) {
    const tableName = row[tableKey];
    try {
      const [columns] = await db.query(`DESCRIBE \`${tableName}\``);
      const textCols = columns.filter(c => 
        c.Type.includes('varchar') || 
        c.Type.includes('text') || 
        c.Type.includes('char') || 
        c.Type.includes('int')
      ).map(c => c.Field);

      if (textCols.length === 0) continue;

      // Check if any column contains 'acta'
      const actaCols = textCols.filter(c => c.toLowerCase().includes('acta') || c.toLowerCase().includes('numero'));

      const colsToSearch = actaCols.length > 0 ? actaCols : textCols;

      for (const col of colsToSearch) {
        const [matches] = await db.query(
          `SELECT * FROM \`${tableName}\` WHERE \`${col}\` LIKE ? OR \`${col}\` LIKE ? LIMIT 10`,
          [`%${searchTerm}%`, `%${searchTermShort}%`]
        );

        if (matches.length > 0) {
          console.log(`\n========================================`);
          console.log(`🎯 ENCONTRADO EN TABLA: "${tableName}", COLUMNA: "${col}"`);
          console.log(`Registros encontrados (${matches.length}):`);
          console.log(JSON.stringify(matches, null, 2));
          console.log(`========================================\n`);
        }
      }
    } catch (e) {
      // Ignore errors for views or permission
    }
  }

  process.exit(0);
}

searchActa().catch(e => {
  console.error(e);
  process.exit(1);
});
