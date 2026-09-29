const pool = require('../db');

(async () => {
  try {
    const [series] = await pool.query(`
      SELECT ts.id_trabajador, ts.id_producto, ts.id_producto_serie, ps.numero_serie, p.nombre as producto_nombre
      FROM trabajador_series ts
      JOIN producto_series ps ON ts.id_producto_serie = ps.id_producto_serie
      JOIN productos p ON ts.id_producto = p.id_producto
      WHERE ts.id_trabajador = 75 AND ts.estado = 'Asignada'
      LIMIT 1
    `);
    console.log('Serie de Klinder lista para probar:', series);

    if (series.length > 0) {
      const ser = series[0];
      const res = await fetch('http://localhost:3000/api/inventario/transferencias/solicitar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_trabajador_origen: 75,
          id_trabajador_destino: 64, // Wil Nelson
          motivo: 'Prueba automática de validación',
          materiales: [],
          series: [
            {
              id_producto: ser.id_producto,
              id_producto_serie: ser.id_producto_serie,
              numero_serie: ser.numero_serie,
              nombre_producto: ser.producto_nombre
            }
          ]
        })
      });
      const data = await res.json();
      console.log('Resultado de solicitar transferencia:', data);

      if (data.success && data.id_transferencia) {
        console.log('Ahora probando responder (Aceptar) por Wil Nelson (64)...');
        const resResp = await fetch(`http://localhost:3000/api/inventario/transferencias/${data.id_transferencia}/responder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_trabajador_destino: 64,
            accion: 'ACEPTAR'
          })
        });
        const dataResp = await resResp.json();
        console.log('Resultado responder:', dataResp);

        // Devolver la serie a Klinder para dejarlo en su estado original
        await pool.query(
          "UPDATE trabajador_series SET id_trabajador = 75, estado = 'Asignada' WHERE id_producto_serie = ?",
          [ser.id_producto_serie]
        );
        console.log('✅ Serie retornada a Klinder para no alterar sus datos.');
      }
    }
  } catch (err) {
    console.error(err);
  }
  process.exit();
})();
