const mysql = require('mysql2/promise');

async function revert() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  console.log("🧹 REVIRTIENDO SIMULACIÓN DE ORDEN...");

  const [liqs] = await conn.query("SELECT id_liquidacion FROM orden_liquidaciones WHERE id_orden = 10781");
  for (const l of liqs) {
    await conn.query("DELETE FROM orden_liquidacion_detalle WHERE id_liquidacion = ?", [l.id_liquidacion]);
    await conn.query("DELETE FROM orden_liquidaciones WHERE id_liquidacion = ?", [l.id_liquidacion]);
  }

  await conn.query("DELETE FROM producto_series WHERE numero_serie = 'HW-2026-FTTH-9941'");
  await conn.query("UPDATE ordenes SET estado = 'Iniciada', motivo_finalizacion = NULL, fecha_liquidacion = NULL WHERE id_orden = 10781");

  console.log("✅ Simulación de orden revertida con éxito.");
  await conn.end();
}

revert().catch(console.error);
