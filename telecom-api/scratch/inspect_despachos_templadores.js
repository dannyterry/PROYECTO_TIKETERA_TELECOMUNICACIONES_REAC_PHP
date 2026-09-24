const mysql = require('mysql2/promise');

async function inspectDespachos() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  const [despachos] = await conn.execute(`
    SELECT dd.*,
           d.codigo_despacho, d.fecha_despacho, d.id_trabajador,
           CONCAT(u.nombres, ' ', COALESCE(u.primer_apellido, '')) as tecnico
    FROM despacho_detalles dd
    JOIN despachos d ON dd.id_despacho = d.id_despacho
    JOIN trabajadores t ON d.id_trabajador = t.id_trabajador
    JOIN usuarios u ON t.id_usuario = u.id_usuario
    WHERE dd.id_producto = 49
    ORDER BY d.fecha_despacho ASC
  `);
  console.log('TODOS LOS DESPACHOS DE TEMPLADORES (id_producto 49):');
  console.table(despachos);

  const [movs] = await conn.execute(`
    SELECT * FROM movimientos WHERE id_producto = 49 ORDER BY fecha_creacion ASC
  `);
  console.log('TODOS LOS MOVIMIENTOS DE TEMPLADORES:');
  console.table(movs);

  await conn.end();
}

inspectDespachos().catch(console.error);
