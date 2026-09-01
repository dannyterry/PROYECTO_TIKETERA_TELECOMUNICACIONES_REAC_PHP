const pool = require('./db.js');

async function main() {
  console.log('🧹 Limpieza exhaustiva de columnas desplazadas en la base de datos...');

  // 1. Limpiar motivo_cancelacion que tenga productos o planes
  const [r1] = await pool.query(`
    UPDATE ordenes 
    SET motivo_cancelacion = NULL 
    WHERE LOWER(motivo_cancelacion) IN ('averias', 'postventa', 'motowin', 'planta externa', 'reiterada', 'técnica', 'tecnica', 'comercial')
       OR motivo_cancelacion REGEXP '^-?[0-9]{1,3}\\\\.[0-9]+'
       OR motivo_cancelacion REGEXP '(1GBPS|500MBPS|Mbps|Gbps|WIN PRO)'
  `);
  console.log('✅ motivo_cancelacion limpiado:', r1.affectedRows);

  // 2. Limpiar motivo_anulacion que tenga productos o planes
  const [r2] = await pool.query(`
    UPDATE ordenes 
    SET motivo_anulacion = NULL 
    WHERE LOWER(motivo_anulacion) IN ('averias', 'postventa', 'motowin', 'planta externa', 'reiterada', 'técnica', 'tecnica', 'comercial')
       OR motivo_anulacion REGEXP '^-?[0-9]{1,3}\\\\.[0-9]+'
       OR motivo_anulacion REGEXP '(1GBPS|500MBPS|Mbps|Gbps|WIN PRO|PLANTA EXTERNA)'
  `);
  console.log('✅ motivo_anulacion limpiado:', r2.affectedRows);

  // 3. Limpiar motivo_finalizacion que tenga coordenadas o productos
  const [r3] = await pool.query(`
    UPDATE ordenes 
    SET motivo_finalizacion = NULL 
    WHERE LOWER(motivo_finalizacion) IN ('averias', 'postventa', 'motowin', 'planta externa', 'reiterada', 'técnica', 'tecnica', 'comercial')
       OR motivo_finalizacion REGEXP '^-?[0-9]{1,3}\\\\.[0-9]+'
       OR motivo_finalizacion REGEXP '(1GBPS|500MBPS|Mbps|Gbps|WIN PRO)'
  `);
  console.log('✅ motivo_finalizacion limpiado:', r3.affectedRows);

  // 4. Limpiar motivo_regestion que tenga 'Técnica' o GPS o planes
  const [r4] = await pool.query(`
    UPDATE ordenes 
    SET motivo_regestion = NULL 
    WHERE LOWER(motivo_regestion) IN ('técnica', 'tecnica', 'comercial')
       OR motivo_regestion REGEXP '^-?[0-9]{1,3}\\\\.[0-9]+'
       OR motivo_regestion REGEXP '(1GBPS|500MBPS|Mbps|Gbps|WIN PRO)'
  `);
  console.log('✅ motivo_regestion limpiado:', r4.affectedRows);

  // 5. Limpiar datos_tecnicos que tenga solo GPS
  const [r5] = await pool.query(`
    UPDATE ordenes 
    SET datos_tecnicos = NULL 
    WHERE datos_tecnicos REGEXP '^-?[0-9]{1,3}\\\\.[0-9]+'
  `);
  console.log('✅ datos_tecnicos limpiado:', r5.affectedRows);

  console.log('🎉 ¡Limpieza exhaustiva completada!');
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
