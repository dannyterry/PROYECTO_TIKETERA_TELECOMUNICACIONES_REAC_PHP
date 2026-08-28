/**
 * ==============================================================================
 * 🚀 SCRIPT DE CARGA HISTÓRICA COMPLETA 2026 (ENERO A LA ACTUALIDAD)
 * ==============================================================================
 * Ejecución:
 *   node scripts/sync-historico-2026.js
 *
 * Características:
 *   - Procesa mes por mes de forma ordenada para no saturar Fénix ni la red.
 *   - Guarda y actualiza directamente en tu base de datos MySQL (tabla 'ordenes').
 *   - Si un mes ya estaba cargado, actualiza sus estados respetando campos manuales.
 *   - Pausa de seguridad de 3 segundos entre meses.
 * ==============================================================================
 */

const pool = require('../db');
const { sincronizarFenix } = require('../services/fenixScraper');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getTodayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Lotes a sincronizar: Desde el 10 de Agosto 2026 hasta la actualidad
const LOTES_2026 = [
  { nombre: "Agosto 2026 (10/08/2026 al presente)", desde: "2026-08-10", hasta: getTodayISO() },
];

async function contarOrdenesTotales() {
  try {
    const [rows] = await pool.query("SELECT COUNT(*) AS total FROM ordenes");
    return rows[0].total || 0;
  } catch (e) {
    return 0;
  }
}

async function main() {
  console.log("==================================================================");
  console.log("  🚀 INICIANDO SINCRONIZACIÓN HISTÓRICA 2026 (FÉNIX ➔ MYSQL)");
  console.log("==================================================================");

  const totalInicial = await contarOrdenesTotales();
  console.log(`📊 Órdenes actuales en base de datos: ${totalInicial}`);
  console.log(`📦 Se procesarán ${LOTES_2026.length} lotes mensuales...\n`);

  let totalProcesadas = 0;
  const tiempoInicio = Date.now();

  for (let i = 0; i < LOTES_2026.length; i++) {
    const lote = LOTES_2026[i];
    const num = i + 1;

    console.log(`------------------------------------------------------------------`);
    console.log(`[${num}/${LOTES_2026.length}] 📅 Procesando ${lote.nombre} (${lote.desde} al ${lote.hasta})...`);

    try {
      const resultado = await sincronizarFenix({
        fechaDesde: lote.desde,
        fechaHasta: lote.hasta,
      });

      const guardadas = (resultado && (resultado.totalGuardadas || resultado.total)) || 0;
      totalProcesadas += guardadas;

      console.log(`✅ [${lote.nombre}] Finalizado con éxito: ${guardadas} órdenes procesadas.`);
    } catch (err) {
      console.error(`❌ [${lote.nombre}] Error al sincronizar:`, err.message);
    }

    // Pausa de 3 segundos entre meses (excepto en el último)
    if (i < LOTES_2026.length - 1) {
      console.log(`⏳ Esperando 3 segundos antes del siguiente mes...`);
      await sleep(3000);
    }
  }

  const totalFinal = await contarOrdenesTotales();
  const duracionMin = ((Date.now() - tiempoInicio) / 1000 / 60).toFixed(1);

  console.log("\n==================================================================");
  console.log("  🎉 ¡SINCRONIZACIÓN HISTÓRICA 2026 COMPLETADA EXITOSAMENTE!");
  console.log("==================================================================");
  console.log(`⏱️ Tiempo total transcurrido: ${duracionMin} minutos`);
  console.log(`📦 Órdenes totales en BD antes: ${totalInicial}`);
  console.log(`📈 Órdenes totales en BD ahora:  ${totalFinal}`);
  console.log(`✨ Nuevas/Actualizadas:         +${totalFinal - totalInicial}`);
  console.log("==================================================================\n");

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error fatal en el script:", err);
  process.exit(1);
});
