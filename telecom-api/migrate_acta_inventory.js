const pool = require('./db');

async function migrate() {
  try {
    console.log("🛠️ Iniciando migración para Acta WIN y Módulo de Almacén...");

    // 1. Tabla de Equipos Retirados de Clientes (Recogidos por Técnicos)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`orden_equipos_retirados\` (
        \`id_equipo_retirado\` INT AUTO_INCREMENT PRIMARY KEY,
        \`id_orden\` INT NOT NULL,
        \`id_trabajador\` INT NOT NULL,
        \`tipo_equipo\` VARCHAR(50) NOT NULL,
        \`numero_serie\` VARCHAR(100) NOT NULL,
        \`motivo_retiro\` VARCHAR(255) NULL,
        \`estado\` ENUM('En_Poder_Tecnico', 'Internado_Almacen', 'Defectuoso', 'Baja') DEFAULT 'En_Poder_Tecnico',
        \`id_almacen_destino\` INT NULL,
        \`recibido_por\` VARCHAR(100) NULL,
        \`fecha_recojo\` DATETIME NOT NULL,
        \`fecha_internamiento\` DATETIME NULL,
        \`observaciones\` TEXT NULL,
        \`fecha_creacion\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_orden (\`id_orden\`),
        INDEX idx_trabajador (\`id_trabajador\`),
        INDEX idx_serie (\`numero_serie\`),
        INDEX idx_estado (\`estado\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("✅ Tabla orden_equipos_retirados creada / verificada.");

    // 2. Modificar orden_liquidaciones para contener los campos del Acta WIN
    const cols = [
      { name: "numero_guia", type: "VARCHAR(50) NULL" },
      { name: "tipo_trabajo_acta", type: "VARCHAR(100) NULL" },
      { name: "cto", type: "VARCHAR(100) NULL" },
      { name: "puerto", type: "VARCHAR(50) NULL" },
      { name: "speedtest_download", type: "DECIMAL(8,2) NULL" },
      { name: "speedtest_upload", type: "DECIMAL(8,2) NULL" },
      { name: "tipo_conexion", type: "VARCHAR(50) NULL" },
      { name: "drop_metro_inicio", type: "INT NULL" },
      { name: "drop_metro_fin", type: "INT NULL" },
      { name: "drop_total_metros", type: "INT NULL" },
      { name: "lat_liquidacion", type: "DECIMAL(10,8) NULL" },
      { name: "lng_liquidacion", type: "DECIMAL(11,8) NULL" },
      { name: "observaciones_tecnico", type: "TEXT NULL" },
      { name: "firma_cliente", type: "TEXT NULL" },
      { name: "firma_tecnico", type: "TEXT NULL" }
    ];

    for (const c of cols) {
      try {
        await pool.query(`ALTER TABLE orden_liquidaciones ADD COLUMN \`${c.name}\` ${c.type}`);
        console.log(`✅ Columna ${c.name} añadida a orden_liquidaciones`);
      } catch (e) {
        if (e.code !== 'ER_DUP_FIELDNAME') {
          console.log(`ℹ️ Columna ${c.name}: ${e.message}`);
        }
      }
    }

    // 3. Modificar compras para soportar comprobantes y autollenado
    const colsCompras = [
      { name: "tipo_comprobante", type: "VARCHAR(50) DEFAULT 'Factura'" },
      { name: "numero_comprobante", type: "VARCHAR(100) NULL" },
      { name: "observaciones", type: "TEXT NULL" }
    ];

    for (const c of colsCompras) {
      try {
        await pool.query(`ALTER TABLE compras ADD COLUMN \`${c.name}\` ${c.type}`);
        console.log(`✅ Columna ${c.name} añadida a compras`);
      } catch (e) {
        if (e.code !== 'ER_DUP_FIELDNAME') {
          console.log(`ℹ️ Columna compras.${c.name}: ${e.message}`);
        }
      }
    }

    console.log("🎉 ¡Migración de base de datos de Almacén y Acta completada!");
  } catch (error) {
    console.error("Error general en migración:", error);
  } finally {
    process.exit(0);
  }
}

migrate();
