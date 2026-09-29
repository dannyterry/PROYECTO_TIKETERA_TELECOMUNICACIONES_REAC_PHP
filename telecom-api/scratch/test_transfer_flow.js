const db = require('../db');

async function testTransferFlow() {
  try {
    console.log('--- INICIANDO TEST DEL SISTEMA DE TRANSFERENCIAS ENTRE TÉCNICOS ---');

    // 1. Obtener 2 técnicos con stock
    const [tecnicos] = await db.query(`
      SELECT t.id_trabajador, u.documento as dni, 
             TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS nombre
      FROM trabajadores t
      JOIN usuarios u ON t.id_usuario = u.id_usuario
      WHERE u.estado = 'Activo'
      LIMIT 2
    `);

    if (tecnicos.length < 2) {
      console.log('No hay suficientes técnicos para el test');
      return;
    }

    const tecA = tecnicos[0];
    const tecB = tecnicos[1];

    console.log(`Técnico Origen (A): #${tecA.id_trabajador} ${tecA.nombre} (DNI: ${tecA.dni})`);
    console.log(`Técnico Destino (B): #${tecB.id_trabajador} ${tecB.nombre} (DNI: ${tecB.dni})`);

    // 2. Verificar búsqueda por DNI
    const [busqueda] = await db.query(`
      SELECT t.id_trabajador, u.documento as dni, 
             TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS nombre_completo
      FROM trabajadores t
      JOIN usuarios u ON t.id_usuario = u.id_usuario
      WHERE u.documento = ?
    `, [tecB.dni]);

    console.log('✅ Búsqueda por DNI exitosa:', busqueda[0]?.nombre_completo);

    console.log('--- TEST COMPLETADO CON ÉXITO ---');
  } catch (err) {
    console.error('Error en test:', err);
  } finally {
    process.exit(0);
  }
}

testTransferFlow();
