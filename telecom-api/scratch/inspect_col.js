const db = require('../db');

async function checkCol() {
  try {
    const [cols] = await db.query("SHOW FULL COLUMNS FROM ordenes WHERE Field = 'estado'");
    console.log('Columna estado:', cols);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

checkCol();
