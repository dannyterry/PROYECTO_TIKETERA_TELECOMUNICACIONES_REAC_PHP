const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const stagingPhpDir = path.join('d:', 'proyecrh', 'staging_php');
const zipPhp = path.join('d:', 'proyecrh', 'php_backend_listo_hosting.zip');

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

if (fs.existsSync(zipPhp)) fs.unlinkSync(zipPhp);
execSync(`powershell -Command "Compress-Archive -Path '${stagingPhpDir}\\*' -DestinationPath '${zipPhp}' -Force"`);
console.log('✅ Paquete PHP generado limpiamente:', zipPhp);
