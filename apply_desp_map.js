const fs = require('fs');

const sql = fs.readFileSync('./telecom-api/backups/migracion_alinear_trabajadores_prod.sql', 'utf8');
const lines = sql.split(/\r?\n/);
const map = {};
for (const l of lines) {
  if (l.includes('asistencias')) {
    const parts = l.trim().split(' ');
    const newId = parseInt(parts[5]);
    const oldId = parseInt(parts[9].replace(';', ''));
    map[String(oldId)] = newId;
  }
}
// Especial: old 53 -> 141 (Ciro Infantes, cuyos productos fueron asignados a las 12:45)
map['53'] = 141;

let despSql = fs.readFileSync('./telecom-api/backups/crear_historial_despachos_prod.sql', 'utf8');
const despLines = despSql.split(/\r?\n/);
const newLines = [];

for (const line of despLines) {
  if (line.includes('INSERT INTO `despachos`')) {
    // Buscar patrón: VALUES (1, 'DSP-2026-00001', 44,
    const m = line.match(/VALUES \((\d+), '([^']+)', (\d+),/);
    if (m) {
      const idDesp = m[1];
      const cod = m[2];
      const oldWorkerId = m[3];
      const mappedId = map[String(oldWorkerId)] || oldWorkerId;
      console.log(`Despacho #${idDesp} (${cod}): old ${oldWorkerId} -> new ${mappedId}`);
      const replaced = line.replace(`VALUES (${idDesp}, '${cod}', ${oldWorkerId},`, `VALUES (${idDesp}, '${cod}', ${mappedId},`);
      newLines.push(replaced);
      continue;
    }
  }
  newLines.push(line);
}

fs.writeFileSync('./telecom-api/backups/crear_historial_despachos_prod.sql', newLines.join('\n'), 'utf8');
console.log('✅ crear_historial_despachos_prod.sql actualizado correctamente.');
