const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost', user: 'root', password: '', database: 'corporacioncespe_cespedes'
  });

  // 1. Check all users in `usuarios` to have the list of internal technicians
  const [techUsers] = await conn.query("SELECT id_usuario, nombres, apellidos, primer_apellido, segundo_apellido, cuadrilla FROM usuarios");
  console.log(`Total usuarios en BD: ${techUsers.length}`);

  // 2. Fetch all orders in September (01-30 Sep)
  const [septOrders] = await conn.query(`
    SELECT id_orden, numero, cliente, cuadrilla, tecnico_asignado, usuario_ejecutor_fenix, estado, historial_estados, fecha_visita, fecha_solicitud
    FROM ordenes 
    WHERE (fecha_visita >= '2026-09-01 00:00:00') OR (fecha_solicitud >= '2026-09-01 00:00:00')
  `);
  console.log(`Total órdenes en Septiembre: ${septOrders.length}`);

  // Let's check which orders have an executor in historial_estados or usuario_ejecutor_fenix
  const externalCandidates = [];

  for (const o of septOrders) {
    let hist = [];
    if (o.historial_estados) {
      try {
        hist = typeof o.historial_estados === 'string' ? JSON.parse(o.historial_estados) : o.historial_estados;
      } catch (e) {}
    }

    // Check executor from historial
    const closingEvents = hist.filter(h => /finalizad|revisi|liquid/i.test(h.estado || ''));
    const closingUsers = closingEvents.map(h => (h.usuario || '').trim()).filter(u => u && !/administrador|admin|sistema/i.test(u));

    // Also check usuario_ejecutor_fenix
    const execName = o.usuario_ejecutor_fenix || (closingUsers.length > 0 ? closingUsers[closingUsers.length - 1] : null);

    if (execName) {
      const normExec = execName.toUpperCase().trim();
      const match = techUsers.find(u => {
        const f1 = `${u.nombres || ''} ${u.apellidos || ''}`.toUpperCase().trim();
        const f2 = `${u.nombres || ''} ${u.primer_apellido || ''} ${u.segundo_apellido || ''}`.toUpperCase().trim();
        if (f1 && normExec === f1) return true;
        if (f2 && normExec === f2) return true;
        if (f1 && normExec.includes(f1)) return true;
        const np = (u.nombres || '').toUpperCase().split(/\s+/).filter(p => p.length > 2);
        const ap = (u.apellidos || u.primer_apellido || '').toUpperCase().split(/\s+/).filter(p => p.length > 2);
        return np.some(p => normExec.includes(p)) && ap.some(p => normExec.includes(p));
      });

      if (!match) {
        externalCandidates.push({
          id_orden: o.id_orden,
          numero: o.numero,
          cliente: o.cliente,
          cuadrilla: o.cuadrilla,
          tecnico_asignado: o.tecnico_asignado,
          usuario_ejecutor: execName,
          estado_actual: o.estado,
          fecha_visita: o.fecha_visita
        });
      }
    }
  }

  console.log(`\n🔍 ÓRDENES EJECUTADAS POR PERSONAL EXTERNO EN SEPTIEMBRE: ${externalCandidates.length}`);
  console.table(externalCandidates);

  await conn.end();
}

main().catch(console.error);
