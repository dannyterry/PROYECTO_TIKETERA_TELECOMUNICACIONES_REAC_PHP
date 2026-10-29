const mysql = require('mysql2/promise');

async function testQuery() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    database: 'corporacioncespe_cespedes'
  });

  const [tCount] = await conn.query("SELECT COUNT(*) as c FROM trabajadores");
  console.log('Total trabajadores en tabla:', tCount[0].c);

  const [uCount] = await conn.query("SELECT COUNT(*) as c FROM usuarios");
  console.log('Total usuarios en tabla:', uCount[0].c);

  const [tJoinU] = await conn.query(`
    SELECT t.id_trabajador, t.id_usuario, t.estado as t_estado, u.id_rol, u.estado as u_estado, r.nombre as rol_nombre
    FROM trabajadores t
    JOIN usuarios u ON t.id_usuario = u.id_usuario
    LEFT JOIN roles r ON u.id_rol = r.id_rol
    LIMIT 15
  `);
  console.log('Primeros 15 trabajadores join usuarios:', tJoinU);

  // Probar la condición WHERE
  const [whereTest] = await conn.query(`
    SELECT t.id_trabajador, u.id_usuario, u.id_rol, r.nombre as rol_nombre, u.estado as u_estado, t.estado as t_estado
    FROM trabajadores t
    JOIN usuarios u ON t.id_usuario = u.id_usuario
    LEFT JOIN roles r ON u.id_rol = r.id_rol
    WHERE (u.id_rol IN (2, 6) OR UPPER(r.nombre) IN ('TECNICO', 'SUPERVICION', 'SUPERVISOR'))
  `);
  console.log('Coincidencias con roles 2 y 6:', whereTest.length, whereTest.slice(0, 5));

  // Ver qué estados tienen u.estado y t.estado
  const [estadosU] = await conn.query("SELECT DISTINCT estado FROM usuarios");
  console.log('Estados en usuarios:', estadosU);

  const [estadosT] = await conn.query("SELECT DISTINCT estado FROM trabajadores");
  console.log('Estados en trabajadores:', estadosT);

  // Ver cómo obtiene técnicos StockOverviewTab
  const [tpRows] = await conn.query(`
    SELECT DISTINCT t.id_trabajador, u.documento, u.nombres, u.primer_apellido, u.apellidos
    FROM trabajador_productos tp
    JOIN trabajadores t ON tp.id_trabajador = t.id_trabajador
    JOIN usuarios u ON t.id_usuario = u.id_usuario
  `);
  console.log('Técnicos que tienen trabajador_productos:', tpRows.length);

  await conn.end();
}

testQuery();

