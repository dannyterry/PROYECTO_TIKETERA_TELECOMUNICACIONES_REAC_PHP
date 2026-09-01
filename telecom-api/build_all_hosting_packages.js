const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('====================================================');
console.log('📦 GENERADOR DE PAQUETES DE PRODUCCIÓN PARA HOSTING');
console.log('====================================================');

// 1. COMPILAR FRONTEND REACT
console.log('\n🔵 [1/3] Compilando Frontend React (npm run build)...');
try {
  execSync('npm run build', { cwd: path.join('d:', 'proyecrh', 'mi-proyecto'), stdio: 'inherit' });
  console.log('✅ React compilado exitosamente.');
} catch (e) {
  console.error('❌ Error al compilar React:', e.message);
}

// 1.1 Zipear dist_react
const distReactDir = 'C:\\xampp\\htdocs\\corporacionescepe\\public\\dist_react';
const zipReact = path.join('d:', 'proyecrh', 'dist_react_listo_hosting.zip');
try { if (fs.existsSync(zipReact)) fs.unlinkSync(zipReact); } catch (e) {}

if (fs.existsSync(distReactDir)) {
  execSync(`powershell -Command "Compress-Archive -Path '${distReactDir}\\*' -DestinationPath '${zipReact}' -Force"`);
  console.log('📦 Paquete Frontend generado:', zipReact);
}

// 2. EMPAQUETAR NODE TELECOM API
console.log('\n🟢 [2/3] Empaquetando Backend Node (telecom-api)...');
const stagingApiDir = path.join('d:', 'proyecrh', 'staging_api');
if (fs.existsSync(stagingApiDir)) fs.rmSync(stagingApiDir, { recursive: true, force: true });
fs.mkdirSync(stagingApiDir, { recursive: true });

// Copiar db.js con IS_PRODUCTION = true
let dbContent = fs.readFileSync(path.join('d:', 'proyecrh', 'telecom-api', 'db.js'), 'utf8');
dbContent = dbContent.replace(/const IS_PRODUCTION = false;/, 'const IS_PRODUCTION = true;');
fs.writeFileSync(path.join(stagingApiDir, 'db.js'), dbContent, 'utf8');

// Copiar archivos esenciales
const apiFiles = [
  'server.js',
  'looker_alert_service.js',
  'looker_session.json',
  'package.json',
  'package-lock.json'
];

for (const file of apiFiles) {
  const src = path.join('d:', 'proyecrh', 'telecom-api', file);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(stagingApiDir, file));
}

// Copiar services
const apiServicesDir = path.join(stagingApiDir, 'services');
fs.mkdirSync(apiServicesDir, { recursive: true });
copyRecursiveSync(path.join('d:', 'proyecrh', 'telecom-api', 'services'), apiServicesDir);

const zipApi = path.join('d:', 'proyecrh', 'telecom_api_listo_hosting.zip');
try { if (fs.existsSync(zipApi)) fs.unlinkSync(zipApi); } catch (e) {}
execSync(`powershell -Command "Compress-Archive -Path '${stagingApiDir}\\*' -DestinationPath '${zipApi}' -Force"`);
console.log('📦 Paquete Node API generado:', zipApi);

// 3. EMPAQUETAR PHP BACKEND
console.log('\n🟣 [3/3] Empaquetando Backend PHP...');
const stagingPhpDir = path.join('d:', 'proyecrh', 'staging_php');
if (fs.existsSync(stagingPhpDir)) fs.rmSync(stagingPhpDir, { recursive: true, force: true });
fs.mkdirSync(stagingPhpDir, { recursive: true });

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

copyRecursiveSync('C:\\xampp\\htdocs\\corporacionescepe\\app', path.join(stagingPhpDir, 'app'));
if (fs.existsSync('C:\\xampp\\htdocs\\corporacionescepe\\index.php')) {
  fs.copyFileSync('C:\\xampp\\htdocs\\corporacionescepe\\index.php', path.join(stagingPhpDir, 'index.php'));
}

const zipPhp = path.join('d:', 'proyecrh', 'php_backend_listo_hosting.zip');
if (fs.existsSync(zipPhp)) fs.unlinkSync(zipPhp);
execSync(`powershell -Command "Compress-Archive -Path '${stagingPhpDir}\\*' -DestinationPath '${zipPhp}' -Force"`);
console.log('📦 Paquete PHP generado:', zipPhp);

console.log('\n====================================================');
console.log('🎉 ¡TODOS LOS PAQUETES FUERON GENERADOS CON ÉXITO!');
console.log('====================================================');
