const mysql = require('mysql2/promise');

async function testRebuild() {
  const pool = mysql.createPool({ 
    host: 'corporacioncespedes.com', 
    user: 'corporacioncespe_miguel', 
    password: 'corporacioncespe_123', 
    database: 'corporacioncespe_cespedes',
    connectTimeout: 15000 
  });

  console.log('1. Creando tabla limpia orden_tareas_cache_new...');
  await pool.query('DROP TABLE IF EXISTS orden_tareas_cache_new');
  await pool.query('CREATE TABLE orden_tareas_cache_new LIKE orden_tareas_cache');

  console.log('2. Copiando los 1,615 registros limpios (solo enlaces S3, 16 MB)...');
  const t0 = Date.now();
  const [insertRes] = await pool.query('INSERT INTO orden_tareas_cache_new SELECT * FROM orden_tareas_cache');
  console.log(`✅ ${insertRes.affectedRows} filas copiadas en ${((Date.now() - t0)/1000).toFixed(2)}s`);

  // Verificar el tamaño de la nueva tabla
  const [sizeNew] = await pool.query(`
    SELECT 
      table_name, 
      ROUND(data_length/1024/1024, 2) as data_mb, 
      ROUND(index_length/1024/1024, 2) as index_mb 
    FROM information_schema.tables 
    WHERE table_schema = 'corporacioncespe_cespedes' AND table_name = 'orden_tareas_cache_new'
  `);
  console.log('📊 Tamaño de la nueva tabla limpia:');
  console.table(sizeNew);

  console.log('3. Intercambiando tablas atómicamente (0ms de corte)...');
  await pool.query('RENAME TABLE orden_tareas_cache TO orden_tareas_cache_old, orden_tareas_cache_new TO orden_tareas_cache');

  console.log('4. Eliminando el archivo viejo de 886 MB del disco duro...');
  await pool.query('DROP TABLE orden_tareas_cache_old');

  // Verificar tamaño final
  const [sizeFinal] = await pool.query(`
    SELECT 
      table_name, 
      ROUND(data_length/1024/1024, 2) as data_mb, 
      ROUND(index_length/1024/1024, 2) as index_mb 
    FROM information_schema.tables 
    WHERE table_schema = 'corporacioncespe_cespedes' AND table_name = 'orden_tareas_cache'
  `);
  console.log('🎉 Tamaño final de orden_tareas_cache en disco:');
  console.table(sizeFinal);

  const [totalDb] = await pool.query(`
    SELECT ROUND(SUM(data_length + index_length)/1024/1024, 2) as total_db_mb 
    FROM information_schema.tables 
    WHERE table_schema = 'corporacioncespe_cespedes'
  `);
  console.log(`\n💾 TAMAÑO TOTAL DE LA BASE DE DATOS EN PRODUCCIÓN: ${totalDb[0].total_db_mb} MB`);

  pool.end();
  process.exit(0);
}

testRebuild().catch(console.error);
