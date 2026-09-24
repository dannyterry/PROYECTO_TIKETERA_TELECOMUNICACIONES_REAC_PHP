const db = require('../db');

async function run() {
  const [tables] = await db.query("SHOW TABLES");
  console.log("All tables:", tables.map(t => Object.values(t)[0]).filter(n => n.includes('liq') || n.includes('acta') || n.includes('orden') || n.includes('material')));
  
  // Find order 3461673
  const [ords] = await db.query("SHOW TABLES LIKE '%orden%'");
  for (const t of ords) {
    const tbl = Object.values(t)[0];
    try {
      const [r] = await db.query(`SELECT * FROM \`${tbl}\` WHERE numero_orden LIKE '%3461673%' OR numero_acta LIKE '%44722%' LIMIT 1`);
      if (r && r.length > 0) {
        console.log(`Found in table ${tbl}:`, JSON.stringify(r[0], null, 2));
      }
    } catch (e) {}
  }
  process.exit(0);
}
run();
