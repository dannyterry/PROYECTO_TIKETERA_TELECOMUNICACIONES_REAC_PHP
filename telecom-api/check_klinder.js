const pool = require('./db.js');

async function main() {
  const [users] = await pool.query(
    "SELECT id_usuario, nombres, apellidos, primer_apellido, segundo_apellido, cuadrilla FROM usuarios WHERE nombres LIKE '%KLINDER%' OR apellidos LIKE '%PANIURA%'"
  );
  console.log("Usuarios con Klinder:", users);

  const [order] = await pool.query("SELECT * FROM ordenes WHERE numero = '3402198'");
  console.log("Orden 3402198:", order[0]);

  process.exit(0);
}

main().catch(console.error);
