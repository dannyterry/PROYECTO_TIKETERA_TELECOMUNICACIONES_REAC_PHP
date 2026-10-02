const mysql = require('mysql2/promise');

const REMOTE_CONFIG = {
  host: 'corporacioncespedes.com',
  user: 'corporacioncespe_miguel',
  password: 'corporacioncespe_123',
  database: 'corporacioncespe_cespedes',
  dateStrings: true,
};

const LOCAL_CONFIG = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'corporacioncespe_cespedes',
};

async function migrateDb(config, name) {
  try {
    const conn = await mysql.createConnection(config);
    console.log(`Conectado a ${name}...`);

    const columnsToAdd = [
      { name: 'subcontrata_codigo', sql: 'ALTER TABLE usuarios ADD COLUMN subcontrata_codigo VARCHAR(100) NULL DEFAULT NULL AFTER opcion_personal' },
      { name: 'emision_revision_tecnica', sql: 'ALTER TABLE usuarios ADD COLUMN emision_revision_tecnica DATE NULL DEFAULT NULL' },
      { name: 'vencimiento_revision_tecnica', sql: 'ALTER TABLE usuarios ADD COLUMN vencimiento_revision_tecnica DATE NULL DEFAULT NULL' },
      { name: 'numero_revision_tecnica', sql: 'ALTER TABLE usuarios ADD COLUMN numero_revision_tecnica VARCHAR(100) NULL DEFAULT NULL' },
      { name: 'emision_soat', sql: 'ALTER TABLE usuarios ADD COLUMN emision_soat DATE NULL DEFAULT NULL' },
      { name: 'vencimiento_soat', sql: 'ALTER TABLE usuarios ADD COLUMN vencimiento_soat DATE NULL DEFAULT NULL' },
      { name: 'numero_soat', sql: 'ALTER TABLE usuarios ADD COLUMN numero_soat VARCHAR(100) NULL DEFAULT NULL' },
    ];

    const [existingCols] = await conn.query('DESCRIBE usuarios');
    const existingColNames = new Set(existingCols.map(c => c.Field));

    for (const col of columnsToAdd) {
      if (!existingColNames.has(col.name)) {
        await conn.query(col.sql);
        console.log(`  ✅ [${name}] Columna '${col.name}' agregada.`);
      } else {
        console.log(`  ℹ️ [${name}] Columna '${col.name}' ya existe.`);
      }
    }

    await conn.end();
  } catch (err) {
    console.error(`Error en ${name}:`, err.message);
  }
}

(async () => {
  await migrateDb(LOCAL_CONFIG, 'LOCAL');
  await migrateDb(REMOTE_CONFIG, 'PRODUCCIÓN');
})();
