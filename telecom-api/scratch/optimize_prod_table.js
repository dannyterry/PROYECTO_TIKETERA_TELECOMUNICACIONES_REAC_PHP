const mysql = require('mysql2/promise');
const { uploadBufferToS3 } = require('../services/s3Service');

async function subirBase64DirectoAS3(base64Str, s3Key) {
  try {
    const match = base64Str.match(/^data:(image\/[a-zA-Z0-9.+]+);base64,(.+)$/);
    let contentType = 'image/jpeg';
    let base64Data = base64Str;
    if (match) {
      contentType = match[1];
      base64Data = match[2];
    }
    const buffer = Buffer.from(base64Data, 'base64');
    const res = await uploadBufferToS3(buffer, s3Key, contentType);
    return res && res.s3Url ? res.s3Url : null;
  } catch (err) {
    console.error(`Error subiendo ${s3Key} a S3:`, err.message);
    return null;
  }
}

async function main() {
  console.log('🚀 Conectando a Producción para optimización segura...');
  const pool = mysql.createPool({ 
    host: 'corporacioncespedes.com', 
    user: 'corporacioncespe_miguel', 
    password: 'corporacioncespe_123', 
    database: 'corporacioncespe_cespedes',
    connectTimeout: 20000 
  });

  // 1. Migrar los últimos 2 registros con data:image a S3 si los hay
  const [pendientes] = await pool.query(
    "SELECT numero_orden, tareas_json FROM orden_tareas_cache WHERE LOCATE('data:image', tareas_json) > 0"
  );
  console.log(`📸 Registros con Base64 pendientes de pasar a S3: ${pendientes.length}`);
  for (const row of pendientes) {
    try {
      const tasks = JSON.parse(row.tareas_json);
      let subidas = 0;
      for (let tIdx = 0; tIdx < tasks.length; tIdx++) {
        const t = tasks[tIdx];
        if (t.imagen_base64 && typeof t.imagen_base64 === 'string' && t.imagen_base64.startsWith('data:image/')) {
          const s3Key = `tareas/orden_${row.numero_orden}/tarea_${t.id || tIdx}_${Date.now()}.jpg`;
          const url = await subirBase64DirectoAS3(t.imagen_base64, s3Key);
          if (url) { t.imagen_base64 = url; subidas++; }
        }
        if (t.detalle && Array.isArray(t.detalle.fotografias)) {
          for (let fIdx = 0; fIdx < t.detalle.fotografias.length; fIdx++) {
            const f = t.detalle.fotografias[fIdx];
            if (f.imagen_hd && typeof f.imagen_hd === 'string' && f.imagen_hd.startsWith('data:image/')) {
              const s3Key = `tareas/orden_${row.numero_orden}/acta_hd_${f.dataId || fIdx}_${Date.now()}.jpg`;
              const url = await subirBase64DirectoAS3(f.imagen_hd, s3Key);
              if (url) { f.imagen_hd = url; subidas++; }
            }
            if (f.imagen && typeof f.imagen === 'string' && f.imagen.startsWith('data:image/')) {
              const s3Key = `tareas/orden_${row.numero_orden}/acta_preview_${f.dataId || fIdx}_${Date.now()}.jpg`;
              const url = await subirBase64DirectoAS3(f.imagen, s3Key);
              if (url) { f.imagen = url; subidas++; }
            }
          }
        }
      }
      if (subidas > 0) {
        await pool.query('UPDATE orden_tareas_cache SET tareas_json = ? WHERE numero_orden = ?', [JSON.stringify(tasks), row.numero_orden]);
        console.log(`✅ Orden #${row.numero_orden}: ${subidas} fotos subidas a S3.`);
      }
    } catch (e) {
      console.warn(`Aviso en orden #${row.numero_orden}:`, e.message);
    }
  }

  // 2. Comprobar métricas ANTES de optimizar
  const [antes] = await pool.query(`
    SELECT 
      table_name, 
      ROUND(data_length/1024/1024, 2) as data_mb, 
      ROUND(index_length/1024/1024, 2) as index_mb, 
      ROUND(data_free/1024/1024, 2) as free_mb 
    FROM information_schema.tables 
    WHERE table_schema = 'corporacioncespe_cespedes' AND table_name = 'orden_tareas_cache'
  `);
  console.log('\n📊 ESTADO ANTES DE OPTIMIZAR:');
  console.table(antes);

  // 3. Ejecutar OPTIMIZE TABLE
  console.log('\n🧹 Ejecutando OPTIMIZE TABLE orden_tareas_cache en el servidor MySQL...');
  const startTime = Date.now();
  const [optResult] = await pool.query('OPTIMIZE TABLE orden_tareas_cache');
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`✅ Optimización finalizada en ${elapsed}s:`, optResult);

  // 4. Comprobar métricas DESPUÉS de optimizar
  const [despues] = await pool.query(`
    SELECT 
      table_name, 
      ROUND(data_length/1024/1024, 2) as data_mb, 
      ROUND(index_length/1024/1024, 2) as index_mb, 
      ROUND(data_free/1024/1024, 2) as free_mb 
    FROM information_schema.tables 
    WHERE table_schema = 'corporacioncespe_cespedes' AND table_name = 'orden_tareas_cache'
  `);
  console.log('\n🎉 ESTADO DESPUÉS DE OPTIMIZAR:');
  console.table(despues);

  // 5. Total de base de datos
  const [totalDb] = await pool.query(`
    SELECT ROUND(SUM(data_length + index_length)/1024/1024, 2) as total_db_mb 
    FROM information_schema.tables 
    WHERE table_schema = 'corporacioncespe_cespedes'
  `);
  console.log(`\n💾 TAMAÑO TOTAL DE LA BASE DE DATOS EN PRODUCCIÓN: ${totalDb[0].total_db_mb} MB`);

  pool.end();
  process.exit(0);
}

main().catch(console.error);
