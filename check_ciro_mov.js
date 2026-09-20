const db = require('./telecom-api/db');

async function test() {
  try {
    const [m] = await db.query(`
      SELECT * FROM movimientos 
      ORDER BY id_movimiento DESC LIMIT 30
    `);
    console.log('Últimos 30 movimientos en la tabla movimientos:', m);

    const [va] = await db.query(`
      SELECT va.*, u.nombres, u.primer_apellido, v.placa 
      FROM vehiculo_asignaciones va 
      LEFT JOIN trabajadores t ON va.id_trabajador = t.id_trabajador 
      LEFT JOIN usuarios u ON t.id_usuario = u.id_usuario 
      LEFT JOIN vehiculos v ON va.id_vehiculo = v.id_vehiculo
      WHERE u.nombres LIKE '%CIRO%' OR va.fecha_asignacion >= '2026-09-18'
    `);
    console.log('Vehiculo asignaciones Ciro:', va);

  } catch (e) {
    console.error(e);
  } finally {
    process.exit();
  }
}
test();
