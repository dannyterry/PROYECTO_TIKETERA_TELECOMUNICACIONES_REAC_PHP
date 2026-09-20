const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('====================================================');
console.log('📦 GENERANDO PAQUETES OPTIMIZADOS PARA SUBIR AL HOSTING');
console.log('====================================================');

const projectRoot = path.resolve(__dirname, '..');
const apiDir = path.join(projectRoot, 'telecom-api');
const frontendDir = path.join(projectRoot, 'mi-proyecto');
const distReactDir = 'C:\\xampp\\htdocs\\corporacionescepe\\public\\dist_react';

const outputDir = path.join(projectRoot, 'PAQUETES_SUBIR_HOSTING');
if (fs.existsSync(outputDir)) {
  fs.rmSync(outputDir, { recursive: true, force: true });
}
fs.mkdirSync(outputDir, { recursive: true });

// ----------------------------------------------------
// 1. FRONTEND: COMPILAR CON VITE Y ZIPEAR
// ----------------------------------------------------
console.log('\n🔵 [1/3] Compilando Frontend React...');
try {
  execSync('npm run build', { cwd: frontendDir, stdio: 'inherit' });
  console.log('✅ Build de React completado con éxito.');
} catch (e) {
  console.error('❌ Error compilando React:', e.message);
  process.exit(1);
}

const zipFrontend = path.join(outputDir, '1_FRONTEND_dist_react.zip');
if (fs.existsSync(distReactDir)) {
  execSync(`powershell -Command "Compress-Archive -Path '${distReactDir}\\*' -DestinationPath '${zipFrontend}' -Force"`);
  console.log('📦 ZIP Frontend generado:', zipFrontend);
} else {
  console.error('❌ No se encontró dist_react en:', distReactDir);
}

// ----------------------------------------------------
// 2. BACKEND: SOLO LOS ARCHIVOS ESTRICTAMENTE NECESARIOS
// ----------------------------------------------------
console.log('\n🟢 [2/3] Preparando Backend Node (telecom-api)...');
const stagingApiDir = path.join(outputDir, 'staging_api');
fs.mkdirSync(stagingApiDir, { recursive: true });

// Copiar db.js
fs.copyFileSync(path.join(apiDir, 'db.js'), path.join(stagingApiDir, 'db.js'));

// Copiar server.js y dependencias indispensables
const coreFiles = [
  'server.js',
  'package.json',
  'package-lock.json',
  'looker_alert_service.js',
  'cards_and_alerts.json'
];

for (const file of coreFiles) {
  const src = path.join(apiDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(stagingApiDir, file));
  }
}

// Copiar solo carpetas de código necesarias: lib/ y services/
function copyDirRecursive(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyDirRecursive(path.join(apiDir, 'lib'), path.join(stagingApiDir, 'lib'));
copyDirRecursive(path.join(apiDir, 'services'), path.join(stagingApiDir, 'services'));

// Carpeta uploads vacía con .gitkeep
const stagingUploadsDir = path.join(stagingApiDir, 'uploads');
fs.mkdirSync(stagingUploadsDir, { recursive: true });
fs.writeFileSync(path.join(stagingUploadsDir, '.gitkeep'), '');

// Zipear Backend
const zipBackend = path.join(outputDir, '2_BACKEND_telecom_api.zip');
execSync(`powershell -Command "Compress-Archive -Path '${stagingApiDir}\\*' -DestinationPath '${zipBackend}' -Force"`);
console.log('📦 ZIP Backend generado:', zipBackend);

// Limpiar staging temporal
fs.rmSync(stagingApiDir, { recursive: true, force: true });

// ----------------------------------------------------
// 3. BASE DE DATOS: COPIAR SCRIPT DE MIGRACIÓN
// ----------------------------------------------------
console.log('\n🟡 [3/3] Copiando script de base de datos para Producción...');
const sqlSrc = path.join(apiDir, 'backups', 'migracion_alinear_trabajadores_prod.sql');
const sqlDest = path.join(outputDir, '3_BASE_DE_DATOS_migracion_alinear_prod.sql');
if (fs.existsSync(sqlSrc)) {
  fs.copyFileSync(sqlSrc, sqlDest);
  console.log('📄 SQL de migración copiado:', sqlDest);
}

console.log('\n====================================================');
console.log('🎉 ¡TODOS LOS PAQUETES ESTÁN LISTOS!');
console.log('📁 Carpeta: ' + outputDir);
console.log('   1️⃣  1_FRONTEND_dist_react.zip (Descomprimir en public/dist_react)');
console.log('   2️⃣  2_BACKEND_telecom_api.zip (Descomprimir en la raíz de tu Node App)');
console.log('   3️⃣  3_BASE_DE_DATOS_migracion_alinear_prod.sql (Importar o ejecutar en phpMyAdmin)');
console.log('====================================================\n');
