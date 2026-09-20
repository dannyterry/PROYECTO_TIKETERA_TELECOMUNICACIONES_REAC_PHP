const db = require('./telecom-api/db');

async function test() {
  try {
    const [tp] = await db.query(`
      SELECT tp.id_trabajador, tp.id_producto, tp.stock, tp.fecha_actualizacion, tp.fecha_creacion,
             u.nombres, u.primer_apellido, p.nombre as prod_nombre 
      FROM trabajador_productos tp 
      JOIN trabajadores t ON tp.id_trabajador = t.id_trabajador 
      JOIN usuarios u ON t.id_usuario = u.id_usuario 
      JOIN productos p ON tp.id_producto = p.id_producto 
      WHERE u.nombres LIKE '%CIRO%'
    `);
    console.log('Stock de Ciro en trabajador_productos:', tp);

    const [d] = await db.query(`
      SELECT d.*, u.nombres, u.primer_apellido 
      FROM despachos d 
      LEFT JOIN trabajadores t ON d.id_trabajador = t.id_trabajador 
      LEFT JOIN usuarios u ON t.id_usuario = u.id_usuario
      ORDER BY d.fecha_despacho DESC
    `);
    console.log('Despachos en tabla despachos:', d);

    const [mov] = await db.query(`
      SELECT id_movimiento, tipo, id_producto, cantidad, origen, destino, motivo, fecha_movimiento, observaciones
      FROM movimientos 
      WHERE DATE(fecha_movimiento) = '2026-09-19' OR observaciones LIKE '%CIRO%'
      ORDER BY id_movimiento DESC LIMIT 20
    `);
    console.log('Movimientos recientes hoy / Ciro:', mov);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit();
  }
}
test();
