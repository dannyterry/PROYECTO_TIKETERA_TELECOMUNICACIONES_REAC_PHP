const mysql = require('mysql2/promise');

async function migrate() {
  const remoteConn = await mysql.createConnection({
    host: 'corporacioncespedes.com',
    user: 'corporacioncespe_miguel',
    password: 'corporacioncespe_123',
    database: 'corporacioncespe_cespedes'
  });

  console.log('📡 Conectado a la base de datos de producción (corporacioncespedes.com)...');

  // 1. Crear tabla adelantos_sueldo
  console.log('\n1. Creando tabla adelantos_sueldo en Producción...');
  await remoteConn.query(`
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
  `);
  console.log('✅ Tabla adelantos_sueldo creada o verificada en Producción.');

  // 2. Columnas faltantes en ordenes
  console.log('\n2. Agregando columnas faltantes a tabla ordenes en Producción...');
  const colsOrdenes = [
    { name: 'asignacion_manual', sql: 'ALTER TABLE ordenes ADD COLUMN asignacion_manual TINYINT(1) DEFAULT 0' },
    { name: 'fecha_asignacion_manual', sql: 'ALTER TABLE ordenes ADD COLUMN fecha_asignacion_manual DATETIME DEFAULT NULL' },
    { name: 'cuadrilla_origen_fenix', sql: 'ALTER TABLE ordenes ADD COLUMN cuadrilla_origen_fenix VARCHAR(255) DEFAULT NULL' }
  ];

  for (const c of colsOrdenes) {
    try {
      await remoteConn.query(c.sql);
      console.log('  ✅ Columna agregada en ordenes: ' + c.name);
    } catch(e) {
      if (e.code === 'ER_DUP_FIELDNAME') console.log('  ℹ️ Ya existía en ordenes: ' + c.name);
      else throw e;
    }
  }

  console.log('\n🎉 ¡TODAS LAS TABLAS Y COLUMNAS HAN SIDO SINCRONIZADAS CON ÉXITO EN PRODUCCIÓN!');
  await remoteConn.end();
  process.exit(0);
}

migrate().catch(err => {
  console.error('❌ Error en migración:', err);
  process.exit(1);
});
