const db = require('../db');

async function checkWilmer() {
  try {
    const [colsTrab] = await db.query('SHOW COLUMNS FROM trabajadores');
    console.log('Columnas trabajadores:', colsTrab.map(c => c.Field));

    const [colsVeh] = await db.query('SHOW COLUMNS FROM vehiculos');
    console.log('Columnas vehiculos:', colsVeh.map(c => c.Field));

    // Buscar a Wilmer Ríos
    const [usuarios] = await db.query(`
      SELECT u.id_usuario, u.nombres, u.apellidos, u.usuario, u.cuadrilla,
             t.id_trabajador, t.id_vehiculo
      FROM usuarios u
      LEFT JOIN trabajadores t ON u.id_usuario = t.id_usuario
      WHERE u.nombres LIKE '%WILMER%' OR u.apellidos LIKE '%RIOS%'
    `);
    console.log('Wilmer Rios data:', usuarios);

    // Endpoint /api/movilidad/tecnicos query
    const [tecnicosMob] = await db.query(`
      SELECT 
        t.id_trabajador,
        t.id_usuario,
        CONCAT(u.nombres, ' ', u.apellidos) as nombre_completo,
        u.cuadrilla,
        t.id_vehiculo,
        v.placa as vehiculo_placa,
        v.marca as vehiculo_marca,
        v.modelo as vehiculo_modelo
      FROM trabajadores t
      JOIN usuarios u ON t.id_usuario = u.id_usuario
      LEFT JOIN vehiculos v ON t.id_vehiculo = v.id_vehiculo
      WHERE u.nombres LIKE '%WILMER%' OR u.apellidos LIKE '%RIOS%'
    `);
    console.log('Query de movilidad para Wilmer:', tecnicosMob);

    // Todos los vehiculos
    const [allVeh] = await db.query(`SELECT id_vehiculo, placa, marca, modelo, estado FROM vehiculos`);
    console.log('Total vehículos en BD:', allVeh.length, allVeh);

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

checkWilmer();
