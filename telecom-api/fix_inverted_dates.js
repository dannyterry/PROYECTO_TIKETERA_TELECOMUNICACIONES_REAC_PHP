const db = require('./db');

async function fixInvertedDates() {
  console.log('--- 🔄 CORRIGIENDO FECHAS INVERTIDAS EN ÓRDENES ---');

  // Buscar todas las órdenes donde la fecha_visita esté en los meses 9, 10, 11 o 12 del 2026
  // (pero que fueron creadas o gestionadas en Agosto 2026)
  const [rows] = await db.query(`
    SELECT id_orden, numero, fecha_visita, inicio_visita, fin_visita, fecha_solicitud, fecha_estado, fecha_creacion
    FROM ordenes
    WHERE fecha_visita >= '2026-09-01 00:00:00' AND fecha_visita <= '2026-12-31 23:59:59'
  `);

  console.log(`Total de órdenes a corregir: ${rows.length}`);

  let corregidas = 0;
  for (const row of rows) {
    const swapMonthAndDay = (dtStr) => {
      if (!dtStr) return null;
      const s = String(dtStr);
      // Formato YYYY-MM-DD HH:mm:ss
      const match = s.match(/^(\d{4})-(\d{2})-(\d{2})(.*)$/);
      if (!match) return dtStr;
      const year = match[1];
      const month = match[2]; // eg '09', '10', '11', '12'
      const day = match[3];   // eg '08'
      const rest = match[4];  // eg ' 08:00:00'

      // Si el mes es > 8 y el día es 08, significa que el día real era 09, 10, 11 o 12 de Agosto
      if (parseInt(month, 10) > 8 && parseInt(day, 10) === 8) {
        const newMonth = '08';
        const newDay = month;
        return `${year}-${newMonth}-${newDay}${rest}`;
      }
      return dtStr;
    };

    const newFechaVisita = swapMonthAndDay(row.fecha_visita);
    const newInicioVisita = swapMonthAndDay(row.inicio_visita);
    const newFinVisita = swapMonthAndDay(row.fin_visita);
    const newFechaSolicitud = swapMonthAndDay(row.fecha_solicitud);
    const newFechaEstado = swapMonthAndDay(row.fecha_estado);

    await db.query(`
      UPDATE ordenes
      SET fecha_visita = ?,
          inicio_visita = ?,
          fin_visita = ?,
          fecha_solicitud = ?,
          fecha_estado = ?
      WHERE id_orden = ?
    `, [newFechaVisita, newInicioVisita, newFinVisita, newFechaSolicitud, newFechaEstado, row.id_orden]);

    corregidas++;
  }

  console.log(`✅ ${corregidas} órdenes corregidas correctamente a Agosto 2026.`);

  // Verificar nueva distribución por meses
  const [dist] = await db.query(`
    SELECT 
      YEAR(fecha_visita) as anio, 
      MONTH(fecha_visita) as mes, 
      COUNT(*) as total,
      MIN(fecha_visita) as min_fecha,
      MAX(fecha_visita) as max_fecha
    FROM ordenes 
    GROUP BY YEAR(fecha_visita), MONTH(fecha_visita)
    ORDER BY anio DESC, mes DESC
  `);
  console.log('\n📊 Nueva Distribución Oficial de Órdenes por Mes:');
  console.table(dist);

  process.exit();
}

fixInvertedDates().catch(err => {
  console.error(err);
  process.exit(1);
});
