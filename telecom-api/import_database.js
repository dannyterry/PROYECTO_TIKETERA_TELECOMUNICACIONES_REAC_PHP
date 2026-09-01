const mysql = require('mysql2/promise');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function importDb() {
  console.log("==================================================");
  console.log("🚀 INICIANDO IMPORTACIÓN DE BASE DE DATOS ACTUALIZADA");
  console.log("==================================================");

  const sqlFilePath = path.join('d:', 'proyecrh', 'actualizado_01_09_2026.sql');
  if (!fs.existsSync(sqlFilePath)) {
    throw new Error(`No se encontró el archivo: ${sqlFilePath}`);
  }
  const fileSizeMB = (fs.statSync(sqlFilePath).size / (1024 * 1024)).toFixed(2);
  console.log(`📁 Archivo encontrado: actualizado_01_09_2026.sql (${fileSizeMB} MB)`);

  // 1. Conectar a MySQL sin base de datos para resetearla limpiamente
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: ''
  });

  console.log("🔄 Recreando base de datos 'corporacioncespe_cespedes' limpia...");
  await connection.query("DROP DATABASE IF EXISTS corporacioncespe_cespedes");
  await connection.query("CREATE DATABASE corporacioncespe_cespedes CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci");
  await connection.end();
  console.log("✅ Base de datos creada con éxito.");

  // 2. Importar usando mysql.exe mediante stream
  console.log("⏳ Importando datos desde el archivo SQL...");
  const mysqlExe = 'C:\\xampp\\mysql\\bin\\mysql.exe';

  const child = spawn(mysqlExe, [
    '-u', 'root',
    '--default-character-set=utf8mb4',
    'corporacioncespe_cespedes'
  ]);

  const readStream = fs.createReadStream(sqlFilePath);
  readStream.pipe(child.stdin);

  child.stderr.on('data', (data) => {
    const msg = data.toString();
    if (!msg.includes('[Warning]')) {
      console.error('stderr:', msg);
    }
  });

  await new Promise((resolve, reject) => {
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`mysql.exe terminó con código de error ${code}`));
    });
  });

  console.log("🎉 ¡Importación completada con éxito!");

  // 3. Verificar tablas y conteo de órdenes
  const verifyConn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  const [tables] = await verifyConn.query("SHOW TABLES");
  console.log(`📋 Total de tablas importadas: ${tables.length}`);

  const [orders] = await verifyConn.query("SELECT COUNT(*) as total FROM ordenes");
  console.log(`📦 Total de órdenes en tabla 'ordenes': ${orders[0].total}`);

  const [users] = await verifyConn.query("SELECT COUNT(*) as total FROM usuarios");
  console.log(`👥 Total de usuarios: ${users[0].total}`);

  const [todayOrders] = await verifyConn.query(
    "SELECT COUNT(*) as total FROM ordenes WHERE DATE(fecha_visita) = '2026-09-01' OR DATE(fecha_solicitud) = '2026-09-01'"
  );
  console.log(`📅 Órdenes del día de hoy (01/09/2026): ${todayOrders[0].total}`);

  await verifyConn.end();
  process.exit(0);
}

importDb().catch((err) => {
  console.error("❌ Error en importación:", err.message);
  process.exit(1);
});
