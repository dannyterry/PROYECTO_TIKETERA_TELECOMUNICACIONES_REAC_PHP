const pool = require('../db');

async function test() {
  const [cols] = await pool.query("DESCRIBE usuarios");
  console.log("Columnas de usuarios:", cols.map(c => c.Field));

  const [techUsers] = await pool.query(
    `SELECT * FROM usuarios WHERE nombres LIKE '%Ciro%' OR nombres LIKE '%Nibardo%' OR apellidos LIKE '%Sanchez%' OR apellidos LIKE '%Oblitas%'`
  );
  console.log("Usuarios encontrados:", techUsers);
  process.exit(0);
}

test();
