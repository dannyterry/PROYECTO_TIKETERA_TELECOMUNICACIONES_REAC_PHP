const pool = require('../db');

async function createAuditTables() {
  try {
    // 1. Agregar columnas a usuarios si no existen
    const [cols] = await pool.query('DESCRIBE usuarios');
    const colNames = cols.map((c) => c.Field);

    if (!colNames.includes('ultimo_acceso')) {
      await pool.query('ALTER TABLE usuarios ADD COLUMN ultimo_acceso TIMESTAMP NULL DEFAULT NULL');
      console.log('✅ Added ultimo_acceso to usuarios');
    }

    if (!colNames.includes('esta_online')) {
      await pool.query('ALTER TABLE usuarios ADD COLUMN esta_online TINYINT(1) DEFAULT 0');
      console.log('✅ Added esta_online to usuarios');
    }

    if (!colNames.includes('ultima_accion')) {
      await pool.query('ALTER TABLE usuarios ADD COLUMN ultima_accion VARCHAR(255) NULL DEFAULT NULL');
      console.log('✅ Added ultima_accion to usuarios');
    }

    // 2. Crear tabla auditoria_actividad
    await pool.query(`
      CREATE TABLE IF NOT EXISTS auditoria_actividad (
        id_log BIGINT AUTO_INCREMENT PRIMARY KEY,
        id_usuario INT NULL,
        usuario_nombre VARCHAR(255) NULL,
        id_rol INT NULL,
        rol_nombre VARCHAR(100) NULL,
        area VARCHAR(100) NULL,
        modulo VARCHAR(50) NOT NULL,
        accion VARCHAR(100) NOT NULL,
        id_referencia VARCHAR(100) NULL,
        descripcion TEXT NOT NULL,
        ip_address VARCHAR(45) NULL,
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_auditoria_usuario_fecha (id_usuario, fecha_creacion),
        INDEX idx_auditoria_modulo (modulo),
        INDEX idx_auditoria_fecha (fecha_creacion)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Table auditoria_actividad created successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error creating audit table:', err);
    process.exit(1);
  }
}

createAuditTables();
