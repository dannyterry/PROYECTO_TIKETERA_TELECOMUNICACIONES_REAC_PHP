const https = require('https');
const jwt = require('jsonwebtoken');

const token = jwt.sign(
  { id_usuario: 1, id_rol: 1, usuario: 'admin' },
  'cespedes_jwt_secret_key_2026',
  { expiresIn: '12h' }
);

const options = {
  hostname: 'api.corporacioncespedes.com',
  path: '/api/auditoria/logs?modulo=GESTION&limite=1000',
  method: 'GET',
  headers: { 'Authorization': 'Bearer ' + token }
};

https.get(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      const hoy = json.filter(l => (l.fecha_creacion || '').startsWith('2026-10-13'));
      console.log('Total logs de hoy:', hoy.length);
      const llamadas = hoy.filter(l => l.accion === 'INCONCERT_TOGGLE');
      const obs = hoy.filter(l => l.accion === 'OBSERVACION_LLAMADA');
      console.log('Llamadas Inconcert registradas hoy:', llamadas.length);
      console.log('Observaciones registradas hoy:', obs.length);

      const ticketsLlamadas = [...new Set(llamadas.map(l => l.id_referencia))];
      console.log('Tickets unicos con llamada:', ticketsLlamadas.length, ticketsLlamadas);

      const obsMap = {};
      obs.forEach(l => {
        const m = l.descripcion.match(/obs\. de llamada: "([^"]+)"/i);
        if (m) obsMap[l.id_referencia] = m[1];
      });
      console.log('Observaciones mapeadas:', Object.keys(obsMap).length, obsMap);
    } catch(e) {
      console.error('Error parseando:', e.message);
    }
  });
}).on('error', err => console.error(err.message));
