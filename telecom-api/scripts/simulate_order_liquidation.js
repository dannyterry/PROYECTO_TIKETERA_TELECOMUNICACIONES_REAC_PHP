const mysql = require('mysql2/promise');

async function simulate() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  console.log("🚀 INICIANDO SIMULACIÓN DE LIQUIDACIÓN DE ORDEN PARA YOMAR SANTIAGO DE LA CRUZ...");

  // 0. Limpiar cualquier liquidación previa de la orden 10781
  const [prevLiqs] = await conn.query("SELECT id_liquidacion FROM orden_liquidaciones WHERE id_orden = 10781");
  for (const l of prevLiqs) {
    await conn.query("DELETE FROM orden_liquidacion_detalle WHERE id_liquidacion = ?", [l.id_liquidacion]);
    await conn.query("DELETE FROM orden_liquidaciones WHERE id_liquidacion = ?", [l.id_liquidacion]);
  }

  // 1. Asignar precios y categorías a los productos
  await conn.query("UPDATE productos SET precio_compra = 130.00, categoria_liquidar = 'EQUIPO' WHERE id_producto = 68"); // ONT HUAWEI
  await conn.query("UPDATE productos SET precio_compra = 2.50, categoria_liquidar = 'MATERIAL' WHERE id_producto = 46"); // CONECTORES
  await conn.query("UPDATE productos SET precio_compra = 5.00, categoria_liquidar = 'MATERIAL' WHERE id_producto = 50"); // ROSETAS
  await conn.query("UPDATE productos SET precio_compra = 1.00, categoria_liquidar = 'MATERIAL' WHERE id_producto = 75"); // CABLE UTP / DROP

  // 2. Crear una serie para el ONT si no existe
  const [serieExist] = await conn.query("SELECT id_producto_serie FROM producto_series WHERE numero_serie = 'HW-2026-FTTH-9941'");
  let serieId = null;
  if (serieExist.length > 0) {
    serieId = serieExist[0].id_producto_serie;
    await conn.query("UPDATE producto_series SET estado = 'INSTALADO' WHERE id_producto_serie = ?", [serieId]);
  } else {
    const [insSerie] = await conn.query(`
      INSERT INTO producto_series (id_producto, numero_serie, estado, id_almacen, fecha_ingreso)
      VALUES (68, 'HW-2026-FTTH-9941', 'INSTALADO', 1, NOW())
    `);
    serieId = insSerie.insertId;
  }

  // 3. Crear cabecera de orden_liquidaciones
  const [insLiq] = await conn.query(`
    INSERT INTO orden_liquidaciones (
      id_orden, id_trabajador, numero_acta, numero_guia, tipo_trabajo_acta,
      cto, puerto, speedtest_download, speedtest_upload, tipo_conexion,
      drop_metro_inicio, drop_metro_fin, drop_total_metros,
      lat_liquidacion, lng_liquidacion,
      observaciones, observaciones_tecnico,
      estado, fecha_liquidacion
    ) VALUES (
      10781, 65, '001-008942', '001-008942', 'INSTALACION / NORMALIZACION',
      'CTO-SURCO-04', '02', 520.50, 515.20, 'Fibra Óptica FTTH',
      1100, 1165, 65,
      -12.145821, -76.985412,
      '[SIMULACIÓN] Liquidación técnica de prueba con materiales instalados en campo.',
      'Instalación normalizada con éxito. Potencia óptica -18.7 dBm. Equipos configurados y navegando a 500Mbps.',
      'Pendiente', NOW()
    )
  `);

  const idLiquidacion = insLiq.insertId;
  console.log(`✅ Cabecera de liquidación creada con ID: ${idLiquidacion}`);

  // 4. Crear detalles de materiales consumidos en orden_liquidacion_detalle
  // A. ONT Huawei
  await conn.query(`
    INSERT INTO orden_liquidacion_detalle (id_liquidacion, id_producto, id_producto_serie, cantidad, numero_serie)
    VALUES (?, 68, ?, 1, 'HW-2026-FTTH-9941')
  `, [idLiquidacion, serieId]);

  // B. Conectores (2 unidades)
  await conn.query(`
    INSERT INTO orden_liquidacion_detalle (id_liquidacion, id_producto, id_producto_serie, cantidad, numero_serie)
    VALUES (?, 46, NULL, 2, NULL)
  `, [idLiquidacion]);

  // C. Roseta (1 unidad)
  await conn.query(`
    INSERT INTO orden_liquidacion_detalle (id_liquidacion, id_producto, id_producto_serie, cantidad, numero_serie)
    VALUES (?, 50, NULL, 1, NULL)
  `, [idLiquidacion]);

  // D. Metros de Cable Drop (65 metros)
  await conn.query(`
    INSERT INTO orden_liquidacion_detalle (id_liquidacion, id_producto, id_producto_serie, cantidad, numero_serie, drop_inicio, drop_fin)
    VALUES (?, 75, NULL, 65, NULL, 1100, 1165)
  `, [idLiquidacion]);

  // 5. Actualizar estado de la orden #10781 a Finalizada
  await conn.query(`
    UPDATE ordenes 
    SET estado = 'Finalizada', 
        motivo_finalizacion = 'INSTALACION CONFORME',
        tipo_trabajo = 'NORMALIZACION FIBRA',
        fecha_estado = NOW()
    WHERE id_orden = 10781
  `);

  console.log("✅ Orden #10781 (3410510) actualizada a Finalizada.");
  console.log("🎉 SIMULACIÓN COMPLETADA CON ÉXITO.");
  await conn.end();
}

simulate().catch(console.error);
