const db = require('./db');

async function fixMeshStock() {
  const prodId = 38;

  // 1. Eliminar series no estándar o de pruebas
  await db.query("DELETE FROM producto_series WHERE id_producto = ? AND (numero_serie IN ('32143432432423R12', '32132131231243434') OR numero_serie LIKE 'ZTEGH196A00%')", [prodId]);
  console.log('✅ Series de prueba y temporales eliminadas.');

  // 2. Asegurar que las series ZTEGH196A0204 a ZTEGH196A0233 existan (exactamente 30 series en almacén)
  for (let i = 204; i <= 233; i++) {
    const sn = `ZTEGH196A0${i}`;
    await db.query(`
      INSERT INTO producto_series (id_producto, id_almacen, numero_serie, estado, fecha_ingreso)
      VALUES (?, 1, ?, 'DISPONIBLE', NOW())
      ON DUPLICATE KEY UPDATE estado = 'DISPONIBLE', id_almacen = 1
    `, [prodId, sn]);
  }
  console.log('✅ 30 series correlativas ZTEGH196A0204 a ZTEGH196A0233 registradas.');

  // 3. Ajustar stock central en tabla stock a exactamente 30
  await db.query("UPDATE stock SET cantidad = 30 WHERE id_producto = ? AND id_almacen = 1", [prodId]);
  console.log('✅ Stock de Almacén Central actualizado a 30.');

  // 4. Verificar resultado final
  const [stockRows] = await db.query('SELECT * FROM stock WHERE id_producto = ?', [prodId]);
  const [seriesRows] = await db.query('SELECT numero_serie, estado FROM producto_series WHERE id_producto = ?', [prodId]);
  console.log('Stock en DB:', stockRows[0]);
  console.log('Total series en DB:', seriesRows.length);
  const disp = seriesRows.filter(s => s.estado === 'DISPONIBLE').length;
  const res = seriesRows.filter(s => s.estado === 'RESERVADO').length;
  console.log(`Disponibles en Almacén: ${disp} | En Técnicos: ${res} | Total Series: ${seriesRows.length}`);

  process.exit();
}

fixMeshStock().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
