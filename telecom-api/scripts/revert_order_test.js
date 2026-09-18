const pool = require('../db');

async function revert() {
  console.log('--- REVIRTIENDO LIQUIDACIÓN DE ORDEN 3450769 ---');
  
  try {
    // 1. Obtener liquidaciones previas
    const [liqs] = await pool.query('SELECT id_liquidacion FROM orden_liquidaciones WHERE id_orden = 11427');
    for (const l of liqs) {
      await pool.query('DELETE FROM orden_liquidacion_detalle WHERE id_liquidacion = ?', [l.id_liquidacion]);
    }
    await pool.query('DELETE FROM orden_equipos_retirados WHERE id_orden = 11427');
    await pool.query('DELETE FROM orden_liquidaciones WHERE id_orden = 11427');
    console.log('✅ Liquidaciones anteriores eliminadas de la base de datos');

    // 2. Revertir estado de la orden
    await pool.query("UPDATE ordenes SET estado = 'Iniciada' WHERE id_orden = 11427");
    console.log('✅ Estado de orden #3450769 restablecido a Iniciada');

    // 3. Restaurar stock de PATCH COR (+1)
    await pool.query('UPDATE trabajador_productos SET stock = stock + 1 WHERE id_trabajador = 106 AND id_producto = 47');
    console.log('✅ Stock de PATCH COR restaurado al técnico');

    // 4. Restaurar Acta 001-04871 a estado Asignada / DISPONIBLE
    await pool.query(`
      UPDATE trabajador_series ts 
      JOIN producto_series ps ON ts.id_producto_serie = ps.id_producto_serie 
      SET ts.estado = 'Asignada', ps.estado = 'DISPONIBLE' 
      WHERE ps.numero_serie LIKE '%04871%'
    `);
    console.log('✅ Acta física 001-04871 restaurada a disponible');

    // 5. Restaurar ONT ZTEGDA04AA0E
    await pool.query(`
      UPDATE trabajador_series ts 
      JOIN producto_series ps ON ts.id_producto_serie = ps.id_producto_serie 
      SET ts.estado = 'Asignada', ps.estado = 'RESERVADO' 
      WHERE ps.numero_serie = 'ZTEGDA04AA0E'
    `);
    console.log('✅ ONT ZTEGDA04AA0E disponible y lista en stock del técnico');

    console.log('🎉 Reversión completada con éxito.');
  } catch (err) {
    console.error('Error al revertir:', err);
  } finally {
    process.exit(0);
  }
}

revert();
