const fs = require('fs');

const controllerPath = 'C:\\xampp\\htdocs\\corporacionescepe\\app\\core\\Controller.php';
if (fs.existsSync(controllerPath)) {
  const content = fs.readFileSync(controllerPath, 'utf8');
  console.log('--- Controller.php (primeras 30 lineas) ---');
  console.log(content.split('\n').slice(0, 30).join('\n'));
}

const indexPath = 'C:\\xampp\\htdocs\\corporacionescepe\\public\\index.php';
if (fs.existsSync(indexPath)) {
  const content = fs.readFileSync(indexPath, 'utf8');
  console.log('--- public/index.php (primeras 20 lineas) ---');
  console.log(content.split('\n').slice(0, 20).join('\n'));
}
