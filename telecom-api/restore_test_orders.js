const pool = require('./db.js');

async function restoreOrders() {
  console.log("🔄 Restaurando órdenes de prueba a sus técnicos originales...");

  // 1. Restaurar 3404398 a Sandy Efrain Mar Alvarado (ID 70)
  await pool.query(
    `UPDATE ordenes 
     SET id_tecnico = 70, 
         tecnico_asignado = 'SANDY EFRAIN MAR ALVARADO',
         motivo_regestion = NULL
     WHERE numero = '3404398'`
  );
  console.log("✅ Orden 3404398 restaurada a Sandy Efrain Mar Alvarado (K 19, #70)");

  // 2. Restaurar 3404111 a Wil Nelson Carhuaz Flores (ID 64)
  await pool.query(
    `UPDATE ordenes 
     SET id_tecnico = 64, 
         tecnico_asignado = 'WIL NELSON CARHUAZ FLORES',
         motivo_regestion = NULL
     WHERE numero = '3404111'`
  );
  console.log("✅ Orden 3404111 restaurada a Wil Nelson Carhuaz Flores (K 12, #64)");

  // 3. Verificar órdenes resultantes para Edmundo Flores (ID 78)
  const [edmundoRows] = await pool.query(
    `SELECT id_orden, numero, cliente, cuadrilla, tecnico_asignado, id_tecnico, estado, fecha_visita 
     FROM ordenes 
     WHERE (DATE(fecha_visita) = '2026-09-01' OR DATE(fecha_solicitud) = '2026-09-01')
       AND (id_tecnico = 78 OR tecnico_asignado LIKE '%EDMUNDO%')`
  );

  console.log("\n📋 Órdenes actuales de Edmundo Flores en la BD (Total: " + edmundoRows.length + "):");
  console.table(edmundoRows);

  process.exit(0);
}

restoreOrders().catch(err => {
  console.error(err);
  process.exit(1);
});
