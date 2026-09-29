const pool = require('../db');

(async () => {
  console.log('=== BUSCANDO SUPERVICION EN TODAS LAS TABLAS ===');
  const [tables] = await pool.query(`
    SELECT TABLE_NAME, COLUMN_NAME 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'corporacioncespe_cespedes' 
      AND DATA_TYPE IN ('varchar', 'text', 'char', 'enum')
  `);

  for (const col of tables) {
    try {
      const [rows] = await pool.query(
        `SELECT COUNT(*) as count FROM \`${col.TABLE_NAME}\` WHERE \`${col.COLUMN_NAME}\` LIKE '%SUPERVIC%'`
      );
      if (rows[0].count > 0) {
        console.log(`Encontrado en tabla "${col.TABLE_NAME}", columna "${col.COLUMN_NAME}": ${rows[0].count} registros`);
      }
    } catch (e) {
      // ignore
    }
  }

  process.exit();
})();
