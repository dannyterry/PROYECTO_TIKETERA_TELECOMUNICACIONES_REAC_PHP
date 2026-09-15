const mysql = require('mysql2/promise');

const REMOTE_CONFIG = {
  host: 'corporacioncespedes.com',
  user: 'corporacioncespe_miguel',
  password: 'corporacioncespe_123',
  database: 'corporacioncespe_cespedes',
  dateStrings: true
};

async function restoreGataOnProduction() {
  console.log('🔄 RESTAURANDO GATA HIDRAULICA (ID 86, GATC) EN HOSTING PRODUCCIÓN...\n');
  const remote = mysql.createPool(REMOTE_CONFIG);

  // 1. Restaurar stock a Almacén Principal = 6, Segundo uso = 0
  const [resStock] = await remote.query(`
    UPDATE stock 
    SET cantidad = 6, cantidad_segundo_uso = 0 
    WHERE id_producto = 86
  `);
  console.log(`✅ Stock actualizado en Almacén Principal: 6 unidades (Segundo uso: 0).`);

  // 2. Eliminar asignación accidental al técnico
  const [resDelete] = await remote.query(`
    DELETE FROM trabajador_productos 
    WHERE id_producto = 86
  `);
  console.log(`✅ Asignaciones en trabajador_productos eliminadas (${resDelete.affectedRows} filas afectadas).`);

  // 3. Registrar movimiento de ajuste / reversión
  await remote.query(`
    INSERT INTO movimientos (id_producto, id_almacen, tipo, cantidad, referencia, fecha_creacion)
    VALUES (86, 1, 'AJUSTE', 6, 'Restauración a Almacén Principal (Reversión de despacho accidental y segundo uso)', NOW())
  `);
  console.log(`✅ Movimiento de ajuste registrado en kardex / movimientos.`);

  // 4. Verificación final
  console.log('\n--- VERIFICACIÓN FINAL EN PRODUCCIÓN ---');
  const [stockFinal] = await remote.query('SELECT * FROM stock WHERE id_producto = 86');
  console.table(stockFinal);

  const [tpFinal] = await remote.query('SELECT * FROM trabajador_productos WHERE id_producto = 86');
  console.log('Trabajador Productos:', tpFinal.length === 0 ? 'Sin asignaciones (0 técnicos)' : tpFinal);

  process.exit();
}

restoreGataOnProduction().catch(err => {
  console.error('❌ Error al restaurar:', err);
  process.exit(1);
});
