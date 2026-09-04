const mysql = require('mysql2/promise');

async function check() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  const [tables] = await conn.query('SHOW TABLES');
  const tableNames = tables.map(t => Object.values(t)[0]);
  console.log('ALL TABLES:', tableNames.filter(t => 
    t.includes('acta') || t.includes('orden') || t.includes('mat') || 
    t.includes('liq') || t.includes('tecnic') || t.includes('prod') || 
    t.includes('almacen') || t.includes('tarea') || t.includes('instal')
  ));

  for (const name of tableNames) {
    if (name.includes('acta') || name.includes('orden') || name.includes('material') || name.includes('consumo')) {
      const [cols] = await conn.query(`DESCRIBE \`${name}\``);
      console.log(`\nTABLE ${name}:`, cols.map(c => c.Field));
    }
  }

  await conn.end();
}

check().catch(console.error);
