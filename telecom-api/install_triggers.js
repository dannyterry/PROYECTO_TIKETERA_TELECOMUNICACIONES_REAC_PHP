const mysql = require('mysql2/promise');

const REMOTE_CONFIG = {
  host: 'corporacioncespedes.com',
  user: 'corporacioncespe_miguel',
  password: 'corporacioncespe_123',
  database: 'corporacioncespe_cespedes',
  dateStrings: true,
  connectTimeout: 30000,
  multipleStatements: true
};

const LOCAL_CONFIG = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: '',
  database: 'corporacioncespe_cespedes',
  dateStrings: true,
  multipleStatements: true
};

async function installTriggersOnDb(config, label) {
  try {
    const pool = mysql.createPool(config);
    console.log(`Instalando sincronización en ${label}...`);

    // Sincronizar todos los estados actuales
    await pool.query(`
      UPDATE trabajadores t
      JOIN usuarios u ON t.id_usuario = u.id_usuario
      SET t.estado = IF(u.estado = 'Activo', 'Activo', 'Inactivo')
    `);

    // Triggers automáticos
    await pool.query(`DROP TRIGGER IF EXISTS trg_usuarios_sync_trabajador_insert;`);
    await pool.query(`
      CREATE TRIGGER trg_usuarios_sync_trabajador_insert
      AFTER INSERT ON usuarios
      FOR EACH ROW
      BEGIN
        INSERT INTO trabajadores (id_usuario, id_horario, fecha_ingreso, estado, fecha_creacion)
        VALUES (NEW.id_usuario, 1, COALESCE(NEW.fecha_ingreso, CURDATE()), IF(NEW.estado = 'Activo', 'Activo', 'Inactivo'), NOW())
        ON DUPLICATE KEY UPDATE estado = IF(NEW.estado = 'Activo', 'Activo', 'Inactivo');
      END;
    `);

    await pool.query(`DROP TRIGGER IF EXISTS trg_usuarios_sync_trabajador_update;`);
    await pool.query(`
      CREATE TRIGGER trg_usuarios_sync_trabajador_update
      AFTER UPDATE ON usuarios
      FOR EACH ROW
      BEGIN
        IF OLD.estado != NEW.estado THEN
          UPDATE trabajadores 
          SET estado = IF(NEW.estado = 'Activo', 'Activo', 'Inactivo')
          WHERE id_usuario = NEW.id_usuario;
        END IF;
      END;
    `);

    console.log(`✅ Triggers y sincronización completada en ${label}.`);
    await pool.end();
  } catch (err) {
    console.warn(`⚠️ Error en ${label}:`, err.message);
  }
}

async function run() {
  await installTriggersOnDb(LOCAL_CONFIG, 'LOCAL (XAMPP)');
  await installTriggersOnDb(REMOTE_CONFIG, 'REMOTO (Hosting)');
}

run();
