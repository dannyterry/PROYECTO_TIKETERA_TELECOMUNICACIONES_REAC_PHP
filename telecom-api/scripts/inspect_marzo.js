const pool = require('../db');

async function checkDanesa() {
  try {
    const [rows] = await pool.query(`
      SELECT 
        id_orden,
        numero,
        cliente,
        codigo_seguimiento,
        tipo_trabajo,
        producto,
        motivo_finalizacion,
        motivo_cancelacion,
        cuadrilla,
        fecha_visita,
        estado
      FROM ordenes
      WHERE cliente LIKE '%DANESA VALIENTE%' OR numero = '3009785' OR codigo_seguimiento = 'VTEXT-42004797'
    `);
    console.log("=== HISTORIAL DE DANESA VALIENTE CRUZ ===");
    console.table(rows);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

checkDanesa();
