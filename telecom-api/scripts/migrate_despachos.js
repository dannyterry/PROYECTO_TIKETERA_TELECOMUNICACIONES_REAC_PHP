const db = require('../db');

async function migrate() {
  console.log('Iniciando migración de tablas para Despachos e Historial...');

  try {
    // 1. Asegurar columna fecha_actualizacion en trabajador_productos
    const [colAct] = await db.query("SHOW COLUMNS FROM trabajador_productos LIKE 'fecha_actualizacion'");
    if (colAct.length === 0) {
      await db.query("ALTER TABLE trabajador_productos ADD COLUMN fecha_actualizacion DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER fecha_creacion");
      console.log('✅ Columna fecha_actualizacion añadida a trabajador_productos');
    }

    // 2. Crear tabla despachos
    await db.query(`
      CREATE TABLE IF NOT EXISTS despachos (
        id_despacho INT AUTO_INCREMENT PRIMARY KEY,
        codigo_despacho VARCHAR(50) NOT NULL UNIQUE,
        id_trabajador INT NOT NULL,
        id_usuario_despacha INT NULL,
        id_vehiculo INT NULL,
        tipo_despacho VARCHAR(50) DEFAULT 'DOTACION_OPERATIVA',
        total_items INT DEFAULT 0,
        total_series INT DEFAULT 0,
        observaciones TEXT NULL,
        estado ENUM('COMPLETADO', 'ANULADO') DEFAULT 'COMPLETADO',
        fecha_despacho DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_desp_trabajador (id_trabajador),
        INDEX idx_desp_fecha (fecha_despacho)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ Tabla despachos lista.');

    // 3. Crear tabla despacho_detalles
    await db.query(`
      CREATE TABLE IF NOT EXISTS despacho_detalles (
        id_detalle_despacho INT AUTO_INCREMENT PRIMARY KEY,
        id_despacho INT NOT NULL,
        id_producto INT NOT NULL,
        cantidad INT NOT NULL DEFAULT 1,
        es_segundo_uso TINYINT(1) DEFAULT 0,
        series_entregadas TEXT NULL,
        drop_inicio INT NULL,
        drop_fin INT NULL,
        observaciones VARCHAR(255) NULL,
        INDEX idx_det_despacho (id_despacho),
        INDEX idx_det_producto (id_producto),
        FOREIGN KEY (id_despacho) REFERENCES despachos(id_despacho) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ Tabla despacho_detalles lista.');

    // 4. Si hay movimientos de tipo SALIDA para técnicos previos, generar despachos retroactivos si no hay ninguno
    const [cnt] = await db.query('SELECT COUNT(*) as total FROM despachos');
    if (cnt[0].total === 0) {
      console.log('Generando despachos iniciales a partir de asignaciones activas...');
      const [techs] = await db.query(`
        SELECT DISTINCT tp.id_trabajador, t.id_vehiculo, MIN(tp.fecha_creacion) as fecha_min
        FROM trabajador_productos tp
        JOIN trabajadores t ON tp.id_trabajador = t.id_trabajador
        WHERE tp.stock > 0
        GROUP BY tp.id_trabajador, t.id_vehiculo
      `);

      let num = 1;
      for (const t of techs) {
        const cod = `DSP-${new Date().getFullYear()}-${String(num).padStart(5, '0')}`;
        const fechaDesp = t.fecha_min || new Date();

        const [prods] = await db.query(`
          SELECT tp.id_producto, tp.stock, tp.fecha_creacion
          FROM trabajador_productos tp
          WHERE tp.id_trabajador = ? AND tp.stock > 0
        `, [t.id_trabajador]);

        const [series] = await db.query(`
          SELECT ts.id_producto, ps.numero_serie
          FROM trabajador_series ts
          JOIN producto_series ps ON ts.id_producto_serie = ps.id_producto_serie
          WHERE ts.id_trabajador = ? AND ts.estado = 'Asignada'
        `, [t.id_trabajador]);

        let totItems = prods.reduce((acc, p) => acc + (p.stock || 0), 0);
        let totSeries = series.length;

        if (totItems > 0 || totSeries > 0) {
          const [ins] = await db.query(`
            INSERT INTO despachos (codigo_despacho, id_trabajador, id_vehiculo, total_items, total_series, observaciones, fecha_despacho, fecha_creacion)
            VALUES (?, ?, ?, ?, ?, 'Carga inicial de dotación en vehículo', ?, ?)
          `, [cod, t.id_trabajador, t.id_vehiculo, totItems, totSeries, fechaDesp, fechaDesp]);

          const idDesp = ins.insertId;

          // Detalle de productos
          for (const p of prods) {
            const seriesDelProd = series.filter(s => s.id_producto === p.id_producto).map(s => s.numero_serie);
            await db.query(`
              INSERT INTO despacho_detalles (id_despacho, id_producto, cantidad, series_entregadas)
              VALUES (?, ?, ?, ?)
            `, [idDesp, p.id_producto, p.stock, seriesDelProd.length > 0 ? JSON.stringify(seriesDelProd) : null]);
          }

          num++;
        }
      }
      console.log(`✅ Se generaron ${num - 1} registros históricos iniciales de despachos.`);
    }

    console.log('🎉 Migración completada con éxito.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en migración:', error);
    process.exit(1);
  }
}

migrate();
