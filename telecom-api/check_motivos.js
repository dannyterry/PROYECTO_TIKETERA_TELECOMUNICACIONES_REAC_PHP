const pool = require('./db');

async function main() {
  const [sample] = await pool.query(`
    SELECT id_orden, numero, tipo_trabajo, tipo_trabajo_asignado, motivo_finalizacion, motivo_cancelacion, motivo_trabajo, motivo_regestion, motivo_anulacion
    FROM ordenes
    WHERE (motivo_finalizacion IS NOT NULL AND motivo_finalizacion != '')
       OR (motivo_cancelacion IS NOT NULL AND motivo_cancelacion != '')
    ORDER BY id_orden DESC
    LIMIT 10
  `);
  console.log('Sample rows:');
  console.log(sample);
  process.exit();
}

main();
