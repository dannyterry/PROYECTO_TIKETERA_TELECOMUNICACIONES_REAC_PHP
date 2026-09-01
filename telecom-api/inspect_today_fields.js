const pool = require('./db.js');

async function main() {
  const [rows] = await pool.query(
    `SELECT numero, estado, motivo_finalizacion, motivo_cancelacion, motivo_regestion, motivo_anulacion, motivo_trabajo, tipo_trabajo, producto
     FROM ordenes WHERE fecha_visita >= '2026-09-01' ORDER BY id_orden DESC`
  );
  console.log(rows.map(r => ({
    num: r.numero,
    est: r.estado,
    mFin: r.motivo_finalizacion,
    mReg: r.motivo_regestion,
    mTrab: r.motivo_trabajo,
    tTrab: r.tipo_trabajo,
    prod: r.producto
  })));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
