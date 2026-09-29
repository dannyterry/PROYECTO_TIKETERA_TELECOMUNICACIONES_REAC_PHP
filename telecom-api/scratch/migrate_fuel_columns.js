const db = require('../db');

async function migrateFuelColumns() {
  try {
    console.log('--- ACTUALIZANDO TABLAS PARA NIVEL DE COMBUSTIBLE ---');

    // 1. vehiculo_inspecciones -> nivel_combustible
    const [colsInsp] = await db.query("SHOW COLUMNS FROM vehiculo_inspecciones LIKE 'nivel_combustible'");
    if (colsInsp.length === 0) {
      await db.query("ALTER TABLE vehiculo_inspecciones ADD COLUMN nivel_combustible VARCHAR(50) NULL DEFAULT 'Medio' AFTER foto_estado_general");
      console.log('✅ Columna nivel_combustible agregada a vehiculo_inspecciones');
    } else {
      console.log('ℹ️ Columna nivel_combustible ya existe en vehiculo_inspecciones');
    }

    // 2. vehiculos -> ultimo_nivel_combustible
    const [colsVeh] = await db.query("SHOW COLUMNS FROM vehiculos LIKE 'ultimo_nivel_combustible'");
    if (colsVeh.length === 0) {
      await db.query("ALTER TABLE vehiculos ADD COLUMN ultimo_nivel_combustible VARCHAR(50) NULL DEFAULT 'Medio' AFTER estado");
      console.log('✅ Columna ultimo_nivel_combustible agregada a vehiculos');
    } else {
      console.log('ℹ️ Columna ultimo_nivel_combustible ya existe en vehiculos');
    }

    console.log('--- MIGRACIÓN COMPLETADA CON ÉXITO ---');
  } catch (err) {
    console.error('Error en migración:', err);
  } finally {
    process.exit(0);
  }
}

migrateFuelColumns();
