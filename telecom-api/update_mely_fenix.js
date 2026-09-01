const pool = require('./db.js');
const { resolverTipoTrabajoOficial } = require('./services/tipoTrabajoHelper.js');

async function updateFenixMely() {
  const officialTipo = resolverTipoTrabajoOficial('CAMBIO DE ONT - ONT INOPERATIVA', 'DESCARTE DE ONT', 'Finalizada');

  await pool.query(`
    UPDATE ordenes SET
      cuadrilla = 'K 12 CESPEDES SGA WIL NELSON CARHUAZ FLORES',
      id_tecnico = 64,
      tecnico_asignado = 'WIL NELSON CARHUAZ FLORES',
      estado = 'Finalizada',
      inicio_visita = '2026-09-01 15:17:54',
      fin_visita = '2026-09-01 16:13:40',
      motivo_finalizacion = 'CAMBIO DE ONT - ONT INOPERATIVA',
      tipo_trabajo = ?,
      motivo_trabajo = 'DESCARTE DE ONT'
    WHERE numero = '3404111'
  `, [officialTipo]);

  const [rows] = await pool.query("SELECT numero, cliente, cuadrilla, tecnico_asignado, id_tecnico, estado, motivo_finalizacion, tipo_trabajo, inicio_visita, fin_visita FROM ordenes WHERE numero = '3404111'");
  console.log("✅ Orden 3404111 actualizada según la última verdad de Fénix:");
  console.table(rows);

  process.exit(0);
}

updateFenixMely().catch(console.error);
