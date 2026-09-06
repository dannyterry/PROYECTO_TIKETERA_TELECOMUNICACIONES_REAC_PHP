<?php
$userId = $_SESSION['auth']['id_usuario'] ?? $_SESSION['id_usuario'] ?? '';
$userName = $_SESSION['auth']['nombres'] ?? $_SESSION['auth']['nombre'] ?? $_SESSION['nombre'] ?? '';
if (!empty($_SESSION['auth']['apellidos'])) {
    $userName .= ' ' . $_SESSION['auth']['apellidos'];
}
$userRol = (string)($_SESSION['auth']['id_rol'] ?? '');
$rolNombre = strtoupper(trim($_SESSION['auth']['rol'] ?? ''));

$distHtml = dirname(__DIR__, 2) . '/public/dist_react/index.html';
$v = file_exists($distHtml) ? filemtime($distHtml) : time();
?>
<style>
    /* 🚫 Quitar el scroll general/externo del navegador */
    html, body {
        overflow: hidden !important;
        height: 100vh !important;
    }
    .content-page {
        height: 100vh !important;
        overflow: hidden !important;
        padding-bottom: 0 !important;
        display: flex !important;
        flex-direction: column !important;
    }
    .content {
        flex: 1 1 auto !important;
        display: flex !important;
        flex-direction: column !important;
        overflow: hidden !important;
        padding-bottom: 0 !important;
        margin-bottom: 0 !important;
    }
    .container-fluid {
        flex: 1 1 auto !important;
        display: flex !important;
        flex-direction: column !important;
        height: calc(100vh - 70px) !important;
        padding: 0 14px 10px 14px !important;
        overflow: hidden !important;
    }
    .footer {
        display: none !important;
    }
    .react-app-wrapper {
        width: 100% !important;
        height: 100% !important;
        flex: 1 1 auto !important;
        overflow: hidden !important;
        border-radius: 16px !important;
        box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.15) !important;
        background: #0f172a;
    }
    .react-app-wrapper iframe {
        width: 100% !important;
        height: 100% !important;
        border: none !important;
        display: block !important;
    }
</style>

<div class="react-app-wrapper">
    <iframe 
        src="<?= base_url() ?>public/dist_react/index.html?v=<?= $v ?>&userId=<?= urlencode($userId) ?>&userName=<?= urlencode($userName) ?>&userRol=<?= urlencode($userRol) ?>&rolNombre=<?= urlencode($rolNombre) ?>#dashboard" 
        title="Panel Ejecutivo & Torre de Control"
    ></iframe>
</div>
