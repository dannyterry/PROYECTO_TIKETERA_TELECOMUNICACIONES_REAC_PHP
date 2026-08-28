const db = require('./db');

async function checkReserved() {
  const [rows] = await db.query(`
    SELECT ps.id_producto_serie, ps.id_producto, p.nombre, ps.numero_serie, ps.estado, ts.id_trabajador, CONCAT(u.nombres, ' ', COALESCE(u.primer_apellido, u.apellidos, '')) as tecnico
    FROM producto_series ps
    JOIN productos p ON ps.id_producto = p.id_producto
    LEFT JOIN trabajador_series ts ON ps.id_producto_serie = ts.id_producto_serie AND ts.estado = 'Asignada'
    LEFT JOIN trabajadores t ON ts.id_trabajador = t.id_trabajador
    LEFT JOIN usuarios u ON t.id_usuario = u.id_usuario
    WHERE ps.estado = 'RESERVADO'
  `);
  console.log('Series con estado RESERVADO:', rows);

  const [fusionadoras] = await db.query(`
    SELECT ps.id_producto_serie, ps.numero_serie, ps.estado, ts.id_trabajador, CONCAT(u.nombres, ' ', COALESCE(u.primer_apellido, u.apellidos, '')) as tecnico
    FROM producto_series ps
    JOIN productos p ON ps.id_producto = p.id_producto
    LEFT JOIN trabajador_series ts ON ps.id_producto_serie = ts.id_producto_serie AND ts.estado = 'Asignada'
    LEFT JOIN trabajadores t ON ts.id_trabajador = t.id_trabajador
    LEFT JOIN usuarios u ON t.id_usuario = u.id_usuario
    WHERE p.nombre LIKE '%FUSIONADORA%'
  `);
  console.log('Todas las series de fusionadoras:', fusionadoras);

  process.exit();
}

checkReserved().catch(err => {
  console.error(err);
  process.exit(1);
});
