const { obtenerOrdeVisiId, obtenerTareasOrden } = require('../services/fenixScraper');

async function test() {
  console.log("Testing obtenerOrdeVisiId for 3412098...");
  const ordeVisiId = await obtenerOrdeVisiId('3412098');
  console.log("RESULT ordeVisiId:", ordeVisiId);
  if (ordeVisiId) {
    const tareas = await obtenerTareasOrden(ordeVisiId);
    console.log(`TOTAL TAREAS: ${tareas.length}`);
    console.log("PRIMERAS 5 TAREAS:", tareas.slice(0, 5));
    const metrajeTask = tareas.find(t => t.titulo && t.titulo.toUpperCase().includes('METRAJE'));
    console.log("TAREA METRAJE:", metrajeTask);
  }
}

test().catch(console.error);
