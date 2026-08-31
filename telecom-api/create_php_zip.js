const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const targetZip = path.join('d:', 'proyecrh', 'SUBIR_PHP_ACTUALIZADO.zip');
const stagingDir = path.join('d:', 'proyecrh', 'staging_php');

if (fs.existsSync(stagingDir)) {
  fs.rmSync(stagingDir, { recursive: true, force: true });
}
fs.mkdirSync(stagingDir, { recursive: true });

// Copy app/
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

copyRecursiveSync('C:\\xampp\\htdocs\\corporacionescepe\\app', path.join(stagingDir, 'app'));

// Copy index.php
fs.copyFileSync('C:\\xampp\\htdocs\\corporacionescepe\\index.php', path.join(stagingDir, 'index.php'));

if (fs.existsSync(targetZip)) {
  fs.unlinkSync(targetZip);
}

execSync(`powershell -Command "Compress-Archive -Path '${stagingDir}\\*' -DestinationPath '${targetZip}' -Force"`);

console.log('✅ Archivo ZIP PHP generado con éxito:', targetZip);
