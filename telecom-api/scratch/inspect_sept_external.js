const db = require('../db');

async function checkSeptExternal() {
  try {
    const [rows] = await db.query(`
      SELECT id_orden, numero, estado, fecha_visita, tecnico_asignado, cuadrilla, id_tecnico, usuario_ejecutor_fenix
      FROM ordenes
      WHERE numero IN ('3471757', '3468672', '3409481')
    `);
    console.log('Órdenes 3471757, 3468672, 3409481:', rows);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

checkSeptExternal();
