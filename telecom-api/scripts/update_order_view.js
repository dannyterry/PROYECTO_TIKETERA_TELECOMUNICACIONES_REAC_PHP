const fs = require('fs');

const orderViewPath = 'C:\\xampp\\htdocs\\corporacionescepe\\app\\views\\order\\index.php';

const newOrderPhp = `<?php
// app/views/order/index.php
$distHtml = dirname(__DIR__, 3) . '/public/dist_react/index.html';
$v = file_exists($distHtml) ? filemtime($distHtml) : time();

$userId = $_SESSION['auth']['id_usuario'] ?? $_SESSION['id_usuario'] ?? '';
$userName = $_SESSION['auth']['nombres'] ?? $_SESSION['auth']['nombre'] ?? $_SESSION['nombre'] ?? '';
if (!empty($_SESSION['auth']['apellidos'])) {
    $userName .= ' ' . $_SESSION['auth']['apellidos'];
}
$idRol = (int)($_SESSION['auth']['id_rol'] ?? 0);
$rolNombre = strtoupper(trim($_SESSION['auth']['rol'] ?? ''));

// Detectar si es técnico de campo (id_rol = 2)
$esTecnico = ($idRol === 2 || stripos($rolNombre, 'TECNIC') !== false);

// Si es técnico va directo a su portal móvil (#portal-tecnico)
// TODOS LOS DEMÁS (Gestión id_rol=4, Supervisión id_rol=6, Operaciones id_rol=7, Admin id_rol=1) van a la Grid de Órdenes (#ordenes)
$viewHash = $esTecnico ? '#portal-tecnico' : '#ordenes';
?>

<div class="row m-0 p-0" style="margin: -20px -24px !important;">
    <div class="col-12 p-0">
        <iframe 
            id="react-orders-frame"
            src="<?= url_assets('dist_react/index.html?v=' . $v . '&userId=' . urlencode($userId) . '&userName=' . urlencode($userName) . $viewHash) ?>" 
            style="width: 100%; height: calc(100vh - 70px); border: none; min-height: 850px; display: block; background: #f8fafc;"
            title="Módulo de Órdenes de Trabajo"
        ></iframe>
    </div>
</div>
`;

fs.writeFileSync(orderViewPath, newOrderPhp, 'utf8');
console.log('✅ app/views/order/index.php updated with proper role separation.');
