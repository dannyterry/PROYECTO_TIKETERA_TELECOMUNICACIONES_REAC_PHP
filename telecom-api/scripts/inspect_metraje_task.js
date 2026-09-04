const { obtenerOrdeVisiId, obtenerTareasOrden, obtenerDetalleTarea } = require('../services/fenixScraper');

async function test() {
  const id = await obtenerOrdeVisiId('3412098');
  console.log("ordeVisiId:", id);
  if (!id) return;
  const tasks = await obtenerTareasOrden(id);
  const metrajeTasks = tasks.filter(t => t.titulo && t.titulo.toUpperCase().includes('METRAJE'));
  console.log("TAREAS DE METRAJE:", JSON.stringify(metrajeTasks, null, 2));

  for (const m of metrajeTasks) {
    console.log(`\nConsultando detalle de ${m.titulo} (ID: ${m.id}, index: ${m.index})...`);
    const det = await obtenerDetalleTarea(m.id, m.index);
    console.log("DETALLE:", JSON.stringify(det, null, 2));
  }
}

test().catch(console.error);
