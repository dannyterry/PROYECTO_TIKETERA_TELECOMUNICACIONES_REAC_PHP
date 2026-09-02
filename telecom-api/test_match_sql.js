const pool = require('./db.js');

async function main() {
  const [res] = await pool.query(`
    UPDATE ordenes o
    JOIN usuarios u ON o.cuadrilla LIKE CONCAT('%', SUBSTRING_INDEX(u.nombres, ' ', 1), '%')
                   AND o.cuadrilla LIKE CONCAT('%', COALESCE(u.primer_apellido, SUBSTRING_INDEX(u.apellidos, ' ', 1)), '%')
    SET o.id_tecnico = u.id_usuario,
        o.tecnico_asignado = CONCAT(u.nombres, ' ', COALESCE(u.primer_apellido, u.apellidos))
    WHERE o.id_tecnico IS NULL
  `);

  console.log("Órdenes actualizadas:", res.affectedRows);
  process.exit(0);
}

main().catch(console.error);
