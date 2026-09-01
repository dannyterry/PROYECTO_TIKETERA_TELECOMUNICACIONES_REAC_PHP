const pool = require('./db.js');

async function main() {
  const [rows] = await pool.query(`
    SELECT 
      o.numero, 
      o.motivo_finalizacion as tipo_liquidacion, 
      o.tipo_trabajo as crudo_fenix, 
      m.tipo_trabajo as oficial_de_tabla_motivos,
      m.precio_compra,
      m.precio_venta
    FROM ordenes o 
    LEFT JOIN motivos m ON TRIM(o.motivo_finalizacion) = TRIM(m.nombre) 
    WHERE DATE(o.fecha_visita) = '2026-09-01' 
      AND o.estado IN ('Finalizada', 'Finalizados', 'Fenix')
  `);

  console.log("Órdenes finalizadas de hoy (01/09/2026):");
  console.table(rows);
  process.exit(0);
}

main().catch(console.error);
