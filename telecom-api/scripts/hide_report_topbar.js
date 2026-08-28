const fs = require('fs');

// 1. Update ReportController.php
const reportCtrlPath = 'C:\\xampp\\htdocs\\corporacionescepe\\app\\controllers\\ReportController.php';
let reportCtrlCode = fs.readFileSync(reportCtrlPath, 'utf8');

reportCtrlCode = reportCtrlCode.replace(
    /'titulo'\s*=>\s*'Reportes',/,
    `'titulo' => 'Reportes',\n            'ocultar_titulo' => true,`
);
fs.writeFileSync(reportCtrlPath, reportCtrlCode, 'utf8');
console.log('✅ ReportController.php updated with ocultar_titulo => true');

// 2. Update DashboardController.php
const dashCtrlPath = 'C:\\xampp\\htdocs\\corporacionescepe\\app\\controllers\\DashboardController.php';
let dashCtrlCode = fs.readFileSync(dashCtrlPath, 'utf8');
if (!dashCtrlCode.includes("'ocultar_titulo' => true")) {
  dashCtrlCode = dashCtrlCode.replace(
      /\$data\s*=\s*\[/,
      `$data = [\n            'ocultar_titulo' => true,`
  );
  fs.writeFileSync(dashCtrlPath, dashCtrlCode, 'utf8');
  console.log('✅ DashboardController.php updated with ocultar_titulo => true');
}

// 3. Update report/index.php view
const reportViewPath = 'C:\\xampp\\htdocs\\corporacionescepe\\app\\views\\report\\index.php';
const newReportPhp = `<?php
$userId = $_SESSION['auth']['id_usuario'] ?? $_SESSION['id_usuario'] ?? '';
$userName = $_SESSION['auth']['nombres'] ?? $_SESSION['auth']['nombre'] ?? $_SESSION['nombre'] ?? '';
if (!empty($_SESSION['auth']['apellidos'])) {
    $userName .= ' ' . $_SESSION['auth']['apellidos'];
}
$distHtml = dirname(__DIR__, 2) . '/public/dist_react/index.html';
$v = file_exists($distHtml) ? filemtime($distHtml) : time();
?>
<div class="row m-0 p-0" style="margin: -25px -24px -20px -24px !important;">
    <div class="col-12 p-0">
        <iframe 
            src="<?= base_url() ?>public/dist_react/index.html?v=<?= $v ?>&userId=<?= urlencode($userId) ?>&userName=<?= urlencode($userName) ?>#dashboard" 
            style="width: 100%; height: calc(100vh - 70px); min-height: 880px; border: none; display: block; background: #0f172a;" 
            title="Panel Ejecutivo & Reportes React"
        ></iframe>
    </div>
</div>
`;
fs.writeFileSync(reportViewPath, newReportPhp, 'utf8');
console.log('✅ app/views/report/index.php updated with full panorama styling');

// 4. Update dashboard/index.php view
const dashboardViewPath = 'C:\\xampp\\htdocs\\corporacionescepe\\app\\views\\dashboard\\index.php';
const newDashboardPhp = `<?php
$userId = $_SESSION['auth']['id_usuario'] ?? $_SESSION['id_usuario'] ?? '';
$userName = $_SESSION['auth']['nombres'] ?? $_SESSION['auth']['nombre'] ?? $_SESSION['nombre'] ?? '';
if (!empty($_SESSION['auth']['apellidos'])) {
    $userName .= ' ' . $_SESSION['auth']['apellidos'];
}
$distHtml = dirname(__DIR__, 2) . '/public/dist_react/index.html';
$v = file_exists($distHtml) ? filemtime($distHtml) : time();
?>
<div class="row m-0 p-0" style="margin: -25px -24px -20px -24px !important;">
    <div class="col-12 p-0">
        <iframe 
            src="<?= base_url() ?>public/dist_react/index.html?v=<?= $v ?>&userId=<?= urlencode($userId) ?>&userName=<?= urlencode($userName) ?>#dashboard" 
            style="width: 100%; height: calc(100vh - 70px); min-height: 880px; border: none; display: block; background: #0f172a;" 
            title="Panel Ejecutivo & Torre de Control"
        ></iframe>
    </div>
</div>
`;
fs.writeFileSync(dashboardViewPath, newDashboardPhp, 'utf8');
console.log('✅ app/views/dashboard/index.php updated with full panorama styling');
