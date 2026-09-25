const { sincronizarFenix } = require('../services/fenixScraper');
const db = require('../db');

async function compare() {
  console.log('--- Sincronizando con Fenix en vivo ---');
  const result = await sincronizarFenix();
  console.log('Fenix total procesadas:', result.totalProcesadas);
  
  const [dbOrders] = await db.query(`
    SELECT id_orden, numero as ot, cod_seguimiento_cliente, codigo_seguimiento, 
           cliente, fecha_visita, fecha_solicitud, estado, cuadrilla, tecnico_asignado
    FROM ordenes
    WHERE (
      COALESCE(fecha_solicitud, fecha_visita, hora_asignacion, inicio_visita, fecha_creacion) >= '2026-09-25 00:00:00'
      AND COALESCE(fecha_solicitud, fecha_visita, hora_asignacion, inicio_visita, fecha_creacion) <= '2026-09-25 23:59:59'
    )
    ORDER BY id_orden ASC
  `);
  
  console.log('Total órdenes en BD para hoy:', dbOrders.length);
  
  const [allOrdersToday] = await db.query(`
    SELECT id_orden, numero as ot, cod_seguimiento_cliente, codigo_seguimiento, 
           cliente, fecha_visita, fecha_solicitud, estado, cuadrilla, tecnico_asignado
    FROM ordenes
    WHERE (DATE(fecha_visita) = '2026-09-25' OR DATE(fecha_solicitud) = '2026-09-25')
  `);
  console.log('Total órdenes con fecha_visita o fecha_solicitud hoy:', allOrdersToday.length);

  // Group by OT to see if any OT is duplicated in BD
  const otMap = new Map();
  dbOrders.forEach(o => {
    const list = otMap.get(o.ot) || [];
    list.push(o);
    otMap.set(o.ot, list);
  });

  const dupes = [];
  for (const [ot, list] of otMap.entries()) {
    if (list.length > 1) dupes.push({ ot, count: list.length, orders: list });
  }

  if (dupes.length > 0) {
    console.log('⚠️ DUPLICADOS EN BD:', JSON.stringify(dupes, null, 2));
  } else {
    console.log('✅ No hay OTs duplicadas en la consulta de BD');
  }

  // Print all orders
  console.log('\n--- LISTA COMPLETA DE ÓRDENES EN BD (Hoy) ---');
  dbOrders.forEach((o, i) => {
    console.log(`${i+1}. OT: ${o.ot} | Ticket: ${o.cod_seguimiento_cliente} | Pedido: ${o.codigo_seguimiento} | Cliente: ${o.cliente} | Estado: ${o.estado} | Visita: ${o.fecha_visita} | Soli: ${o.fecha_solicitud}`);
  });

  process.exit(0);
}

compare().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
