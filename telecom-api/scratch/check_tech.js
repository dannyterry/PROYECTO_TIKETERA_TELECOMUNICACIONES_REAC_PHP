const mysql = require('mysql2/promise');

async function test() {
  const local = await mysql.createConnection({ host: '127.0.0.1', user: 'root', password: '', database: 'corporacioncespe_cespedes' });
  const [rows] = await local.query(
    "SELECT ol.id_liquidacion, ol.id_orden, ol.id_trabajador, o.id_tecnico, o.cuadrilla, o.tecnico_asignado " +
    "FROM orden_liquidaciones ol " +
    "JOIN ordenes o ON ol.id_orden = o.id_orden " +
    "WHERE o.tecnico_asignado LIKE '%VILLALBA%' OR o.cuadrilla LIKE '%VILLALBA%' OR ol.id_trabajador = 105"
  );
  console.log('LIQUIDACIONES DE EDIXON (' + rows.length + '):');
  console.table(rows.slice(0, 15));
  process.exit(0);
}
test().catch(e => { console.error(e); process.exit(1); });
