const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const stagingDir = path.join('d:', 'proyecrh', 'staging_api');
const targetZip = path.join('d:', 'proyecrh', 'SUBIR_API_TELECOM_NODE.zip');

if (fs.existsSync(stagingDir)) {
  fs.rmSync(stagingDir, { recursive: true, force: true });
}
fs.mkdirSync(stagingDir, { recursive: true });

// Ensure db.js in staging has IS_PRODUCTION = true
let dbContent = fs.readFileSync(path.join('d:', 'proyecrh', 'telecom-api', 'db.js'), 'utf8');
dbContent = dbContent.replace(/const IS_PRODUCTION = false;/, 'const IS_PRODUCTION = true;');
fs.writeFileSync(path.join(stagingDir, 'db.js'), dbContent, 'utf8');

// Copy essential files
const filesToCopy = [
  'server.js',
  'looker_alert_service.js',
  'looker_session.json',
  'package.json',
  'package-lock.json'
];

for (const file of filesToCopy) {
  const src = path.join('d:', 'proyecrh', 'telecom-api', file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(stagingDir, file));
  }
}

// Copy services/
const servicesDir = path.join(stagingDir, 'services');
fs.mkdirSync(servicesDir, { recursive: true });
const fenixSrc = path.join('d:', 'proyecrh', 'telecom-api', 'services', 'fenixScraper.js');
if (fs.existsSync(fenixSrc)) {
  fs.copyFileSync(fenixSrc, path.join(servicesDir, 'fenixScraper.js'));
}

// Zip staging folder
if (fs.existsSync(targetZip)) {
  fs.unlinkSync(targetZip);
}

execSync(`powershell -Command "Compress-Archive -Path '${stagingDir}\\*' -DestinationPath '${targetZip}' -Force"`);

console.log('✅ Archivo ZIP generado con éxito:', targetZip);
