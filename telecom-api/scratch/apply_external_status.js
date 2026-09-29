const db = require('../db');

async function applyExternalStatus() {
  try {
    // 1. Actualizar la orden 3471757 a Finalizada Externa
    const [res1] = await db.query(`
      UPDATE ordenes 
      SET estado = 'Finalizada Externa', 
          tecnico_asignado = 'EXTERNO: ERICK ADALBERTO GALLARDO TARDILLO',
          id_tecnico = null
      WHERE numero = '3471757'
    `);
    console.log('Actualizada orden 3471757 a Finalizada Externa:', res1.affectedRows);

    // 2. Comprobar cómo quedan las órdenes externas
    const [ext] = await db.query(`
      SELECT id_orden, numero, estado, fecha_visita, tecnico_asignado, cuadrilla, usuario_ejecutor_fenix
      FROM ordenes 
      WHERE numero IN ('3471757', '3468672', '3409481')
    `);
    console.log('Estado de las 3 órdenes:', ext);

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

applyExternalStatus();
