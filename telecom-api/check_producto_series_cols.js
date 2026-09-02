const pool = require('./db.js');

async function checkProductoSeriesColumns() {
  const [cols] = await pool.query("SHOW COLUMNS FROM producto_series");
  console.log("Columnas actuales en producto_series:");
  console.table(cols);

  const [sampleRows] = await pool.query("SELECT * FROM producto_series LIMIT 5");
  console.log("Muestra de filas en producto_series:");
  console.table(sampleRows);

  process.exit(0);
}

checkProductoSeriesColumns().catch(console.error);
