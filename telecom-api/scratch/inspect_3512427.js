const pool = require('../db.js');

async function inspectOrder() {
  const [ords] = await pool.query('SELECT id_orden, numero, cliente, tecnico_asignado FROM ordenes WHERE numero = "3512427"');
  console.log('Orden:', ords);
  if (ords.length > 0) {
    const id = ords[0].id_orden;
    const [ret] = await pool.query('SELECT * FROM orden_equipos_retirados WHERE id_orden = ?', [id]);
    console.log('Retirados:', ret);
    const [liqs] = await pool.query('SELECT * FROM orden_liquidaciones WHERE id_orden = ?', [id]);
    console.log('Liquidaciones:', liqs);
    const [det] = await pool.query(`
      SELECT old.*, p.nombre 
      FROM orden_liquidacion_detalle old 
      JOIN orden_liquidaciones ol ON old.id_liquidacion = ol.id_liquidacion 
      JOIN productos p ON old.id_producto = p.id_producto 
      WHERE ol.id_orden = ?
    `, [id]);
    console.log('Detalle Liquidacion:', det);
  }
  process.exit(0);
}

inspectOrder().catch(console.error);
