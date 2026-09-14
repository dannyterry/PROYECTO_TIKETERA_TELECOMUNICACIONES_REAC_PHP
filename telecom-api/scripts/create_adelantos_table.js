const pool = require('../db.js');

async function migrate() {
  try {
    const sql = `
      CREATE TABLE IF NOT EXISTS adelantos_sueldo (
        id_adelanto INT AUTO_INCREMENT PRIMARY KEY,
        id_trabajador INT NOT NULL,
        id_usuario_registro INT NULL,
        monto DECIMAL(10,2) NOT NULL,
        fecha_adelanto DATE NOT NULL,
        metodo_pago VARCHAR(50) DEFAULT 'Transferencia',
        numero_operacion VARCHAR(100) NULL,
        motivo VARCHAR(255) NULL,
        estado ENUM('PENDIENTE', 'DESCONTADO', 'ANULADO') DEFAULT 'PENDIENTE',
        fecha_descuento DATE NULL,
        id_orden_liquidacion INT NULL,
        observaciones TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_trabajador (id_trabajador),
        INDEX idx_fecha (fecha_adelanto),
        INDEX idx_estado (estado)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await pool.query(sql);
    console.log('✅ Tabla adelantos_sueldo creada o verificada exitosamente.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creando tabla adelantos_sueldo:', error);
    process.exit(1);
  }
}

migrate();
