const mysql = require('mysql2/promise');

async function checkMoreCols() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  const [cols] = await conn.query("SHOW COLUMNS FROM orden_liquidacion_detalle");
  const colNames = cols.map(c => c.Field);
  console.log("EXISTING COLS IN orden_liquidacion_detalle:", colNames);

  const needed = [
    { name: 'es_baja', def: 'TINYINT(1) DEFAULT 0' },
    { name: 'serie_creada', def: 'TINYINT(1) DEFAULT 0' },
    { name: 'estado_anterior', def: 'VARCHAR(50) NULL' },
    { name: 'id_trabajador_serie', def: 'INT NULL' }
  ];

  for (const n of needed) {
    if (!colNames.includes(n.name)) {
      console.log(`Adding ${n.name} to orden_liquidacion_detalle...`);
      await conn.query(`ALTER TABLE orden_liquidacion_detalle ADD COLUMN ${n.name} ${n.def}`);
    }
  }

  console.log("All columns verified successfully.");
  await conn.end();
}

checkMoreCols().catch(console.error);
