const db = require('./db');

async function checkAugustDays() {
  const [rows] = await db.query(`
    SELECT DATE(fecha_solicitud) as dia, COUNT(*) as total
    FROM ordenes
    WHERE YEAR(fecha_solicitud) = 2026 AND MONTH(fecha_solicitud) >= 8
    GROUP BY DATE(fecha_solicitud)
    ORDER BY dia ASC
  `);
  console.table(rows);
  process.exit(0);
}

checkAugustDays();
