const pool = require('./db');
(async () => {
  const [rows] = await pool.query(`
    SELECT id_orden, numero, cliente, tipo_trabajo, tipo_trabajo_asignado, motivo_trabajo, motivo_finalizacion, fecha_visita, cuadrilla
    FROM ordenes
    WHERE (cuadrilla LIKE '%EDIXON%' OR tecnico_asignado LIKE '%EDIXON%')
      AND tipo_trabajo IN ('NORMALIZACIÓN', 'PEX', 'RECABLEADO')
  `);
  console.log('Órdenes especiales de Edixon:', rows);
  process.exit(0);
})();
