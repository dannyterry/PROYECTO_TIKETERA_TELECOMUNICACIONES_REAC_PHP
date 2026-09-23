const mysql = require('mysql2/promise');

const REMOTE_CONFIG = {
  host: 'corporacioncespedes.com',
  user: 'corporacioncespe_miguel',
  password: 'corporacioncespe_123',
  database: 'corporacioncespe_cespedes',
  dateStrings: true,
  connectTimeout: 30000
};

async function executeInProduction() {
  console.log('🔴 Conectando a Base de Datos de PRODUCCIÓN (corporacioncespedes.com)...');
  const conn = await mysql.createConnection(REMOTE_CONFIG);
  console.log('✅ Conexión establecida con éxito.');

  try {
    // 1. Grapas #6 (GRAC): Sumar +2 en detalle_compras y en stock central
    console.log('\n--- 1. ACTUALIZANDO GRAPAS #6 (GRAC) EN PRODUCCIÓN ---');
    const [grapasProd] = await conn.query("SELECT id_producto, nombre, codigo FROM productos WHERE codigo = 'GRAC' LIMIT 1");
    if (grapasProd.length === 0) {
      throw new Error("No se encontró producto con código GRAC en producción");
    }
    const idGrapas = grapasProd[0].id_producto;

    // Actualizar detalle_compras
    const [resDc] = await conn.query("UPDATE detalle_compras SET cantidad = cantidad + 2 WHERE id_producto = ?", [idGrapas]);
    console.log(`Detalle compras actualizado en producción: ${resDc.affectedRows} fila(s) afectada(s).`);

    // Actualizar stock central a 1800 (+2 a 1798)
    const [resStk] = await conn.query("UPDATE stock SET cantidad = 1800 WHERE id_producto = ?", [idGrapas]);
    console.log(`Stock central actualizado a 1800 en producción: ${resStk.affectedRows} fila(s) afectada(s).`);

    // 2. Categoría VEHICULO: Poner stock central en 0 (sin tocar asignaciones de técnicos)
    console.log('\n--- 2. RESETEANDO STOCK CENTRAL DE CATEGORÍA VEHICULO EN PRODUCCIÓN ---');
    const [resVeh] = await conn.query(`
      UPDATE stock 
      SET cantidad = 0, cantidad_segundo_uso = 0 
      WHERE id_producto IN (SELECT id_producto FROM productos WHERE id_categoria = 10)
    `);
    console.log(`Stock central de categoría VEHICULO reseteado a 0: ${resVeh.affectedRows} fila(s) afectada(s).`);

    // 3. Verificación en Producción
    console.log('\n--- 3. VERIFICACIÓN FINAL EN PRODUCCIÓN ---');
    const [checkGrapas] = await conn.query(`
      SELECT 
        p.id_producto, 
        p.codigo, 
        p.nombre, 
        s.cantidad AS stock_central, 
        (SELECT COALESCE(SUM(tp.stock), 0) FROM trabajador_productos tp WHERE tp.id_producto = p.id_producto) AS en_carros,
        (s.cantidad + (SELECT COALESCE(SUM(tp.stock), 0) FROM trabajador_productos tp WHERE tp.id_producto = p.id_producto)) AS total_empresa
      FROM productos p
      JOIN stock s ON p.id_producto = s.id_producto
      WHERE p.id_producto = ?
    `, [idGrapas]);
    console.log('ESTADO FINAL GRAPAS #6:', checkGrapas[0]);

    const [checkVeh] = await conn.query(`
      SELECT p.id_producto, p.nombre, p.codigo, s.cantidad AS stock_central, s.cantidad_segundo_uso
      FROM productos p
      JOIN stock s ON p.id_producto = s.id_producto
      WHERE p.id_categoria = 10
    `);
    console.log(`Total productos de categoría VEHICULO con stock 0: ${checkVeh.length}`);
    checkVeh.forEach(v => {
      console.log(` • ${v.nombre} (${v.codigo}) -> Stock Central: ${v.stock_central}, 2do Uso: ${v.cantidad_segundo_uso}`);
    });

    console.log('\n🎉 ¡PROCESO EN PRODUCCIÓN COMPLETADO CON ÉXITO!');
  } finally {
    await conn.end();
  }
}

executeInProduction().catch(err => {
  console.error('❌ Error en producción:', err);
  process.exit(1);
});
