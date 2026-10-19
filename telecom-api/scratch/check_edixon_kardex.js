const mysql = require('mysql2/promise');

async function test() {
  const local = await mysql.createConnection({
    host: '127.0.0.1', user: 'root', password: '', database: 'corporacioncespe_cespedes', dateStrings: true
  });

  const [tech] = await local.query(
    "SELECT t.id_trabajador, u.id_usuario, u.nombres, u.apellidos, u.primer_apellido, u.segundo_apellido, u.usuario, u.cuadrilla " +
    "FROM trabajadores t JOIN usuarios u ON t.id_usuario = u.id_usuario " +
    "WHERE u.nombres LIKE '%EDIXON%' OR u.apellidos LIKE '%VILLALBA%'"
  );
  console.log('=== TRABAJADOR / USUARIO EDIXON ===');
  console.table(tech);

  const [orders] = await local.query(
    "SELECT o.id_orden, o.numero, o.id_tecnico, o.cuadrilla, o.tecnico_asignado, ol.id_liquidacion, ol.id_trabajador, ol.fecha_liquidacion " +
    "FROM ordenes o " +
    "LEFT JOIN orden_liquidaciones ol ON o.id_orden = ol.id_orden " +
    "WHERE o.tecnico_asignado LIKE '%VILLALBA%' OR o.cuadrilla LIKE '%VILLALBA%' OR o.id_tecnico IN (SELECT id_usuario FROM usuarios WHERE apellidos LIKE '%VILLALBA%')"
  );
  console.log('=== ORDENES Y LIQUIDACIONES DE EDIXON ===');
  console.table(orders);

  const [details] = await local.query(
    "SELECT old.id_detalle_liq, old.id_liquidacion, old.id_producto, p.nombre, old.cantidad, ol.id_trabajador, ol.fecha_liquidacion " +
    "FROM orden_liquidacion_detalle old " +
    "JOIN orden_liquidaciones ol ON old.id_liquidacion = ol.id_liquidacion " +
    "JOIN productos p ON old.id_producto = p.id_producto " +
    "WHERE ol.id_orden IN (SELECT id_orden FROM ordenes WHERE tecnico_asignado LIKE '%VILLALBA%') OR ol.id_trabajador IN (SELECT id_trabajador FROM trabajadores WHERE id_usuario IN (SELECT id_usuario FROM usuarios WHERE apellidos LIKE '%VILLALBA%'))"
  );
  console.log('=== DETALLES DE LIQUIDACION DE EDIXON (' + details.length + ') ===');
  console.table(details);

  process.exit(0);
}

test().catch(e => { console.error(e); process.exit(1); });
