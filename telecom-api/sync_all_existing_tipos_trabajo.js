const mysql = require('mysql2/promise');
const { getMotivosCatalogo, resolverTipoTrabajoConCatalogo } = require('./services/tipoTrabajoHelper');

const LOCAL_CONFIG = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: '',
  database: 'corporacioncespe_cespedes',
  dateStrings: true
};

const REMOTE_CONFIG = {
  host: 'corporacioncespedes.com',
  user: 'corporacioncespe_miguel',
  password: 'corporacioncespe_123',
  database: 'corporacioncespe_cespedes',
  dateStrings: true
};

async function syncOrdersForDb(pool, dbLabel) {
  console.log(`\n======================================================`);
  console.log(`🔄 ACTUALIZANDO ÓRDENES EN [${dbLabel}] SEGÚN TABLA MOTIVOS...`);
  console.log(`======================================================`);

  const catalogoMotivos = await getMotivosCatalogo(pool);
  console.log(`📌 Motivos cargados desde tabla motivos: ${catalogoMotivos.length}`);

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
      const officialTipo = resolverTipoTrabajoConCatalogo(r.motivo_finalizacion, r.tipo_trabajo || r.motivo_trabajo, r.estado, catalogoMotivos);
      const rawAveria = r.motivo_trabajo || r.tipo_trabajo;

      if (officialTipo && officialTipo !== r.tipo_trabajo) {
        await pool.query(
          "UPDATE ordenes SET tipo_trabajo = ?, motivo_trabajo = COALESCE(motivo_trabajo, ?) WHERE id_orden = ?",
          [officialTipo, rawAveria, r.id_orden]
        );
        actualizadas++;
      }
    }
  }

  console.log(`✅ Proceso finalizado en [${dbLabel}]:`);
  console.log(`   - Órdenes Finalizadas analizadas: ${finalizadasCount}`);
  console.log(`   - Órdenes actualizadas con Tipo de Trabajo Oficial de 'motivos': ${actualizadas}`);
}

async function main() {
  const localPool = mysql.createPool(LOCAL_CONFIG);
  await syncOrdersForDb(localPool, "LOCAL XAMPP");

  try {
    const remotePool = mysql.createPool(REMOTE_CONFIG);
    await syncOrdersForDb(remotePool, "PRODUCCIÓN REMOTA");
  } catch (e) {
    console.error("No se pudo conectar a producción remota:", e.message);
  }

  process.exit(0);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
