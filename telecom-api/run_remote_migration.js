const mysql = require('mysql2/promise');

async function migrate() {
  const remoteConn = await mysql.createConnection({
    host: 'corporacioncespedes.com',
    user: 'corporacioncespe_miguel',
    password: 'corporacioncespe_123',
    database: 'corporacioncespe_cespedes'
  });

  console.log('📡 Conectado a la base de datos de producción...');

  // 1. Crear tabla trabajador_descansos
  console.log('\n1. Creando tabla trabajador_descansos...');
  await remoteConn.query(`
    CREATE TABLE IF NOT EXISTS \`trabajador_descansos\` (
      \`id_descanso\` int(11) NOT NULL AUTO_INCREMENT,
      \`id_trabajador\` int(11) NOT NULL,
      \`fecha_inicio\` date NOT NULL,
      \`fecha_fin\` date NOT NULL,
      \`motivo\` varchar(255) DEFAULT 'Descanso / Vacaciones',
      \`estado\` enum('Pendiente','Aprobado','Completado','Cancelado') DEFAULT 'Aprobado',
      \`fecha_creacion\` timestamp NOT NULL DEFAULT current_timestamp(),
      PRIMARY KEY (\`id_descanso\`),
      KEY \`fk_descansos_trab\` (\`id_trabajador\`),
      CONSTRAINT \`fk_descansos_trab\` FOREIGN KEY (\`id_trabajador\`) REFERENCES \`trabajadores\` (\`id_trabajador\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✅ Tabla trabajador_descansos lista.');

  // 2. Columnas en orden_equipos_retirados
  console.log('\n2. Agregando columnas a orden_equipos_retirados...');
  const colsEquipos = [
    { name: 'proid', sql: 'ALTER TABLE orden_equipos_retirados ADD COLUMN proid varchar(100) DEFAULT NULL' },
    { name: 'codigo_producto', sql: 'ALTER TABLE orden_equipos_retirados ADD COLUMN codigo_producto varchar(100) DEFAULT NULL' },
    { name: 'guia_remision_win', sql: 'ALTER TABLE orden_equipos_retirados ADD COLUMN guia_remision_win varchar(100) DEFAULT NULL' }
  ];
  for (const c of colsEquipos) {
    try {
      await remoteConn.query(c.sql);
      console.log('  ✅ Columna agregada: orden_equipos_retirados.' + c.name);
    } catch(e) {
      if (e.code === 'ER_DUP_FIELDNAME') console.log('  ℹ️ Ya existía: orden_equipos_retirados.' + c.name);
      else throw e;
    }
  }

  // 3. Columna en producto_series
  console.log('\n3. Agregando columna proid a producto_series...');
  try {
    await remoteConn.query('ALTER TABLE producto_series ADD COLUMN proid varchar(100) DEFAULT NULL');
    console.log('  ✅ Columna agregada: producto_series.proid');
  } catch(e) {
    if (e.code === 'ER_DUP_FIELDNAME') console.log('  ℹ️ Ya existía: producto_series.proid');
    else throw e;
  }

  // 4. Columnas en productos
  console.log('\n4. Agregando columnas a productos...');
  const colsProd = [
    { name: 'proid', sql: 'ALTER TABLE productos ADD COLUMN proid varchar(100) DEFAULT NULL' },
    { name: 'stand', sql: 'ALTER TABLE productos ADD COLUMN stand varchar(5) DEFAULT NULL' },
    { name: 'fila', sql: 'ALTER TABLE productos ADD COLUMN fila int(11) DEFAULT NULL' }
  ];
  for (const c of colsProd) {
    try {
      await remoteConn.query(c.sql);
      console.log('  ✅ Columna agregada: productos.' + c.name);
    } catch(e) {
      if (e.code === 'ER_DUP_FIELDNAME') console.log('  ℹ️ Ya existía: productos.' + c.name);
      else throw e;
    }
  }

  // 5. Columna en stock
  console.log('\n5. Agregando cantidad_segundo_uso a stock...');
  try {
    await remoteConn.query('ALTER TABLE stock ADD COLUMN cantidad_segundo_uso int(11) NOT NULL DEFAULT 0');
    console.log('  ✅ Columna agregada: stock.cantidad_segundo_uso');
  } catch(e) {
    if (e.code === 'ER_DUP_FIELDNAME') console.log('  ℹ️ Ya existía: stock.cantidad_segundo_uso');
    else throw e;
  }

  // 6. Columna en tipos_trabajo
  console.log('\n6. Agregando precio_cespedes a tipos_trabajo...');
  try {
    await remoteConn.query('ALTER TABLE tipos_trabajo ADD COLUMN precio_cespedes decimal(10,2) NOT NULL DEFAULT 0.00');
    console.log('  ✅ Columna agregada: tipos_trabajo.precio_cespedes');
  } catch(e) {
    if (e.code === 'ER_DUP_FIELDNAME') console.log('  ℹ️ Ya existía: tipos_trabajo.precio_cespedes');
    else throw e;
  }

  console.log('\n🎉 ¡MIGRACIÓN DE BASE DE DATOS COMPLETADA CON ÉXITO AL 100% EN PRODUCCIÓN!');
  await remoteConn.end();
  process.exit(0);
}

migrate().catch(err => {
  console.error('❌ Error en migración:', err);
  process.exit(1);
});
