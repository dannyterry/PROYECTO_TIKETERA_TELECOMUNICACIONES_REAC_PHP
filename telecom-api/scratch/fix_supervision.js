const mysql = require('mysql2/promise');

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: '127.0.0.1',
      user: 'root',
      password: '',
      database: 'corporacioncespe_cespedes'
    });

    console.log("Conectado a BD...");
    const [roles] = await conn.query("SELECT * FROM roles WHERE nombre LIKE '%SUPERVIC%' OR nombre LIKE '%SUPERVIS%'");
    console.log("Roles encontrados:", roles);

    const [updateRes] = await conn.query("UPDATE roles SET nombre = 'SUPERVISION' WHERE nombre = 'SUPERVICION' OR nombre = 'Supervicion' OR nombre = 'supervicion'");
    console.log("Resultado update roles:", updateRes.affectedRows, "filas actualizadas.");

    const [allRoles] = await conn.query("SELECT * FROM roles");
    console.log("Todos los roles:", allRoles);

    await conn.end();
  } catch (e) {
    console.error("Error:", e.message);
  }
})();
