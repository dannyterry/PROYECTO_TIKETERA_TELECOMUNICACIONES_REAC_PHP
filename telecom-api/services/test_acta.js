const pool = require('../db');
const fenix = require('./fenixScraper');

async function test() {
  const cleanNum = '3474607';
  console.log('Testing extraction for order:', cleanNum);
  const ordeVisiId = await fenix.obtenerOrdeVisiId(cleanNum);
  console.log('ordeVisiId:', ordeVisiId);
  const tareas = await fenix.obtenerTareasOrden(ordeVisiId, cleanNum);
  console.log('Tareas count:', tareas.length);
  const actaTask = tareas.find(t => {
    const tit = (t.titulo || t.nombre || '').toUpperCase();
    return tit.includes('ACTA') || tit.includes('CONFORMIDAD');
  }) || tareas[tareas.length - 1];

  console.log('Acta task found:', actaTask.titulo, 'id:', actaTask.id, 'index:', actaTask.index);
  const detalle = await fenix.obtenerDetalleTarea(actaTask.id, actaTask.index);
  console.log('Fotografías encontradas en detalle:', detalle.fotografias);

  for (const fotoObj of detalle.fotografias) {
    console.log(`Intentando descargar para dataId: ${fotoObj.dataId}, opcion: ${fotoObj.opcion}...`);
    const img = await fenix.obtenerImagenReal(fotoObj.dataId, fotoObj.opcion || 1, fotoObj.titulo || 'ACTA');
    console.log(`Resultado: ${img ? img.length + ' bytes' : 'FALLÓ'}`);
  }
  process.exit(0);
}
test();
