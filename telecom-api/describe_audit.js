const db = require('./db');

async function showCols() {
  const [cols] = await db.query(`DESCRIBE auditoria_actividad`);
  console.table(cols);
  const [rows] = await db.query(`SELECT * FROM auditoria_actividad LIMIT 10`);
  console.log(`Total filas en auditoria_actividad: ${rows.length}`);
  console.table(rows);
  process.exit(0);
}

showCols();
