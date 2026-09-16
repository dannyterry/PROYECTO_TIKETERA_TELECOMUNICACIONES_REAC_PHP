const pool = require('../db');

const BASE_LAT = -12.1450; // Base Surco / San Juan de Miraflores
const BASE_LNG = -76.9800;

function calcularDistanciaHaversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

(async () => {
  const [workers] = await pool.query(`
    SELECT t.id_trabajador, u.cuadrilla, TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''), ' ', COALESCE(u.segundo_apellido, ''))) AS nombre_tecnico
    FROM trabajadores t
    JOIN usuarios u ON t.id_usuario = u.id_usuario
    WHERE t.estado = 'activo'
  `);

  const [ordenes] = await pool.query(`
    SELECT id_orden, numero, cliente, cuadrilla, tecnico_asignado, estado, georeferencia, direccion
    FROM ordenes
    WHERE DATE(COALESCE(fecha_solicitud, fecha_visita, fecha_creacion)) = CURDATE()
      AND LOWER(TRIM(estado)) = 'finalizada'
  `);

  console.log("Total órdenes finalizadas hoy:", ordenes.length);

  for (const w of workers) {
    const wc = (w.cuadrilla || '').toLowerCase().trim();
    const wn = (w.nombre_tecnico || '').toLowerCase().trim();

    const misOrdenes = ordenes.filter(o => {
      const c = (o.cuadrilla || '').toLowerCase();
      const t = (o.tecnico_asignado || '').toLowerCase();
      if (wc && c.includes(wc)) return true;
      if (wn && (t.includes(wn) || c.includes(wn))) return true;
      return false;
    });

    if (misOrdenes.length === 0) continue;

    const puntosRuta = [];
    for (const ord of misOrdenes) {
      const match = (ord.georeferencia || ord.direccion || '').match(/(-?\d{1,2}\.\d{4,8})\s*,\s*(-?\d{1,3}\.\d{4,8})/);
      if (match) {
        puntosRuta.push({ lat: Number(match[1]), lng: Number(match[2]), cliente: ord.cliente });
      }
    }

    let kmTotal = 0;
    if (puntosRuta.length > 0) {
      // Base -> Primer cliente
      let tramoBase1 = calcularDistanciaHaversine(BASE_LAT, BASE_LNG, puntosRuta[0].lat, puntosRuta[0].lng) * 1.35;
      kmTotal += tramoBase1;

      // Entre clientes
      for (let i = 0; i < puntosRuta.length - 1; i++) {
        let tramo = calcularDistanciaHaversine(puntosRuta[i].lat, puntosRuta[i].lng, puntosRuta[i+1].lat, puntosRuta[i+1].lng) * 1.35;
        kmTotal += tramo;
      }

      // Último cliente -> Base
      let tramoBaseFin = calcularDistanciaHaversine(puntosRuta[puntosRuta.length - 1].lat, puntosRuta[puntosRuta.length - 1].lng, BASE_LAT, BASE_LNG) * 1.35;
      kmTotal += tramoBaseFin;
    } else {
      kmTotal = 12 + (misOrdenes.length * 4.5);
    }

    console.log(`Técnico: ${w.nombre_tecnico} (${w.cuadrilla}) | Finalizadas: ${misOrdenes.length} | Puntos GPS: ${puntosRuta.length} | KM Estimado: ${Math.round(kmTotal * 10) / 10} km`);
  }

  process.exit(0);
})();
