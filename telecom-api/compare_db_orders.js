const db = require('./db');

async function check() {
  try {
    const [cols] = await db.query("DESCRIBE ordenes");
    console.log('Columnas de ordenes:', cols.map(c => c.Field));

    const [count] = await db.query("SELECT COUNT(*) AS total FROM ordenes");
    console.log('Total ordenes en BD local:', count[0].total);

    const [tablas] = await db.query("SHOW TABLES");
    console.log('Total tablas en BD local:', tablas.length);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

check();
