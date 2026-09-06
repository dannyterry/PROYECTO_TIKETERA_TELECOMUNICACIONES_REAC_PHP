const mysql = require('mysql2/promise');

async function checkAreasInUse() {
  try {
    const conn = await mysql.createConnection({
      host: 'corporacioncespedes.com',
      port: 3306,
      user: 'corporacioncespe_miguel',
      password: 'corporacioncespe_123',
      database: 'corporacioncespe_cespedes'
    });

    console.log("=== VERIFICANDO ÁREAS ASIGNADAS A USUARIOS EN PRODUCCIÓN ===");
    const [usuariosConArea] = await conn.query(`
      SELECT DISTINCT area 
      FROM usuarios 
      WHERE area IS NOT NULL AND area != ''
    `);
    
    console.log("Áreas actualmente escritas en usuarios de producción:");
    usuariosConArea.forEach(u => console.log(` - "${u.area}"`));

    await conn.end();
  } catch (err) {
    console.error(err);
  }
}

checkAreasInUse();
