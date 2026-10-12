const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const targetZip = path.resolve('d:/proyectofinal/SOLO_CAMBIOS_BACKEND.zip');
const staging = path.resolve('d:/proyectofinal/temp_cambios');

if (fs.existsSync(targetZip)) fs.unlinkSync(targetZip);
if (fs.existsSync(staging)) fs.rmSync(staging, { recursive: true, force: true });

fs.mkdirSync(path.join(staging, 'services'), { recursive: true });
fs.copyFileSync(path.resolve('d:/proyectofinal/telecom-api/server.js'), path.join(staging, 'server.js'));
fs.copyFileSync(path.resolve('d:/proyectofinal/telecom-api/services/fenixScraper.js'), path.join(staging, 'services', 'fenixScraper.js'));

const psCmd = `Compress-Archive -Path '${staging}/*' -DestinationPath '${targetZip}' -Force`;
execSync(`powershell -Command "${psCmd}"`, { stdio: 'inherit' });
fs.rmSync(staging, { recursive: true, force: true });
console.log('✅ SOLO_CAMBIOS_BACKEND.zip generado:', (fs.statSync(targetZip).size / 1024).toFixed(2), 'KB');
