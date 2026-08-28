const pool = require('../db');

async function addGeoColumns() {
  try {
    console.log('🚀 Agregando columnas de geolocalización en vivo a tabla usuarios...');

    const [cols] = await pool.query('DESCRIBE usuarios');
    const existing = cols.map(c => c.Field);

    if (!existing.includes('distrito_conexion')) {
      await pool.query('ALTER TABLE usuarios ADD COLUMN distrito_conexion VARCHAR(150) NULL AFTER distrito');
      console.log('✅ Columna distrito_conexion agregada.');
    }
    if (!existing.includes('lat_conexion')) {
      await pool.query('ALTER TABLE usuarios ADD COLUMN lat_conexion DECIMAL(10, 7) NULL AFTER distrito_conexion');
      console.log('✅ Columna lat_conexion agregada.');
    }
    if (!existing.includes('lng_conexion')) {
      await pool.query('ALTER TABLE usuarios ADD COLUMN lng_conexion DECIMAL(10, 7) NULL AFTER lat_conexion');
      console.log('✅ Columna lng_conexion agregada.');
    }
    if (!existing.includes('ip_conexion')) {
      await pool.query('ALTER TABLE usuarios ADD COLUMN ip_conexion VARCHAR(60) NULL AFTER lng_conexion');
      console.log('✅ Columna ip_conexion agregada.');
    }

    console.log('🎉 Migración de geolocalización en vivo completada exitosamente.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error agregando columnas de geolocalización:', error);
    process.exit(1);
  }
}

addGeoColumns();
