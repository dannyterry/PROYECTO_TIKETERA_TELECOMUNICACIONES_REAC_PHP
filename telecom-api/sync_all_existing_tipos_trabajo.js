const pool = require('./db.js');
const { resolverTipoTrabajoOficial } = require('./services/tipoTrabajoHelper.js');

async function main() {
  console.log("🚀 Sincronizando y clasificando Tipo de Trabajo oficial en toda la BD...");

  const [rows] = await pool.query(
    "SELECT id_orden, numero, motivo_finalizacion, motivo_trabajo, tipo_trabajo, estado FROM ordenes"
  );

  console.log(`📌 Total de órdenes a revisar: ${rows.length}`);

  let actualizadas = 0;
  let finalizadasCount = 0;

  for (const r of rows) {
    const rawStatus = String(r.estado || "").toLowerCase().trim();
    const isFinalizada = rawStatus.includes("finaliz") || rawStatus.includes("liquid") || rawStatus.includes("termin") || rawStatus.includes("cerrad") || rawStatus.includes("fenix");

    if (isFinalizada) {
      finalizadasCount++;
      const officialTipo = resolverTipoTrabajoOficial(r.motivo_finalizacion, r.tipo_trabajo || r.motivo_trabajo, r.estado);
      const rawAveria = r.motivo_trabajo || r.tipo_trabajo;

      if (officialTipo) {
        await pool.query(
          "UPDATE ordenes SET tipo_trabajo = ?, motivo_trabajo = COALESCE(motivo_trabajo, ?) WHERE id_orden = ?",
          [officialTipo, rawAveria, r.id_orden]
        );
        actualizadas++;
      }
    }
  }

  console.log(`✅ Proceso finalizado:`);
  console.log(`   - Órdenes Finalizadas analizadas: ${finalizadasCount}`);
  console.log(`   - Órdenes actualizadas con Tipo de Trabajo Oficial: ${actualizadas}`);

  process.exit(0);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
