const mysql = require('mysql2/promise');

async function inspect80Units() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  console.log('================================================================');
  console.log('🔍 ANÁLISIS DE LAS 80 UNIDADES (TÉCNICOS #66 Y #31)');
  console.log('================================================================\n');

  // 1. Ver los 2 movimientos específicos de salida en tabla movimientos
  const [movs] = await conn.execute(`
    SELECT * FROM movimientos WHERE id_movimiento IN (160, 202)
  `);
  console.log('1. MOVIMIENTOS EN BD:');
  console.table(movs);

  // 2. Buscar si existen trabajadores o usuarios con ID 66 y 31
  const [trabajadores] = await conn.execute(`
    SELECT t.id_trabajador, t.id_usuario, t.id_vehiculo,
           u.nombres, u.primer_apellido, u.segundo_apellido, u.documento, u.cuadrilla, u.estado
    FROM trabajadores t
    JOIN usuarios u ON t.id_usuario = u.id_usuario
    WHERE t.id_trabajador IN (31, 66) OR u.id_usuario IN (31, 66)
  `);
  console.log('\n2. TRABAJADORES CON ID 31 O 66:');
  console.table(trabajadores);

  // 3. Buscar si existen usuarios con ID 31 y 66 en general
  const [usuarios] = await conn.execute(`
    SELECT id_usuario, nombres, primer_apellido, segundo_apellido, documento, cuadrilla, estado, id_rol
    FROM usuarios
    WHERE id_usuario IN (31, 66)
  `);
  console.log('\n3. USUARIOS CON ID 31 O 66:');
  console.table(usuarios);

  // 4. Buscar despachos registrados para trabajador 31 y 66
  const [despachos] = await conn.execute(`
    SELECT d.*, dd.*
    FROM despachos d
    LEFT JOIN despacho_detalles dd ON d.id_despacho = dd.id_despacho
    WHERE d.id_trabajador IN (31, 66)
  `);
  console.log('\n4. DESPACHOS EN TABLA despachos / despacho_detalles PARA 31 Y 66:');
  console.table(despachos);

  // 5. Buscar stock en trabajador_productos para 31 y 66
  const [stockTec] = await conn.execute(`
    SELECT tp.*, p.nombre as producto
    FROM trabajador_productos tp
    JOIN productos p ON tp.id_producto = p.id_producto
    WHERE tp.id_trabajador IN (31, 66)
  `);
  console.log('\n5. STOCK EN trabajador_productos PARA 31 Y 66:');
  console.table(stockTec);

  // 6. Revisar si hay liquidaciones o devoluciones para 31 y 66
  const [liq] = await conn.execute(`
    SELECT ol.*, old.*
    FROM orden_liquidaciones ol
    LEFT JOIN orden_liquidacion_detalle old ON ol.id_liquidacion = old.id_liquidacion
    WHERE ol.id_trabajador IN (31, 66)
  `);
  console.log('\n6. LIQUIDACIONES PARA 31 Y 66:');
  console.table(liq);

  // 7. Ver cómo se borran asignaciones en el backend
  console.log('\n7. REVISANDO SI SE ELIMINÓ O SI FUE UNA ASIGNACIÓN ANTERIOR:');

  await conn.end();
}

inspect80Units().catch(console.error);
