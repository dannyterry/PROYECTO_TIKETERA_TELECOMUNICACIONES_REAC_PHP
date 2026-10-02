const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function main() {
  console.log('📦 Generando archivos ZIP para despliegue en producción...\n');

  const rootDir = 'd:\\proyectofinal';
  const frontendDistDir = path.join(rootDir, 'mi-proyecto', 'dist');
  const frontendZip = path.join(rootDir, 'frontend_dist.zip');
  const backendDir = path.join(rootDir, 'telecom-api');
  const backendZip = path.join(rootDir, 'backend_deploy.zip');

  // 1. Eliminar zips anteriores si existen
  if (fs.existsSync(frontendZip)) fs.unlinkSync(frontendZip);
  if (fs.existsSync(backendZip)) fs.unlinkSync(backendZip);

  // 2. Compilar Frontend
  console.log('1️⃣ Compilando Frontend (npm run build)...');
  execSync('npm run build', { cwd: path.join(rootDir, 'mi-proyecto'), stdio: 'inherit' });
  console.log('✅ Build de Frontend completado con éxito.\n');

  // 3. Crear ZIP del Frontend (dist)
  console.log('2️⃣ Creando frontend_dist.zip...');
  const psFrontend = `Compress-Archive -Path "${frontendDistDir}\\*" -DestinationPath "${frontendZip}" -Force`;
  execSync(`powershell -Command "${psFrontend}"`, { stdio: 'inherit' });
  const fSizeMB = (fs.statSync(frontendZip).size / (1024 * 1024)).toFixed(2);
  console.log(`✅ Frontend ZIP creado: ${frontendZip} (${fSizeMB} MB)\n`);

  // 4. Crear ZIP del Backend (excluyendo node_modules, scratch, .git, dumps)
  console.log('3️⃣ Creando backend_deploy.zip con lo esencial...');
  
  // Archivos y carpetas esenciales del backend
  const backendItems = [
    'server.js',
    'package.json',
    'package-lock.json',
    'services',
    'routes',
    'config',
    'controllers',
    'models',
    'middlewares',
    'utils',
    'uploads',
    'public',
    'scripts'
  ];

  const validItems = backendItems
    .map(item => path.join(backendDir, item))
    .filter(p => fs.existsSync(p));

  const itemsString = validItems.map(p => `"${p}"`).join(', ');
  const psBackend = `Compress-Archive -Path ${itemsString} -DestinationPath "${backendZip}" -Force`;
  execSync(`powershell -Command "${psBackend}"`, { stdio: 'inherit' });
  
  const bSizeMB = (fs.statSync(backendZip).size / (1024 * 1024)).toFixed(2);
  console.log(`✅ Backend ZIP creado: ${backendZip} (${bSizeMB} MB)\n`);

  console.log('====================================================');
  console.log('🎉 PAQUETES LISTOS PARA SUBIR A PRODUCCIÓN:');
  console.log(`📁 Frontend: ${frontendZip} (${fSizeMB} MB) -> Subir a public_html/ o carpeta web`);
  console.log(`📁 Backend:  ${backendZip} (${bSizeMB} MB) -> Subir a tu servidor Node.js`);
  console.log('====================================================');
}

main().catch(console.error);
