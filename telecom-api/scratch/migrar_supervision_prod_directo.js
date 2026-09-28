const mysql = require('mysql2/promise');

const REMOTE_CONFIG = {
  host: 'corporacioncespedes.com',
  user: 'corporacioncespe_miguel',
  password: 'corporacioncespe_123',
  database: 'corporacioncespe_cespedes',
  dateStrings: true,
  connectTimeout: 60000
};

async function migrarProduccion() {
  console.log('================================================================');
  console.log('📡 CONECTANDO DIRECTAMENTE A LA BASE DE DATOS DE PRODUCCIÓN...');
  console.log('Host: corporacioncespedes.com | Base de Datos: corporacioncespe_cespedes');
  console.log('================================================================\n');

  let conn;
  try {
    conn = await mysql.createConnection(REMOTE_CONFIG);
    console.log('✅ Conexión establecida con éxito a Producción.');

    // 1. Verificar columnas existentes en supervision_campo
    const [cols] = await conn.query('DESCRIBE supervision_campo');
    const existing = cols.map(c => c.Field);

    const columnsToAdd = [
      { name: 'id_orden', def: 'int(11) DEFAULT NULL' },
      { name: 'numero_ticket', def: 'varchar(50) DEFAULT NULL' },
      { name: 'cliente_orden', def: 'varchar(150) DEFAULT NULL' },
      { name: 'direccion_orden', def: 'varchar(255) DEFAULT NULL' },
      { name: 'coordenadas_orden', def: 'varchar(100) DEFAULT NULL' },
      { name: 'coordenadas_en_camino', def: 'varchar(100) DEFAULT NULL' },
      { name: 'coordenadas_inicio', def: 'varchar(100) DEFAULT NULL' },
      { name: 'coordenadas_fin', def: 'varchar(100) DEFAULT NULL' },
      { name: 'distancia_metros_inicio', def: 'int(11) DEFAULT NULL' },
      { name: 'hora_inicio', def: 'time DEFAULT NULL' },
      { name: 'hora_fin', def: 'time DEFAULT NULL' },
    ];

    for (const col of columnsToAdd) {
      if (!existing.includes(col.name)) {
        console.log(`+ Agregando columna en Producción: ${col.name}`);
        await conn.query(`ALTER TABLE supervision_campo ADD COLUMN ${col.name} ${col.def}`);
      } else {
        console.log(`✓ Columna ya existe en Producción: ${col.name}`);
      }
    }

    // 2. Modificar enum de estado_operativo para incluir CANCELADA
    console.log('⚙️ Actualizando estado_operativo ENUM para incluir CANCELADA...');
    await conn.query("ALTER TABLE supervision_campo MODIFY COLUMN estado_operativo enum('EN_CAMINO','INICIADA','FINALIZADA','CANCELADA') DEFAULT 'INICIADA'");
    console.log('✅ ENUM estado_operativo actualizado.');

    // 3. Crear índices si no existen
    try {
      await conn.query("ALTER TABLE supervision_campo ADD INDEX idx_sup_estado_fecha (supervisor, estado_operativo, fecha)");
      console.log('✅ Índice idx_sup_estado_fecha creado.');
    } catch (e) {
      console.log('✓ Índice idx_sup_estado_fecha ya existe o no requirió cambios.');
    }

    console.log('\n================================================================');
    console.log('🎉 ¡MIGRACIÓN DE BASE DE DATOS DE PRODUCCIÓN COMPLETADA AL 100%!');
    console.log('================================================================');
  } catch (error) {
    console.error('❌ Error ejecutando migración en Producción:', error.message);
  } finally {
    if (conn) await conn.end();
    process.exit(0);
  }
}

migrarProduccion();
