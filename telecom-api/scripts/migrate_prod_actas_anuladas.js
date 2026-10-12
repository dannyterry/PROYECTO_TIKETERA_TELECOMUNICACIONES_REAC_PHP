const mysql = require('mysql2/promise');

async function main() {
  const remoteConn = await mysql.createConnection({
    host: 'corporacioncespedes.com',
    user: 'corporacioncespe_miguel',
    password: 'corporacioncespe_123',
    database: 'corporacioncespe_cespedes'
  });

  console.log('📡 Conectado a la BD de Producción...');

  console.log('1. Modificando enum de trabajador_series en Producción...');
  await remoteConn.query(`
    ALTER TABLE trabajador_series 
    MODIFY COLUMN estado ENUM('Asignada','Usada','Devuelta','Anulada') NOT NULL DEFAULT 'Asignada'
  `);
  console.log('✅ trabajador_series.estado actualizado con Anulada.');

  console.log('2. Creando tabla actas_anuladas en Producción...');
  await remoteConn.query(`
    CREATE TABLE IF NOT EXISTS actas_anuladas (
      id_acta_anulada INT(11) NOT NULL AUTO_INCREMENT,
      id_trabajador INT(11) DEFAULT NULL,
      id_producto_serie INT(11) DEFAULT NULL,
      numero_acta VARCHAR(50) NOT NULL,
      motivo TEXT NOT NULL,
      foto_url LONGTEXT DEFAULT NULL,
      anulado_por VARCHAR(150) DEFAULT NULL,
      fecha_anulacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
      PRIMARY KEY (id_acta_anulada),
      KEY idx_trabajador (id_trabajador),
      KEY idx_numero (numero_acta)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✅ Tabla actas_anuladas creada con éxito en Producción.');

  await remoteConn.end();
  console.log('🎉 Migración en producción finalizada exitosamente.');
}

main().catch(err => {
  console.error('❌ Error migrando en producción:', err);
  process.exit(1);
});
