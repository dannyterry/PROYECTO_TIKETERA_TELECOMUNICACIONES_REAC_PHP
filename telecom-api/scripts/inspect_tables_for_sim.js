const mysql = require('mysql2/promise');

async function test() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  const [colsLiq] = await conn.query('DESCRIBE orden_liquidaciones');
  console.log("orden_liquidaciones cols:", colsLiq.map(c => `${c.Field} (${c.Type})`));

  const [colsDet] = await conn.query('DESCRIBE orden_liquidacion_detalle');
  console.log("orden_liquidacion_detalle cols:", colsDet.map(c => `${c.Field} (${c.Type})`));

  const [prods] = await conn.query(`
    SELECT id_producto, nombre, categoria_liquidar, precio_compra, maneja_serie 
    FROM productos 
    WHERE nombre LIKE '%CONECTOR%' OR nombre LIKE '%ONT%' OR nombre LIKE '%CABLE%' OR nombre LIKE '%ROSETA%'
  `);
  console.log("Productos telecom:", prods);

  await conn.end();
}

test().catch(console.error);
