const path = require('path');
const s3 = require('../services/s3Service');
const pool = require('../db');

const isDryRun = process.argv.includes('--dry-run');
const isAll = process.argv.includes('--all');
const limitArgIdx = process.argv.indexOf('--limit');
const batchSize = limitArgIdx !== -1 ? parseInt(process.argv[limitArgIdx + 1], 10) : (isAll ? 10000 : 20);

async function migrar() {
  console.log('='.repeat(70));
  console.log('🚀 MIGRACION MASIVA DE FOTOS BASE64 A AMAZON S3');
  console.log('  • Bucket S3:       ' + s3.S3_BUCKET + ' (' + s3.S3_REGION + ')');
  console.log('  • Modo:            ' + (isDryRun ? 'DRY-RUN (Simulación sin escribir)' : 'REAL (Subiendo a S3 y limpiando BD)'));
  console.log('  • Límite por lote: ' + batchSize);
  console.log('='.repeat(70) + '\n');

  try {
    // 1. Conteo total pendiente
    const [countRows] = await pool.query(
      "SELECT count(*) as total, ROUND(SUM(OCTET_LENGTH(tareas_json))/1024/1024, 2) as mb FROM orden_tareas_cache WHERE LOCATE('data:image', tareas_json) > 0"
    );
    const pendientesTotales = countRows[0].total || 0;
    const mbTotales = countRows[0].mb || 0;
    console.log(`📊 Órdenes pendientes con Base64: ${pendientesTotales} (~${mbTotales} MB en MySQL)\n`);

    if (pendientesTotales === 0) {
      console.log('✨ No hay órdenes pendientes con fotos Base64. ¡Todo limpio en S3!');
      await pool.end();
      return;
    }

    // 2. Traer lote
    const [rows] = await pool.query(
      "SELECT numero_orden, OCTET_LENGTH(tareas_json) as bytes_antes, tareas_json FROM orden_tareas_cache WHERE LOCATE('data:image', tareas_json) > 0 LIMIT ?",
      [batchSize]
    );

    console.log(`⏳ Procesando lote de ${rows.length} órdenes...\n`);

    let totalFotosSubidas = 0;
    let totalBytesAhorrados = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const numOrden = row.numero_orden;
      const pesoAntesKB = (row.bytes_antes / 1024).toFixed(1);

      let tasks;
      try {
        tasks = JSON.parse(row.tareas_json);
      } catch (e) {
        console.warn(`  [${i + 1}/${rows.length}] ⚠️ Orden #${numOrden}: JSON inválido, omitiendo.`);
        continue;
      }

      if (!Array.isArray(tasks)) continue;

      let fotosEnEstaOrden = 0;

      for (let tIdx = 0; tIdx < tasks.length; tIdx++) {
        const t = tasks[tIdx];

        // A) Foto principal de tarea
        if (t.imagen_base64 && typeof t.imagen_base64 === 'string' && t.imagen_base64.startsWith('data:image/')) {
          const s3Key = `tareas/orden_${numOrden}/tarea_${t.id || tIdx}_${Date.now()}.jpg`;
          const s3Url = await procesarYSubirBase64(t.imagen_base64, s3Key, isDryRun);
          if (s3Url) {
            t.imagen_base64 = s3Url;
            fotosEnEstaOrden++;
          }
        }

        // B) Fotografías en detalle
        if (t.detalle && Array.isArray(t.detalle.fotografias)) {
          for (let fIdx = 0; fIdx < t.detalle.fotografias.length; fIdx++) {
            const fObj = t.detalle.fotografias[fIdx];

            // B.1) Acta HD
            if (fObj.imagen_hd && typeof fObj.imagen_hd === 'string' && fObj.imagen_hd.startsWith('data:image/')) {
              const s3Key = `tareas/orden_${numOrden}/acta_hd_${fObj.dataId || fIdx}_${Date.now()}.jpg`;
              const s3Url = await procesarYSubirBase64(fObj.imagen_hd, s3Key, isDryRun);
              if (s3Url) {
                fObj.imagen_hd = s3Url;
                fotosEnEstaOrden++;
              }
            }

            // B.2) Imagen / Miniatura
            if (fObj.imagen && typeof fObj.imagen === 'string' && fObj.imagen.startsWith('data:image/')) {
              const s3Key = `tareas/orden_${numOrden}/acta_preview_${fObj.dataId || fIdx}_${Date.now()}.jpg`;
              const s3Url = await procesarYSubirBase64(fObj.imagen, s3Key, isDryRun);
              if (s3Url) {
                fObj.imagen = s3Url;
                fotosEnEstaOrden++;
              }
            }
          }
        }
      }

      const nuevoJson = JSON.stringify(tasks);
      const pesoDespuesKB = (Buffer.byteLength(nuevoJson) / 1024).toFixed(1);
      const ahorroKB = (pesoAntesKB - pesoDespuesKB).toFixed(1);

      if (fotosEnEstaOrden > 0) {
        if (!isDryRun) {
          await pool.query(
            'UPDATE orden_tareas_cache SET tareas_json = ?, fecha_actualizacion = NOW() WHERE numero_orden = ?',
            [nuevoJson, numOrden]
          );
        }
        totalFotosSubidas += fotosEnEstaOrden;
        totalBytesAhorrados += (row.bytes_antes - Buffer.byteLength(nuevoJson));

        console.log(`  [${i + 1}/${rows.length}] Orden #${numOrden}: ${fotosEnEstaOrden} fotos a S3 | ${pesoAntesKB} KB ➔ ${pesoDespuesKB} KB (Ahorro: -${ahorroKB} KB)`);
      } else {
        console.log(`  [${i + 1}/${rows.length}] Orden #${numOrden}: Sin fotos procesables.`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('🎉 RESUMEN DEL LOTE PROCESADO:');
    console.log(`  • Órdenes migradas:       ${rows.length}`);
    console.log(`  • Fotos subidas a S3:     ${totalFotosSubidas}`);
    console.log(`  • Espacio ahorrado en BD: ${(totalBytesAhorrados / 1024 / 1024).toFixed(2)} MB`);
    console.log('='.repeat(70) + '\n');

  } catch (errGlobal) {
    console.error('❌ Error general durante la migración:', errGlobal);
  } finally {
    await pool.end();
  }
}

async function procesarYSubirBase64(base64Str, s3Key, isDryRun) {
  try {
    const match = base64Str.match(/^data:(image\/[a-zA-Z0-9.+]+);base64,(.+)$/);
    let contentType = 'image/jpeg';
    let base64Data = base64Str;

    if (match) {
      contentType = match[1];
      base64Data = match[2];
    }

    const buffer = Buffer.from(base64Data, 'base64');

    if (isDryRun) {
      return `https://${s3.S3_BUCKET}.s3.${s3.S3_REGION}.amazonaws.com/${s3Key}`;
    }

    const res = await s3.uploadBufferToS3(buffer, s3Key, contentType);
    return res.s3Url;
  } catch (err) {
    console.error(`  ⚠️ Falló subida a S3 (${s3Key}):`, err.message);
    return null;
  }
}

migrar();
