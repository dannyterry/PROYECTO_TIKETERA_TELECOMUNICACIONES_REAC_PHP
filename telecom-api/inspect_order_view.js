const fs = require('fs');

console.log('--- order/index.php ---');
console.log(fs.readFileSync('C:\\xampp\\htdocs\\corporacionescepe\\app\\views\\order\\index.php', 'utf8'));

console.log('--- header.php (primeras 50 lineas) ---');
console.log(fs.readFileSync('C:\\xampp\\htdocs\\corporacionescepe\\app\\views\\templates\\header.php', 'utf8').split('\n').slice(0, 50).join('\n'));
