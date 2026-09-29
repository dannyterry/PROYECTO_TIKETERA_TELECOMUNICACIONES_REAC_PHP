const db = require('../db');

async function testQuery() {
  try {
    const [veh] = await db.query('SELECT id_vehiculo, placa, estado, ultimo_nivel_combustible FROM vehiculos LIMIT 3');
    console.log('Vehículos en BD con nivel de combustible:', veh);

    const [insp] = await db.query('SELECT id_inspeccion, id_vehiculo, fecha, nivel_combustible FROM vehiculo_inspecciones LIMIT 3');
    console.log('Inspecciones en BD con nivel de combustible:', insp);

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

testQuery();
