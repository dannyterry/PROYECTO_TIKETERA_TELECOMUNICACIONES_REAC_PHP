const pool = require('../db');

async function migrate() {
  const [cols] = await pool.query(`
    SELECT COLUMN_NAME 
    FROM information_schema.columns 
    WHERE TABLE_SCHEMA = 'corporacioncespe_cespedes' AND TABLE_NAME = 'usuarios'
  `);
  const names = cols.map(c => c.COLUMN_NAME);

  const neededCols = [
    { name: 'doc_delantera', type: 'VARCHAR(255) NULL' },
    { name: 'doc_trasera', type: 'VARCHAR(255) NULL' },
    { name: 'brevete_delantera', type: 'VARCHAR(255) NULL' },
    { name: 'brevete_trasera', type: 'VARCHAR(255) NULL' },
    { name: 'revision_tecnica_frontal', type: 'VARCHAR(255) NULL' },
    { name: 'revision_tecnica_posterior', type: 'VARCHAR(255) NULL' },
    { name: 'tarjeta_propiedad_frontal', type: 'VARCHAR(255) NULL' },
    { name: 'tarjeta_propiedad_posterior', type: 'VARCHAR(255) NULL' },
    { name: 'otro_documento_pdf', type: 'VARCHAR(255) NULL' },
  ];

  for (const c of neededCols) {
    if (!names.includes(c.name)) {
      await pool.query(`ALTER TABLE usuarios ADD COLUMN ${c.name} ${c.type}`);
      console.log(`✅ Columna agregada: ${c.name}`);
    } else {
      console.log(`ℹ️ Columna ya existe: ${c.name}`);
    }
  }

  console.log("🎉 Migración de documentos en tabla 'usuarios' finalizada con éxito.");
}

migrate().catch(console.error).finally(() => process.exit(0));
