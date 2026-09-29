const pool = require('../db');
const { sincronizarFenix } = require('../services/fenixScraper');

async function testFinalRules() {
  console.log("🔍 Verificando estados de órdenes de prueba...");

  const [orders] = await pool.query(`
    SELECT numero, cliente, estado, cuadrilla, tecnico_asignado, id_tecnico, asignacion_manual
    FROM ordenes
    WHERE numero IN ('3467354', '3471757', '3467741', '3468586', '3472647')
  `);

  console.table(orders);
  process.exit(0);
}

testFinalRules();
