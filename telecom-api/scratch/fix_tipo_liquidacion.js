const mysql = require('mysql2/promise');

async function fixDatabase(host, user, password, dbName) {
  const pool = mysql.createPool({ host, user, password, database: dbName });
  console.log(`\n========================================`);
  console.log(`Conectando a ${host} (${dbName})...`);

  // Buscar liquidaciones con tipo de trabajo inválido (REASIGNACIÓN, REGESTIÓN, REITERADA)
  const [rows] = await pool.query(`
    SELECT 
      ol.id_liquidacion, 
      o.numero, 
      ol.numero_acta, 
      ol.tipo_trabajo_acta AS actual, 
      COALESCE(NULLIF(TRIM(o.motivo_finalizacion), ''), NULLIF(TRIM(o.tipo_trabajo_asignado), ''), NULLIF(TRIM(o.tipo_trabajo), '')) AS corregido
    FROM orden_liquidaciones ol
    JOIN ordenes o ON o.id_orden = ol.id_orden
    WHERE ol.tipo_trabajo_acta LIKE '%REASIGNA%' 
       OR ol.tipo_trabajo_acta LIKE '%REGEST%'
       OR ol.tipo_trabajo_acta = 'REITERADA'
  `);

  console.log(`Filas encontradas para corregir: ${rows.length}`);
  console.table(rows);

  for (const r of rows) {
    if (r.corregido && r.corregido !== r.actual) {
      await pool.query(
        'UPDATE orden_liquidaciones SET tipo_trabajo_acta = ? WHERE id_liquidacion = ?',
        [r.corregido, r.id_liquidacion]
      );
      console.log(`✅ Liquidación #${r.id_liquidacion} (Orden ${r.numero}): "${r.actual}" -> "${r.corregido}"`);
    }
  }

  pool.end();
}

async function run() {
  // 1. Corregir en Producción
  await fixDatabase(
    'corporacioncespedes.com',
    'corporacioncespe_miguel',
    'corporacioncespe_123',
    'corporacioncespe_cespedes'
  );

  // 2. Corregir en Local
  await fixDatabase(
    '127.0.0.1',
    'root',
    '',
    'corporacioncespe_cespedes'
  );

  console.log('\n🎉 ¡Proceso de corrección de base de datos terminado!');
}

run().catch(console.error);
