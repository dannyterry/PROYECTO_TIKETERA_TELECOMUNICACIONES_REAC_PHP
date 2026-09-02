const pool = require('./db.js');

async function checkAllUserCuadrillas() {
  const [users] = await pool.query(
    "SELECT id_usuario, nombres, apellidos, primer_apellido, segundo_apellido, cuadrilla FROM usuarios ORDER BY id_usuario ASC"
  );

  console.log("Usuarios y su cuadrilla configurada en la tabla usuarios:");
  console.table(users.map(u => ({
    id: u.id_usuario,
    nombre: `${u.nombres} ${u.primer_apellido || u.apellidos || ''}`.trim(),
    cuadrilla_en_usuarios: u.cuadrilla
  })));

  process.exit(0);
}

checkAllUserCuadrillas().catch(console.error);
