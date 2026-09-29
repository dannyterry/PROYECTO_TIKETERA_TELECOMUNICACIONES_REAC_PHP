const db = require('../db');

async function createTransferTables() {
  try {
    console.log('--- CREANDO TABLAS PARA TRANSFERENCIAS ENTRE TÉCNICOS ---');

    // 1. Tabla principal de transferencias
    await db.query(`
      CREATE TABLE IF NOT EXISTS \`transferencias_tecnicos\` (
        \`id_transferencia\` INT AUTO_INCREMENT PRIMARY KEY,
        \`codigo_transferencia\` VARCHAR(50) NOT NULL UNIQUE,
        \`id_trabajador_origen\` INT NOT NULL,
        \`id_trabajador_destino\` INT NOT NULL,
        \`dni_origen\` VARCHAR(20) NULL,
        \`nombre_origen\` VARCHAR(150) NULL,
        \`cuadrilla_origen\` VARCHAR(100) NULL,
        \`dni_destino\` VARCHAR(20) NULL,
        \`nombre_destino\` VARCHAR(150) NULL,
        \`cuadrilla_destino\` VARCHAR(100) NULL,
        \`estado\` ENUM('PENDIENTE', 'ACEPTADA', 'RECHAZADA', 'CANCELADA') DEFAULT 'PENDIENTE',
        \`motivo_transferencia\` TEXT NULL,
        \`motivo_rechazo\` TEXT NULL,
        \`total_items\` INT DEFAULT 0,
        \`total_series\` INT DEFAULT 0,
        \`fecha_solicitud\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`fecha_respuesta\` DATETIME NULL,
        INDEX idx_origen (\`id_trabajador_origen\`),
        INDEX idx_destino (\`id_trabajador_destino\`),
        INDEX idx_estado (\`estado\`),
        INDEX idx_fecha (\`fecha_solicitud\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ Tabla transferencias_tecnicos creada o verificada');

    // 2. Tabla de detalle de transferencias
    await db.query(`
      CREATE TABLE IF NOT EXISTS \`transferencia_tecnico_detalles\` (
        \`id_detalle\` INT AUTO_INCREMENT PRIMARY KEY,
        \`id_transferencia\` INT NOT NULL,
        \`id_producto\` INT NOT NULL,
        \`nombre_producto\` VARCHAR(200) NULL,
        \`cantidad\` DECIMAL(10,2) DEFAULT 0,
        \`unidad_medida\` VARCHAR(30) NULL,
        \`es_serie\` TINYINT DEFAULT 0,
        \`numero_serie\` VARCHAR(100) NULL,
        \`id_producto_serie\` INT NULL,
        INDEX idx_transferencia (\`id_transferencia\`),
        INDEX idx_producto (\`id_producto\`),
        INDEX idx_serie (\`numero_serie\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ Tabla transferencia_tecnico_detalles creada o verificada');

  } catch (err) {
    console.error('Error creando tablas:', err);
  } finally {
    process.exit(0);
  }
}

createTransferTables();
