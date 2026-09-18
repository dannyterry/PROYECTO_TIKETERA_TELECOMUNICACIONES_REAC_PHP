const pool = require('../db');

async function migrate() {
  const [cols] = await pool.query(`
    SELECT COLUMN_NAME 
    FROM information_schema.columns 
    WHERE TABLE_SCHEMA = 'corporacioncespe_cespedes' AND TABLE_NAME = 'usuarios'
  `);
  const names = cols.map(c => c.COLUMN_NAME);

  if (!names.includes('tipo_servicio')) {
    await pool.query(`ALTER TABLE usuarios ADD COLUMN tipo_servicio VARCHAR(100) NULL AFTER area`);
    console.log("✅ Columna agregada: tipo_servicio");
  } else {
    console.log("ℹ️ Columna ya existe: tipo_servicio");
  }

  console.log("🎉 Migración finalizada.");
}

migrate().catch(console.error).finally(() => process.exit(0));
