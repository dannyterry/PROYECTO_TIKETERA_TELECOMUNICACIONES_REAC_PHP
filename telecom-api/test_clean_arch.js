const http = require('http');

const data = JSON.stringify({
  tecnico: 'PAUL ALBERTO CAPCHA RIOS / YOFRE DAVID AGUIN MONTOYA'
});

const req = http.request(
  {
    hostname: 'localhost',
    port: 3000,
    path: '/ordenes/3403317/tecnico',
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  },
  (res) => {
    const pool = require('./db.js');
    setTimeout(async () => {
      const [rows] = await pool.query(
        "SELECT numero, id_tecnico, id_tecnico_reemplazo, tecnico_asignado FROM ordenes WHERE numero = '3403317'"
      );
      console.log('✅ MySQL Fila en tabla ordenes:', rows[0]);

      http.get('http://localhost:3000/ordenes?t=' + Date.now(), (res2) => {
        let body = '';
        res2.on('data', (c) => (body += c));
        res2.on('end', () => {
          const parsed = JSON.parse(body);
          const ord = (parsed.ordenes || parsed).find((o) => o.numero == '3403317');
          console.log('✅ GET /ordenes entregó a React:', {
            ticket: ord?.numero,
            titular: ord?.nombre_tecnico,
            apoyo: ord?.nombre_tecnico_2,
            id_t1: ord?.id_tecnico,
            id_t2: ord?.id_tecnico_reemplazo
          });
          process.exit(0);
        });
      });
    }, 500);
  }
);

req.write(data);
req.end();
