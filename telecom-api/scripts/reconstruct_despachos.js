const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function populateDespachosHistorial() {
  console.log('===============================================================');
  console.log('📦 POBLANDO HISTORIAL DE DESPACHOS A PARTIR DE MOVIMIENTOS');
  console.log('===============================================================');

  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes',
    dateStrings: true
  });

  try {
    await conn.beginTransaction();

    // 1. Asegurar tablas despachos y despacho_detalles
    await conn.query(`
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

    await conn.query(`
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

    // 2. Obtener movimientos que representan despachos a técnicos
    const [movs] = await conn.query(`
      SELECT m.id_movimiento, m.id_producto, m.cantidad, m.referencia, m.fecha_creacion
      FROM movimientos m
      WHERE m.referencia LIKE '%Despacho a Técnico%'
      ORDER BY m.id_movimiento ASC
    `);

    console.log(`📋 Se encontraron ${movs.length} movimientos de despacho en producción.`);

    // 3. Agrupar movimientos en despachos individuales
    const grupos = {};
    for (const m of movs) {
      const match = m.referencia.match(/Técnico #(\d+)/);
      const rawId = match ? parseInt(match[1]) : 0;
      // Truncar al minuto para agrupar las inserciones del mismo lote
      const fStr = m.fecha_creacion.slice(0, 16);
      const key = `${rawId}_${fStr}`;

      if (!grupos[key]) {
        grupos[key] = {
          raw_id_trabajador: rawId,
          fecha: m.fecha_creacion,
          referencia: m.referencia,
          items: []
        };
      }
      grupos[key].items.push(m);
    }

    // 4. Limpiar datos antiguos de despachos si había
    await conn.query('DELETE FROM despacho_detalles');
    await conn.query('DELETE FROM despachos');

    const sqlExport = [
      '-- CREACIÓN Y RECONSTRUCCIÓN DE TABLAS DESPACHOS Y DESPACHO_DETALLES',
      `CREATE TABLE IF NOT EXISTS \`despachos\` (
        \`id_despacho\` INT AUTO_INCREMENT PRIMARY KEY,
        \`codigo_despacho\` VARCHAR(50) NOT NULL UNIQUE,
        \`id_trabajador\` INT NOT NULL,
        \`id_usuario_despacha\` INT NULL,
        \`id_vehiculo\` INT NULL,
        \`tipo_despacho\` VARCHAR(50) DEFAULT 'DOTACION_OPERATIVA',
        \`total_items\` INT DEFAULT 0,
        \`total_series\` INT DEFAULT 0,
        \`observaciones\` TEXT NULL,
        \`estado\` ENUM('COMPLETADO', 'ANULADO') DEFAULT 'COMPLETADO',
        \`fecha_despacho\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`fecha_creacion\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_desp_trabajador (\`id_trabajador\`),
        INDEX idx_desp_fecha (\`fecha_despacho\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
      `CREATE TABLE IF NOT EXISTS \`despacho_detalles\` (
        \`id_detalle_despacho\` INT AUTO_INCREMENT PRIMARY KEY,
        \`id_despacho\` INT NOT NULL,
        \`id_producto\` INT NOT NULL,
        \`cantidad\` INT NOT NULL DEFAULT 1,
        \`es_segundo_uso\` TINYINT(1) DEFAULT 0,
        \`series_entregadas\` TEXT NULL,
        \`drop_inicio\` INT NULL,
        \`drop_fin\` INT NULL,
        \`observaciones\` VARCHAR(255) NULL,
        INDEX idx_det_despacho (\`id_despacho\`),
        INDEX idx_det_producto (\`id_producto\`),
        FOREIGN KEY (\`id_despacho\`) REFERENCES \`despachos\`(\`id_despacho\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
      'DELETE FROM `despacho_detalles`;',
      'DELETE FROM `despachos`;'
    ];

    let count = 1;
    for (const key of Object.keys(grupos)) {
      const g = grupos[key];
      const codigo = `DSP-2026-${String(count).padStart(5, '0')}`;
      const totalItems = g.items.reduce((acc, it) => acc + Number(it.cantidad || 0), 0);

      // Extraer observaciones limpias
      let obs = g.referencia;
      const parenMatch = g.referencia.match(/\((.*?)\)/);
      if (parenMatch) obs = parenMatch[1];

      // Determinar si id_trabajador es válido
      const [tCheck] = await conn.query('SELECT id_trabajador FROM trabajadores WHERE id_trabajador = ?', [g.raw_id_trabajador]);
      const validWorkerId = tCheck.length > 0 ? g.raw_id_trabajador : g.raw_id_trabajador;

      const [insD] = await conn.query(`
        INSERT INTO despachos (
          codigo_despacho, id_trabajador, id_usuario_despacha, id_vehiculo,
          tipo_despacho, total_items, total_series, observaciones, estado, fecha_despacho, fecha_creacion
        ) VALUES (?, ?, NULL, NULL, 'DOTACION_OPERATIVA', ?, 0, ?, 'COMPLETADO', ?, ?)
      `, [codigo, validWorkerId, totalItems, obs, g.fecha, g.fecha]);

      const idDespacho = insD.insertId;
      sqlExport.push(`INSERT INTO \`despachos\` (\`id_despacho\`, \`codigo_despacho\`, \`id_trabajador\`, \`tipo_despacho\`, \`total_items\`, \`total_series\`, \`observaciones\`, \`estado\`, \`fecha_despacho\`, \`fecha_creacion\`) VALUES (${idDespacho}, '${codigo}', ${validWorkerId}, 'DOTACION_OPERATIVA', ${totalItems}, 0, '${obs.replace(/'/g, "''")}', 'COMPLETADO', '${g.fecha}', '${g.fecha}');`);

      for (const item of g.items) {
        await conn.query(`
          INSERT INTO despacho_detalles (id_despacho, id_producto, cantidad, es_segundo_uso, observaciones)
          VALUES (?, ?, ?, 0, 'Carga histórica de dotación')
        `, [idDespacho, item.id_producto, item.cantidad]);

        sqlExport.push(`INSERT INTO \`despacho_detalles\` (\`id_despacho\`, \`id_producto\`, \`cantidad\`, \`es_segundo_uso\`, \`observaciones\`) VALUES (${idDespacho}, ${item.id_producto}, ${item.cantidad}, 0, 'Carga histórica de dotación');`);
      }

      console.log(`✅ [${codigo}] Despacho registrado para Técnico #${validWorkerId} con ${g.items.length} productos (${totalItems} unidades).`);
      count++;
    }

    await conn.commit();

    const sqlFile = path.join(__dirname, '..', 'backups', 'crear_historial_despachos_prod.sql');
    fs.writeFileSync(sqlFile, sqlExport.join('\n'), 'utf8');

    console.log('\n===============================================================');
    console.log('🎉 ¡HISTORIAL DE DESPACHOS GENERADO EXITOSAMENTE!');
    console.log(`📋 Total despachos creados: ${count - 1}`);
    console.log(`📄 Script SQL guardado en: ${sqlFile}`);
    console.log('===============================================================');

  } catch (err) {
    await conn.rollback();
    console.error('❌ Error poblando historial:', err);
  } finally {
    await conn.end();
  }
}

populateDespachosHistorial();
