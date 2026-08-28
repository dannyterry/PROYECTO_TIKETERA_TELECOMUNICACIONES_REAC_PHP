const db = require('./db');

async function inspectFutureOrders() {
  const [future] = await db.query(`
    SELECT id_orden, numero, fecha_visita, fecha_creacion, estado, cliente
    FROM ordenes
    WHERE fecha_visita > '2026-08-31 23:59:59'
    ORDER BY fecha_visita ASC
  `);
  console.log(`Total de órdenes con fecha futura en 2026 (después de Agosto): ${future.length}`);
  console.log('Muestra:');
  future.slice(0, 15).forEach(o => {
    console.log(`ID: ${o.id_orden} | N°: ${o.numero} | Fecha Visita: ${o.fecha_visita} | Creado: ${o.fecha_creacion} | Estado: ${o.estado}`);
  });

  process.exit();
}

inspectFutureOrders().catch(err => {
  console.error(err);
  process.exit(1);
});
