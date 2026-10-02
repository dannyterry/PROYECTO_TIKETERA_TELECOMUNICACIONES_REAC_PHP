const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost', user: 'root', password: '', database: 'corporacioncespe_cespedes'
  });

  console.log('--- 1. VERIFICACIÓN LATENCIA 1ER TRAMO (SEPTIEMBRE 2026) ---');
  const [latRows] = await conn.query(`
    SELECT o.numero, o.tecnico_asignado, o.estado, o.inicio_visita
    FROM ordenes o
    WHERE DATE(o.inicio_visita) >= '2026-09-01' 
      AND DATE(o.inicio_visita) <= '2026-09-30'
      AND TIME(o.inicio_visita) BETWEEN '06:00:00' AND '14:00:00'
      AND o.tecnico_asignado IS NOT NULL 
      AND TRIM(o.tecnico_asignado) != ''
      AND o.tecnico_asignado NOT LIKE 'EXTERNO%'
      AND o.estado != 'Finalizada Externa'
      AND (o.id_tecnico IS NOT NULL AND o.id_tecnico > 0)
    ORDER BY o.inicio_visita ASC
  `);
  console.log(`Total órdenes evaluadas en latencia (Solo técnicos internos): ${latRows.length}`);
  const hasExternalInLat = latRows.some(r => r.tecnico_asignado.includes('EXTERNO') || r.estado === 'Finalizada Externa');
  console.log('¿Hay externos en latencia?:', hasExternalInLat ? '❌ SÍ' : '✅ NO, 0 externos');

  console.log('\n--- 2. VERIFICACIÓN MATRIZ DE RENDIMIENTO ---');
  const [matRows] = await conn.query(`
    SELECT o.numero, o.tecnico_asignado, o.estado, u.nombres
    FROM ordenes o
    LEFT JOIN usuarios u ON o.id_tecnico = u.id_usuario
    WHERE DATE(o.fecha_visita) >= '2026-09-01' 
      AND DATE(o.fecha_visita) <= '2026-09-30'
      AND o.estado != 'Finalizada Externa'
      AND (o.tecnico_asignado IS NULL OR o.tecnico_asignado NOT LIKE 'EXTERNO%')
      AND (o.id_tecnico IS NOT NULL AND o.id_tecnico > 0)
  `);
  console.log(`Total órdenes en matriz de rendimiento: ${matRows.length}`);
  const hasExternalInMat = matRows.some(r => (r.tecnico_asignado && r.tecnico_asignado.includes('EXTERNO')) || r.estado === 'Finalizada Externa');
  console.log('¿Hay externos o cuadrillas fantasma en matriz?:', hasExternalInMat ? '❌ SÍ' : '✅ NO, 0 externos');

  console.log('\n--- 3. VERIFICACIÓN DE OBSERVADAS EN AGOSTO ---');
  const [obsRows] = await conn.query(`
    SELECT numero, cliente, cuadrilla, estado, motivo_finalizacion
    FROM ordenes 
    WHERE fecha_visita LIKE '2026-08%' AND estado = 'Observada'
  `);
  console.log('Órdenes con estado exacto Observada en Agosto:', obsRows.length);
  console.table(obsRows);

  await conn.end();
}

main().catch(console.error);
