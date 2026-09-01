const pool = require('./db.js');

async function main() {
  const [rows] = await pool.query(
    "SELECT id_usuario, nombres, apellidos, primer_apellido, segundo_apellido FROM usuarios WHERE nombres LIKE '%YOFRE%' OR apellidos LIKE '%AGUIN%' OR nombres LIKE '%OSCAR%' OR apellidos LIKE '%PINERO%' OR apellidos LIKE '%PI%ERO%'"
  );
  console.log("Usuarios encontrados:", rows);
  process.exit(0);
}

main().catch(console.error);
