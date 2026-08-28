const fs = require('fs');

const reportViewPath = 'C:\\xampp\\htdocs\\corporacionescepe\\app\\views\\report\\index.php';

const newReportPhp = `<?php
$userId = $_SESSION['id_usuario'] ?? '';
$userName = $_SESSION['nombre'] ?? '';
$distHtml = dirname(__DIR__, 2) . '/public/dist_react/index.html';
$v = file_exists($distHtml) ? filemtime($distHtml) : time();
?>
<div style="width: 100%; height: calc(100vh - 85px); min-height: 850px; margin: 0; padding: 0; overflow: hidden; background: #0f172a; border-radius: 20px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);">
    <iframe src="<?= base_url() ?>public/dist_react/index.html?v=<?= $v ?>&userId=<?= urlencode($userId) ?>&userName=<?= urlencode($userName) ?>#dashboard" style="width: 100%; height: 100%; border: none;" title="Panel Ejecutivo & Reportes React"></iframe>
</div>
`;

fs.writeFileSync(reportViewPath, newReportPhp, 'utf8');
console.log('✅ app/views/report/index.php updated to embed React ExecutiveDashboardPage.');
