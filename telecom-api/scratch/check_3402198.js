const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  const [rows] = await conn.query("SELECT * FROM ordenes WHERE numero = '3402198'");
  console.log('ORDER 3402198:', rows[0]);

  // Check user MARIO CESAR SULCA CAJAHUARINGA in usuarios
  const [users] = await conn.query("SELECT id_usuario, nombres, apellidos, rol, cuadrilla, estado FROM usuarios WHERE nombres LIKE '%MARIO%' OR apellidos LIKE '%SULCA%' OR apellidos LIKE '%CAJAHUARINGA%'");
  console.log('\nUSUARIOS MATCHING SULCA:', users);

  // Check Klinder Paniura in usuarios
  const [klinder] = await conn.query("SELECT id_usuario, nombres, apellidos, rol, cuadrilla, estado FROM usuarios WHERE nombres LIKE '%KLINDER%' OR apellidos LIKE '%PANIURA%'");
  console.log('\nUSUARIOS MATCHING KLINDER:', klinder);

  await conn.end();
}

main().catch(console.error);
