const mysql = require('mysql2/promise');

const REMOTE_CONFIG = {
  host: 'corporacioncespedes.com',
  user: 'corporacioncespe_miguel',
  password: 'corporacioncespe_123',
  database: 'corporacioncespe_cespedes',
  connectTimeout: 30000
};

async function applyMigrationsToProd() {
  console.log('📡 Conectando a Producción (corporacioncespedes.com)...');
  const remoteConn = await mysql.createConnection(REMOTE_CONFIG);

  try {
    // 1. Crear tabla control_jornadas_personal
    console.log('\n1. Creando tabla control_jornadas_personal en Producción...');
    await remoteConn.query(`
      CREATE TABLE IF NOT EXISTS control_jornadas_personal (
        id_jornada int(11) NOT NULL AUTO_INCREMENT,
        id_usuario int(11) NOT NULL,
        fecha date NOT NULL,
        hora_primer_ingreso time NOT NULL,
        hora_ultimo_acceso time NOT NULL,
        minutos_totales int(11) DEFAULT 1,
        intervalos_actividad longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(intervalos_actividad)),
        ultima_accion varchar(255) DEFAULT NULL,
        ip_address varchar(50) DEFAULT NULL,
        dispositivo varchar(255) DEFAULT NULL,
        fecha_actualizacion timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (id_jornada),
        UNIQUE KEY uq_usuario_fecha (id_usuario, fecha),
        KEY idx_fecha (fecha),
        KEY idx_usuario (id_usuario)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Tabla control_jornadas_personal lista en Producción.');

    // 2. Columna foto_acta en orden_liquidaciones
    console.log('\n2. Verificando/Agregando columna foto_acta a orden_liquidaciones...');
    try {
      await remoteConn.query(`
        ALTER TABLE orden_liquidaciones 
        ADD COLUMN foto_acta VARCHAR(500) DEFAULT NULL;
      `);
      console.log('✅ Columna foto_acta agregada a orden_liquidaciones en Producción.');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ La columna foto_acta ya existía en orden_liquidaciones.');
      } else {
        throw e;
      }
    }

    console.log('\n🎉 ¡Base de datos de Producción actualizada y sincronizada!');
  } finally {
    await remoteConn.end();
  }
}

applyMigrationsToProd().catch(err => {
  console.error('❌ Error aplicando migraciones a Producción:', err);
  process.exit(1);
});

