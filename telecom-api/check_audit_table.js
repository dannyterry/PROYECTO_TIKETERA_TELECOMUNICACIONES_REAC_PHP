const db = require('./db');

async function checkAudit() {
  const [rows] = await db.query(`
    SELECT * FROM auditoria_actividad ORDER BY id_auditoria DESC LIMIT 20
  `);
  console.log(`Total registros en auditoria_actividad: ${rows.length}`);
  console.table(rows);
  process.exit(0);
}

checkAudit();
