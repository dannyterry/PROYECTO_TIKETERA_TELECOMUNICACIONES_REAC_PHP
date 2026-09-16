const pool = require('../db');

async function checkAugustExact() {
  try {
    const [rows] = await pool.query(`
      SELECT id_orden, numero, codigo_seguimiento, cliente, cuadrilla, tipo_trabajo, tipo_trabajo_asignado, motivo_finalizacion, producto, estado
      FROM ordenes
      WHERE YEAR(fecha_visita) = 2026 AND MONTH(fecha_visita) = 8
        AND (cuadrilla IS NULL OR (TRIM(cuadrilla) NOT REGEXP '^[oO][0-9]+' AND TRIM(cuadrilla) NOT REGEXP '^[oO] ' AND TRIM(cuadrilla) NOT LIKE 'ORDENAMIENTO%'))
        AND (cliente IS NULL OR (cliente NOT LIKE '%NORMALIZACI%' AND cliente NOT LIKE '%CONJUNTA PEXT%'))
        AND (tipo_trabajo IS NULL OR tipo_trabajo NOT LIKE '%ORDENAMIENTO%')
        AND (motivo_finalizacion IS NULL OR motivo_finalizacion NOT LIKE '%CONJUNTA PEXT%')
        AND estado != 'Anulada' AND estado NOT LIKE '%Regesti%'
        -- Averías que podrían ser la orden faltante de Postventa
        AND NOT (
          COALESCE(producto, '') LIKE '%POST%VENTA%'
          OR COALESCE(tipo_trabajo, '') LIKE '%TRASLADO%'
          OR COALESCE(tipo_trabajo, '') LIKE '%REUBICA%'
          OR COALESCE(tipo_trabajo, '') LIKE '%MUDANZA%'
        )
        AND (
          motivo_finalizacion LIKE '%POSTVENTA%'
          OR motivo_finalizacion LIKE '%MESH%'
          OR motivo_finalizacion LIKE '%WIFI PRO%'
          OR tipo_trabajo LIKE '%ADICIONAL%'
          OR tipo_trabajo_asignado LIKE '%APARATO%'
        )
    `);

    console.log(`Órdenes en Agosto con motivo POSTVENTA / MESH / WIFI PRO que no entraron por tipo_trabajo (${rows.length}):`);
    console.table(rows.map(r => ({
      id: r.id_orden,
      ot: r.numero,
      cliente: r.cliente?.slice(0, 20),
      tipo: r.tipo_trabajo,
      motivo: r.motivo_finalizacion,
      estado: r.estado
    })));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkAugustExact();
