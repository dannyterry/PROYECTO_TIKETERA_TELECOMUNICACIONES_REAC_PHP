const mysql = require('mysql2/promise');

async function regularizarActas(isProd = false) {
  const config = isProd ? {
    host: 'corporacioncespedes.com',
    user: 'corporacioncespe_miguel',
    password: 'corporacioncespe_123',
    database: 'corporacioncespe_cespedes'
  } : {
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  };

  const envLabel = isProd ? '🌐 PRODUCCIÓN (corporacioncespedes.com)' : '💻 LOCAL (127.0.0.1)';
  console.log(`\n========================================`);
  console.log(`Iniciando Regularización de Actas en: ${envLabel}`);
  console.log(`========================================`);

  const conn = await mysql.createConnection(config);

  try {
    // 0. Asegurar columna 'mac' en producto_series para la pestaña 'Equipos Generales'
    console.log("🔍 Verificando columna 'mac' en producto_series...");
    const [cols] = await conn.query("DESCRIBE producto_series");
    const hasMac = cols.some(c => c.Field.toLowerCase() === 'mac');
    if (!hasMac) {
      console.log("➕ Añadiendo columna 'mac' a producto_series...");
      await conn.query("ALTER TABLE producto_series ADD COLUMN mac VARCHAR(100) NULL DEFAULT NULL AFTER proid");
      console.log("✅ Columna 'mac' añadida con éxito.");
    } else {
      console.log("✓ Columna 'mac' ya existe.");
    }

    // 1. Obtener todas las series registradas en compras para ACTAS (id_producto = 65 o MAT-ACT)
    const [actasProd] = await conn.query(`
      SELECT id_producto, nombre, codigo FROM productos 
      WHERE id_producto = 65 OR codigo = 'MAT-ACT' OR UPPER(nombre) LIKE '%ACTA%'
      LIMIT 1
    `);

    if (actasProd.length === 0) {
      console.error('❌ No se encontró el producto de Actas.');
      return;
    }

    const prodId = actasProd[0].id_producto;
    console.log(`📦 Producto identificado: [${prodId}] ${actasProd[0].nombre}`);

    const [comprasDetalle] = await conn.query(`
      SELECT series_ingresadas FROM detalle_compras WHERE id_producto = ?
    `, [prodId]);

    const seriesConCompra = new Set();
    for (const row of comprasDetalle) {
      if (row.series_ingresadas) {
        row.series_ingresadas.split(',').forEach(s => {
          const clean = s.trim().toUpperCase();
          if (clean) seriesConCompra.add(clean);
        });
      }
    }
    console.log(`✓ Series de actas ya amparadas por compras previas: ${seriesConCompra.size}`);

    // 2. Obtener todas las series físicas de actas en producto_series
    const [seriesFisicas] = await conn.query(`
      SELECT id_producto_serie, numero_serie, estado, id_almacen, fecha_ingreso
      FROM producto_series
      WHERE id_producto = ?
      ORDER BY id_producto_serie ASC
    `, [prodId]);

    console.log(`✓ Total de series de actas en producto_series: ${seriesFisicas.length}`);

    // 3. Filtrar las que fueron creadas sin compra
    const seriesHuerfanas = seriesFisicas.filter(s => !seriesConCompra.has(s.numero_serie.trim().toUpperCase()));

    if (seriesHuerfanas.length === 0) {
      console.log('🎉 ¡Todas las series de actas ya cuentan con registro en Compras! No hay nada que regularizar.');
      return;
    }

    console.log(`⚠️ Se encontraron ${seriesHuerfanas.length} actas despachadas sin compra previa.`);
    console.log(`Ejemplo de series a regularizar:`, seriesHuerfanas.slice(0, 5).map(s => s.numero_serie).join(', '), '...');

    // 4. Crear Compra de Regularización
    const numComprobante = `REG-ACTAS-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const cant = seriesHuerfanas.length;
    const precioUnitario = 0.36; // S/ 0.36 por acta o S/ 36 por paquete de 100/10
    const subtotal = Number((cant * precioUnitario).toFixed(2));
    const listaSeriesTexto = seriesHuerfanas.map(s => s.numero_serie.trim().toUpperCase()).join(',');

    await conn.beginTransaction();

    const [resCompra] = await conn.query(`
      INSERT INTO compras (
        id_proveedor, id_almacen, fecha, total, estado, 
        tipo_comprobante, numero_comprobante, observaciones, fecha_creacion
      ) VALUES (
        NULL, 1, NOW(), ?, 'COMPLETADO', 
        'Nota de Ingreso (NIA)', ?, 'Regularización contable de actas físicas entregadas directamente a cuadrillas técnicas', NOW()
      )
    `, [subtotal, numComprobante]);

    const idCompra = resCompra.insertId;

    await conn.query(`
      INSERT INTO detalle_compras (
        id_compra, id_producto, cantidad, precio, subtotal, series_ingresadas
      ) VALUES (
        ?, ?, ?, ?, ?, ?
      )
    `, [idCompra, prodId, cant, precioUnitario, subtotal, listaSeriesTexto]);

    // Registrar en movimientos (Kardex: ENTRADA por Regularización)
    await conn.query(`
      INSERT INTO movimientos (id_producto, id_almacen, tipo, cantidad, referencia, fecha_creacion)
      VALUES (?, 1, 'ENTRADA', ?, ?, NOW())
    `, [
      prodId,
      cant,
      `Regularización Inicial de Actas [${numComprobante}] (${cant} actas)`
    ]);

    await conn.commit();

    console.log(`\n✅ Regularización completada con éxito:`);
    console.log(`- Compra ID: #${idCompra}`);
    console.log(`- Comprobante: ${numComprobante}`);
    console.log(`- Total Actas Regularizadas: ${cant}`);
    console.log(`- Subtotal Registrado: S/ ${subtotal}`);
    console.log(`- Kardex de Entrada generado.`);

  } catch (error) {
    await conn.rollback();
    console.error('❌ Error durante la regularización:', error);
  } finally {
    await conn.end();
  }
}

// Ejecución según parámetro
const args = process.argv.slice(2);
const isProd = args.includes('--prod');

regularizarActas(isProd);
