const pool = require('../db');

async function simulate() {
  const connection = await pool.getConnection();
  try {
    console.log("==================================================");
    console.log("🚀 INICIANDO SIMULACIÓN DE DOTACIÓN Y LIQUIDACIÓN");
    console.log("==================================================");

    // 1. Obtener datos del técnico Brayan
    const [techRows] = await connection.query(`
      SELECT t.id_trabajador, t.id_usuario, u.nombres, u.apellidos, u.cuadrilla, v.placa
      FROM trabajadores t
      JOIN usuarios u ON t.id_usuario = u.id_usuario
      LEFT JOIN vehiculos v ON t.id_vehiculo = v.id_vehiculo
      WHERE t.id_trabajador = 21 OR u.id_usuario = 67
      LIMIT 1
    `);

    if (techRows.length === 0) {
      throw new Error("No se encontró el técnico Brayan Canelon.");
    }
    const tech = techRows[0];
    const techNombre = `${tech.nombres} ${tech.apellidos}`.trim();
    console.log(`👨‍🔧 Técnico: ${techNombre} (ID Trabajador: ${tech.id_trabajador})`);
    console.log(`🚗 Vehículo / Cuadrilla: ${tech.placa || 'B7F-892'} | ${tech.cuadrilla || 'K 7 CESPEDES SGA'}`);

    // 2. Crear Productos de Prueba
    console.log("\n📦 1. Creando productos de prueba en Almacén...");

    // Producto 1: Conectores (Material)
    const [p1Res] = await connection.query(`
      INSERT INTO productos (nombre, codigo, id_categoria, stock_minimo, maneja_serie, es_drop, estado)
      VALUES ('[TEST] CONECTOR MECANICO SC/APC FIBRA', 'TEST-CON-01', 1, 10, 0, 0, 'Activo')
      ON DUPLICATE KEY UPDATE id_producto = LAST_INSERT_ID(id_producto)
    `);
    const idProd1 = p1Res.insertId;

    // Producto 2: Módem ONT (Equipo serializado)
    const [p2Res] = await connection.query(`
      INSERT INTO productos (nombre, codigo, id_categoria, stock_minimo, maneja_serie, es_drop, estado)
      VALUES ('[TEST] MODEM ONT HUAWEI WIFI 6 DUAL BAND', 'TEST-ONT-01', 7, 2, 1, 0, 'Activo')
      ON DUPLICATE KEY UPDATE id_producto = LAST_INSERT_ID(id_producto)
    `);
    const idProd2 = p2Res.insertId;

    // Producto 3: Talonario de Actas (Serializado)
    const [p3Res] = await connection.query(`
      INSERT INTO productos (nombre, codigo, id_categoria, stock_minimo, maneja_serie, es_drop, estado)
      VALUES ('[TEST] TALONARIO DE ACTAS DE SERVICIO', 'TEST-ACTAS-01', 12, 1, 1, 0, 'Activo')
      ON DUPLICATE KEY UPDATE id_producto = LAST_INSERT_ID(id_producto)
    `);
    const idProd3 = p3Res.insertId;

    console.log(`✅ Productos creados: Material #${idProd1}, Equipo ONT #${idProd2}, Talonario Actas #${idProd3}`);

    // Guardar stock inicial en Almacén Central (id_almacen = 1)
    await connection.query(`
      INSERT INTO stock (id_producto, id_almacen, cantidad) VALUES (?, 1, 50)
      ON DUPLICATE KEY UPDATE cantidad = cantidad + 50
    `, [idProd1]);

    await connection.query(`
      INSERT INTO stock (id_producto, id_almacen, cantidad) VALUES (?, 1, 5)
      ON DUPLICATE KEY UPDATE cantidad = cantidad + 5
    `, [idProd2]);

    await connection.query(`
      INSERT INTO stock (id_producto, id_almacen, cantidad) VALUES (?, 1, 10)
      ON DUPLICATE KEY UPDATE cantidad = cantidad + 10
    `, [idProd3]);

    // 3. Crear Series de Prueba
    console.log("\n🏷️ 2. Registrando series de equipos y actas...");
    const serieOnt = 'SN-HW-2026-TEST01';
    const seriesActas = ['ACTA-8001', 'ACTA-8002', 'ACTA-8003', 'ACTA-8004', 'ACTA-8005'];

    // Serie ONT
    const [sOntRes] = await connection.query(`
      INSERT INTO producto_series (id_producto, id_almacen, numero_serie, estado, fecha_ingreso)
      VALUES (?, 1, ?, 'DISPONIBLE', NOW())
      ON DUPLICATE KEY UPDATE id_producto_serie = LAST_INSERT_ID(id_producto_serie), estado = 'DISPONIBLE'
    `, [idProd2, serieOnt]);
    const idSerieOnt = sOntRes.insertId;

    // Series Actas
    const idSeriesActas = [];
    for (const sa of seriesActas) {
      const [saRes] = await connection.query(`
        INSERT INTO producto_series (id_producto, id_almacen, numero_serie, estado, fecha_ingreso)
        VALUES (?, 1, ?, 'DISPONIBLE', NOW())
        ON DUPLICATE KEY UPDATE id_producto_serie = LAST_INSERT_ID(id_producto_serie), estado = 'DISPONIBLE'
      `, [idProd3, sa]);
      idSeriesActas.push(saRes.insertId);
    }
    console.log(`✅ Series registradas: ONT (${serieOnt}) y 5 Actas (${seriesActas.join(', ')})`);

    // 4. DESPACHAR AL TÉCNICO BRAYAN
    console.log("\n🚚 3. Asignando / Despachando dotación al técnico Brayan...");

    // Despacho de Materiales (10 conectores)
    await connection.query(`
      INSERT INTO trabajador_productos (id_trabajador, id_producto, stock)
      VALUES (?, ?, 10)
      ON DUPLICATE KEY UPDATE stock = stock + 10
    `, [tech.id_trabajador, idProd1]);

    // Despacho de ONT (Serie asignada)
    await connection.query(`
      INSERT INTO trabajador_series (id_trabajador, id_producto, id_producto_serie, estado, fecha_asignacion)
      VALUES (?, ?, ?, 'Asignada', NOW())
      ON DUPLICATE KEY UPDATE estado = 'Asignada'
    `, [tech.id_trabajador, idProd2, idSerieOnt]);

    await connection.query(`UPDATE producto_series SET estado = 'RESERVADO' WHERE id_producto_serie = ?`, [idSerieOnt]);
    await connection.query(`
      INSERT INTO trabajador_productos (id_trabajador, id_producto, stock)
      VALUES (?, ?, 1)
      ON DUPLICATE KEY UPDATE stock = stock + 1
    `, [tech.id_trabajador, idProd2]);

    // Despacho de Actas (5 series asignadas)
    for (const idSa of idSeriesActas) {
      await connection.query(`
        INSERT INTO trabajador_series (id_trabajador, id_producto, id_producto_serie, estado, fecha_asignacion)
        VALUES (?, ?, ?, 'Asignada', NOW())
        ON DUPLICATE KEY UPDATE estado = 'Asignada'
      `, [tech.id_trabajador, idProd3, idSa]);
      await connection.query(`UPDATE producto_series SET estado = 'RESERVADO' WHERE id_producto_serie = ?`, [idSa]);
    }
    await connection.query(`
      INSERT INTO trabajador_productos (id_trabajador, id_producto, stock)
      VALUES (?, ?, 5)
      ON DUPLICATE KEY UPDATE stock = stock + 5
    `, [tech.id_trabajador, idProd3]);

    console.log("✅ Dotación entregada: 10 Conectores, 1 Módem ONT y 5 Actas correlativas.");

    // 5. PROCESAR LIQUIDACIÓN DEL TÉCNICO
    console.log("\n📋 4. Procesando Acta de Liquidación y Devolución...");

    // Cabecera
    const [liqRes] = await connection.query(`
      INSERT INTO liquidaciones_tecnicos (
        id_trabajador, tecnico_nombre, cuadrilla, vehiculo_placa, almacenero_nombre,
        motivo, observaciones, total_items_devueltos, total_series_devueltas, fecha_liquidacion
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      tech.id_trabajador,
      techNombre,
      tech.cuadrilla || 'K 7 CESPEDES SGA BRAYAN JESUS CANELON GONZALES',
      tech.placa || 'B7F-892',
      'Encargada Almacén (almacengeneral)',
      'Prueba de Liquidación de Materiales y Devolución',
      'Simulación de prueba solicitada por administración. Brayan finalizó 2 órdenes: usó 2 conectores y 1 acta (ACTA-8001). Devuelve 8 conectores, módem ONT y 4 actas restantes.',
      13, // 8 conectores + 1 ONT + 4 actas devueltas = 13 items
      5   // 1 ONT + 4 actas = 5 series
    ]);
    const idLiquidacion = liqRes.insertId;

    // Detalle 1: Conectores (Esperados 10, Devueltos 8, Faltantes/Instalados 2)
    await connection.query(`
      INSERT INTO liquidacion_detalles (
        id_liquidacion, id_producto, producto_nombre, producto_codigo, categoria,
        cantidad_esperada, cantidad_devuelta, cantidad_faltante, series_devueltas, observaciones
      ) VALUES (?, ?, '[TEST] CONECTOR MECANICO SC/APC FIBRA', 'TEST-CON-01', 'MATERIALES', 10, 8, 2, NULL, '2 conectores utilizados en órdenes finalizadas 2769618 y 2769342')
    `, [idLiquidacion, idProd1]);

    // Detalle 2: Módem ONT (Esperado 1, Devuelto 1, Faltante 0)
    await connection.query(`
      INSERT INTO liquidacion_detalles (
        id_liquidacion, id_producto, producto_nombre, producto_codigo, categoria,
        cantidad_esperada, cantidad_devuelta, cantidad_faltante, series_devueltas, observaciones
      ) VALUES (?, ?, '[TEST] MODEM ONT HUAWEI WIFI 6 DUAL BAND', 'TEST-ONT-01', 'EQUIPOS', 1, 1, 0, ?, 'Equipo devuelto en perfecto estado de funcionamiento')
    `, [idLiquidacion, idProd2, JSON.stringify([serieOnt])]);

    // Detalle 3: Actas de Servicio (Esperadas 5, Devueltas 4, Usada 1)
    const actasDevueltas = ['ACTA-8002', 'ACTA-8003', 'ACTA-8004', 'ACTA-8005'];
    await connection.query(`
      INSERT INTO liquidacion_detalles (
        id_liquidacion, id_producto, producto_nombre, producto_codigo, categoria,
        cantidad_esperada, cantidad_devuelta, cantidad_faltante, series_devueltas, observaciones
      ) VALUES (?, ?, '[TEST] TALONARIO DE ACTAS DE SERVICIO', 'TEST-ACTAS-01', 'HERRAMIENTAS', 5, 4, 1, ?, 'Acta ACTA-8001 utilizada en orden #2769618. Se devuelven 4 actas en blanco.')
    `, [idLiquidacion, idProd3, JSON.stringify(actasDevueltas)]);

    // Actualizar estado de series devueltas a DISPONIBLE en Almacén
    await connection.query(`UPDATE producto_series SET estado = 'DISPONIBLE', id_almacen = 1 WHERE id_producto_serie = ?`, [idSerieOnt]);
    await connection.query(`UPDATE trabajador_series SET estado = 'Devuelta' WHERE id_producto_serie = ? AND id_trabajador = ?`, [idSerieOnt, tech.id_trabajador]);

    for (let i = 1; i < idSeriesActas.length; i++) {
      const idSa = idSeriesActas[i];
      await connection.query(`UPDATE producto_series SET estado = 'DISPONIBLE', id_almacen = 1 WHERE id_producto_serie = ?`, [idSa]);
      await connection.query(`UPDATE trabajador_series SET estado = 'Devuelta' WHERE id_producto_serie = ? AND id_trabajador = ?`, [idSa, tech.id_trabajador]);
    }

    // El acta 8001 queda como instalada/usada
    await connection.query(`UPDATE producto_series SET estado = 'VENDIDO' WHERE id_producto_serie = ?`, [idSeriesActas[0]]);
    await connection.query(`UPDATE trabajador_series SET estado = 'Instalada' WHERE id_producto_serie = ? AND id_trabajador = ?`, [idSeriesActas[0], tech.id_trabajador]);

    // Stock de Brayan queda en 0 para estos ítems de prueba
    await connection.query(`UPDATE trabajador_productos SET stock = 0 WHERE id_trabajador = ? AND id_producto IN (?, ?, ?)`, [tech.id_trabajador, idProd1, idProd2, idProd3]);

    console.log(`\n🎉 ¡SIMULACIÓN COMPLETADA EXITOSAMENTE!`);
    console.log(`📄 Constancia / Acta de Liquidación Generada: #${idLiquidacion}`);
    console.log(`==================================================`);
    console.log(`DATOS REGISTRADOS PARA VERIFICACIÓN Y LIMPIEZA:`);
    console.log(`ID Liquidación: ${idLiquidacion}`);
    console.log(`IDs Productos: [${idProd1}, ${idProd2}, ${idProd3}]`);
    console.log(`Series: [${serieOnt}, ${seriesActas.join(', ')}]`);
    console.log(`==================================================`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error en la simulación:", error);
    process.exit(1);
  } finally {
    connection.release();
  }
}

simulate();
