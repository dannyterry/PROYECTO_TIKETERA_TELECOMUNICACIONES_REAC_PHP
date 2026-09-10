const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('====================================================');
console.log('📦 COMPILANDO Y GENERANDO PAQUETES DE PRODUCCIÓN');
console.log('====================================================');

const baseDir = 'd:\\proyectofinal';
const miProyectoDir = path.join(baseDir, 'mi-proyecto');
const distReactSource = 'C:\\xampp\\htdocs\\corporacionescepe\\public\\dist_react';

// 1. Compilar React fresco con la corrección del login
console.log('\n🔵 [1/3] Compilando React (npm run build)...');
execSync('npm run build', { cwd: miProyectoDir, stdio: 'inherit' });
console.log('✅ React compilado con éxito.');

// 2. Crear paquete React PURO para public_html
console.log('\n🔵 [2/3] Generando paquete React Puro para public_html...');
const stagingWebDir = path.join(baseDir, 'staging_public_html');
if (fs.existsSync(stagingWebDir)) fs.rmSync(stagingWebDir, { recursive: true, force: true });
fs.mkdirSync(stagingWebDir, { recursive: true });

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach((child) => {
      copyRecursiveSync(path.join(src, child), path.join(dest, child));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

// Copiar todo el contenido de dist_react a staging
copyRecursiveSync(distReactSource, stagingWebDir);

// Crear .htaccess para React SPA
const htaccessContent = `<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteCond %{REQUEST_FILENAME} !-l
  RewriteRule . /index.html [L]
</IfModule>

# Configuración MIME y Cache
AddDefaultCharset UTF-8
<IfModule mod_headers.c>
  Header set X-Content-Type-Options "nosniff"
</IfModule>
`;
fs.writeFileSync(path.join(stagingWebDir, '.htaccess'), htaccessContent, 'utf8');

// Zipear paquete puro para public_html
const zipPuro = path.join(baseDir, 'frontend_react_puro_public_html.zip');
try { if (fs.existsSync(zipPuro)) fs.unlinkSync(zipPuro); } catch (e) {}

try {
  execSync(`tar -a -c -f "${zipPuro}" -C "${stagingWebDir}" .`, { stdio: 'pipe' });
} catch (e) {
  execSync(`powershell -Command "Start-Sleep -Milliseconds 800; Compress-Archive -Path '${stagingWebDir}\\*' -DestinationPath '${zipPuro}' -Force"`);
}

const statPuro = fs.statSync(zipPuro);
console.log(`✅ Paquete React Puro generado: ${zipPuro} (${(statPuro.size / 1024).toFixed(1)} KB)`);

// Limpiar staging
try { fs.rmSync(stagingWebDir, { recursive: true, force: true }); } catch (e) {}

// 3. Backend API Node
console.log('\n🟢 [3/3] Empaquetando Backend Node (telecom-api)...');
const stagingApiDir = path.join(baseDir, 'staging_api_temp');
if (fs.existsSync(stagingApiDir)) fs.rmSync(stagingApiDir, { recursive: true, force: true });
fs.mkdirSync(stagingApiDir, { recursive: true });

const filesToCopy = [
  'server.js',
  'db.js',
  'looker_alert_service.js',
  'looker_session.json',
  'cards_and_alerts.json',
  'package.json',
  'package-lock.json'
];

for (const f of filesToCopy) {
  const src = path.join(baseDir, 'telecom-api', f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(stagingApiDir, f));
  }
}

const srcServices = path.join(baseDir, 'telecom-api', 'services');
if (fs.existsSync(srcServices)) {
  copyRecursiveSync(srcServices, path.join(stagingApiDir, 'services'));
}

const zipApi = path.join(baseDir, 'telecom_api_listo_hosting.zip');
try { if (fs.existsSync(zipApi)) fs.unlinkSync(zipApi); } catch (e) {}

try {
  execSync(`tar -a -c -f "${zipApi}" -C "${stagingApiDir}" .`, { stdio: 'pipe' });
} catch (e) {
  execSync(`powershell -Command "Start-Sleep -Milliseconds 800; Compress-Archive -Path '${stagingApiDir}\\*' -DestinationPath '${zipApi}' -Force"`);
}

const statApi = fs.statSync(zipApi);
console.log(`✅ Backend API zipeado: ${zipApi} (${(statApi.size / 1024).toFixed(1)} KB)`);

// Limpiar staging
try { fs.rmSync(stagingApiDir, { recursive: true, force: true }); } catch (e) {}

console.log('\n====================================================');
console.log('🎉 ¡TODOS LOS PAQUETES LISTOS PARA SUBIR!');
console.log('1. frontend_react_puro_public_html.zip (Para poner directamente en public_html)');
console.log('2. telecom_api_listo_hosting.zip (Para api.corporacioncespedes.com)');
console.log('3. migracion_hosting_2026_09_09.sql (Para phpMyAdmin o ejecución directa)');
console.log('====================================================');
