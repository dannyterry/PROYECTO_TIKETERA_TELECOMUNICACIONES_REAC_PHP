const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = 'd:\\proyectofinal';
const backendZip = path.join(rootDir, 'SOLO_CAMBIOS_BACKEND.zip');
const frontendZip = path.join(rootDir, 'frontend_dist.zip');
const tmpDir = path.join(rootDir, 'telecom-api', 'scratch', 'pkg_backend_tmp');

if (fs.existsSync(backendZip)) fs.unlinkSync(backendZip);
if (fs.existsSync(frontendZip)) fs.unlinkSync(frontendZip);
if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });

fs.mkdirSync(path.join(tmpDir, 'services'), { recursive: true });
fs.mkdirSync(path.join(tmpDir, 'scripts'), { recursive: true });

fs.copyFileSync(path.join(rootDir, 'telecom-api', 'server.js'), path.join(tmpDir, 'server.js'));
fs.copyFileSync(path.join(rootDir, 'telecom-api', 'services', 'fenixScraper.js'), path.join(tmpDir, 'services', 'fenixScraper.js'));
fs.copyFileSync(path.join(rootDir, 'telecom-api', 'services', 's3Service.js'), path.join(tmpDir, 'services', 's3Service.js'));
fs.copyFileSync(path.join(rootDir, 'telecom-api', 'scripts', 'migrar_base64_a_s3.js'), path.join(tmpDir, 'scripts', 'migrar_base64_a_s3.js'));

console.log('1. Comprimiendo SOLO_CAMBIOS_BACKEND.zip...');
execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${tmpDir}\\*' -DestinationPath '${backendZip}' -Force"`);
fs.rmSync(tmpDir, { recursive: true, force: true });

console.log('2. Comprimiendo frontend_dist.zip...');
const distDir = path.join(rootDir, 'mi-proyecto', 'dist');
execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${distDir}\\*' -DestinationPath '${frontendZip}' -Force"`);

const bStat = fs.statSync(backendZip);
const fStat = fs.statSync(frontendZip);
console.log(`✅ Backend zip creado: ${(bStat.size / 1024).toFixed(1)} KB`);
console.log(`✅ Frontend zip creado: ${(fStat.size / 1024 / 1024).toFixed(2)} MB`);
