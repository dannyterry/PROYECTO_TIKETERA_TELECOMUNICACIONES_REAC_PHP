const pool = require('./db.js');

const realSeriesData = [
  {
    modeloKey: 'ONT ZTE',
    codigoModelo: 'ZTA',
    series: [
      { serie: 'ZTEGDA04A7B8', etiquetaPrevia: 'RTZT 01109' }
    ]
  },
  {
    modeloKey: 'ONT HUAWEI',
    codigoModelo: 'HWA',
    series: [
      { serie: '485754438CAC9AB8', etiquetaPrevia: 'RT 01469' },
      { serie: '485754438C998CB8', etiquetaPrevia: 'RT 01501' },
      { serie: '485754438CA3D8B8', etiquetaPrevia: 'RT 01513' }
    ]
  },
  {
    modeloKey: 'SMART HUAWEI',
    codigoModelo: 'HWB',
    series: [
      { serie: '48575443435218B3', etiquetaPrevia: 'SW 0190' },
      { serie: '4857544308F747B3', etiquetaPrevia: 'SW 0448' },
      { serie: '4857544308F7B6B3', etiquetaPrevia: 'SW 0474' }
    ]
  },
  {
    modeloKey: 'SMART ZTE',
    codigoModelo: 'ZTB',
    series: [
      { serie: 'ZTE0H8TR7204248', etiquetaPrevia: 'ZTE 005' }
    ]
  },
  {
    modeloKey: 'TV BOX ZTE',
    codigoModelo: 'WTA',
    series: [
      { serie: 'Z6406003250011410', etiquetaPrevia: 'N° 126' }
    ]
  },
  {
    modeloKey: 'FONO WIN',
    codigoModelo: 'TLA',
    series: [
      { serie: '2FWS000000069947', etiquetaPrevia: 'TELF 0055' }
    ]
  }
];

async function insertRealSeries() {
  console.log("==================================================");
  console.log("🚀 INSERTANDO SERIES REALES Y ACTUALIZANDO MODELOS");
  console.log("==================================================");

  // 1. Limpiar series previas para que solo queden las reales
  await pool.query("SET FOREIGN_KEY_CHECKS = 0");
  await pool.query("TRUNCATE TABLE producto_series");
  await pool.query("TRUNCATE TABLE trabajador_series");
  await pool.query("SET FOREIGN_KEY_CHECKS = 1");

  for (const grupo of realSeriesData) {
    // A. Actualizar nombre oficial del modelo en la tabla productos
    await pool.query(
      "UPDATE productos SET nombre = ? WHERE codigo = ?",
      [grupo.modeloKey, grupo.codigoModelo]
    );

    const [prodRows] = await pool.query(
      "SELECT id_producto, nombre, codigo FROM productos WHERE codigo = ?",
      [grupo.codigoModelo]
    );

    if (prodRows.length === 0) {
      console.warn(`⚠️ Modelo con código ${grupo.codigoModelo} no encontrado.`);
      continue;
    }

    const prod = prodRows[0];
    let numCorrelativo = 1;

    for (const item of grupo.series) {
      const codigoSerie = `${grupo.codigoModelo}-S${String(numCorrelativo).padStart(3, '0')}`;
      const numeroSerie = item.serie.trim().toUpperCase();

      await pool.query(`
        INSERT INTO producto_series (id_producto, id_almacen, codigo_serie, numero_serie, estado, fecha_ingreso)
        VALUES (?, 1, ?, ?, 'DISPONIBLE', NOW())
      `, [prod.id_producto, codigoSerie, numeroSerie]);

      console.log(`✅ [${prod.nombre}] Código: ${codigoSerie} | Serie: ${numeroSerie} (Previo: ${item.etiquetaPrevia})`);
      numCorrelativo++;
    }

    // B. Actualizar stock en Almacén Central
    await pool.query(`
      INSERT INTO stock (id_producto, id_almacen, cantidad)
      VALUES (?, 1, ?)
      ON DUPLICATE KEY UPDATE cantidad = ?
    `, [prod.id_producto, grupo.series.length, grupo.series.length]);
  }

  console.log("--------------------------------------------------");
  console.log("📊 RESUMEN FINAL EN BASE DE DATOS:");
  const [reporte] = await pool.query(`
    SELECT p.codigo AS cod_modelo, p.nombre AS modelo, ps.codigo_serie, ps.numero_serie, ps.estado
    FROM producto_series ps
    JOIN productos p ON ps.id_producto = p.id_producto
    ORDER BY p.id_producto ASC, ps.id_producto_serie ASC
  `);
  console.table(reporte);

  process.exit(0);
}

insertRealSeries().catch(console.error);
