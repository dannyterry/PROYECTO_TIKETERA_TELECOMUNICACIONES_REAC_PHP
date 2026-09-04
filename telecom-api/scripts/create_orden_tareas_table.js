const mysql = require('mysql2/promise');

async function createTable() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  console.log("🛠️ CREANDO TABLA orden_tareas...");

  await conn.query(`
    CREATE TABLE IF NOT EXISTS orden_tareas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      id_orden INT NOT NULL,
      numero_orden VARCHAR(50) NOT NULL,
      id_tarea_fenix VARCHAR(50) NOT NULL,
      index_tarea INT DEFAULT 0,
      titulo VARCHAR(255) NOT NULL,
      estado VARCHAR(50) DEFAULT 'Pendiente',
      es_obligatorio TINYINT(1) DEFAULT 0,
      tipo_icono VARCHAR(50) NULL,
      tiene_foto TINYINT(1) DEFAULT 0,
      valor_texto TEXT NULL,
      metraje DECIMAL(10,2) NULL,
      observacion TEXT NULL,
      fecha_inicio VARCHAR(50) NULL,
      fecha_fin VARCHAR(50) NULL,
      duracion VARCHAR(50) NULL,
      fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_id_orden (id_orden),
      INDEX idx_numero_orden (numero_orden),
      INDEX idx_titulo (titulo),
      UNIQUE KEY uniq_orden_tarea (id_orden, id_tarea_fenix, index_tarea)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  console.log("✅ Tabla orden_tareas creada / verificada con éxito.");
  await conn.end();
}

createTable().catch(console.error);
