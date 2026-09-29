const db = require('../db');

async function inspectAugustCreation() {
  try {
    console.log('--- REVISANDO CUÁNDO SE INSERTARON/CREARON LAS ÓRDENES DE AGOSTO ---');

    const [creadas] = await db.query(`
      SELECT DATE(fecha_creacion) as fecha_ingreso_bd, count(*) as cantidad,
             GROUP_CONCAT(DISTINCT estado) as estados
      FROM ordenes 
      WHERE fecha_visita >= '2026-08-01' AND fecha_visita <= '2026-08-31 23:59:59'
      GROUP BY DATE(fecha_creacion)
      ORDER BY fecha_ingreso_bd DESC
    `);
    console.log('Fechas de creación en BD de las órdenes de Agosto:', creadas);

    // Revisar las órdenes del 12/08 y 27/08
    const [adicionales] = await db.query(`
      SELECT id_orden, numero, tipo_trabajo, estado, fecha_visita, fecha_creacion, tecnico_asignado, cuadrilla
      FROM ordenes 
      WHERE numero IN ('3349893', '3388959')
    `);
    console.log('Detalle de las 2 órdenes adicionales:', adicionales);

    // Revisar todas las órdenes de Agosto con fecha_creacion reciente (ej. septiembre)
    const [recientes] = await db.query(`
      SELECT id_orden, numero, tipo_trabajo, estado, fecha_visita, fecha_creacion, tecnico_asignado
      FROM ordenes
      WHERE fecha_visita >= '2026-08-01' AND fecha_visita <= '2026-08-31 23:59:59'
        AND fecha_creacion >= '2026-09-01'
    `);
    console.log('Órdenes de Agosto insertadas en Septiembre:', recientes.length, recientes);

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

inspectAugustCreation();
