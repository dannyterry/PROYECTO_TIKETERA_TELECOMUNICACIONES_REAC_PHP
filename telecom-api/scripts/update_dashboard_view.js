const fs = require('fs');

const dashboardViewPath = 'C:\\xampp\\htdocs\\corporacionescepe\\app\\views\\dashboard\\index.php';

const newDashboardPhp = `<?php
$userId = $_SESSION['id_usuario'] ?? '';
$userName = $_SESSION['nombre'] ?? '';
$distHtml = dirname(__DIR__, 2) . '/public/dist_react/index.html';
$v = file_exists($distHtml) ? filemtime($distHtml) : time();
?>
<div style="width: 100%; height: calc(100vh - 90px); min-height: 850px; margin: 0; padding: 0; overflow: hidden; background: #0f172a; border-radius: 20px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);">
    <iframe src="<?= base_url() ?>public/dist_react/index.html?v=<?= $v ?>&userId=<?= urlencode($userId) ?>&userName=<?= urlencode($userName) ?>#dashboard" style="width: 100%; height: 100%; border: none;" title="Panel Ejecutivo & Torre de Control"></iframe>
</div>
`;

fs.writeFileSync(dashboardViewPath, newDashboardPhp, 'utf8');
console.log('✅ Dashboard PHP view updated to load React ExecutiveDashboardPage.');
