const mysql = require('mysql2/promise');

async function verifyStockCamioneta() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  console.log('================================================================');
  console.log('🔍 CORROBORACIÓN EXACTA DEL STOCK EN CAMIONETA: WIL NELSON CARHUAZ');
  console.log('================================================================\n');

  // 1. Insumos y Materiales en Camioneta (trabajador_productos)
  const [materiales] = await conn.query(`
    SELECT 
      tp.id_producto,
      p.codigo,
      p.nombre,
      p.es_drop,
      p.maneja_serie,
      COALESCE(c.nombre, 'MATERIALES') AS categoria,
      tp.stock
    FROM trabajador_productos tp
    JOIN productos p ON tp.id_producto = p.id_producto
    LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
    WHERE tp.id_trabajador = 64 AND tp.stock > 0
    ORDER BY c.nombre ASC, p.nombre ASC
  `);

  console.log(`📦 INSUMOS & MATERIALES EN CAMIONETA (Total: ${materiales.length} ítems):`);
  console.table(materiales.map(m => ({
    Producto: m.nombre,
    Stock_Actual: `${m.stock} ${m.es_drop ? 'm' : 'und'}`,
    Categoria: m.categoria,
    Maneja_Serie: m.maneja_serie ? 'SÍ' : 'NO'
  })));

  // 2. Series asignadas en Camioneta (trabajador_series)
  const [series] = await conn.query(`
    SELECT 
      ts.id_trabajador_serie,
      ps.id_producto_serie,
      ps.numero_serie,
      ps.codigo_serie,
      p.id_producto,
      p.nombre AS equipo_nombre,
      COALESCE(c.nombre, 'EQUIPOS') AS categoria,
      ts.estado
    FROM trabajador_series ts
    JOIN producto_series ps ON ts.id_producto_serie = ps.id_producto_serie
    JOIN productos p ON ts.id_producto = p.id_producto
    LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
    WHERE ts.id_trabajador = 64 AND ts.estado = 'Asignada'
    ORDER BY p.nombre ASC, ps.numero_serie ASC
  `);

  const equipos = series.filter(s => !s.equipo_nombre.toUpperCase().includes('ACTA'));
  const actas = series.filter(s => s.equipo_nombre.toUpperCase().includes('ACTA'));

  console.log(`\n📱 EQUIPOS CON SERIES (Total: ${equipos.length} unidades en mano):`);
  console.table(equipos.map(e => ({
    Modelo: e.equipo_nombre,
    Numero_Serie: e.numero_serie,
    Codigo_Serie: e.codigo_serie || 'N/A',
    Estado: e.estado
  })));

  console.log(`\n📋 ACTAS FÍSICAS ASIGNADAS (Total: ${actas.length} series activas en talonarios):`);
  const seriesNumeros = actas.map(a => a.numero_serie);
  console.log(`Primera serie: ${seriesNumeros[0]} | Última serie: ${seriesNumeros[seriesNumeros.length - 1]}`);
  console.log(`Listado completo de Actas asignadas:`);
  console.log(seriesNumeros.join(', '));

  // 3. Resumen de Actas usadas / liquidadas en órdenes
  const [actasUsadas] = await conn.query(`
    SELECT 
      ts.id_trabajador_serie,
      ps.numero_serie,
      ts.estado,
      p.nombre
    FROM trabajador_series ts
    JOIN producto_series ps ON ts.id_producto_serie = ps.id_producto_serie
    JOIN productos p ON ts.id_producto = p.id_producto
    WHERE ts.id_trabajador = 64 AND ts.estado != 'Asignada'
  `);
  console.log(`\n📑 ACTAS LIQUIDADAS / USADAS (Total: ${actasUsadas.length}):`);
  console.table(actasUsadas);

  await conn.end();
}

verifyStockCamioneta().catch(console.error);
