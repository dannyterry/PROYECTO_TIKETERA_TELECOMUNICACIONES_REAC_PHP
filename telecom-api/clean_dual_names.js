const pool = require('./db.js');

async function cleanDualNames() {
  const [rows] = await pool.query(
    "SELECT id_orden, numero, tecnico_asignado, id_tecnico, id_tecnico_reemplazo FROM ordenes WHERE tecnico_asignado LIKE '%/%' OR tecnico_asignado LIKE '% y %'"
  );

  console.log(`Encontradas ${rows.length} órdenes con nombres combinados en tecnico_asignado.`);

  for (const r of rows) {
    const t1Name = r.tecnico_asignado.split(/\s*[\/,+]\s*|\s+y\s+/i)[0].trim();
    await pool.query(
      "UPDATE ordenes SET tecnico_asignado = ? WHERE id_orden = ?",
      [t1Name, r.id_orden]
    );
    console.log(`✅ Orden #${r.id_orden} (${r.numero}): tecnico_asignado actualizado a "${t1Name}" (id_tecnico: ${r.id_tecnico}, id_tecnico_reemplazo: ${r.id_tecnico_reemplazo})`);
  }

  process.exit(0);
}

cleanDualNames().catch(err => {
  console.error(err);
  process.exit(1);
});
