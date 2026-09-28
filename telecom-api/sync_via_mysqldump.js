const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function syncViaMysqldump() {
  console.log('================================================================');
  console.log('🚀 SINCRONIZACIÓN OFICIAL Y COMPLETA VÍA MYSQLDUMP DIRECTO');
  console.log('📡 Origen: corporacioncespedes.com ➔ 💻 Destino: 127.0.0.1 (XAMPP)');
  console.log('================================================================\n');

  const dumpFile = path.join(__dirname, 'temp_prod_dump.sql');
  const mysqldumpExe = 'C:\\xampp\\mysql\\bin\\mysqldump.exe';
  const mysqlExe = 'C:\\xampp\\mysql\\bin\\mysql.exe';

  console.log('1️⃣ Descargando dump completo desde Producción con mysqldump.exe...');
  const dumpArgs = [
    '-h', 'corporacioncespedes.com',
    '-u', 'corporacioncespe_miguel',
    '-pcorporacioncespe_123',
    '--single-transaction',
    '--quick',
    '--default-character-set=utf8mb4',
    '--routines',
    '--triggers',
    'corporacioncespe_cespedes'
  ];

  const dumpProcess = spawn(mysqldumpExe, dumpArgs);
  const writeStream = fs.createWriteStream(dumpFile);

  dumpProcess.stdout.pipe(writeStream);

  let dumpStderr = '';
  dumpProcess.stderr.on('data', (d) => {
    dumpStderr += d.toString();
  });

  await new Promise((resolve, reject) => {
    dumpProcess.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`mysqldump falló con código ${code}: ${dumpStderr}`));
    });
  });

  const fileSizeMB = (fs.statSync(dumpFile).size / (1024 * 1024)).toFixed(2);
  console.log(`✅ Dump descargado con éxito: ${fileSizeMB} MB\n`);

  console.log('2️⃣ Preparando archivo SQL (compatibilidad y normalización)...');
  let sqlContent = fs.readFileSync(dumpFile, 'utf8');

  // Corregir colaciones de MySQL 8.x que MariaDB o MySQL 5.7 no soporten
  sqlContent = sqlContent
    .replace(/utf8mb4_0900_[a-z0-9_]+/gi, 'utf8mb4_general_ci')
    .replace(/utf8mb4_uca1400_[a-z0-9_]+/gi, 'utf8mb4_general_ci')
    .replace(/DEFINER=`[^`]+`@`[^`]+`/gi, 'DEFINER=CURRENT_USER');

  fs.writeFileSync(dumpFile, sqlContent, 'utf8');
  console.log('✅ Archivo SQL normalizado.\n');

  console.log('3️⃣ Recreando base de datos local limpia...');
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: ''
  });
  await conn.query('DROP DATABASE IF EXISTS `corporacioncespe_cespedes`');
  await conn.query('CREATE DATABASE `corporacioncespe_cespedes` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci');
  await conn.end();
  console.log('✅ Base de datos local corporacioncespe_cespedes creada limpia.\n');

  console.log('4️⃣ Importando dump a MySQL local...');
  const importArgs = [
    '-h', '127.0.0.1',
    '-u', 'root',
    '--default-character-set=utf8mb4',
    '--max_allowed_packet=128M',
    'corporacioncespe_cespedes'
  ];

  const importProcess = spawn(mysqlExe, importArgs);
  const readStream = fs.createReadStream(dumpFile);
  readStream.pipe(importProcess.stdin);

  let importStderr = '';
  importProcess.stderr.on('data', (d) => {
    const msg = d.toString();
    if (!msg.includes('[Warning]')) {
      importStderr += msg;
    }
  });

  await new Promise((resolve, reject) => {
    importProcess.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Importación falló con código ${code}: ${importStderr}`));
    });
  });

  console.log('✅ Importación en MySQL local finalizada al 100%.\n');

  // Limpieza de archivo temporal
  if (fs.existsSync(dumpFile)) {
    fs.unlinkSync(dumpFile);
    console.log('🧹 Archivo temporal eliminado.');
  }

  // Verificación final
  const localConn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  const [tables] = await localConn.query('SHOW TABLES');
  const [ordenesCnt] = await localConn.query('SELECT COUNT(*) as c FROM ordenes');
  const [tareasCnt] = await localConn.query('SELECT COUNT(*) as c FROM orden_tareas');
  const [usuariosCnt] = await localConn.query('SELECT COUNT(*) as c FROM usuarios');

  console.log('\n================================================================');
  console.log('🎉 ¡SINCRONIZACIÓN COMPLETADA CON ÉXITO ABSOLUTO!');
  console.log(`📊 Total de tablas locales: ${tables.length}`);
  console.log(`📦 Órdenes en local: ${ordenesCnt[0].c.toLocaleString()}`);
  console.log(`📦 Tareas en local: ${tareasCnt[0].c.toLocaleString()}`);
  console.log(`👥 Usuarios en local: ${usuariosCnt[0].c.toLocaleString()}`);
  console.log('================================================================\n');

  await localConn.end();
}

syncViaMysqldump().catch((err) => {
  console.error('\n❌ ERROR FATAL:', err);
  process.exit(1);
});
