const pool = require('./db.js');

function extractTechNameFromCuadrilla(cuadStr) {
  if (!cuadStr || cuadStr === '-') return '';
  let str = String(cuadStr).trim();
  const sgaMatch = str.match(/\bSGA[\s-_:•|/\\]+(.+)$/i);
  if (sgaMatch && sgaMatch[1] && sgaMatch[1].trim().length > 2) {
    str = sgaMatch[1].trim();
  }
  return str
    .replace(/^(?:[A-Z]\s*\d+\s*(?:MOTOWIN|CESPEDES|TRASLADO|SGA|WIN)?|CESPEDES|SGA|MOTOWIN|WIN|CONTRATISTA|MIGRACION|TRASLADO|INSTALACION)[\s-_:•|/\\]+/gi, '')
    .replace(/^(?:CESPEDES|SGA|MOTOWIN|WIN|CONTRATISTA|MIGRACION|TRASLADO|INSTALACION)[\s-_:•|/\\]+/gi, '')
    .replace(/^[-_:•|/\\.\s]+/, '')
    .replace(/[-_:•|/\\.\s]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function populateExistingOrders() {
  const [users] = await pool.query(
    "SELECT id_usuario, nombres, apellidos, primer_apellido, segundo_apellido FROM usuarios"
  );
  console.log(`Cargados ${users.length} usuarios.`);

  const [ordenes] = await pool.query(
    "SELECT id_orden, numero, cuadrilla, tecnico_asignado, id_tecnico FROM ordenes WHERE id_tecnico IS NULL AND cuadrilla IS NOT NULL AND cuadrilla != ''"
  );

  console.log(`Procesando ${ordenes.length} órdenes que tienen id_tecnico en NULL...`);
  let updated = 0;

  for (const ord of ordenes) {
    const rawName = extractTechNameFromCuadrilla(ord.cuadrilla);
    if (!rawName || rawName.length < 3) continue;

    const normRaw = rawName.toUpperCase();
    const found = users.find((u) => {
      const full1 = `${u.nombres || ''} ${u.apellidos || ''}`.toUpperCase().trim();
      const full2 = `${u.nombres || ''} ${u.primer_apellido || ''} ${u.segundo_apellido || ''}`.toUpperCase().trim();
      if (full1 && normRaw === full1) return true;
      if (full2 && normRaw === full2) return true;
      if (full1 && (normRaw.includes(full1) || full1.includes(normRaw))) return true;

      const nameParts = (u.nombres || '').toUpperCase().split(/\s+/).filter(p => p.length > 2);
      const apeParts = (u.apellidos || u.primer_apellido || '').toUpperCase().split(/\s+/).filter(p => p.length > 2);

      const hasName = nameParts.some(p => normRaw.includes(p));
      const hasApe = apeParts.some(p => normRaw.includes(p));
      return hasName && hasApe;
    });

    const finalId = found ? found.id_usuario : null;
    const finalNombre = found ? `${found.nombres} ${found.apellidos || found.primer_apellido || ''}`.trim() : rawName;

    await pool.query(
      "UPDATE ordenes SET id_tecnico = ?, tecnico_asignado = COALESCE(tecnico_asignado, ?) WHERE id_orden = ?",
      [finalId, finalNombre, ord.id_orden]
    );
    updated++;
  }

  console.log(`✅ ¡Completado! ${updated} órdenes actualizadas con id_tecnico y tecnico_asignado en MySQL.`);
  process.exit(0);
}

populateExistingOrders().catch(err => {
  console.error(err);
  process.exit(1);
});
