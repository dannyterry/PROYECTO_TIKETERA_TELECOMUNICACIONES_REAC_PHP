const mysql = require('mysql2/promise');

async function inspectRemoteDb() {
  const hostsToTry = ['corporacioncespedes.com', '162.241.60.207', 'mail.corporacioncespedes.com'];
  
  for (const host of hostsToTry) {
    console.log(`\n🔍 Probando conexión a MySQL remoto en: ${host}...`);
    try {
      const conn = await mysql.createConnection({
        host: host,
        port: 3306,
        user: 'corporacioncespe_miguel',
        password: 'corporacioncespe_123',
        database: 'corporacioncespe_cespedes',
        connectTimeout: 5000
      });

      console.log(`✅ ¡Conectado exitosamente a la BD remota de producción en ${host}!`);
      
      // 1. Tablas
      const [tables] = await conn.query("SHOW TABLES");
      const tableNames = tables.map(t => Object.values(t)[0]);
      
      console.log("\n📋 Tablas encontradas en la BD de Hosting:");
      const tablesToCheck = ['auditoria_actividad', 'mensajes_chat', 'orden_tareas', 'areas', 'usuarios', 'roles'];
      tablesToCheck.forEach(t => {
        console.log(` - ${t}: ${tableNames.includes(t) ? '✅ EXISTE' : '❌ NO EXISTE'}`);
      });

      // 2. Columnas en usuarios
      if (tableNames.includes('usuarios')) {
        const [cols] = await conn.query("DESCRIBE usuarios");
        const colNames = cols.map(c => c.Field);
        console.log("\n👤 Columnas en tabla 'usuarios':");
        const colsToCheck = ['ultimo_acceso', 'esta_online', 'ultima_accion', 'distrito_conexion', 'lat_conexion', 'lng_conexion', 'ip_conexion'];
        colsToCheck.forEach(c => {
          console.log(` - ${c}: ${colNames.includes(c) ? '✅ EXISTE' : '❌ FALTA'}`);
        });
      }

      // 3. Registros en areas
      if (tableNames.includes('areas')) {
        const [areas] = await conn.query("SELECT id_area, nombre FROM areas ORDER BY id_area ASC");
        console.log(`\n🏢 Áreas en Hosting (Total: ${areas.length}):`);
        areas.forEach(a => console.log(`   ${a.id_area}. ${a.nombre}`));
      }

      await conn.end();
      process.exit(0);
    } catch (err) {
      console.log(`❌ No se pudo conectar a ${host}:`, err.message);
    }
  }

  console.log("\n⚠️ El puerto 3306 externo de MySQL está bloqueado por el firewall de cPanel (Remote MySQL).");
  process.exit(1);
}

inspectRemoteDb();
