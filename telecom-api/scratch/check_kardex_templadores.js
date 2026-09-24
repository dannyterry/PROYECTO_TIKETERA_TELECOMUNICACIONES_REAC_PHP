const mysql = require('mysql2/promise');

async function checkAllDespachoMovs() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  const [movs] = await conn.execute(`
    SELECT m.id_movimiento, m.tipo, m.cantidad, m.referencia, m.fecha_creacion, p.nombre as producto
    FROM movimientos m
    JOIN productos p ON m.id_producto = p.id_producto
    WHERE m.id_producto = 49
    ORDER BY m.fecha_creacion ASC
  `);
  console.log('Historial completo de movimientos de Templadores en Kardex:');
  console.table(movs);

  await conn.end();
}

checkAllDespachoMovs().catch(console.error);
