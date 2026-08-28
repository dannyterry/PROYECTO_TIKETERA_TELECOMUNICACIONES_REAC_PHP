const pool = require('../db');

async function check() {
  const [roles] = await pool.query('SELECT * FROM roles');
  console.log('--- ROLES ---');
  console.table(roles);

  const [klinder] = await pool.query("SELECT id_usuario, usuario, nombres, apellidos, id_rol, area FROM usuarios WHERE usuario LIKE '%kpaniura%' OR nombres LIKE '%KLINDER%'");
  console.log('--- KLINDER ---');
  console.table(klinder);

  const [gestores] = await pool.query("SELECT id_usuario, usuario, nombres, apellidos, id_rol, area FROM usuarios WHERE id_rol = 4 OR area LIKE '%GESTION%' LIMIT 5");
  console.log('--- GESTORES ---');
  console.table(gestores);

  process.exit();
}

check();
