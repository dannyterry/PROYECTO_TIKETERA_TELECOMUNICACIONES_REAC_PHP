const mysql = require('d:/proyectofinal/telecom-api/node_modules/mysql2/promise');

const prodConfig = {
  host: 'corporacioncespedes.com',
  user: 'corporacioncespe_miguel',
  password: 'corporacioncespe_123',
  database: 'corporacioncespe_cespedes',
};

// Known WIN backoffice auditors/liquidators that are not field technicians
const BACKOFFICE_AUDITORS = [
  'GRECIA JAZMIN RIVAS ORELLANA',
  'CESAR GONZALO COLCHADO AZNARAN',
  'LIZ JHOSSELIN GUTIERREZ AZORSA',
  'LAURA ANDREA CASTAÑEDA PADILLA',
  'ADMINISTRADOR',
  'ADMIN',
  'SISTEMA',
  'CENTRAL'
];

function resolveTrueTechnician(historial, techUsers, originalCuadrilla, originalTecnico) {
  if (!historial || !Array.isArray(historial) || historial.length === 0) {
    return null;
  }

  // Find all field actions (Revisión, Iniciada, En camino)
  // excluding known administrative auditors or users that entered for 0-1 min after the order was already completed
  const rows = historial.filter(h => {
    const u = (h.usuario || '').trim().toUpperCase();
    if (!u || BACKOFFICE_AUDITORS.some(aud => u.includes(aud) || aud.includes(u))) return false;
    const st = (h.estado || '').toUpperCase();
    return st.includes('REVISI') || st.includes('INICIA') || st.includes('PROCESO') || st.includes('CAMINO');
  });

  // Check if any internal Céspedes technician executed field work (prioritize Revisión / Iniciada of field)
  for (const h of rows) {
    const norm = String(h.usuario).toUpperCase().trim();
    const matchedInternal = (techUsers || []).find((u) => {
      const full1 = `${u.nombres || ''} ${u.apellidos || ''}`.toUpperCase().trim();
      const full2 = `${u.nombres || ''} ${u.primer_apellido || ''} ${u.segundo_apellido || ''}`.toUpperCase().trim();
      if (full1 && (norm === full1 || norm.includes(full1) || full1.includes(norm))) return true;
      if (full2 && (norm === full2 || norm.includes(full2) || full2.includes(norm))) return true;
      const nameParts = (u.nombres || '').toUpperCase().split(/\s+/).filter(p => p.length > 2);
      const apeParts = (u.apellidos || u.primer_apellido || '').toUpperCase().split(/\s+/).filter(p => p.length > 2);
      return nameParts.some(p => norm.includes(p)) && apeParts.some(p => norm.includes(p));
    });

    if (matchedInternal) {
      return {
        isInternal: true,
        id_tecnico: matchedInternal.id_usuario,
        nombre: `${matchedInternal.nombres} ${matchedInternal.apellidos || matchedInternal.primer_apellido || ''}`.trim(),
        estado: 'Finalizada'
      };
    }
  }

  // If NO internal technician performed field work, check who did the last operational field work (External technician)
  if (rows.length > 0) {
    const externalUser = rows[0].usuario.trim();
    return {
      isInternal: false,
      id_tecnico: null,
      nombre: 'EXTERNO: ' + externalUser,
      estado: 'Finalizada Externa',
      usuario_ejecutor_fenix: externalUser
    };
  }

  return null;
}

async function runTest() {
  const conn = await mysql.createConnection(prodConfig);
  try {
    const [techUsers] = await conn.query("SELECT id_usuario, nombres, apellidos, primer_apellido, segundo_apellido FROM usuarios");
    const [orders] = await conn.query("SELECT id_orden, numero, cliente, tecnico_asignado, cuadrilla, id_tecnico, usuario_ejecutor_fenix, estado, historial_estados FROM ordenes WHERE estado LIKE 'Finalizada%'");

    console.log(`Total órdenes analizadas: ${orders.length}`);
    let fixes = [];

    for (const ord of orders) {
      let hist = [];
      try { hist = JSON.parse(ord.historial_estados || '[]'); } catch(e){}
      if (hist.length === 0) continue;

      const resolution = resolveTrueTechnician(hist, techUsers, ord.cuadrilla, ord.tecnico_asignado);
      if (!resolution) continue;

      if (resolution.isInternal && ord.estado === 'Finalizada Externa') {
        fixes.push({
          numero: ord.numero,
          cliente: ord.cliente,
          antes: { estado: ord.estado, tec: ord.tecnico_asignado, id: ord.id_tecnico },
          despues: { estado: resolution.estado, tec: resolution.nombre, id: resolution.id_tecnico }
        });
      } else if (!resolution.isInternal && ord.estado === 'Finalizada') {
        fixes.push({
          numero: ord.numero,
          cliente: ord.cliente,
          antes: { estado: ord.estado, tec: ord.tecnico_asignado, id: ord.id_tecnico },
          despues: { estado: resolution.estado, tec: resolution.nombre, id: resolution.id_tecnico }
        });
      }
    }

    console.log(`\nDiscrepancias detectadas (${fixes.length}):`);
    console.table(fixes.map(f => ({
      OT: f.numero,
      Cliente: f.cliente.substring(0, 25),
      Antes_Tec: f.antes.tec,
      Antes_Est: f.antes.estado,
      Despues_Tec: f.despues.tec,
      Despues_Est: f.despues.estado
    })));

  } catch(e) {
    console.error(e);
  } finally {
    await conn.end();
  }
}

runTest();
