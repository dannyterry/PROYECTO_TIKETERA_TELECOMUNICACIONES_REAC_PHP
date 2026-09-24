const mysql = require('mysql2/promise');

async function addPhotoColumns() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  try {
    console.log('Agregando columnas de fotos a supervisiones_campo...');
    
    const [cols] = await conn.execute(`DESCRIBE supervisiones_campo`);
    const fieldNames = cols.map(c => c.Field);

    if (!fieldNames.includes('foto_epp_uniforme')) {
      await conn.execute(`ALTER TABLE supervisiones_campo ADD COLUMN foto_epp_uniforme LONGTEXT NULL AFTER firma_supervisor`);
      console.log('✅ Agregada columna foto_epp_uniforme');
    }
    if (!fieldNames.includes('foto_herramientas')) {
      await conn.execute(`ALTER TABLE supervisiones_campo ADD COLUMN foto_herramientas LONGTEXT NULL AFTER foto_epp_uniforme`);
      console.log('✅ Agregada columna foto_herramientas');
    }
    if (!fieldNames.includes('foto_carro_limpio')) {
      await conn.execute(`ALTER TABLE supervisiones_campo ADD COLUMN foto_carro_limpio LONGTEXT NULL AFTER foto_herramientas`);
      console.log('✅ Agregada columna foto_carro_limpio');
    }

    console.log('✅ Columnas de fotos verificadas con éxito.');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await conn.end();
  }
}

addPhotoColumns().catch(console.error);
