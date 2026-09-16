const pool = require('../db');

async function showSpecificOrders() {
  try {
    const [rows] = await pool.query(`
      SELECT 
        id_orden, 
        numero, 
        cliente, 
        tipo_trabajo, 
        producto, 
        motivo_finalizacion, 
        motivo_cancelacion,
        cuadrilla, 
        fecha_visita, 
        estado 
      FROM ordenes 
      WHERE id_orden IN (69, 328, 393, 234, 321, 397, 492, 937, 979, 1142)
    `);
    console.log("=== DETALLE DE LAS ÓRDENES SINGULARES EN ENERO 2026 ===");
    console.table(rows);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

showSpecificOrders();
