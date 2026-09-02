const pool = require('./db.js');

function extractCuadKey(str) {
  if (!str || str === '-') return '';
  const s = String(str).toUpperCase().trim();
  const match = s.match(/\b([A-Z]\s*\d+\s*(?:MOTOWIN|CESPEDES|TRASLADO)?|[A-Z]\s*\d+)/i);
  if (match) return match[1].replace(/\s+/g, ' ').trim();
  const sga = s.split('SGA')[0].replace(/^CUADRILLA\s+/i, '').trim();
  return sga || s;
}

async function analyze() {
  console.log("==================================================");
  console.log("📊 ANÁLISIS DE CUADRILLAS FRECUENTES (ÚLTIMOS 14 DÍAS)");
  console.log("==================================================\n");

  const [users] = await pool.query(
    "SELECT id_usuario, nombres, apellidos, primer_apellido, segundo_apellido, cuadrilla as cuadrilla_actual FROM usuarios WHERE estado = 'Activo' ORDER BY id_usuario ASC"
  );

  const results = [];

  for (const u of users) {
    const fullName = `${u.nombres} ${u.primer_apellido || u.apellidos || ''}`.trim();

    // Consultar órdenes de los últimos 14 días para este técnico
    const [orders] = await pool.query(
      `SELECT cuadrilla, DATE(fecha_visita) as fecha, COUNT(*) as cant
       FROM ordenes
       WHERE id_tecnico = ? AND fecha_visita >= DATE_SUB('2026-09-02', INTERVAL 14 DAY)
         AND cuadrilla IS NOT NULL AND cuadrilla != ''
       GROUP BY cuadrilla, DATE(fecha_visita)
       ORDER BY fecha DESC`,
      [u.id_usuario]
    );

    if (orders.length === 0) continue;

    // Contar frecuencia por clave de cuadrilla
    const freqMap = {};
    const daysMap = {};

    orders.forEach(o => {
      const key = extractCuadKey(o.cuadrilla);
      freqMap[key] = (freqMap[key] || 0) + o.cant;
      if (!daysMap[key]) daysMap[key] = new Set();
      daysMap[key].add(o.fecha);
    });

    let bestKey = '';
    let maxOrders = 0;
    let daysWorked = 0;

    for (const k in freqMap) {
      if (freqMap[k] > maxOrders) {
        maxOrders = freqMap[k];
        bestKey = k;
        daysWorked = daysMap[k].size;
      }
    }

    const currentKey = extractCuadKey(u.cuadrilla_actual);
    const hasChange = bestKey && currentKey !== bestKey;

    results.push({
      id: u.id_usuario,
      tecnico: fullName,
      cuadrilla_en_perfil: u.cuadrilla_actual || 'SIN ASIGNAR',
      cuadrilla_real_frecuente: bestKey,
      dias_trabajados: daysWorked,
      ordenes_recientes: maxOrders,
      cambio_detectado: hasChange ? '🚨 SÍ CAMBIÓ' : '✅ IGUAL'
    });
  }

  console.table(results);
  process.exit(0);
}

analyze().catch(console.error);
