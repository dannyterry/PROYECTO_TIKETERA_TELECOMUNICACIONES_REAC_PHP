const pool = require('../db');

async function createChatTable() {
  try {
    console.log('🚀 Creando tabla mensajes_chat en MySQL...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS mensajes_chat (
        id_mensaje INT AUTO_INCREMENT PRIMARY KEY,
        id_emisor INT NOT NULL,
        emisor_nombre VARCHAR(150) NOT NULL,
        emisor_rol VARCHAR(100) NULL,
        emisor_area VARCHAR(100) NULL,
        id_receptor INT NULL,
        receptor_nombre VARCHAR(150) NULL,
        mensaje TEXT NOT NULL,
        leido TINYINT(1) DEFAULT 0,
        fecha_envio DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_fecha (fecha_envio),
        INDEX idx_emisor (id_emisor),
        INDEX idx_receptor (id_receptor)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('✅ Tabla mensajes_chat creada correctamente.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creando tabla mensajes_chat:', error);
    process.exit(1);
  }
}

createChatTable();
