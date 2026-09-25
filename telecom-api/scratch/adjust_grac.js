const mysql = require('mysql2/promise');

async function adjustGrac() {
  const conn = await mysql.createConnection({
    host: 'corporacioncespedes.com',
    user: 'corporacioncespe_miguel',
    password: 'corporacioncespe_123',
    database: 'corporacioncespe_cespedes'
  });

  await conn.execute(`
    UPDATE stock SET cantidad = cantidad + 2 
    WHERE id_producto = (SELECT id_producto FROM productos WHERE codigo = 'GRAC') 
      AND (id_almacen = 1 OR id_almacen IS NULL)
  `);

  await conn.execute(`
    INSERT INTO movimientos (id_producto, id_almacen, tipo, cantidad, referencia, fecha_creacion) 
    VALUES ((SELECT id_producto FROM productos WHERE codigo = 'GRAC'), 1, 'ENTRADA', 2, 'Ajuste de inventario: Reincorporación final de GRAPAS #6', NOW())
  `);

  console.log('✅ GRAC actualizado en producción.');
  await conn.end();
}

adjustGrac().catch(console.error);
