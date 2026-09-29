const pool = require('../db');

(async () => {
  await pool.query("UPDATE roles SET nombre = 'SUPERVISOR', descripcion = 'SUPERVISOR DE CAMPO Y CALIDAD' WHERE id_rol = 6");
  console.log('✅ Rol 6 actualizado a SUPERVISOR');
  const [roles] = await pool.query('SELECT * FROM roles');
  console.table(roles);
  process.exit();
})();
