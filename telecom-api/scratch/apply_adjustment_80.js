const mysql = require('mysql2/promise');

async function applyAdjustment() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  console.log('================================================================');
  console.log('🚀 APLICANDO AJUSTE DE +80 UNIDADES A TEMPLADORES (id_producto: 49)');
  console.log('================================================================\n');

  // 1. Ver stock antes
  const [stockAntes] = await conn.execute(`
    SELECT * FROM stock WHERE id_producto = 49
  `);
  console.log('Stock antes en Almacén Central:');
  console.table(stockAntes);

  // 2. Actualizar stock
  await conn.execute(`
    UPDATE stock 
    SET cantidad = cantidad + 80 
    WHERE id_producto = 49 AND (id_almacen = 1 OR id_almacen IS NULL)
  `);

  // 3. Registrar movimiento en Kardex
  await conn.execute(`
    INSERT INTO movimientos (id_producto, id_almacen, tipo, cantidad, referencia, fecha_creacion)
    VALUES (49, 1, 'ENTRADA', 80, 'Ajuste de inventario: Reincorporación de 80 und por asignaciones eliminadas (#31 y #66)', NOW())
  `);

  // 4. Ver stock después
  const [stockDespues] = await conn.execute(`
    SELECT * FROM stock WHERE id_producto = 49
  `);
  console.log('\nStock después en Almacén Central:');
  console.table(stockDespues);

  // 5. Ver total en carros
  const [carros] = await conn.execute(`
    SELECT SUM(stock) as total_carros FROM trabajador_productos WHERE id_producto = 49
  `);
  const totalCarros = Number(carros[0]?.total_carros || 0);

  // 6. Ver total gastado en órdenes
  const [gastado] = await conn.execute(`
    SELECT SUM(cantidad) as total_gastado FROM orden_liquidacion_detalle WHERE id_producto = 49
  `);
  const totalGastado = Number(gastado[0]?.total_gastado || 0);

  const stockCentral = Number(stockDespues[0]?.cantidad || 0);
  const totalEmpresa = stockCentral + totalCarros;

  console.log('\n================================================================');
  console.log('📊 RESUMEN FINAL DE TEMPLADORES:');
  console.log(`• Stock en Almacén Central:       ${stockCentral} und`);
  console.log(`• Stock en Camionetas (Carros):    ${totalCarros} und`);
  console.log(`• Stock TOTAL EMPRESA:            ${totalEmpresa} und`);
  console.log(`• Gastado/Instalado en Clientes:  ${totalGastado} und`);
  console.log(`----------------------------------------------------------------`);
  console.log(`• BALANCE TOTAL COMPRAS:          ${stockCentral} + ${totalCarros} + ${totalGastado} = ${stockCentral + totalCarros + totalGastado} und (Factura Compra = 2,100 und)`);
  console.log('================================================================');

  await conn.end();
}

applyAdjustment().catch(console.error);
