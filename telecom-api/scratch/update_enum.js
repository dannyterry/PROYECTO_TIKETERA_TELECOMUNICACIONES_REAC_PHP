const pool = require('../db');

async function updateEnum() {
  await pool.query("ALTER TABLE supervision_campo MODIFY COLUMN estado_operativo enum('EN_CAMINO','INICIADA','FINALIZADA','CANCELADA') DEFAULT 'INICIADA'");
  console.log('ENUM estado_operativo modificado con éxito incluyendo CANCELADA');
  process.exit(0);
}

updateEnum().catch(e => {
  console.error(e);
  process.exit(1);
});
