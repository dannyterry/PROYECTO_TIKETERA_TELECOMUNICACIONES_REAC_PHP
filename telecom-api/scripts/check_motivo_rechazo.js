const mysql = require('mysql2/promise');

async function check() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  const [cols] = await conn.query("SHOW COLUMNS FROM orden_liquidaciones LIKE 'motivo_rechazo'");
  console.log("COLUMNA motivo_rechazo:", cols);

  if (cols.length === 0) {
    console.log("Agregando columna motivo_rechazo a orden_liquidaciones...");
    await conn.query("ALTER TABLE orden_liquidaciones ADD COLUMN motivo_rechazo TEXT NULL AFTER estado");
    console.log("Columna motivo_rechazo agregada con éxito.");
  }

  // Verificar la query de cabecera
  try {
    const [cab] = await conn.query(`
      SELECT ol.id_liquidacion, ol.numero_acta, ol.fecha_liquidacion, ol.observaciones,
             ol.estado AS estado_liquidacion, ol.motivo_rechazo,
             o.numero AS numero_orden, o.cliente, o.direccion, o.tipo_trabajo,
             COALESCE(
                 NULLIF(TRIM(o.motivo_finalizacion), ''),
                 NULLIF(TRIM(o.motivo_cancelacion), '')
             ) AS tipo_averia,
             o.fecha_visita,
             CONCAT(u.nombres,' ',u.apellidos) AS tecnico
      FROM orden_liquidaciones ol
      INNER JOIN ordenes o      ON o.id_orden      = ol.id_orden
      INNER JOIN trabajadores t ON t.id_trabajador = ol.id_trabajador
      INNER JOIN usuarios u     ON u.id_usuario    = t.id_usuario
      WHERE ol.id_liquidacion = 4
    `);
    console.log("CABECERA QUERY RESULT:", cab);
  } catch (e) {
    console.error("ERROR EN CABECERA QUERY:", e.message);
  }

  await conn.end();
}

check().catch(console.error);
