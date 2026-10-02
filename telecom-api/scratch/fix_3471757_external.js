const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  const [res] = await conn.query(`
    UPDATE ordenes 
    SET estado = 'Finalizada Externa',
        tecnico_asignado = 'EXTERNO: ERICK ADALBERTO GALLARDO TARDILLO',
        usuario_ejecutor_fenix = 'ERICK ADALBERTO GALLARDO TARDILLO',
        id_tecnico = NULL
    WHERE numero = '3471757'
  `);
  console.log('Orden 3471757 actualizada a Finalizada Externa:', res.affectedRows);

  // Update in remote hosting too
  try {
    const remoteConn = await mysql.createConnection({
      host: 'corporacioncespedes.com', port: 3306, user: 'corporacioncespe_miguel', password: 'corporacioncespe_123', database: 'corporacioncespe_cespedes'
    });
    const [remoteRes] = await remoteConn.query(`
      UPDATE ordenes 
      SET estado = 'Finalizada Externa',
          tecnico_asignado = 'EXTERNO: ERICK ADALBERTO GALLARDO TARDILLO',
          usuario_ejecutor_fenix = 'ERICK ADALBERTO GALLARDO TARDILLO',
          id_tecnico = NULL
      WHERE numero = '3471757'
    `);
    console.log('Hosting actualizado 3471757:', remoteRes.affectedRows);
    await remoteConn.end();
  } catch (e) {
    console.log('Error hosting:', e.message);
  }

  // Check the two external orders in September now
  const [externals] = await conn.query(`
    SELECT id_orden, numero, cliente, cuadrilla, tecnico_asignado, usuario_ejecutor_fenix, estado, fecha_visita
    FROM ordenes 
    WHERE estado = 'Finalizada Externa'
  `);
  console.log('\n🌟 ÓRDENES EXTERNAS CONFIRMADAS EN EL SISTEMA:');
  console.table(externals);

  // Conteo oficial de Septiembre (01 al 29 Sep)
  const [counts] = await conn.query(`
    SELECT estado, count(*) as cantidad 
    FROM ordenes 
    WHERE (
      (fecha_visita >= '2026-09-01 00:00:00' AND fecha_visita <= '2026-09-29 23:59:59')
      OR (fecha_visita IS NULL AND fecha_solicitud >= '2026-09-01 00:00:00' AND fecha_solicitud <= '2026-09-29 23:59:59')
    )
    GROUP BY estado
    ORDER BY cantidad DESC
  `);
  console.log('\n📊 CONTEO OFICIAL REVISADO (01 al 29 Sep):');
  console.table(counts);

  await conn.end();
}

main().catch(console.error);
