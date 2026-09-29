const pool = require('../db');

(async () => {
  try {
    const res = await fetch('http://localhost:3000/api/inventario/transferencias/solicitar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_trabajador_origen: 75, // Klinder
        id_trabajador_destino: 64, // Wil Nelson
        motivo: 'Prueba de transferencia',
        materiales: [],
        series: [
          {
            id_producto: 1,
            id_producto_serie: null,
            numero_serie: '001-44144',
            nombre_producto: 'ACTA'
          }
        ]
      })
    });
    const data = await res.json();
    console.log('Respuesta de API:', data);
  } catch (err) {
    console.error(err);
  }
  process.exit();
})();
