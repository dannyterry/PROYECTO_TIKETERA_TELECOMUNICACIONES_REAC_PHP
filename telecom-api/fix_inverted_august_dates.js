const db = require('./db');

async function fixInvertedDates() {
  console.log('🔄 Corrigiendo fechas invertidas de Agosto...');

  // 1. Fechas invertidas (09/08, 10/08, 11/08, 12/08)
  const updates = [
    { from: '2026-09-08', to: '2026-08-09' },
    { from: '2026-10-08', to: '2026-08-10' },
    { from: '2026-11-08', to: '2026-08-11' },
    { from: '2026-12-08', to: '2026-08-12' }
  ];

  for (const item of updates) {
    const [resSol] = await db.query(`
      UPDATE ordenes 
      SET fecha_solicitud = CONCAT(?, ' ', TIME(fecha_solicitud))
      WHERE DATE(fecha_solicitud) = ?
    `, [item.to, item.from]);

    const [resVis] = await db.query(`
      UPDATE ordenes 
      SET fecha_visita = CONCAT(?, ' ', TIME(fecha_visita))
      WHERE DATE(fecha_visita) = ?
    `, [item.to, item.from]);

    console.log(`✅ Corregido ${item.from} -> ${item.to} (Solicitudes: ${resSol.affectedRows}, Visitas: ${resVis.affectedRows})`);
  }

  // 2. Corregir fecha 1899
  const [res1899] = await db.query(`
    UPDATE ordenes 
    SET fecha_solicitud = fecha_visita 
    WHERE YEAR(fecha_solicitud) < 2000
  `);
  console.log(`✅ Corregidas órdenes con año 1899: ${res1899.affectedRows}`);

  // 3. Verificar distribución final
  const [grouped] = await db.query(`
    SELECT 
      MONTH(COALESCE(fecha_solicitud, fecha_visita)) as mes, 
      COUNT(*) as total
    FROM ordenes
    WHERE YEAR(COALESCE(fecha_solicitud, fecha_visita)) = 2026
    GROUP BY MONTH(COALESCE(fecha_solicitud, fecha_visita))
    ORDER BY mes ASC
  `);

  console.log('\n📊 Distribución mensual corregida (2026):');
  console.table(grouped);
  process.exit(0);
}

fixInvertedDates().catch(e => {
  console.error(e);
  process.exit(1);
});
