const mysql = require('mysql2/promise');

// ============================================================
// ⚙️ SWITCH DE ENTORNO (CAMBIA AQUÍ SEGÚN TU NECESIDAD)
// ============================================================
// 🟢 En Windows (Procesador local) conecta a XAMPP local
// 🔴 En Linux (cPanel hosting /home/corporacioncespe/...) conecta a Producción automáticamente
const isLinuxHosting = process.platform === 'linux' || __dirname.includes('corporacioncespe');
const IS_PRODUCTION = isLinuxHosting;

// ============================================================
// 🟢 1. CONFIGURACIÓN LOCAL (XAMPP en tu PC)
// ============================================================
const localConfig = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: '',
  database: 'corporacioncespe_cespedes'
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
  connectionLimit: 25,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
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

    // Asegurar compatibilidad de columnas e índices en tabla asistencias
    try {
      await connection.query(`
        ALTER TABLE asistencias 
        MODIFY COLUMN hora_salida TIME NULL DEFAULT NULL,
        MODIFY COLUMN hora_entrada TIME NULL DEFAULT '07:30:00',
        MODIFY COLUMN minutos_tarde INT NOT NULL DEFAULT 0,
        MODIFY COLUMN estado ENUM('Asistio', 'Tardanza', 'Falta', 'Descanso', 'Permiso') NOT NULL DEFAULT 'Asistio'
      `);
    } catch (err) {}

    try {
      // Eliminar índices únicos erróneos individuales que impedían más de 1 asistencia por día o por trabajador
      const [idxRows] = await connection.query("SHOW INDEX FROM asistencias WHERE Key_name IN ('fecha', 'id_trabajador') AND Non_unique = 0");
      for (const idx of idxRows) {
        try {
          if (idx.Key_name === 'fecha') await connection.query("ALTER TABLE asistencias DROP INDEX fecha");
          if (idx.Key_name === 'id_trabajador') {
            await connection.query("ALTER TABLE asistencias ADD INDEX idx_trabajador (id_trabajador)");
            await connection.query("ALTER TABLE asistencias DROP INDEX id_trabajador");
          }
        } catch (e) {}
      }
      // Asegurar índice único compuesto correcto (un trabajador sólo 1 registro por día)
      await connection.query("ALTER TABLE asistencias ADD UNIQUE KEY uk_trabajador_fecha (id_trabajador, fecha)");
    } catch (err) {}

    try {
      await connection.query("ALTER TABLE asistencias ADD INDEX idx_fecha (fecha)");
    } catch (err) {}

    // Asegurar que trabajadores permita inserción de nuevo personal sin bloqueo de FKs
    try {
      await connection.query("ALTER TABLE trabajadores MODIFY COLUMN id_horario INT NULL DEFAULT 1");
      await connection.query("ALTER TABLE trabajadores MODIFY COLUMN fecha_ingreso DATE NULL DEFAULT (CURRENT_DATE)");
    } catch (err) {}

    // Sincronizar automáticamente cualquier usuario que no tenga registro en trabajadores
    try {
      await connection.query(`
        INSERT INTO trabajadores (id_trabajador, id_usuario, id_horario, fecha_ingreso, estado)
        SELECT u.id_usuario, u.id_usuario, 1, CURDATE(), 'Activo'
        FROM usuarios u
        LEFT JOIN trabajadores t ON u.id_usuario = t.id_usuario
        WHERE t.id_trabajador IS NULL
      `);
    } catch (err) {}

    // Asegurar columna precio_cespedes en tipos_trabajo
    try {
      await connection.query("ALTER TABLE tipos_trabajo ADD COLUMN precio_cespedes DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER nombre");
    } catch (err) {}

    // Asegurar tabla adelantos_sueldo
    try {
      await connection.query(`
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
    } catch (err) {}

    // Asegurar columna liquidado_por y flexibilidad en orden_liquidaciones
    try {
      const [colLiq] = await connection.query("SHOW COLUMNS FROM orden_liquidaciones LIKE 'liquidado_por'");
      if (colLiq.length === 0) {
        await connection.query("ALTER TABLE orden_liquidaciones ADD COLUMN liquidado_por VARCHAR(150) NULL AFTER fecha_liquidacion");
      }
      await connection.query("ALTER TABLE orden_liquidaciones MODIFY COLUMN id_trabajador INT(11) NULL");
    } catch (err) {}

    // Asegurar estado varchar en trabajador_descansos
    try {
      await connection.query("ALTER TABLE trabajador_descansos MODIFY COLUMN estado VARCHAR(50) NOT NULL DEFAULT 'Programado'");
    } catch (err) {}

    // Asegurar tabla despachos, despacho_detalles y fecha_actualizacion
    try {
      const [colAct] = await connection.query("SHOW COLUMNS FROM trabajador_productos LIKE 'fecha_actualizacion'");
      if (colAct.length === 0) {
        await connection.query("ALTER TABLE trabajador_productos ADD COLUMN fecha_actualizacion DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER fecha_creacion");
      }

      await connection.query(`
        CREATE TABLE IF NOT EXISTS despachos (
          id_despacho INT AUTO_INCREMENT PRIMARY KEY,
          codigo_despacho VARCHAR(50) NOT NULL UNIQUE,
          id_trabajador INT NOT NULL,
          id_usuario_despacha INT NULL,
          id_vehiculo INT NULL,
          tipo_despacho VARCHAR(50) DEFAULT 'DOTACION_OPERATIVA',
          total_items INT DEFAULT 0,
          total_series INT DEFAULT 0,
          observaciones TEXT NULL,
          estado ENUM('COMPLETADO', 'ANULADO') DEFAULT 'COMPLETADO',
          fecha_despacho DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_desp_trabajador (id_trabajador),
          INDEX idx_desp_fecha (fecha_despacho)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS despacho_detalles (
          id_detalle_despacho INT AUTO_INCREMENT PRIMARY KEY,
          id_despacho INT NOT NULL,
          id_producto INT NOT NULL,
          cantidad INT NOT NULL DEFAULT 1,
          es_segundo_uso TINYINT(1) DEFAULT 0,
          series_entregadas TEXT NULL,
          drop_inicio INT NULL,
          drop_fin INT NULL,
          observaciones VARCHAR(255) NULL,
          INDEX idx_det_despacho (id_despacho),
          INDEX idx_det_producto (id_producto),
          FOREIGN KEY (id_despacho) REFERENCES despachos(id_despacho) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    } catch (err) {}

    connection.release();
  })
  .catch((err) => {
    console.error(`❌ [DB] Error al conectar con MySQL (${currentConfig.host}):`, err.message);
  });

module.exports = pool;


