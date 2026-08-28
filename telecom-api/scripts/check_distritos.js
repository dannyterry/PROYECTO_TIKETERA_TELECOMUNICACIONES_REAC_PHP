const pool = require('../db');

async function check() {
  const [rows] = await pool.query('SELECT id_usuario, nombres, apellidos, id_rol, distrito, direccion, area FROM usuarios WHERE estado = "Activo" LIMIT 10');
  console.table(rows);
  process.exit();
}

check();
