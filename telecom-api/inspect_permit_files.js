const fs = require('fs');

console.log('=== PermitModel.php ===');
console.log(fs.readFileSync('C:/xampp/htdocs/corporacionescepe/app/models/PermitModel.php', 'utf8').slice(0, 2000));

console.log('=== PermitController.php ===');
console.log(fs.readFileSync('C:/xampp/htdocs/corporacionescepe/app/controllers/PermitController.php', 'utf8').slice(0, 2000));

console.log('=== index.php ===');
console.log(fs.readFileSync('C:/xampp/htdocs/corporacionescepe/app/views/human_resources/permit/index.php', 'utf8').slice(0, 2000));
