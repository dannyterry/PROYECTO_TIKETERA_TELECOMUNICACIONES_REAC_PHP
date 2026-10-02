const mysql = require('mysql2/promise');

const REMOTE_CONFIG = {
  host: 'corporacioncespedes.com',
  user: 'corporacioncespe_miguel',
  password: 'corporacioncespe_123',
  database: 'corporacioncespe_cespedes',
  dateStrings: true,
};

(async () => {
  try {
    const conn = await mysql.createConnection(REMOTE_CONFIG);
    console.log("Conectado a BD Producción...");

    const [rows] = await conn.query("SELECT * FROM permisos WHERE clave = 'portal_tecnico.traspaso'");
    if (rows.length === 0) {
      const [ins] = await conn.query("INSERT INTO permisos (nombre, clave, modulo, estado) VALUES ('Traspaso a Compañero', 'portal_tecnico.traspaso', 'portal_tecnico', 'Activo')");
      console.log("✅ Permiso 'portal_tecnico.traspaso' creado con ID:", ins.insertId);

      // Por defecto asignarlo a los roles de Técnico (id_rol 3 / Tecnico) y Administrador
      const [rolesTec] = await conn.query("SELECT id_rol, nombre FROM roles WHERE LOWER(nombre) LIKE '%tecnico%' OR id_rol = 3");
      for (const r of rolesTec) {
        await conn.query("INSERT IGNORE INTO roles_permisos (id_rol, id_permiso) VALUES (?, ?)", [r.id_rol, ins.insertId]);
        console.log(`✅ Permiso asignado por defecto al rol: ${r.nombre} (ID ${r.id_rol})`);
      }
    } else {
      console.log("ℹ️ El permiso 'portal_tecnico.traspaso' ya existe con ID:", rows[0].id_permiso);
    }

    await conn.end();
  } catch (err) {
    console.error("Error:", err);
  }
})();
