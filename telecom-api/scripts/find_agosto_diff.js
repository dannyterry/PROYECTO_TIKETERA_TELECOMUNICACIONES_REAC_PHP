const pool = require('../db');

async function findAgostoDiff() {
  try {
    const [rows] = await pool.query(`
      SELECT id_orden, numero, codigo_seguimiento, cliente, tipo_trabajo, tipo_trabajo_asignado, motivo_finalizacion, producto, cuadrilla, estado
      FROM ordenes
      WHERE YEAR(fecha_visita) = 2026 AND MONTH(fecha_visita) = 8
        AND (cuadrilla IS NULL OR (TRIM(cuadrilla) NOT REGEXP '^[oO][0-9]+' AND TRIM(cuadrilla) NOT REGEXP '^[oO] ' AND TRIM(cuadrilla) NOT LIKE 'ORDENAMIENTO%'))
        AND (cliente IS NULL OR (cliente NOT LIKE '%NORMALIZACI%' AND cliente NOT LIKE '%CONJUNTA PEXT%'))
        AND (tipo_trabajo IS NULL OR tipo_trabajo NOT LIKE '%ORDENAMIENTO%')
        AND (motivo_finalizacion IS NULL OR motivo_finalizacion NOT LIKE '%CONJUNTA PEXT%')
        AND estado != 'Anulada' AND estado NOT LIKE '%Regesti%'
        -- actualmente clasificadas como AVERÍAS:
        AND NOT (
          COALESCE(tipo_trabajo, '') LIKE '%TRASLADO%' 
          OR COALESCE(tipo_trabajo, '') LIKE '%REUBICA%' 
          OR COALESCE(tipo_trabajo, '') LIKE '%MESH%' 
          OR COALESCE(tipo_trabajo, '') LIKE '%WIN BOX%' 
          OR COALESCE(tipo_trabajo, '') LIKE '%WINBOX%' 
          OR COALESCE(tipo_trabajo, '') LIKE '%WIFI%' 
          OR COALESCE(tipo_trabajo, '') LIKE '%TELEFON%' 
          OR COALESCE(tipo_trabajo, '') LIKE '%MUDANZA%' 
          OR COALESCE(producto, '') LIKE '%POST%VENTA%' 
          OR COALESCE(motivo_finalizacion, '') LIKE '%POST%VENTA%'
          OR COALESCE(motivo_finalizacion, '') LIKE '%MESH%'
          OR (COALESCE(tipo_trabajo, '') LIKE '%ADICIONAL%' AND COALESCE(tipo_trabajo_asignado, '') NOT LIKE '%LOS ROJO%')
        )
        AND (
          COALESCE(tipo_trabajo_asignado, '') LIKE '%MESH%'
          OR COALESCE(tipo_trabajo_asignado, '') LIKE '%WIFI%'
          OR COALESCE(tipo_trabajo_asignado, '') LIKE '%WINBOX%'
          OR COALESCE(tipo_trabajo_asignado, '') LIKE '%TEL%'
          OR COALESCE(tipo_trabajo_asignado, '') LIKE '%CAMBIO%'
          OR COALESCE(tipo_trabajo_asignado, '') LIKE '%EQUIPO%'
          OR COALESCE(tipo_trabajo_asignado, '') LIKE '%REUBICA%'
          OR COALESCE(tipo_trabajo_asignado, '') LIKE '%TRASLADO%'
          OR COALESCE(cuadrilla, '') LIKE '%TRASLADO%'
          OR COALESCE(cuadrilla, '') LIKE '%POST%VENTA%'
          OR COALESCE(tipo_trabajo, '') LIKE '%ADICIONAL%'
        )
    `);

    console.log(`Órdenes en zona gris de Agosto (${rows.length} órdenes):`);
    console.table(rows.map(r => ({
      ot: r.numero,
      cuadrilla: r.cuadrilla ? r.cuadrilla.slice(0, 20) : '',
      tipo: r.tipo_trabajo,
      asig: r.tipo_trabajo_asignado ? r.tipo_trabajo_asignado.slice(0, 25) : '',
      motivo: r.motivo_finalizacion ? r.motivo_finalizacion.slice(0, 30) : '',
      estado: r.estado
    })));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

findAgostoDiff();
