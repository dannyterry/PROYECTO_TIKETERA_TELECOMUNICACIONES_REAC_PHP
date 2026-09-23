const { pool } = require('../db');

async function setupSupervisionTables() {
  console.log('🚀 Creando tablas para el Módulo de Supervisión & Calidad...');
  try {
    const db = pool.promise ? pool.promise() : pool;
    // 1. Tabla de Supervisión en Campo
    await db.query(`
      CREATE TABLE IF NOT EXISTS \`supervisiones_campo\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`id_tecnico\` INT NULL,
        \`tecnico\` VARCHAR(255) NOT NULL,
        \`dni\` VARCHAR(30) NULL,
        \`cuadrilla\` VARCHAR(255) NULL,
        \`tipo_inspeccion\` VARCHAR(100) NOT NULL DEFAULT 'CAMPO_GENERAL',
        \`fecha\` DATE NOT NULL,
        \`hora\` TIME NULL,
        \`lugar_inspeccion\` VARCHAR(255) NULL,
        \`supervisor\` VARCHAR(255) NULL,
        \`cumplimiento_porcentaje\` DECIMAL(5,2) DEFAULT 100.00,
        \`semaforo\` VARCHAR(20) DEFAULT 'verde',
        \`items_json\` JSON NULL,
        \`observaciones\` TEXT NULL,
        \`firma_supervisor\` LONGTEXT NULL,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_tecnico_fecha\` (\`tecnico\`, \`fecha\`),
        INDEX \`idx_tipo_inspeccion\` (\`tipo_inspeccion\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Tabla `supervisiones_campo` creada / verificada con éxito.');

    // 2. Tabla de Auditorías de Calidad al Cliente
    await db.query(`
      CREATE TABLE IF NOT EXISTS \`auditorias_calidad_cliente\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`id_orden\` INT NULL,
        \`numero_ticket\` VARCHAR(100) NULL,
        \`id_tecnico\` INT NULL,
        \`tecnico\` VARCHAR(255) NOT NULL,
        \`cuadrilla\` VARCHAR(255) NULL,
        \`cliente\` VARCHAR(255) NOT NULL,
        \`telefono\` VARCHAR(50) NULL,
        \`distrito\` VARCHAR(100) NULL,
        \`fecha_atencion\` DATE NULL,
        \`fecha_auditoria\` DATE NOT NULL,
        \`auditor\` VARCHAR(255) NULL,
        \`preguntas_json\` JSON NULL,
        \`puntaje_porcentaje\` DECIMAL(5,2) DEFAULT 100.00,
        \`calificacion_estrellas\` INT DEFAULT 5,
        \`comentario_cliente\` TEXT NULL,
        \`estado_conformidad\` VARCHAR(50) DEFAULT 'CONFORME',
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_calidad_tecnico\` (\`tecnico\`, \`fecha_auditoria\`),
        INDEX \`idx_ticket\` (\`numero_ticket\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Tabla `auditorias_calidad_cliente` creada / verificada con éxito.');

    console.log('🎉 Migración de Supervisión & Calidad finalizada con éxito.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error creando tablas de supervisión:', err);
    process.exit(1);
  }
}

setupSupervisionTables();
