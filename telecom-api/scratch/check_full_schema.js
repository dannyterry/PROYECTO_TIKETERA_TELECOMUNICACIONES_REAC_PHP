const mysql = require('mysql2/promise');

async function checkFullSchema() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  console.log('================================================================');
  console.log('🔍 REVISIÓN DE ESQUEMA COMPLETO: TABLAS Y COLUMNAS CLAVE');
  console.log('================================================================\n');

  // 1. Listar todas las tablas
  const [tables] = await conn.execute(`SHOW TABLES`);
  const tableNames = tables.map(t => Object.values(t)[0]);
  console.log(`Total Tablas en Base de Datos: ${tableNames.length}`);
  console.log(tableNames.join(', '));

  // 2. Verificar tablas de Supervisión y Calidad
  const supTables = ['supervision_campo', 'supervision_calidad_cliente'];
  for (const t of supTables) {
    if (tableNames.includes(t)) {
      console.log(`\n✅ Tabla encontrada: ${t}`);
      const [cols] = await conn.execute(`DESCRIBE ${t}`);
      console.table(cols.map(c => ({ Field: c.Field, Type: c.Type, Null: c.Null, Key: c.Key })));
    } else {
      console.warn(`\n⚠️ Tabla FALTANTE: ${t}`);
    }
  }

  // 3. Verificar tablas de roles y permisos
  if (tableNames.includes('roles_permisos')) {
    console.log(`\n✅ Tabla roles_permisos encontrada:`);
    const [cols] = await conn.execute(`DESCRIBE roles_permisos`);
    console.table(cols.map(c => ({ Field: c.Field, Type: c.Type, Null: c.Null, Key: c.Key })));
  }

  // 4. Verificar ordenes y orden_liquidaciones
  const ordTables = ['ordenes', 'orden_liquidaciones', 'orden_liquidacion_detalle'];
  for (const t of ordTables) {
    if (tableNames.includes(t)) {
      console.log(`\n✅ Tabla encontrada: ${t}`);
      const [cols] = await conn.execute(`DESCRIBE ${t}`);
      console.table(cols.map(c => ({ Field: c.Field, Type: c.Type, Null: c.Null, Key: c.Key })));
    }
  }

  await conn.end();
}

checkFullSchema().catch(console.error);
