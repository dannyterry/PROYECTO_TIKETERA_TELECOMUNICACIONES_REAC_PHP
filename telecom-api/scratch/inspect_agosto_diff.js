const db = require('../db');

async function checkDateDifferences() {
  try {
    // 1. Conteo filtrando por DATE(fecha_visita)
    const [visita] = await db.query(`
      SELECT estado, count(*) as c 
      FROM ordenes 
      WHERE DATE(fecha_visita) BETWEEN '2026-08-01' AND '2026-08-31'
      GROUP BY estado
    `);
    console.log('Filtrado por DATE(fecha_visita):', visita);

    // 2. Conteo filtrando por DATE(fecha_creacion)
    const [creacion] = await db.query(`
      SELECT estado, count(*) as c 
      FROM ordenes 
      WHERE DATE(fecha_creacion) BETWEEN '2026-08-01' AND '2026-08-31'
      GROUP BY estado
    `);
    console.log('Filtrado por DATE(fecha_creacion):', creacion);

    // 3. Conteo filtrando por DATE(fecha_estado)
    const [estadoDate] = await db.query(`
      SELECT estado, count(*) as c 
      FROM ordenes 
      WHERE DATE(fecha_estado) BETWEEN '2026-08-01' AND '2026-08-31'
      GROUP BY estado
    `);
    console.log('Filtrado por DATE(fecha_estado):', estadoDate);

    // 4. Ver si excluir ADICIONAL da exactamente 1121
    const [sinAdicional] = await db.query(`
      SELECT estado, count(*) as c 
      FROM ordenes 
      WHERE DATE(fecha_visita) BETWEEN '2026-08-01' AND '2026-08-31'
        AND tipo_trabajo != 'ADICIONAL'
      GROUP BY estado
    `);
    console.log('Excluyendo tipo_trabajo ADICIONAL:', sinAdicional);

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

checkDateDifferences();
