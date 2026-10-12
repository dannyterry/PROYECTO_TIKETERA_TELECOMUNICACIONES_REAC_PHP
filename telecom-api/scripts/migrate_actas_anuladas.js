const mysql = require('mysql2/promise');

async function migrate() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  try {
    await conn.query(`
      ALTER TABLE trabajador_series 
      MODIFY COLUMN estado ENUM('Asignada','Usada','Devuelta','Anulada') NOT NULL DEFAULT 'Asignada'
    `);
    console.log('ALTER TABLE trabajador_series OK');
  } catch (err) {
    console.warn('Advertencia en ALTER trabajador_series:', err.message);
  }

  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS actas_anuladas (
        id_acta_anulada INT AUTO_INCREMENT PRIMARY KEY,
        id_trabajador INT NULL,
        id_producto_serie INT NULL,
        numero_acta VARCHAR(50) NOT NULL,
        motivo TEXT NOT NULL,
        foto_url LONGTEXT NULL,
        anulado_por VARCHAR(150) NULL,
        fecha_anulacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_trabajador (id_trabajador),
        INDEX idx_numero (numero_acta)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('CREATE TABLE actas_anuladas OK');
  } catch (err) {
    console.error('Error creando actas_anuladas:', err.message);
  }

  await conn.end();
}

migrate().then(() => console.log('Migración completada'));
