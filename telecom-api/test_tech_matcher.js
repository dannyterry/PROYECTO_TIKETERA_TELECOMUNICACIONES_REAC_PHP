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

async function testAutoMatching() {
  const [users] = await pool.query(
    "SELECT id_usuario, nombres, apellidos, primer_apellido, segundo_apellido FROM usuarios"
  );
  console.log(`Cargados ${users.length} usuarios de la base de datos.`);

  const [ordenes] = await pool.query(
    "SELECT id_orden, numero, cuadrilla, tecnico_asignado, id_tecnico FROM ordenes WHERE fecha_visita >= '2026-08-30' LIMIT 30"
  );

  console.log(`Evaluando ${ordenes.length} órdenes recientes...`);
  let matched = 0;

  for (const ord of ordenes) {
    const rawName = extractTechNameFromCuadrilla(ord.cuadrilla);
    if (!rawName) continue;

    const normRaw = rawName.toUpperCase();
    
    // Buscar en usuarios
    const found = users.find((u) => {
      const full1 = `${u.nombres || ''} ${u.apellidos || ''}`.toUpperCase().trim();
      const full2 = `${u.nombres || ''} ${u.primer_apellido || ''} ${u.segundo_apellido || ''}`.toUpperCase().trim();
      if (full1 && normRaw === full1) return true;
      if (full2 && normRaw === full2) return true;
      if (full1 && (normRaw.includes(full1) || full1.includes(normRaw))) return true;

      // Dividir nombres y apellidos
      const nameParts = (u.nombres || '').toUpperCase().split(/\s+/).filter(p => p.length > 2);
      const apeParts = (u.apellidos || u.primer_apellido || '').toUpperCase().split(/\s+/).filter(p => p.length > 2);

      const hasName = nameParts.some(p => normRaw.includes(p));
      const hasApe = apeParts.some(p => normRaw.includes(p));
      return hasName && hasApe;
    });

    if (found) {
      matched++;
      console.log(`✅ Orden ${ord.numero}: Cuadrilla "${ord.cuadrilla}" ➔ Técnico Extraído "${rawName}" ➔ MATCH Usuario #${found.id_usuario} (${found.nombres} ${found.apellidos})`);
    } else {
      console.log(`⚠️ Orden ${ord.numero}: Cuadrilla "${ord.cuadrilla}" ➔ Extraído "${rawName}" ➔ (Sin coincidencia en tabla usuarios)`);
    }
  }

  console.log(`\nResumen: ${matched}/${ordenes.length} órdenes vinculadas automáticamente con éxito.`);
  process.exit(0);
}

testAutoMatching().catch(err => {
  console.error(err);
  process.exit(1);
});
