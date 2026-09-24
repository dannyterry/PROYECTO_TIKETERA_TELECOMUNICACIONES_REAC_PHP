const mysql = require('mysql2/promise');

async function verifyAllTrucks() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  console.log('================================================================');
  console.log('🔍 VERIFICACIÓN TOTAL DE TEMPLADORES EN TODOS LOS CARROS');
  console.log('================================================================\n');

  // 1. Ver TODOS los técnicos que tienen registro en trabajador_productos para id_producto = 49 (Templadores)
  const [todosLosCarros] = await conn.execute(`
    SELECT 
      tp.id_trabajador_producto,
      tp.id_trabajador,
      t.id_usuario,
      TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, ''), ' ', COALESCE(u.segundo_apellido, ''))) AS tecnico_nombre,
      u.cuadrilla,
      u.estado AS estado_usuario,
      r.nombre AS rol,
      v.placa AS vehiculo_placa,
      tp.stock AS stock_actual_en_carro,
      tp.fecha_creacion,
      tp.fecha_actualizacion
    FROM trabajador_productos tp
    LEFT JOIN trabajadores t ON tp.id_trabajador = t.id_trabajador
    LEFT JOIN usuarios u ON t.id_usuario = u.id_usuario
    LEFT JOIN roles r ON u.id_rol = r.id_rol
    LEFT JOIN vehiculos v ON t.id_vehiculo = v.id_vehiculo
    WHERE tp.id_producto = 49
    ORDER BY tp.stock DESC, tecnico_nombre ASC
  `);

  console.log('1. TODOS LOS REGISTROS DE TEMPLADORES EN "trabajador_productos":');
  console.table(todosLosCarros);

  // 2. Verificar específicamente a los técnicos 31 y 66 en toda la base de datos
  const [tec31_66] = await conn.execute(`
    SELECT tp.* 
    FROM trabajador_productos tp 
    WHERE tp.id_trabajador IN (31, 66)
  `);
  console.log('\n2. ¿Existe algún producto asignado a los trabajadores 31 o 66?');
  console.table(tec31_66);

  // 3. Ver TODOS los despachos históricos que contienen Templadores en despacho_detalles
  const [todosLosDespachos] = await conn.execute(`
    SELECT 
      dd.id_detalle_despacho,
      d.id_despacho,
      d.codigo_despacho,
      d.fecha_despacho,
      d.id_trabajador,
      TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, ''))) AS tecnico_nombre,
      dd.cantidad AS cantidad_despachada,
      d.estado AS estado_despacho
    FROM despacho_detalles dd
    JOIN despachos d ON dd.id_despacho = d.id_despacho
    LEFT JOIN trabajadores t ON d.id_trabajador = t.id_trabajador
    LEFT JOIN usuarios u ON t.id_usuario = u.id_usuario
    WHERE dd.id_producto = 49
    ORDER BY d.fecha_despacho ASC
  `);
  console.log('\n3. TODOS LOS DESPACHOS REGISTRADOS DE TEMPLADORES (despachos):');
  console.table(todosLosDespachos);

  // 4. Suma total en carros
  const sumaCarros = todosLosCarros.reduce((acc, row) => acc + Number(row.stock_actual_en_carro), 0);
  console.log(`\nTOTAL TEMPLADORES EN CARROS: ${sumaCarros} unidades repartidas en exactamente ${todosLosCarros.length} técnicos.`);

  await conn.end();
}

verifyAllTrucks().catch(console.error);
