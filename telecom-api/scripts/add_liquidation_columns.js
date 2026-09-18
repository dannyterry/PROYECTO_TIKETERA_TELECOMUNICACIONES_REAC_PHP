const pool = require('../db');

async function migrate() {
  const [cols] = await pool.query(`
    SELECT COLUMN_NAME 
    FROM information_schema.columns 
    WHERE TABLE_SCHEMA = 'corporacioncespe_cespedes' AND TABLE_NAME = 'liquidacion_detalles'
  `);
  const names = cols.map(c => c.COLUMN_NAME);
  if (!names.includes('cantidad_asignada')) {
    await pool.query('ALTER TABLE liquidacion_detalles ADD COLUMN cantidad_asignada DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER categoria');
    console.log('✅ Columna cantidad_asignada agregada a liquidacion_detalles');
  } else {
    console.log('ℹ️ Columna cantidad_asignada ya existe');
  }
  if (!names.includes('cantidad_gastada')) {
    await pool.query('ALTER TABLE liquidacion_detalles ADD COLUMN cantidad_gastada DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER cantidad_asignada');
    console.log('✅ Columna cantidad_gastada agregada a liquidacion_detalles');
  } else {
    console.log('ℹ️ Columna cantidad_gastada ya existe');
  }
}

migrate().then(() => console.log('🎉 Migración completada exitosamente')).catch(console.error).finally(() => process.exit(0));
