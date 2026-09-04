const mysql = require('mysql2/promise');

async function checkOrders() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  const [tecs] = await conn.query(`
    SELECT t.id_trabajador, CONCAT(u.nombres, ' ', u.apellidos) as tecnico, COUNT(o.id_orden) as total_ordenes
    FROM trabajadores t
    JOIN usuarios u ON u.id_usuario = t.id_usuario
    LEFT JOIN ordenes o ON o.id_tecnico = t.id_trabajador
    GROUP BY t.id_trabajador
    HAVING total_ordenes > 0
  `);
  console.log("TECNICOS CON ORDENES:", tecs);

  const [prods] = await conn.query(`
    SELECT id_producto, nombre, precio_compra, maneja_serie FROM productos LIMIT 10
  `);
  console.log("ALGUNOS PRODUCTOS:", prods);

  const [yomarOrders] = await conn.query(`
    SELECT o.id_orden, o.numero, o.cliente, o.estado, o.fecha_visita, o.id_tecnico, CONCAT(u.nombres, ' ', u.apellidos) as tecnico
    FROM ordenes o
    JOIN trabajadores t ON t.id_trabajador = o.id_tecnico
    JOIN usuarios u ON u.id_usuario = t.id_usuario
    WHERE u.nombres LIKE '%YOMAR%' OR u.apellidos LIKE '%SANTIAGO%' OR o.id_tecnico IN (${tecs.map(t => t.id_trabajador).join(',')})
    LIMIT 10
  `);
  console.log("ORDENES DISPONIBLES:", yomarOrders);

  await conn.end();
}

checkOrders().catch(console.error);
