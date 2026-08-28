const db = require('./db');

async function syncActasSeries() {
  const prodId = 30; // ACTAS DE SERVICIO WIN / GUIAS

  // 1. Asegurar que las 500 actas de almacén central (001-04251 a 001-04750) existan con estado 'DISPONIBLE'
  for (let i = 4251; i <= 4750; i++) {
    const num = String(i).padStart(5, '0');
    const sn = `001-${num}`;
    await db.query(`
      INSERT INTO producto_series (id_producto, id_almacen, numero_serie, estado, fecha_ingreso)
      VALUES (?, 1, ?, 'DISPONIBLE', NOW())
      ON DUPLICATE KEY UPDATE estado = 'DISPONIBLE', id_almacen = 1
    `, [prodId, sn]);
  }
  console.log('✅ 500 series de actas para Almacén Central registradas.');

  // 2. Verificar que el conteo cuadre
  const [stockRow] = await db.query('SELECT cantidad FROM stock WHERE id_producto = ? AND id_almacen = 1', [prodId]);
  const [seriesRows] = await db.query('SELECT numero_serie, estado FROM producto_series WHERE id_producto = ?', [prodId]);
  
  const disp = seriesRows.filter(s => s.estado === 'DISPONIBLE').length;
  const res = seriesRows.filter(s => s.estado === 'RESERVADO').length;

  console.log(`Stock Central: ${stockRow[0].cantidad} | Series Disponibles: ${disp} | Series en Técnicos: ${res} | Total Series: ${seriesRows.length}`);
  process.exit();
}

syncActasSeries().catch(err => {
  console.error(err);
  process.exit(1);
});
