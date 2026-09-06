const pool = require('./db.js');

async function main() {
  const [descAreas] = await pool.query("DESCRIBE areas");
  console.log("Columnas de areas:", descAreas);

  const [dataAreas] = await pool.query("SELECT * FROM areas");
  console.log("Datos de areas:", dataAreas);

  const [descRolesAreas] = await pool.query("DESCRIBE roles_areas");
  console.log("Columnas de roles_areas:", descRolesAreas);

  const [dataRolesAreas] = await pool.query("SELECT * FROM roles_areas");
  console.log("Datos de roles_areas:", dataRolesAreas);

  // Ver dónde se guarda el área del trabajador (usuarios o trabajadores o perfil)
  const [descUsuarios] = await pool.query("DESCRIBE usuarios");
  const areaEnUsuarios = descUsuarios.filter(c => c.Field.toLowerCase().includes('area'));
  console.log("Columnas area en usuarios:", areaEnUsuarios);

  const [descTrab] = await pool.query("DESCRIBE trabajadores");
  console.log("Todas las columnas de trabajadores:", descTrab.map(c => c.Field));

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
