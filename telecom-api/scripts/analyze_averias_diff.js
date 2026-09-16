const pool = require('../db');

async function analyze() {
  try {
    const oficial = {
      1: { nombre: 'Enero', asig: 911, fin: 687, ef: 75.41 },
      2: { nombre: 'Febrero', asig: 1050, fin: 701, ef: 66.76 },
      3: { nombre: 'Marzo', asig: 1026, fin: 747, ef: 72.81 },
      4: { nombre: 'Abril', asig: 979, fin: 768, ef: 78.53 },
      5: { nombre: 'Mayo', asig: 956, fin: 788, ef: 82.43 },
      6: { nombre: 'Junio', asig: 964, fin: 736, ef: 76.35 },
      7: { nombre: 'Julio', asig: 981, fin: 741, ef: 75.54 },
      8: { nombre: 'Agosto', asig: 1129, fin: 915, ef: 81.05 },
      9: { nombre: 'Septiembre', asig: 535, fin: 428, ef: 80.00 }
    };

    const [rows] = await pool.query(`
      SELECT 
        mes,
        COUNT(*) as total_registros,
        SUM(es_asignada_win) as bd_asig,
        SUM(es_finalizada_win) as bd_fin,
        ROUND((SUM(es_finalizada_win) / NULLIF(SUM(es_asignada_win), 0)) * 100, 2) as bd_ef
      FROM ordenes_auditadas_win
      WHERE anio = 2026 AND categoria_win = 'AVERIAS'
      GROUP BY mes
      ORDER BY mes ASC
    `);

    console.log("=== COMPARATIVA DE AVERÍAS: OFICIAL vs BD ===");
    const tabla = rows.map(r => {
      const of = oficial[r.mes] || {};
      return {
        mes: of.nombre || `Mes ${r.mes}`,
        ofic_asig: of.asig,
        bd_asig: Number(r.bd_asig),
        dif_asig: Number(r.bd_asig) - of.asig,
        ofic_fin: of.fin,
        bd_fin: Number(r.bd_fin),
        dif_fin: Number(r.bd_fin) - of.fin,
        ofic_ef: of.ef + '%',
        bd_ef: r.bd_ef + '%',
        match: (Number(r.bd_asig) === of.asig && Number(r.bd_fin) === of.fin) ? '✅ 100%' : '❌'
      };
    });

    console.table(tabla);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

analyze();
