const mysql = require('mysql2/promise');

async function check() {
  const pool = mysql.createPool({ host: '127.0.0.1', user: 'root', password: '', database: 'corporacioncespe_cespedes' });
  
  const idTec = 65; // Alberto Grados
  
  // Las columnas de ordenes que sabemos: buscar el campo del tecnico
  console.log('=== 1. Columnas ordenes - buscar tecnico y acta ===');
  const [colsO] = await pool.query('DESCRIBE ordenes');
  const relevantCols = colsO.filter(c => 
    c.Field.includes('tecnic') || c.Field.includes('acta') || c.Field.includes('trabajador') || 
    c.Field.includes('serie') || c.Field.includes('numero_acta')
  );
  console.log(JSON.stringify(relevantCols.map(c => c.Field)));
  
  // Todas las columnas
  console.log('TODAS:', colsO.map(c => c.Field).join(', '));
  
  // producto_series columnas
  console.log('\n=== 2. Columnas producto_series ===');
  const [colsPS] = await pool.query('DESCRIBE producto_series');
  console.log(colsPS.map(c => c.Field).join(', '));
  
  // Actas en producto_series de Alberto
  console.log('\n=== 3. producto_series ACTAS de Alberto via trabajador_series ===');
  const [ps] = await pool.query(`
    SELECT ps.*
    FROM producto_series ps
    JOIN trabajador_series ts ON ps.id_producto_serie = ts.id_producto_serie
    WHERE ts.id_trabajador = ? AND ts.id_producto = 65
    LIMIT 5
  `, [idTec]);
  console.log(JSON.stringify(ps, null, 2));
  
  await pool.end();
}

check().catch(e => console.error('ERROR:', e.message));
