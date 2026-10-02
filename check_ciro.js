const db = require('./telecom-api/db');

async function test() {
  try {
    const [ciroUsers] = await db.query("SELECT id_usuario, nombres, apellidos, id_rol, cuadrilla FROM usuarios WHERE nombres LIKE '%CIRO%' OR apellidos LIKE '%INFANTES%'");
    console.log('--- Usuario Ciro ---', ciroUsers);

    const [ciroTrab] = await db.query("SELECT * FROM trabajadores WHERE id_usuario = ?", [ciroUsers[0]?.id_usuario]);
    console.log('--- Trabajador Ciro ---', ciroTrab);

    const [juanUsers] = await db.query("SELECT id_usuario, nombres, apellidos, id_rol, cuadrilla FROM usuarios WHERE nombres LIKE '%KARR%' OR apellidos LIKE '%KARR%'");
    console.log('--- Usuario Juan Karr ---', juanUsers);

    const [juanTrab] = await db.query("SELECT * FROM trabajadores WHERE id_usuario = ?", [juanUsers[0]?.id_usuario]);
    console.log('--- Trabajador Juan Karr ---', juanTrab);

    const [vehAur] = await db.query("SELECT * FROM vehiculos WHERE placa LIKE '%AUR%939%' OR id_vehiculo = ?", [ciroTrab[0]?.id_vehiculo || 0]);
    console.log('--- Vehiculo AUR-939 / Vehiculo de Ciro ---', vehAur);

    const [ords] = await db.query(`
      SELECT 
        o.id_orden,
        o.numero,
        o.cliente,
        o.estado,
        o.fecha_visita,
        o.id_tecnico,
        o.tecnico_asignado,
        o.cuadrilla,
        DATE(o.fecha_visita) as fecha_visita_date
      FROM ordenes o 
      WHERE DATE(o.fecha_visita) = '2026-09-30'
        AND (o.id_tecnico = 141 OR o.tecnico_asignado LIKE '%CIRO%')
    `);
    console.log('--- Ordenes en BD para Ciro hoy (2026-09-30) ---', ords);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit();
  }
}
test();
