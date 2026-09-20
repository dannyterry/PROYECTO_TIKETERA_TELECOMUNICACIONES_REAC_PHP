const fs = require('fs');
const db = require('./telecom-api/db');

async function test() {
  const sql = fs.readFileSync('./telecom-api/backups/migracion_alinear_trabajadores_prod.sql', 'utf8');
  const lines = sql.split(/\r?\n/);
  const mappings = {};

  for (const line of lines) {
    if (line.includes('UPDATE') && line.includes('asistencias')) {
      const parts = line.split(' ');
      const newId = parseInt(parts[4]);
      const oldId = parseInt(parts[7].replace(';', ''));
      mappings[oldId] = newId;
    }
  }

  console.log('Total mappings encontrados:', Object.keys(mappings).length);

  const [movs] = await db.query(`
    SELECT DISTINCT fecha_creacion, referencia 
    FROM movimientos 
    WHERE referencia LIKE '%Despacho a Técnico%' 
    ORDER BY fecha_creacion ASC
  `);

  console.log('\n--- CRUCE DE MOVIMIENTOS HISTÓRICOS CON TÉCNICOS ---');
  for (const m of movs) {
    const match = m.referencia.match(/Técnico #(\d+)/);
    const rawOldId = match ? parseInt(match[1]) : 0;
    const mappedNewId = mappings[rawOldId] || rawOldId;

    const [u] = await db.query(`
      SELECT u.id_usuario, u.nombres, u.primer_apellido 
      FROM trabajadores t 
      JOIN usuarios u ON t.id_usuario = u.id_usuario 
      WHERE t.id_trabajador = ?
    `, [mappedNewId]);

    console.log(`Fecha: ${m.fecha_creacion} | Ref: Técnico #${rawOldId} -> Nuevo ID: #${mappedNewId} | Técnico: ${u[0]?.nombres} ${u[0]?.primer_apellido}`);
  }

  process.exit();
}

test();
