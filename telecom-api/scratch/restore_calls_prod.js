const https = require('https');
const jwt = require('jsonwebtoken');

const token = jwt.sign(
  { id_usuario: 1, id_rol: 1, usuario: 'admin' },
  'cespedes_jwt_secret_key_2026',
  { expiresIn: '12h' }
);

function httpReq(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.corporacioncespedes.com',
      path: path,
      method: method,
      headers: {
        'Authorization': 'Bearer ' + token,
        ...(postData ? {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        } : {})
      }
    };
    const req = https.request(options, (res) => {
      let resData = '';
      res.on('data', chunk => resData += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, json: JSON.parse(resData) });
        } catch(e) {
          resolve({ status: res.statusCode, raw: resData });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('🔄 1. Obteniendo las órdenes de hoy de producción...');
  const { json: ordenesHoy } = await httpReq('GET', '/ordenes?fechaDesde=2026-10-13&fechaHasta=2026-10-13');
  console.log(`Órdenes cargadas: ${ordenesHoy.length}`);

  // Mapear por codigo_seguimiento (VTEXT-...) y por numero (351...) y por cliente
  const mapByTicket = new Map();
  for (const o of ordenesHoy) {
    if (o.codigo_seguimiento) mapByTicket.set(String(o.codigo_seguimiento).trim(), o);
    if (o.numero) mapByTicket.set(String(o.numero).trim(), o);
  }

  console.log('\n🔄 2. Obteniendo logs de auditoría de hoy...');
  const { json: logs } = await httpReq('GET', '/api/auditoria/logs?modulo=GESTION&limite=1000');
  const hoyLogs = logs.filter(l => (l.fecha_creacion || '').startsWith('2026-10-13'));
  console.log(`Logs de hoy encontrados: ${hoyLogs.length}`);

  // Recopilar llamadas y observaciones
  const llamadasTickets = new Set();
  const obsTickets = new Map();

  // Los logs vienen en orden DESC, por lo que el primer match para cada ticket es el más reciente
  for (const l of hoyLogs) {
    const ref = (l.id_referencia || '').trim();
    if (!ref) continue;

    if (l.accion === 'INCONCERT_TOGGLE' && (l.descripcion || '').includes("'Sí'")) {
      llamadasTickets.add(ref);
    }

    if (l.accion === 'OBSERVACION_LLAMADA' && !obsTickets.has(ref)) {
      const m = (l.descripcion || '').match(/obs\. de llamada: "([^"]+)"/i);
      if (m && m[1]) {
        obsTickets.set(ref, m[1].trim());
      }
    }
  }

  console.log(`Llamadas a restaurar: ${llamadasTickets.size}`);
  console.log(`Observaciones a restaurar: ${obsTickets.size}`);

  // Restaurar llamadas Inconcert
  let llamadasRestauradas = 0;
  for (const ticket of llamadasTickets) {
    const orden = mapByTicket.get(ticket);
    if (orden) {
      const res = await httpReq('PUT', `/ordenes/${orden.id_orden}/inconcert`, {
        numero: orden.numero,
        llamada_inconcert: 'Si',
        inconcert: 'Si'
      });
      if (res.status === 200) llamadasRestauradas++;
    } else {
      console.warn(`No se encontró orden para ticket de llamada: ${ticket}`);
    }
  }
  console.log(`✅ Llamadas restauradas correctamente: ${llamadasRestauradas}/${llamadasTickets.size}`);

  // Restaurar observaciones de llamada
  let obsRestauradas = 0;
  for (const [ticket, obsText] of obsTickets.entries()) {
    const orden = mapByTicket.get(ticket);
    if (orden) {
      const res = await httpReq('PUT', `/ordenes/${orden.id_orden}/observacion-llamada`, {
        numero: orden.numero,
        observacionLlamada: obsText,
        observacion_llamada: obsText
      });
      if (res.status === 200) obsRestauradas++;
    } else {
      console.warn(`No se encontró orden para ticket de obs: ${ticket}`);
    }
  }
  console.log(`✅ Observaciones restauradas correctamente: ${obsRestauradas}/${obsTickets.size}`);

  console.log('\n🎉 ¡RESTAURACIÓN FINALIZADA CON ÉXITO!');
}

main().catch(console.error);
