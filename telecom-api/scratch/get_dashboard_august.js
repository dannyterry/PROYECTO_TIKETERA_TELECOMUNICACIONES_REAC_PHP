const db = require('../db');

async function getDashboardAugust() {
  try {
    const desde = '2026-08-01';
    const hasta = '2026-08-31';

    // 1. Total general
    const [tot] = await db.query(
      "SELECT COUNT(*) as total FROM ordenes WHERE DATE(fecha_visita) >= ? AND DATE(fecha_visita) <= ?",
      [desde, hasta]
    );

    // 2. Conteo por estado
    const [byEstado] = await db.query(
      `SELECT estado, COUNT(*) as cantidad 
       FROM ordenes 
       WHERE DATE(fecha_visita) >= ? AND DATE(fecha_visita) <= ?
       GROUP BY estado 
       ORDER BY cantidad DESC`,
      [desde, hasta]
    );

    // 3. Conteo por técnicos en Agosto (Top 10)
    const [byTecnico] = await db.query(
      `SELECT COALESCE(tecnico_asignado, 'Sin Asignar') as tecnico, 
              COUNT(*) as total,
              SUM(CASE WHEN estado = 'Finalizada' THEN 1 ELSE 0 END) as finalizadas,
              SUM(CASE WHEN estado = 'Cancelada' THEN 1 ELSE 0 END) as canceladas
       FROM ordenes 
       WHERE DATE(fecha_visita) >= ? AND DATE(fecha_visita) <= ?
       GROUP BY tecnico_asignado
       ORDER BY finalizadas DESC
       LIMIT 10`,
      [desde, hasta]
    );

    console.log('=== RESUMEN EJECUTIVO AGOSTO 2026 ===');
    console.log('Total Órdenes:', tot[0].total);
    console.log('Desglose por Estado:', byEstado);
    console.log('Top Técnicos:', byTecnico);

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

getDashboardAugust();
