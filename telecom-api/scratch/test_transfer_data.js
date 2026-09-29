const pool = require('../db');

(async () => {
  const [rows] = await pool.query(`
    SELECT * FROM trabajador_series WHERE id_trabajador = 75 AND estado = 'Asignada' LIMIT 3
  `);
  console.log('Series de Klinder:', rows);
  process.exit();
})();
