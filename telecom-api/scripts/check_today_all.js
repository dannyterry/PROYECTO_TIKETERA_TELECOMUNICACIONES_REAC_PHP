const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  const [ordersToday] = await conn.query(`
    SELECT o.id_orden, o.numero, o.cliente, o.estado, o.fecha_visita, o.id_tecnico, CONCAT(u.nombres, ' ', u.apellidos) as tecnico
    FROM ordenes o
    JOIN trabajadores t ON t.id_trabajador = o.id_tecnico
    JOIN usuarios u ON u.id_usuario = t.id_usuario
    WHERE DATE(o.fecha_visita) = '2026-09-04'
  `);
  console.log("TODAS LAS ORDENES DE HOY (2026-09-04):");
  ordersToday.forEach(o => {
    console.log(`- ID: ${o.id_orden}, Num: ${o.numero}, Cliente: ${o.cliente}, Tecnico: ${o.tecnico}, Estado: ${o.estado}`);
  });

  // Check columns in orden_liquidacion_detalle
  const [cols] = await conn.query("SHOW COLUMNS FROM orden_liquidacion_detalle LIKE 'drop_inicio'");
  if (cols.length === 0) {
    console.log("Agregando columnas drop_inicio y drop_fin a orden_liquidacion_detalle...");
    await conn.query("ALTER TABLE orden_liquidacion_detalle ADD COLUMN drop_inicio INT NULL, ADD COLUMN drop_fin INT NULL");
    console.log("Columnas agregadas con éxito.");
  } else {
    console.log("Columnas drop_inicio y drop_fin ya existen.");
  }

  await conn.end();
}

main().catch(console.error);
