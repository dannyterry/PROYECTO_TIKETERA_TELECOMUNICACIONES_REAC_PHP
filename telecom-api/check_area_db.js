const pool = require('./db.js');

async function main() {
  const [descAreas] = await pool.query("DESCRIBE areas");
  console.log("Columnas de areas:", descAreas);

  const [dataAreas] = await pool.query("SELECT * FROM areas");
  console.log("Datos de areas:", dataAreas);

  const [fks] = await pool.query(`
    SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE REFERENCED_TABLE_SCHEMA = 'corporacioncespe_cespedes' AND REFERENCED_TABLE_NAME = 'areas'
  `);
  console.log("FKs referencing areas:", fks);

  console.log("Sistema y base de datos verificados correctamente.");
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
