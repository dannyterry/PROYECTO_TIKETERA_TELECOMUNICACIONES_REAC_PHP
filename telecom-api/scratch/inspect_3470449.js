const pool = require('../db');
const fenix = require('../services/fenixScraper');

async function main() {
  const num = '3470449';
  console.log('=== INSPECCIONANDO ORDEN #3470449 ===');

  // 1. DB
  const [ords] = await pool.query('SELECT * FROM ordenes WHERE numero = ?', [num]);
  console.log('\n1. TABLA ordenes:');
  console.log('Tipo Trabajo:', ords[0]?.tipo_trabajo);
  console.log('Motivo Trabajo:', ords[0]?.motivo_trabajo);
  console.log('Motivo Finalizacion:', ords[0]?.motivo_finalizacion);
  console.log('Cliente:', ords[0]?.cliente);
  console.log('Técnico:', ords[0]?.tecnico_asignado);

  const [liqs] = await pool.query('SELECT * FROM orden_liquidaciones WHERE id_orden = ?', [ords[0]?.id_orden]);
  console.log('\n2. TABLA orden_liquidaciones:');
  console.log(liqs);

  const [dets] = await pool.query('SELECT old.*, p.nombre, p.codigo FROM orden_liquidacion_detalle old JOIN productos p ON old.id_producto = p.id_producto WHERE old.id_liquidacion = ?', [liqs[0]?.id_liquidacion]);
  console.log('\n3. TABLA orden_liquidacion_detalle (Materiales):');
  console.log(dets);

  const [retirados] = await pool.query('SELECT * FROM orden_equipos_retirados WHERE id_orden = ?', [ords[0]?.id_orden]);
  console.log('\n4. TABLA orden_equipos_retirados:');
  console.log(retirados);

  // 2. FÉNIX
  console.log('\n5. CONSULTANDO TAREAS EN FÉNIX...');
  const ordeVisiId = await fenix.obtenerOrdeVisiId(num);
  console.log('OrdeVisiId:', ordeVisiId);
  const tareas = await fenix.obtenerTareasOrden(ordeVisiId, num);
  console.log(`Total tareas en Fénix: ${tareas.length}`);

  for (const t of tareas) {
    console.log(`\n--- Tarea #${t.index} | ID: ${t.id} | Titulo: "${t.titulo}" | Estado: ${t.estado} ---`);
    const det = await fenix.obtenerDetalleTarea(t.id, t.index);
    if (det && det.campos && Object.keys(det.campos).length > 0) {
      console.log('   Campos:', det.campos);
    }
    if (det && det.tiempos) {
      console.log('   Tiempos:', det.tiempos);
    }
    if (det && det.fotografias && det.fotografias.length > 0) {
      console.log('   Fotos:', det.fotografias.map(f => ({ titulo: f.titulo, dataId: f.dataId })));
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
