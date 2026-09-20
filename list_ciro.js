const db = require('./telecom-api/db');

async function test() {
  try {
    const [ciroTP] = await db.query(`
      SELECT tp.id_trabajador, tp.id_producto, tp.stock, p.nombre, p.codigo, c.nombre as categoria
      FROM trabajador_productos tp
      JOIN trabajadores t ON tp.id_trabajador = t.id_trabajador
      JOIN usuarios u ON t.id_usuario = u.id_usuario
      JOIN productos p ON tp.id_producto = p.id_producto
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      WHERE u.nombres LIKE '%CIRO%' AND tp.stock > 0
    `);
    console.log('Stock actual de Ciro:', ciroTP.length, ciroTP);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit();
  }
}
test();
