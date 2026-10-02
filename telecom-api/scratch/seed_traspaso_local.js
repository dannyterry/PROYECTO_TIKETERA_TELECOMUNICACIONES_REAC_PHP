const mysql = require('mysql2/promise');

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: 'localhost', user: 'root', password: '', database: 'corporacioncespe_cespedes'
    });
    console.log("Conectado a BD Local...");

    const [rows] = await conn.query("SELECT * FROM permisos WHERE clave = 'portal_tecnico.traspaso'");
    if (rows.length === 0) {
      const [ins] = await conn.query("INSERT INTO permisos (nombre, clave, modulo, estado) VALUES ('Traspaso a Compañero', 'portal_tecnico.traspaso', 'portal_tecnico', 'Activo')");
      console.log("✅ Permiso 'portal_tecnico.traspaso' creado con ID:", ins.insertId);

      const [rolesTec] = await conn.query("SELECT id_rol, nombre FROM roles WHERE LOWER(nombre) LIKE '%tecnico%' OR id_rol = 3");
      for (const r of rolesTec) {
        await conn.query("INSERT IGNORE INTO roles_permisos (id_rol, id_permiso) VALUES (?, ?)", [r.id_rol, ins.insertId]);
        console.log(`✅ Permiso asignado al rol: ${r.nombre} (ID ${r.id_rol})`);
      }
    } else {
      console.log("ℹ️ Ya existe en BD local");
    }

    await conn.end();
  } catch (err) {
    console.log("Local seed omitido:", err.message);
  }
})();
