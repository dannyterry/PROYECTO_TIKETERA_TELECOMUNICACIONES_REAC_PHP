const mysql = require('mysql2/promise');

// ============================================================
// ⚙️ SWITCH DE ENTORNO (CAMBIA AQUÍ SEGÚN TU NECESIDAD)
// ============================================================
// 🟢 false = MODO LOCAL (Para trabajar en tu PC con XAMPP / MySQL local)
// 🔴 true  = MODO PRODUCCIÓN (Para cuando subas el código al Hosting cPanel)
const IS_PRODUCTION = true; // ⬅️ Cambia a true antes de subir al hosting

// ============================================================
// 🟢 1. CONFIGURACIÓN LOCAL (XAMPP en tu PC)
// ============================================================
const localConfig = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: '',
  database: 'corporacionescepe_cespedes'
};

// ============================================================
// 🔴 2. CONFIGURACIÓN PRODUCCIÓN (Hosting cPanel)
// ============================================================
const prodConfig = {
  host: 'localhost',
  user: 'corporacioncespe_miguel',
  password: 'corporacioncespe_123',
  database: 'corporacioncespe_cespedes'
};

// Selección de configuración según el Switch
const currentConfig = IS_PRODUCTION ? prodConfig : localConfig;

console.log("--------------------------------------------------");
console.log(IS_PRODUCTION
  ? "🔴 [DB] CONECTADO A BASE DE DATOS DE PRODUCCIÓN (cPanel)"
  : "🟢 [DB] CONECTADO A BASE DE DATOS LOCAL (XAMPP / localhost)"
);
console.log(`📡 Base de datos seleccionada: '${currentConfig.database}'`);
console.log("--------------------------------------------------");

const pool = mysql.createPool({
  ...currentConfig,
  dateStrings: true, // Evita desfases de zona horaria UTC (+5h)
  timezone: '-05:00',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// 🇵🇪 Asegurar que cada conexión ejecute la zona horaria oficial de Perú (-05:00)
pool.pool.on('connection', (connection) => {
  connection.query("SET time_zone = '-05:00'");
});

// Prueba de conexión automática y optimización de índices al iniciar
pool.getConnection()
  .then(async (connection) => {
    await connection.query("SET time_zone = '-05:00'");
    console.log(`✅ [DB] ¡Conexión establecida correctamente con MySQL! (${currentConfig.host}:${currentConfig.port || 3306})`);

    // Crear índices de alta velocidad para fechas y búsquedas instantáneas
    const createIndexQueries = [
      "ALTER TABLE ordenes ADD INDEX idx_fecha_solicitud (fecha_solicitud)",
      "ALTER TABLE ordenes ADD INDEX idx_fecha_visita (fecha_visita)",
      "ALTER TABLE ordenes ADD INDEX idx_numero (numero)",
      "ALTER TABLE ordenes ADD INDEX idx_cliente (cliente)",
      "ALTER TABLE ordenes ADD INDEX idx_id_tecnico (id_tecnico)"
    ];

    for (const sql of createIndexQueries) {
      try {
        await connection.query(sql);
        console.log(`⚡ [DB Index] Índice creado exitosamente: ${sql.split(' ')[4]}`);
      } catch (err) {
        // Ignorar si el índice ya existe (Error 1061: Duplicate key name)
      }
    }

    connection.release();
  })
  .catch((err) => {
    console.error(`❌ [DB] Error al conectar con MySQL (${currentConfig.host}):`, err.message);
  });

module.exports = pool;


