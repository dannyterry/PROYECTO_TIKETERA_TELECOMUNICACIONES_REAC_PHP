const fs = require('fs');

console.log('=== PermitModel.php modulos ===');
const model = fs.readFileSync('C:/xampp/htdocs/corporacionescepe/app/models/PermitModel.php', 'utf8');
console.log(model.slice(0, 1500));

console.log('=== function_permisos.js ===');
const js = fs.readFileSync('C:/xampp/htdocs/corporacionescepe/public/assets/js/function_permisos.js', 'utf8');
console.log(js.slice(0, 2000));
