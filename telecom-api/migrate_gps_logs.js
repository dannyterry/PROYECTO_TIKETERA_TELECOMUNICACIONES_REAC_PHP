const pool = require('./db');

async function migrateGps() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`tecnico_gps_logs\` (
        \`id_gps_log\` INT AUTO_INCREMENT PRIMARY KEY,
        \`id_trabajador\` INT NOT NULL,
        \`id_vehiculo\` INT NULL,
        \`lat\` DECIMAL(10,8) NOT NULL,
        \`lng\` DECIMAL(11,8) NOT NULL,
        \`tipo_evento\` ENUM('CHECKLIST_INICIO', 'ACTA_CLIENTE', 'CHECKLIST_FIN', 'APP_OPEN') NOT NULL,
        \`referencia_id\` VARCHAR(50) NULL,
        \`descripcion\` VARCHAR(255) NULL,
        \`fecha_hora\` DATETIME NOT NULL,
        \`fecha_creacion\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_trabajador (\`id_trabajador\`),
        INDEX idx_fecha (\`fecha_hora\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("✅ Tabla tecnico_gps_logs creada / verificada con éxito.");
  } catch (error) {
    console.error("Error al crear tabla GPS:", error);
  } finally {
    process.exit(0);
  }
}

migrateGps();
