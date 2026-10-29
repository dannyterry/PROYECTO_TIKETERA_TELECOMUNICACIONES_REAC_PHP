const mysql = require('mysql2/promise');

async function findDrop() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    database: 'corporacioncespe_cespedes'
  });

  const [prods] = await conn.query(`
    SELECT p.id_producto, p.nombre, p.codigo, c.nombre as categoria 
    FROM productos p 
    LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
    WHERE p.nombre LIKE '%DROP%' OR p.nombre LIKE '%BOBINA%' OR c.nombre LIKE '%DROP%'
  `);

  console.log('Productos Drop:', prods);
  await conn.end();
}

findDrop();

