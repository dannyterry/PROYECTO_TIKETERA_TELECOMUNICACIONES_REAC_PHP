const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔨 0. Compilando FRONTEND (npm run build en mi-proyecto)...');
const miProyectoDir = path.resolve('d:/proyectofinal/mi-proyecto');
execSync('npm run build', { cwd: miProyectoDir, stdio: 'inherit' });

console.log('\n📦 1. Empacando FRONTEND (dist) para public_html...');
const distDir = path.resolve('d:/proyectofinal/mi-proyecto/dist');
const frontendZip = path.resolve('d:/proyectofinal/SUBIR_FRONTEND_PUBLIC_HTML.zip');

if (fs.existsSync(frontendZip)) {
  fs.unlinkSync(frontendZip);
}

// PowerShell compress command for frontend
const psFrontend = `Compress-Archive -Path '${distDir}/*' -DestinationPath '${frontendZip}' -Force`;
execSync(`powershell -Command "${psFrontend}"`, { stdio: 'inherit' });
console.log('✅ FRONTEND ZIP CREADO:', frontendZip, 'Tamaño:', (fs.statSync(frontendZip).size / 1024).toFixed(2), 'KB');

console.log('\n📦 2. Empacando BACKEND (API) para api.corporacioncespedes.com...');
const apiDir = path.resolve('d:/proyectofinal/telecom-api');
const backendZip = path.resolve('d:/proyectofinal/SUBIR_BACKEND_API.zip');

if (fs.existsSync(backendZip)) {
  fs.unlinkSync(backendZip);
}

const tempBackend = path.resolve('d:/proyectofinal/temp_backend_pack');
if (fs.existsSync(tempBackend)) {
  fs.rmSync(tempBackend, { recursive: true, force: true });
}
fs.mkdirSync(tempBackend, { recursive: true });

// Copiar archivos raíz requeridos
const rootFiles = ['server.js', 'package.json', 'package-lock.json', 'db.js', '.env', 'looker_alert_service.js', 'cards_and_alerts.json'];
rootFiles.forEach(f => {
  const src = path.join(apiDir, f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(tempBackend, f));
  }
});

// Copiar carpetas necesarias (sin node_modules, sin uploads locales, sin scratch)
const folders = ['services', 'middleware', 'lib', 'scripts', 'public'];
folders.forEach(dir => {
  const srcDir = path.join(apiDir, dir);
  const destDir = path.join(tempBackend, dir);
  if (fs.existsSync(srcDir)) {
    fs.cpSync(srcDir, destDir, { recursive: true });
  }
});

// Asegurar carpeta uploads vacía para subida de fotos
const stagingUploads = path.join(tempBackend, 'uploads');
if (!fs.existsSync(stagingUploads)) {
  fs.mkdirSync(stagingUploads, { recursive: true });
}
const psBackend = `Compress-Archive -Path '${tempBackend}/*' -DestinationPath '${backendZip}' -Force`;
execSync(`powershell -Command "${psBackend}"`, { stdio: 'inherit' });
fs.rmSync(tempBackend, { recursive: true, force: true });
console.log('✅ BACKEND ZIP CREADO:', backendZip, 'Tamaño:', (fs.statSync(backendZip).size / 1024).toFixed(2), 'KB');

// 📦 3. Empacando SOLO CAMBIOS DEL BACKEND (rápido y seguro)
console.log('\n📦 3. Empacando SOLO CAMBIOS BACKEND (server.js + fenixScraper.js + migrar_fotos_s3.js)...');
const cambiosZip = path.resolve('d:/proyectofinal/SOLO_CAMBIOS_BACKEND.zip');
if (fs.existsSync(cambiosZip)) {
  fs.unlinkSync(cambiosZip);
}
const tempCambios = path.resolve('d:/proyectofinal/temp_cambios_pack');
if (fs.existsSync(tempCambios)) {
  fs.rmSync(tempCambios, { recursive: true, force: true });
}
fs.mkdirSync(path.join(tempCambios, 'services'), { recursive: true });
fs.mkdirSync(path.join(tempCambios, 'scripts'), { recursive: true });
fs.copyFileSync(path.join(apiDir, 'server.js'), path.join(tempCambios, 'server.js'));
fs.copyFileSync(path.join(apiDir, 'services', 'fenixScraper.js'), path.join(tempCambios, 'services', 'fenixScraper.js'));
if (fs.existsSync(path.join(apiDir, 'services', 's3Service.js'))) {
  fs.copyFileSync(path.join(apiDir, 'services', 's3Service.js'), path.join(tempCambios, 'services', 's3Service.js'));
}
if (fs.existsSync(path.join(apiDir, 'scripts', 'migrar_fotos_s3.js'))) {
  fs.copyFileSync(path.join(apiDir, 'scripts', 'migrar_fotos_s3.js'), path.join(tempCambios, 'scripts', 'migrar_fotos_s3.js'));
}

const psCambios = `Compress-Archive -Path '${tempCambios}/*' -DestinationPath '${cambiosZip}' -Force`;
execSync(`powershell -Command "${psCambios}"`, { stdio: 'inherit' });
fs.rmSync(tempCambios, { recursive: true, force: true });
console.log('✅ SOLO_CAMBIOS_BACKEND.zip CREADO:', cambiosZip, 'Tamaño:', (fs.statSync(cambiosZip).size / 1024).toFixed(2), 'KB');

console.log('\n🎉 ¡TODOS LOS ARCHIVOS .ZIP LISTOS PARA SUBIR A CPANEL!');

