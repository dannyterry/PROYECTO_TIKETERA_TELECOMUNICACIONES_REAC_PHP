const fs = require('fs');

const loginModelPath = 'C:\\xampp\\htdocs\\corporacionescepe\\app\\models\\LoginModel.php';
let code = fs.readFileSync(loginModelPath, 'utf8');

const regex = /public function obtenerModulo_\(\$id_rol\)[\s\S]*?return 'reportes';\s*\}/;

const replacement = `public function obtenerModulo_($id_rol)
    {
        switch ((int)$id_rol) {
            case 2: // TÉCNICO DE CAMPO
                return 'ordenes';
            case 4: // GESTIÓN
                return 'ordenes';
            case 5: // RECURSOS HUMANOS
                return 'recursos_humanos/usuarios';
            case 3: // ALMACÉN
                return 'inventario/stock';
            case 1: // ADMINISTRACIÓN
            case 6: // SUPERVISIÓN
            case 7: // OPERACIONES
            default:
                return 'reportes';
        }
    }`;

code = code.replace(regex, replacement);
fs.writeFileSync(loginModelPath, code, 'utf8');
console.log('✅ LoginModel.php updated with deterministic role redirections.');
