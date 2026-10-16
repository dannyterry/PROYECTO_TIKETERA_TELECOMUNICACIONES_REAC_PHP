const pool = require('../db');

async function testScorecard() {
  try {
    const [rows] = await pool.query(`
      SELECT 
        COUNT(*) AS total_ordenes,
        SUM(CASE WHEN estado IN ('Finalizada', 'Liquidada') THEN 1 ELSE 0 END) AS terminadas,
        SUM(CASE WHEN estado = 'Cancelada' THEN 1 ELSE 0 END) AS canceladas,
        SUM(CASE WHEN estado IN ('Regestión', 'Regestion') THEN 1 ELSE 0 END) AS regestion,
        SUM(CASE WHEN estado IN ('Anulada', 'Iniciada', 'En camino', 'Agendada') THEN 1 ELSE 0 END) AS excluidas,
        SUM(CASE WHEN (codigo_seguimiento LIKE 'VTR-%' OR tipo_trabajo = 'REITERADA') THEN 1 ELSE 0 END) AS vtr_casos
      FROM ordenes
      WHERE DATE(fecha_visita) >= '2026-10-01' AND DATE(fecha_visita) <= '2026-10-13'
    `);
    
    const r = rows[0];
    const evalCount = Number(r.terminadas) + Number(r.canceladas) + Number(r.regestion);
    const pctEf = evalCount > 0 ? ((Number(r.terminadas) / evalCount) * 100).toFixed(2) : '0.00';
    const pctVtr = Number(r.terminadas) > 0 ? ((Number(r.vtr_casos) / Number(r.terminadas)) * 100).toFixed(2) : '0.00';
    
    console.log('--- RESULTADO SCORECARD WIN (01 al 13 Octubre 2026) ---');
    console.log('Total Órdenes:', r.total_ordenes);
    console.log('Terminadas (Finalizadas + Liquidadas):', r.terminadas);
    console.log('Canceladas:', r.canceladas);
    console.log('Regestión:', r.regestion);
    console.log('Total Evaluados (Base WIN):', evalCount);
    console.log('% Efectividad:', pctEf + '% (Meta: >= 80%)');
    console.log('Casos VTR:', r.vtr_casos);
    console.log('% VTR:', pctVtr + '% (Meta: <= 5%)');
    console.log('Excluidas:', r.excluidas);
    
    const [dailyRows] = await pool.query(`
      SELECT 
        DATE_FORMAT(fecha_visita, '%Y-%m-%d') AS fecha,
        DAY(fecha_visita) AS dia,
        COUNT(*) AS total,
        SUM(CASE WHEN estado IN ('Finalizada', 'Liquidada') THEN 1 ELSE 0 END) AS terminadas,
        SUM(CASE WHEN estado = 'Cancelada' THEN 1 ELSE 0 END) AS canceladas,
        SUM(CASE WHEN estado IN ('Regestión', 'Regestion') THEN 1 ELSE 0 END) AS regestion,
        SUM(CASE WHEN (codigo_seguimiento LIKE 'VTR-%' OR tipo_trabajo = 'REITERADA') THEN 1 ELSE 0 END) AS vtr_casos
      FROM ordenes
      WHERE DATE(fecha_visita) >= '2026-10-01' AND DATE(fecha_visita) <= '2026-10-13'
      GROUP BY DATE(fecha_visita)
      ORDER BY fecha ASC
    `);

    console.log('\n--- DESGLOSE DIARIO ---');
    dailyRows.forEach(row => {
      const base = Number(row.terminadas) + Number(row.canceladas) + Number(row.regestion);
      const ef = base > 0 ? ((Number(row.terminadas) / base) * 100).toFixed(1) : '0.0';
      console.log(`${row.fecha} (Día ${row.dia}): Tot=${row.total} | Term=${row.terminadas} | Canc=${row.canceladas} | Reg=${row.regestion} | %Ef=${ef}%`);
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

testScorecard();
