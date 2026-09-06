const mysql = require('mysql2/promise');

async function inspectMore() {
  try {
    const conn = await mysql.createConnection({
      host: 'corporacioncespedes.com',
      port: 3306,
      user: 'corporacioncespe_miguel',
      password: 'corporacioncespe_123',
      database: 'corporacioncespe_cespedes'
    });

    console.log("=== INSPECCIÓN DETALLADA DE LA BD EN HOSTING ===");

    // 1. Conteo de registros en las nuevas tablas
    const [cAuditoria] = await conn.query("SELECT COUNT(*) as count FROM auditoria_actividad");
    const [cChat] = await conn.query("SELECT COUNT(*) as count FROM mensajes_chat");
    const [cTareas] = await conn.query("SELECT COUNT(*) as count FROM orden_tareas");
    console.log(`- Registros en 'auditoria_actividad': ${cAuditoria[0].count}`);
    console.log(`- Registros en 'mensajes_chat': ${cChat[0].count}`);
    console.log(`- Registros en 'orden_tareas': ${cTareas[0].count}`);

    // 2. Revisar si hay tabla configuracion y si tiene EMAIL_
    const [tConf] = await conn.query("SHOW TABLES LIKE 'configuracion'");
    if (tConf.length > 0) {
      const [emailConf] = await conn.query("SELECT clave, valor FROM configuracion WHERE clave LIKE 'EMAIL_%'");
      console.log(`- Variables EMAIL_ en 'configuracion': ${emailConf.length}`);
      emailConf.forEach(c => console.log(`   ${c.clave}: ${c.valor ? '(configurado)' : '(vacío)'}`));
    } else {
      console.log("- Tabla 'configuracion': ❌ NO EXISTE");
    }

    // 3. Revisar si hay tabla permisos y roles_permisos
    const [tPermisos] = await conn.query("SHOW TABLES LIKE 'permisos'");
    const [tRolesPerm] = await conn.query("SHOW TABLES LIKE 'roles_permisos'");
    console.log(`- Tabla 'permisos': ${tPermisos.length > 0 ? '✅ EXISTE' : '❌ NO'}`);
    console.log(`- Tabla 'roles_permisos': ${tRolesPerm.length > 0 ? '✅ EXISTE' : '❌ NO'}`);

    // 4. Revisar si la columna 'area' existe en la tabla 'usuarios'
    const [uCols] = await conn.query("DESCRIBE usuarios");
    const hasArea = uCols.some(c => c.Field === 'area');
    console.log(`- Columna 'area' en tabla 'usuarios': ${hasArea ? '✅ EXISTE' : '❌ NO'}`);

    // 5. Revisar si la columna 'foto_personal' existe en 'usuarios'
    const hasFoto = uCols.some(c => c.Field === 'foto_personal');
    console.log(`- Columna 'foto_personal' en tabla 'usuarios': ${hasFoto ? '✅ EXISTE' : '❌ NO'}`);

    await conn.end();
  } catch (err) {
    console.error("Error:", err.message);
  }
}

inspectMore();
