const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  console.log('--- REVISIÓN SEPTIEMBRE 2026 (01 al 29 de Septiembre) ---');

  // Conteo por estado de 01-09-2026 hasta 29-09-2026
  const [countsHastaAyer] = await conn.query(`
    SELECT estado, count(*) as cantidad 
    FROM ordenes 
    WHERE (
      (fecha_visita >= '2026-09-01 00:00:00' AND fecha_visita <= '2026-09-29 23:59:59')
      OR (fecha_visita IS NULL AND fecha_solicitud >= '2026-09-01 00:00:00' AND fecha_solicitud <= '2026-09-29 23:59:59')
    )
    GROUP BY estado
    ORDER BY cantidad DESC
  `);
  console.table(countsHastaAyer);

  const [resumenHastaAyer] = await conn.query(`
    SELECT 
      SUM(CASE WHEN estado = 'Finalizada' THEN 1 ELSE 0 END) as Finalizadas,
      SUM(CASE WHEN estado = 'Liquidada' THEN 1 ELSE 0 END) as Liquidadas,
      SUM(CASE WHEN estado = 'Finalizada Externa' THEN 1 ELSE 0 END) as Finalizadas_Externas,
      SUM(CASE WHEN estado = 'Cancelada' THEN 1 ELSE 0 END) as Canceladas,
      SUM(CASE WHEN estado = 'Regestión' THEN 1 ELSE 0 END) as Regestion,
      SUM(CASE WHEN estado = 'Anulada' THEN 1 ELSE 0 END) as Anuladas,
      SUM(CASE WHEN estado = 'Agendada' THEN 1 ELSE 0 END) as Agendadas,
      SUM(CASE WHEN estado = 'Iniciada' THEN 1 ELSE 0 END) as Iniciadas,
      SUM(CASE WHEN estado = 'En camino' THEN 1 ELSE 0 END) as En_Camino,
      SUM(CASE WHEN estado = 'Observada' THEN 1 ELSE 0 END) as Observadas,
      COUNT(*) as TotalGeneral
    FROM ordenes 
    WHERE (
      (fecha_visita >= '2026-09-01 00:00:00' AND fecha_visita <= '2026-09-29 23:59:59')
      OR (fecha_visita IS NULL AND fecha_solicitud >= '2026-09-01 00:00:00' AND fecha_solicitud <= '2026-09-29 23:59:59')
    )
  `);
  console.log('\n--- RESUMEN GLOBAL 01 AL 29 SEPTIEMBRE ---');
  console.table(resumenHastaAyer);

  // Conteo día por día
  const [diaPorDia] = await conn.query(`
    SELECT 
      DATE(COALESCE(fecha_visita, fecha_solicitud)) as fecha,
      COUNT(*) as total_dia,
      SUM(CASE WHEN estado IN ('Finalizada', 'Liquidada') THEN 1 ELSE 0 END) as finalizadas,
      SUM(CASE WHEN estado = 'Cancelada' THEN 1 ELSE 0 END) as canceladas,
      SUM(CASE WHEN estado = 'Regestión' THEN 1 ELSE 0 END) as regestion,
      SUM(CASE WHEN estado = 'Anulada' THEN 1 ELSE 0 END) as anuladas,
      SUM(CASE WHEN estado = 'Observada' THEN 1 ELSE 0 END) as observadas,
      SUM(CASE WHEN estado NOT IN ('Finalizada', 'Liquidada', 'Cancelada', 'Regestión', 'Anulada', 'Observada') THEN 1 ELSE 0 END) as otros_estados
    FROM ordenes 
    WHERE (
      (fecha_visita >= '2026-09-01 00:00:00' AND fecha_visita <= '2026-09-29 23:59:59')
      OR (fecha_visita IS NULL AND fecha_solicitud >= '2026-09-01 00:00:00' AND fecha_solicitud <= '2026-09-29 23:59:59')
    )
    GROUP BY DATE(COALESCE(fecha_visita, fecha_solicitud))
    ORDER BY fecha ASC
  `);
  console.log('\n--- DETALLE DÍA POR DÍA EN SEPTIEMBRE ---');
  console.table(diaPorDia);

  // Revisar si hay órdenes con inconsistencias en septiembre
  const [inconsistencias] = await conn.query(`
    SELECT id_orden, numero, cliente, cuadrilla, estado, motivo_finalizacion, motivo_cancelacion, fecha_visita
    FROM ordenes 
    WHERE (
      (fecha_visita >= '2026-09-01 00:00:00' AND fecha_visita <= '2026-09-29 23:59:59')
      OR (fecha_visita IS NULL AND fecha_solicitud >= '2026-09-01 00:00:00' AND fecha_solicitud <= '2026-09-29 23:59:59')
    )
    AND (
      (estado IN ('Finalizada', 'Liquidada') AND (motivo_finalizacion LIKE '%CANCELAD%' OR motivo_finalizacion LIKE '%NO REALIZAD%' OR motivo_cancelacion LIKE '%CANCELAD%'))
      OR (estado = 'Cancelada' AND (motivo_finalizacion IS NOT NULL AND motivo_finalizacion != '' AND motivo_finalizacion NOT LIKE '%CANCELAD%'))
    )
  `);
  console.log('\n--- POSIBLES INCONSISTENCIAS DETECTADAS EN SEPTIEMBRE ---', inconsistencias.length);
  if (inconsistencias.length > 0) {
    console.table(inconsistencias);
  }

  await conn.end();
}

main().catch(console.error);
