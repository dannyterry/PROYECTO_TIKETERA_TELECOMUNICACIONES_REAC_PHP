const { sincronizarTareasOrdenSeguro, getTareasDeBD, getMetrajeDeclaradoFenix } = require('../services/taskSyncService');

async function test() {
  console.log("Sincronizando orden #3412098...");
  const res = await sincronizarTareasOrdenSeguro('3412098', null, true);
  console.log("Resultado fuente:", res.fuente);
  console.log("Total tareas en BD:", res.tareas.length);

  const metraje = await getMetrajeDeclaradoFenix('3412098');
  console.log("Metraje sugerido encontrado en BD:", metraje);

  const [t0, t1, t2] = res.tareas;
  console.log("Ejemplo tarea 1 en BD:", t0);
  console.log("Ejemplo tarea 2 en BD:", t1);
  console.log("Ejemplo tarea 3 en BD:", t2);
  process.exit(0);
}

test().catch(console.error);
