const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('====================================================');
console.log('🚀 GENERANDO PAQUETES ZIP PARA SUBIR AL CPANEL');
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

// 1. COMPILAR FRONTEND REACT
console.log('\n🔵 [1/2] Compilando Frontend React con Vite...');
try {
  execSync('npm run build', { cwd: frontendDir, stdio: 'inherit' });
  console.log('✅ Build de React completado.');
} catch (e) {
  console.error('❌ Error compilando React:', e.message);
  process.exit(1);
}

// Zipear Frontend
const zipFrontend = path.join(outputDir, '1_FRONTEND_dist_react.zip');
if (fs.existsSync(distReactDir)) {
  execSync(`powershell -Command "Compress-Archive -Path '${distReactDir}\\*' -DestinationPath '${zipFrontend}' -Force"`);
  console.log('📦 ZIP Frontend generado:', zipFrontend);
} else {
  console.error('❌ No se encontró la carpeta dist_react en:', distReactDir);
}

// 2. EMPAQUETAR BACKEND TELECOM API (NODE.JS)
console.log('\n🟢 [2/2] Preparando Backend Node (telecom-api)...');
const stagingApiDir = path.join(outputDir, 'staging_api');
fs.mkdirSync(stagingApiDir, { recursive: true });

// Copiar db.js con configuración limpia para cPanel (localhost / Linux)
let dbContent = fs.readFileSync(path.join(apiDir, 'db.js'), 'utf8');
fs.writeFileSync(path.join(stagingApiDir, 'db.js'), dbContent, 'utf8');

// Archivos principales del API
const filesToCopy = [
  'server.js',
  'looker_alert_service.js',
  'cards_and_alerts.json',
  'package.json',
  'package-lock.json'
];

for (const file of filesToCopy) {
  const src = path.join(apiDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(stagingApiDir, file));
  }
}

// Copiar carpeta services/
const stagingServicesDir = path.join(stagingApiDir, 'services');
fs.mkdirSync(stagingServicesDir, { recursive: true });
const servicesSrc = path.join(apiDir, 'services');
if (fs.existsSync(servicesSrc)) {
  fs.readdirSync(servicesSrc).forEach((f) => {
    const sPath = path.join(servicesSrc, f);
    if (fs.statSync(sPath).isFile()) {
      fs.copyFileSync(sPath, path.join(stagingServicesDir, f));
    }
  });
}

// Crear carpeta uploads vacía con .gitkeep para cPanel
const stagingUploadsDir = path.join(stagingApiDir, 'uploads');
fs.mkdirSync(stagingUploadsDir, { recursive: true });
fs.writeFileSync(path.join(stagingUploadsDir, '.gitkeep'), '');

// Zipear API Node
const zipApi = path.join(outputDir, '2_BACKEND_telecom_api.zip');
execSync(`powershell -Command "Compress-Archive -Path '${stagingApiDir}\\*' -DestinationPath '${zipApi}' -Force"`);
console.log('📦 ZIP API Node generado:', zipApi);

// Limpiar staging temporal
fs.rmSync(stagingApiDir, { recursive: true, force: true });

console.log('\n====================================================');
console.log('🎉 ¡PAQUETES LISTOS PARA SUBIR A TU CPANEL!');
console.log('📁 Carpeta destino:', outputDir);
console.log('  1. ' + zipFrontend);
console.log('  2. ' + zipApi);
console.log('====================================================\n');
