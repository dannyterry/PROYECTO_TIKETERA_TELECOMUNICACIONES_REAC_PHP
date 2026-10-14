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

  // 5. Crear SOLO_CAMBIOS_BACKEND.zip (ultra-ligero)
  console.log('4️⃣ Creando SOLO_CAMBIOS_BACKEND.zip (solo los archivos modificados)...');
  const soloCambiosZip = path.join(rootDir, 'SOLO_CAMBIOS_BACKEND.zip');
  const tmpSoloDir = path.join(rootDir, 'telecom-api', 'scratch', 'solo_cambios_dir');
  if (fs.existsSync(tmpSoloDir)) fs.rmSync(tmpSoloDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(tmpSoloDir, 'services'), { recursive: true });
  fs.mkdirSync(path.join(tmpSoloDir, 'scripts'), { recursive: true });

  fs.copyFileSync(path.join(backendDir, 'server.js'), path.join(tmpSoloDir, 'server.js'));
  fs.copyFileSync(path.join(backendDir, 'services', 'fenixScraper.js'), path.join(tmpSoloDir, 'services', 'fenixScraper.js'));
  fs.copyFileSync(path.join(backendDir, 'services', 'taskSyncService.js'), path.join(tmpSoloDir, 'services', 'taskSyncService.js'));
  fs.copyFileSync(path.join(backendDir, 'services', 's3Service.js'), path.join(tmpSoloDir, 'services', 's3Service.js'));
  fs.copyFileSync(path.join(backendDir, 'scripts', 'migrar_base64_a_s3.js'), path.join(tmpSoloDir, 'scripts', 'migrar_base64_a_s3.js'));

  const psSolo = `Compress-Archive -Path "${tmpSoloDir}\\*" -DestinationPath "${soloCambiosZip}" -Force`;
  execSync(`powershell -Command "${psSolo}"`, { stdio: 'inherit' });
  fs.rmSync(tmpSoloDir, { recursive: true, force: true });

  const sSizeKB = (fs.statSync(soloCambiosZip).size / 1024).toFixed(1);
  console.log(`✅ SOLO_CAMBIOS_BACKEND.zip creado: ${soloCambiosZip} (${sSizeKB} KB)\n`);

  console.log('====================================================');
  console.log('🎉 PAQUETES LISTOS PARA SUBIR A PRODUCCIÓN:');
  console.log(`📁 Frontend: ${frontendZip} (${fSizeMB} MB) -> Subir a public_html/`);
  console.log(`📁 Backend Completo: ${backendZip} (${bSizeMB} MB) -> Subir a servidor Node.js`);
  console.log(`⚡ Solo Cambios: ${soloCambiosZip} (${sSizeKB} KB) -> (Recomendado) Extraer directo en api`);
  console.log('====================================================');
}

main().catch(console.error);
