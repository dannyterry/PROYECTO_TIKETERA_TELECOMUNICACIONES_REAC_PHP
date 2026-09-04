const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  const [yomarToday] = await conn.query(`
    SELECT o.id_orden, o.numero, o.cliente, o.estado, o.fecha_visita, o.tipo_trabajo, o.direccion, o.motivo_finalizacion
    FROM ordenes o 
    WHERE o.id_tecnico = 65 AND DATE(o.fecha_visita) = '2026-09-04'
  `);
  console.log("YOMAR ORDENES HOY (2026-09-04):", yomarToday);

  const [prods] = await conn.query(`
    SELECT id_producto, nombre, categoria_liquidar, precio_compra, maneja_serie 
    FROM productos 
    WHERE precio_compra > 0 OR nombre LIKE '%CONECTOR%' OR nombre LIKE '%CABLE%' OR nombre LIKE '%ROSETA%' OR nombre LIKE '%MODEM%' OR nombre LIKE '%ONT%'
    LIMIT 20
  `);
  console.log("PRODUCTOS DE TELECOMUNICACIONES:", prods);

  await conn.end();
}

main().catch(console.error);
