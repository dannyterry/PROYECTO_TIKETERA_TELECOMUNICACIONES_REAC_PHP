const mysql = require('mysql2/promise');

async function main() {
  const pool = mysql.createPool({ host: 'localhost', user: 'root', password: '', database: 'corporacioncespe_cespedes' });
  const [rows] = await pool.query("SELECT id_orden, numero, datos_tecnicos FROM ordenes WHERE (movil IS NULL OR movil = '') AND datos_tecnicos LIKE '%MOVIL%'");
  console.log(`Encontradas ${rows.length} órdenes con MOVIL en datos_tecnicos`);
  
  let updated = 0;
  for (const r of rows) {
    const m = r.datos_tecnicos.match(/MOVIL\s+(?:ULTIMO\s+CONTACTO|REFERENCIA)[^\/]*\/[^\/]*\/(\d{7,11})/i) ||
              r.datos_tecnicos.match(/MOVIL[^\/]*\/[^\/]*\/(\d{7,11})/i);
    if (m && m[1]) {
      await pool.query("UPDATE ordenes SET movil = ? WHERE id_orden = ?", [m[1], r.id_orden]);
      updated++;
    }
  }
  console.log(`Actualizadas ${updated} órdenes con su número de teléfono real.`);
  await pool.end();
}

main().catch(console.error);
