const db = require('../db');

(async () => {
  try {
    const [sample] = await db.query(`
      SELECT 
        o.id_orden,
        o.numero as ot,
        o.cod_seguimiento_cliente as codigo_pedido,
        o.codigo_seguimiento as ticket,
        o.cliente,
        COALESCE(o.movil, o.fijo, '') as telefono,
        COALESCE(o.localidad, o.region_zona, '') as distrito,
        COALESCE(u.nombre_completo, o.tecnico_asignado, '') as tecnico,
        o.id_tecnico,
        COALESCE(o.cuadrilla, u.cuadrilla, '') as cuadrilla,
        COALESCE(o.fecha_visita, o.fecha_solicitud, o.fecha_estado, '') as fecha_atencion,
        COALESCE(o.motivo_trabajo, o.tipo_trabajo, o.motivo, '') as tipo_trabajo,
        o.direccion
      FROM ordenes o
      LEFT JOIN (
        SELECT id_usuario, CONCAT(nombres, ' ', apellidos) as nombre_completo, cuadrilla FROM usuarios
      ) u ON u.id_usuario = o.id_tecnico
      WHERE o.cliente IS NOT NULL AND TRIM(o.cliente) != ''
      ORDER BY o.id_orden DESC
      LIMIT 5
    `);
    console.log('Sample order rows:', sample);
  } catch (e) {
    console.error('Error:', e);
  } finally {
    process.exit(0);
  }
})();
