const https = require('https');
const jwt = require('jsonwebtoken');

const token = jwt.sign(
  { id_usuario: 1, id_rol: 1, usuario: 'admin' },
  'cespedes_jwt_secret_key_2026',
  { expiresIn: '12h' }
);

const options = {
  hostname: 'api.corporacioncespedes.com',
  path: '/ordenes?fechaDesde=2026-10-13&fechaHasta=2026-10-13',
  method: 'GET',
  headers: { 'Authorization': 'Bearer ' + token }
};

https.get(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      const siLlamadas = json.filter(o => o.llamada_inconcert === 'Si' || o.llamada_inconcert === 'SI');
      const conObs = json.filter(o => o.observacion_llamada && o.observacion_llamada.trim().length > 0);
      console.log('Total ordenes hoy:', json.length);
      console.log('Ordenes con llamada Si:', siLlamadas.length);
      console.log('Ordenes con observacion de llamada:', conObs.length);
      console.log('Primeras 5 órdenes comprobadas:');
      json.slice(0, 5).forEach(o => {
        console.log(`- Ticket: ${o.numero} | Cliente: ${o.cliente} | Llamada: ${o.llamada_inconcert} | Obs: ${o.observacion_llamada}`);
      });
    } catch(e) { console.error('Error:', e.message); }
  });
}).on('error', err => console.error(err.message));
