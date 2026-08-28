const fs = require('fs');

// 1. report/index.php
const reportViewPath = 'C:\\xampp\\htdocs\\corporacionescepe\\app\\views\\report\\index.php';
const reportContent = `<?php
$userId = $_SESSION['auth']['id_usuario'] ?? $_SESSION['id_usuario'] ?? '';
$userName = $_SESSION['auth']['nombres'] ?? $_SESSION['auth']['nombre'] ?? $_SESSION['nombre'] ?? '';
if (!empty($_SESSION['auth']['apellidos'])) {
    $userName .= ' ' . $_SESSION['auth']['apellidos'];
}
$distHtml = dirname(__DIR__, 2) . '/public/dist_react/index.html';
$v = file_exists($distHtml) ? filemtime($distHtml) : time();
?>
<div style="width: 100%; height: calc(100vh - 85px); min-height: 850px; margin: 0; padding: 0; padding-top: 6px; overflow: hidden; border-radius: 18px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.25);">
    <iframe 
        src="<?= base_url() ?>public/dist_react/index.html?v=<?= $v ?>&userId=<?= urlencode($userId) ?>&userName=<?= urlencode($userName) ?>#dashboard" 
        style="width: 100%; height: 100%; border: none; display: block; background: #0f172a;" 
        title="Panel Ejecutivo & Reportes React"
    ></iframe>
</div>
`;
fs.writeFileSync(reportViewPath, reportContent, 'utf8');

// 2. dashboard/index.php
const dashboardViewPath = 'C:\\xampp\\htdocs\\corporacionescepe\\app\\views\\dashboard\\index.php';
const dashboardContent = `<?php
$userId = $_SESSION['auth']['id_usuario'] ?? $_SESSION['id_usuario'] ?? '';
$userName = $_SESSION['auth']['nombres'] ?? $_SESSION['auth']['nombre'] ?? $_SESSION['nombre'] ?? '';
if (!empty($_SESSION['auth']['apellidos'])) {
    $userName .= ' ' . $_SESSION['auth']['apellidos'];
}
$distHtml = dirname(__DIR__, 2) . '/public/dist_react/index.html';
$v = file_exists($distHtml) ? filemtime($distHtml) : time();
?>
<div style="width: 100%; height: calc(100vh - 85px); min-height: 850px; margin: 0; padding: 0; padding-top: 6px; overflow: hidden; border-radius: 18px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.25);">
    <iframe 
        src="<?= base_url() ?>public/dist_react/index.html?v=<?= $v ?>&userId=<?= urlencode($userId) ?>&userName=<?= urlencode($userName) ?>#dashboard" 
        style="width: 100%; height: 100%; border: none; display: block; background: #0f172a;" 
        title="Panel Ejecutivo & Torre de Control"
    ></iframe>
</div>
`;
fs.writeFileSync(dashboardViewPath, dashboardContent, 'utf8');

// 3. order/index.php
const orderViewPath = 'C:\\xampp\\htdocs\\corporacionescepe\\app\\views\\order\\index.php';
const orderContent = `<?php
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
// TODOS LOS DEMÁS van a la Grid de Órdenes (#ordenes)
$viewHash = $esTecnico ? '#portal-tecnico' : '#ordenes';
?>
<div style="width: 100%; height: calc(100vh - 85px); min-height: 850px; margin: 0; padding: 0; padding-top: 6px; overflow: hidden; border-radius: 18px; box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.08);">
    <iframe 
        id="react-orders-frame"
        src="<?= url_assets('dist_react/index.html?v=' . $v . '&userId=' . urlencode($userId) . '&userName=' . urlencode($userName) . $viewHash) ?>" 
        style="width: 100%; height: 100%; border: none; display: block; background: #f8fafc;"
        title="Módulo de Órdenes de Trabajo"
    ></iframe>
</div>
`;
fs.writeFileSync(orderViewPath, orderContent, 'utf8');

// 4. inventory/stock/index.php
const stockViewPath = 'C:\\xampp\\htdocs\\corporacionescepe\\app\\views\\inventory\\stock\\index.php';
const stockContent = `<?php
$userId = $_SESSION['auth']['id_usuario'] ?? $_SESSION['id_usuario'] ?? '';
$userName = $_SESSION['auth']['nombres'] ?? $_SESSION['auth']['nombre'] ?? $_SESSION['nombre'] ?? '';
if (!empty($_SESSION['auth']['apellidos'])) {
    $userName .= ' ' . $_SESSION['auth']['apellidos'];
}
$distHtml = dirname(__DIR__, 4) . '/public/dist_react/index.html';
$v = file_exists($distHtml) ? filemtime($distHtml) : time();
?>
<div style="width: 100%; height: calc(100vh - 85px); min-height: 850px; margin: 0; padding: 0; padding-top: 6px; overflow: hidden; border-radius: 18px; box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.08);">
    <iframe src="<?= base_url() ?>public/dist_react/index.html?v=<?= $v ?>&userId=<?= urlencode($userId) ?>&userName=<?= urlencode($userName) ?>#almacen" style="width: 100%; height: 100%; border: none; display: block; background: #f8fafc;" title="Stock General"></iframe>
</div>
`;
fs.writeFileSync(stockViewPath, stockContent, 'utf8');

console.log('✅ All PHP views standardized with clean padding and no navbar clipping!');
