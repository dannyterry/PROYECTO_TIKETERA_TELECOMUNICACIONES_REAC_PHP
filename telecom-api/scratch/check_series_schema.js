const pool = require('../db');

(async () => {
  const [psCols] = await pool.query(`DESCRIBE producto_series`);
  console.log('Columns of producto_series:');
  console.table(psCols);

  const [tsCols] = await pool.query(`DESCRIBE trabajador_series`);
  console.log('Columns of trabajador_series:');
  console.table(tsCols);

  process.exit();
})();
