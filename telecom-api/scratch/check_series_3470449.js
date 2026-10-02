const pool = require('../db');
const fenix = require('../services/fenixScraper');
const fs = require('fs');
const path = require('path');

async function main() {
  const num = '3470449';
  console.log('=== VERIFICANDO SERIES EN BD PARA ORDEN', num, '===');
  
  // 1. DB
  const [dets] = await pool.query(`
    SELECT old.*, p.nombre, p.codigo 
    FROM orden_liquidacion_detalle old
    JOIN orden_liquidaciones ol ON old.id_liquidacion = ol.id_liquidacion
    JOIN ordenes o ON ol.id_orden = o.id_orden
    JOIN productos p ON old.id_producto = p.id_producto
    WHERE o.numero = ?
  `, [num]);
  console.log('Materiales en orden_liquidacion_detalle:');
  console.log(JSON.stringify(dets, null, 2));

  const [retirados] = await pool.query(`
    SELECT er.* 
    FROM orden_equipos_retirados er
    JOIN ordenes o ON er.id_orden = o.id_orden
    WHERE o.numero = ?
  `, [num]);
  console.log('Equipos en orden_equipos_retirados:');
  console.log(JSON.stringify(retirados, null, 2));

  // 2. FÉNIX
  console.log('\n=== VERIFICANDO FOTOS DE SERIES Y ACTA EN FÉNIX ===');
  await fenix.loginWin();
  const ordeVisiId = await fenix.obtenerOrdeVisiId(num);
  const tareas = await fenix.obtenerTareasOrden(ordeVisiId, num);
  
  for (const t of tareas) {
    if (t.titulo.includes('SERIES') || t.titulo.includes('ACTA') || t.titulo.includes('EQUIPO')) {
      console.log(`\n--- Tarea [${t.index}] "${t.titulo}" (ID: ${t.id}) ---`);
      const det = await fenix.obtenerDetalleTarea(t.id, t.index);
      console.log('   Campos:', det?.campos);
      if (det?.fotografias) {
        for (const f of det.fotografias) {
          console.log(`   Foto encontrada -> DataId: ${f.dataId}, Op: ${f.opcion}`);
          const imgBase64 = await fenix.obtenerImagenReal(f.dataId, f.opcion || 1, f.titulo);
          if (imgBase64) {
            const rawBase64 = imgBase64.replace(/^data:image\/[^;]+;base64,/, '');
            const filename = `fenix_task_${t.index}_${f.dataId}.jpg`;
            const destPath = path.join(__dirname, filename);
            fs.writeFileSync(destPath, Buffer.from(rawBase64, 'base64'));
            console.log(`   ✅ Guardada imagen HD en scratch/${filename} (${imgBase64.length} chars)`);

            // Also copy to artifacts dir so we can view it
            const artPath = path.join('C:\\Users\\USUARIO\\.gemini\\antigravity-ide\\brain\\16345097-03ef-491f-8307-c22d8c9cc407', filename);
            fs.writeFileSync(artPath, Buffer.from(rawBase64, 'base64'));
          }
        }
      }
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
