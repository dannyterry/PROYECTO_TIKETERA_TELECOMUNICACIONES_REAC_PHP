const pool = require('./db');

async function main() {
  try {
    console.log("=== INSPECCIÓN DE LAS ÓRDENES SOSPECHOSAS ===");

    // 1. Órdenes con motivo_finalizacion vacío o espacio
    const [vacias] = await pool.query(`
      SELECT id_orden, numero, cliente, fecha_visita, inicio_visita, fin_visita, estado, motivo_finalizacion, tipo_trabajo, cuadrilla, tecnico_asignado
      FROM ordenes
      WHERE fecha_visita LIKE '2026-08%' AND estado = 'Finalizada' AND (motivo_finalizacion = '' OR motivo_finalizacion IS NULL)
    `);
    console.log(`\n🚨 1. Órdenes con motivo_finalización vacío (Total: ${vacias.length}):`);
    console.table(vacias);

    // 2. Órdenes con motivo 'NORMALIZACION CANCELADA' pero estado 'Finalizada'
    const [normCanc] = await pool.query(`
      SELECT id_orden, numero, cliente, fecha_visita, inicio_visita, fin_visita, estado, motivo_finalizacion, tipo_trabajo, cuadrilla, tecnico_asignado
      FROM ordenes
      WHERE fecha_visita LIKE '2026-08%' AND estado = 'Finalizada' AND motivo_finalizacion LIKE '%CANCELAD%'
    `);
    console.log(`\n🚨 2. Órdenes con motivo CANCELADA pero estado Finalizada (Total: ${normCanc.length}):`);
    console.table(normCanc);

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

main();
