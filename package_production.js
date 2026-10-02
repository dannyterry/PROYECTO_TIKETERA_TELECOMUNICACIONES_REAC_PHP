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
const rootFiles = ['server.js', 'package.json', 'package-lock.json', 'db.js'];
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

const psBackend = `Compress-Archive -Path '${tempBackend}/*' -DestinationPath '${backendZip}' -Force`;
execSync(`powershell -Command "${psBackend}"`, { stdio: 'inherit' });
fs.rmSync(tempBackend, { recursive: true, force: true });
console.log('✅ BACKEND ZIP CREADO:', backendZip, 'Tamaño:', (fs.statSync(backendZip).size / 1024).toFixed(2), 'KB');
console.log('\n🎉 ¡AMBOS ARCHIVOS .ZIP LISTOS PARA SUBIR A CPANEL!');
