async function checkProd() {
  try {
    const resp = await fetch('https://api.corporacioncespedes.com/ordenes?fechaDesde=2026-09-25&fechaHasta=2026-09-25&t=' + Date.now());
    const data = await resp.json();
    console.log('Total órdenes en Producción API hoy:', data.length);
    
    // Check against local / Fenix
    const ots = new Set();
    const dupes = [];
    data.forEach((o, i) => {
      if (ots.has(o.numero)) {
        dupes.push(o.numero);
      }
      ots.add(o.numero);
      console.log(`${i+1}. ID: ${o.id_orden} | OT: ${o.numero} | Ticket: ${o.cod_seguimiento_cliente} | Pedido: ${o.codigo_seguimiento} | Cliente: ${o.cliente} | Estado: ${o.estado} | Visita: ${o.fecha_visita} | Soli: ${o.fecha_solicitud}`);
    });

    if (dupes.length > 0) {
      console.log('\n⚠️ OTs duplicadas en Producción:', dupes);
    } else {
      console.log('\n✅ No hay OTs duplicadas en la lista de producción.');
    }

  } catch (e) {
    console.error('Error fetching prod:', e.message);
  }
  process.exit(0);
}

checkProd();
