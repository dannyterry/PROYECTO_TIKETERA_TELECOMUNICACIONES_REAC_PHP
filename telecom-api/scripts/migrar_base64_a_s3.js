const pool = require('../db');
const { uploadBufferToS3 } = require('../services/s3Service');

/**
 * 🚀 Helper para subir Base64 a S3
 */
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

/**
 * Migra una orden específica de Base64 a S3
 */
async function migrarOrdenAS3(numeroOrden, tareasJsonRaw) {
  let tasks;
  try {
    tasks = JSON.parse(tareasJsonRaw);
  } catch (e) {
    return { ok: false, error: 'JSON inválido' };
  }

  if (!Array.isArray(tasks)) return { ok: false, error: 'No es array' };

  let fotosSubidas = 0;
  for (let tIdx = 0; tIdx < tasks.length; tIdx++) {
    const t = tasks[tIdx];

    // 1. Imagen miniatura de la tarea
    if (t.imagen_base64 && typeof t.imagen_base64 === 'string' && t.imagen_base64.startsWith('data:image/')) {
      const s3Key = `tareas/orden_${numeroOrden}/tarea_${t.id || tIdx}_${Date.now()}.jpg`;
      const s3Url = await subirBase64DirectoAS3(t.imagen_base64, s3Key);
      if (s3Url) {
        t.imagen_base64 = s3Url;
        fotosSubidas++;
      }
    }

    // 2. Fotografías de detalle / actas
    if (t.detalle && Array.isArray(t.detalle.fotografias)) {
      for (let fIdx = 0; fIdx < t.detalle.fotografias.length; fIdx++) {
        const fObj = t.detalle.fotografias[fIdx];
        if (fObj.imagen_hd && typeof fObj.imagen_hd === 'string' && fObj.imagen_hd.startsWith('data:image/')) {
          const s3Key = `tareas/orden_${numeroOrden}/acta_hd_${fObj.dataId || fIdx}_${Date.now()}.jpg`;
          const s3Url = await subirBase64DirectoAS3(fObj.imagen_hd, s3Key);
          if (s3Url) {
            fObj.imagen_hd = s3Url;
            fotosSubidas++;
          }
        }
        if (fObj.imagen && typeof fObj.imagen === 'string' && fObj.imagen.startsWith('data:image/')) {
          const s3Key = `tareas/orden_${numeroOrden}/acta_preview_${fObj.dataId || fIdx}_${Date.now()}.jpg`;
          const s3Url = await subirBase64DirectoAS3(fObj.imagen, s3Key);
          if (s3Url) {
            fObj.imagen = s3Url;
            fotosSubidas++;
          }
        }
      }
    }
  }

  if (fotosSubidas > 0) {
    const nuevoJson = JSON.stringify(tasks);
    await pool.query(
      'UPDATE orden_tareas_cache SET tareas_json = ?, fecha_actualizacion = NOW() WHERE numero_orden = ?',
      [nuevoJson, numeroOrden]
    );
    const bytesAhorrados = Buffer.byteLength(tareasJsonRaw) - Buffer.byteLength(nuevoJson);
    return { ok: true, fotosSubidas, bytesAhorrados };
  }

  return { ok: true, fotosSubidas: 0, bytesAhorrados: 0 };
}

async function run(batchLimit = 25) {
  console.log("☁️ [S3 Migration] Iniciando comprobación de orden_tareas_cache...");

  const [countRows] = await pool.query(
    "SELECT count(*) as total, ROUND(SUM(OCTET_LENGTH(tareas_json))/1024/1024, 2) as mb FROM orden_tareas_cache WHERE LOCATE('data:image', tareas_json) > 0"
  );
  const pendientes = countRows[0] ? countRows[0].total : 0;
  const mbTotal = countRows[0] ? countRows[0].mb : 0;

  console.log(`📊 Órdenes con Base64 pendientes: ${pendientes} (~${mbTotal} MB)`);
  if (pendientes === 0) {
    console.log("🎉 ¡La base de datos ya está completamente limpia y sincronizada con S3!");
    process.exit(0);
  }

  console.log(`🚀 Procesando lote de ${batchLimit} órdenes hacia S3...`);
  const [rows] = await pool.query(
    "SELECT numero_orden, OCTET_LENGTH(tareas_json) as bytes_antes, tareas_json FROM orden_tareas_cache WHERE LOCATE('data:image', tareas_json) > 0 LIMIT ?",
    [batchLimit]
  );

  let totalFotos = 0;
  let totalBytes = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const res = await migrarOrdenAS3(row.numero_orden, row.tareas_json);
    if (res.ok && res.fotosSubidas > 0) {
      totalFotos += res.fotosSubidas;
      totalBytes += res.bytesAhorrados;
      console.log(`  [${i + 1}/${rows.length}] Orden #${row.numero_orden}: ${res.fotosSubidas} fotos migradas a S3 (${(res.bytesAhorrados / 1024).toFixed(1)} KB liberados)`);
    }
  }

  const mbAhorrados = (totalBytes / (1024 * 1024)).toFixed(2);
  console.log(`\n✅ Lote completado:`);
  console.log(`   - Fotos subidas a S3: ${totalFotos}`);
  console.log(`   - Espacio liberado en MySQL: ${mbAhorrados} MB`);
  console.log(`   - Órdenes restantes: ${Math.max(0, pendientes - rows.length)}`);

  process.exit(0);
}

const batchArg = process.argv[2] ? parseInt(process.argv[2], 10) : 25;
run(batchArg).catch(e => {
  console.error("Error en migración:", e);
  process.exit(1);
});
