const mysql = require('mysql2/promise');

const localConfig = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: '',
  database: 'corporacioncespe_cespedes',
};

const productionConfig = {
  host: 'corporacioncespedes.com',
  user: 'corporacioncespe_miguel',
  password: 'corporacioncespe_123',
  database: 'corporacioncespe_cespedes',
  connectTimeout: 10000
};

async function check() {
  console.log("Conectando a Local y Producción...");
  const localConn = await mysql.createConnection(localConfig);
  let prodConn = null;
  try {
    prodConn = await mysql.createConnection(productionConfig);
    console.log("✅ Conectado a Producción");
  } catch (e) {
    console.warn("⚠️ No se pudo conectar directo a Producción:", e.message);
  }

  const query = `
    SELECT id_orden, numero, cliente, estado, inicio_visita, fin_visita, 
           motivo_regestion, motivo_cancelacion, fecha_solicitud, fecha_visita
    FROM ordenes
    WHERE DATE(COALESCE(fecha_solicitud, fecha_visita, inicio_visita, fecha_creacion, NOW())) = CURDATE()
       OR DATE(fecha_solicitud) = CURDATE()
       OR DATE(fecha_visita) = CURDATE()
  `;

  const [localRows] = await localConn.query(query);
  console.log(`\n--- LOCAL: ${localRows.length} órdenes ---`);
  const localCanceladas = localRows.filter(r => 
    ['Cancelada', 'Cancelado', 'Regestion', 'Regestión', 'Anulada', 'Anulado'].includes(r.estado) ||
    r.motivo_cancelacion || r.motivo_regestion
  );
  console.log(`Local Canceladas/Regestión (${localCanceladas.length}):`);
  console.table(localCanceladas.map(r => ({
    id: r.id_orden,
    num: r.numero,
    cli: r.cliente?.substring(0, 20),
    est: r.estado,
    reg: r.motivo_regestion?.substring(0, 20),
    can: r.motivo_cancelacion?.substring(0, 20)
  })));

  if (prodConn) {
    const [prodRows] = await prodConn.query(query);
    console.log(`\n--- PRODUCCIÓN: ${prodRows.length} órdenes ---`);
    const prodCanceladas = prodRows.filter(r => 
      ['Cancelada', 'Cancelado', 'Regestion', 'Regestión', 'Anulada', 'Anulado'].includes(r.estado) ||
      r.motivo_cancelacion || r.motivo_regestion
    );
    console.log(`Producción Canceladas/Regestión (${prodCanceladas.length}):`);
    console.table(prodCanceladas.map(r => ({
      id: r.id_orden,
      num: r.numero,
      cli: r.cliente?.substring(0, 20),
      est: r.estado,
      reg: r.motivo_regestion?.substring(0, 20),
      can: r.motivo_cancelacion?.substring(0, 20)
    })));

    // Comparar diferencias
    console.log('\n--- DIFERENCIAS (Producción vs Local) ---');
    const localMap = new Map(localRows.map(r => [r.numero, r]));
    for (const pr of prodRows) {
      const lr = localMap.get(pr.numero);
      if (!lr) {
        console.log(`Orden #${pr.numero} existe en Producción pero NO en Local!`);
      } else if (lr.estado !== pr.estado) {
        console.log(`Diferencia #${pr.numero} (${pr.cliente}): Prod=[${pr.estado}] vs Local=[${lr.estado}]`);
      }
    }
  }

  process.exit(0);
}

check().catch(e => {
  console.error(e);
  process.exit(1);
});
