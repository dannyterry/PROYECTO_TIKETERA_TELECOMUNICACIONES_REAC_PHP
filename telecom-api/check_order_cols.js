const db = require('./db');

async function checkOrderCols() {
  const [cols] = await db.query(`DESCRIBE ordenes`);
  console.table(cols.map(c => ({ Field: c.Field, Type: c.Type })));
  process.exit(0);
}

checkOrderCols();
