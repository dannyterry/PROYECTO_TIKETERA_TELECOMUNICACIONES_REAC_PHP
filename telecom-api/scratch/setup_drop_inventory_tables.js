const mysql = require('mysql2/promise');

const LOCAL_CONFIG = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: '',
  database: 'corporacioncespe_cespedes'
};

const REMOTE_CONFIG = {
  host: 'corporacioncespedes.com',
  user: 'corporacioncespe_miguel',
  password: 'corporacioncespe_123',
  database: 'corporacioncespe_cespedes',
  connectTimeout: 30000
};

const createDevolucionesDropSql = `
CREATE TABLE IF NOT EXISTS inventario_devoluciones_drop (
  id_devolucion INT AUTO_INCREMENT PRIMARY KEY,
  id_trabajador INT NOT NULL,
  id_producto INT NOT NULL,
  metros_devueltos DECIMAL(10,2) NOT NULL,
  clasificacion ENUM('REUTILIZABLE', 'MERMA') NOT NULL,
  motivo VARCHAR(255) NULL,
  origen ENUM('MODAL_INDIVIDUAL', 'AUDITORIA_CRUCE', 'IMPORTACION_EXCEL') DEFAULT 'MODAL_INDIVIDUAL',
  id_usuario_registro INT NULL,
  fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_trabajador (id_trabajador),
  INDEX idx_clasificacion (clasificacion),
  INDEX idx_fecha (fecha_registro)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

const createAuditoriasCruceSql = `
CREATE TABLE IF NOT EXISTS inventario_auditorias_cruce (
  id_auditoria INT AUTO_INCREMENT PRIMARY KEY,
  id_trabajador INT NOT NULL,
  id_producto INT NOT NULL,
  stock_sistema DECIMAL(10,2) NOT NULL,
  stock_fisico DECIMAL(10,2) NOT NULL,
  sobrante_devuelto DECIMAL(10,2) DEFAULT 0,
  metros_reutilizables DECIMAL(10,2) DEFAULT 0,
  metros_merma DECIMAL(10,2) DEFAULT 0,
  diferencia DECIMAL(10,2) NOT NULL,
  estado_cuadre ENUM('CUADRADO', 'FALTANTE', 'SOBRANTE') NOT NULL,
  observaciones TEXT NULL,
  metodo ENUM('MANUAL_INDIVIDUAL', 'IMPORTACION_EXCEL') DEFAULT 'MANUAL_INDIVIDUAL',
  id_usuario_auditor INT NULL,
  fecha_auditoria TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_trabajador (id_trabajador),
  INDEX idx_audit_fecha (fecha_auditoria)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

async function setupTables() {
  console.log('📦 1. Creando tablas en base de datos LOCAL...');
  const localConn = await mysql.createConnection(LOCAL_CONFIG);
  try {
    await localConn.query(createDevolucionesDropSql);
    await localConn.query(createAuditoriasCruceSql);
    console.log('✅ Tablas creadas exitosamente en LOCAL.');
  } finally {
    await localConn.end();
  }

  console.log('\n📡 2. Creando tablas en base de datos PRODUCCIÓN (corporacioncespedes.com)...');
  try {
    const remoteConn = await mysql.createConnection(REMOTE_CONFIG);
    try {
      await remoteConn.query(createDevolucionesDropSql);
      await remoteConn.query(createAuditoriasCruceSql);
      console.log('✅ Tablas creadas exitosamente en PRODUCCIÓN.');
    } finally {
      await remoteConn.end();
    }
  } catch (errRemote) {
    console.warn('⚠️ No se pudo conectar a producción en este momento:', errRemote.message);
  }
}

setupTables();

