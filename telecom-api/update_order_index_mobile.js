const fs = require('fs');

const orderIndexPath = 'C:\\xampp\\htdocs\\corporacionescepe\\app\\views\\order\\index.php';

const newContent = `<?php
$userId = $_SESSION['auth']['id_usuario'] ?? $_SESSION['id_usuario'] ?? '';
$userName = $_SESSION['auth']['nombres'] ?? $_SESSION['auth']['nombre'] ?? $_SESSION['nombre'] ?? '';
if (!empty($_SESSION['auth']['apellidos'])) {
    $userName .= ' ' . $_SESSION['auth']['apellidos'];
}
$userRol = (string)($_SESSION['auth']['id_rol'] ?? '');
$idRol = (int)($_SESSION['auth']['id_rol'] ?? 0);
$rolNombre = strtoupper(trim($_SESSION['auth']['rol'] ?? ''));
$esTecnico = ($idRol === 2 || stripos($rolNombre, 'TECNIC') !== false);
$viewHash = $esTecnico ? '#portal-tecnico' : '#ordenes';

$distHtml = dirname(__DIR__, 3) . '/public/dist_react/index.html';
$v = file_exists($distHtml) ? filemtime($distHtml) : time();
?>
<style>
    /* 🚫 Quitar el scroll general/externo del navegador y asegurar alto real */
    html, body {
        overflow: hidden !important;
        height: 100% !important;
        height: 100dvh !important;
        margin: 0 !important;
        padding: 0 !important;
    }

    .content-page {
        height: 100% !important;
        height: 100dvh !important;
        overflow: hidden !important;
        padding-bottom: 0 !important;
        display: flex !important;
        flex-direction: column !important;
        margin-left: 0 !important;
    }

    .content {
        flex: 1 1 auto !important;
        display: flex !important;
        flex-direction: column !important;
        overflow: hidden !important;
        padding: 0 !important;
        margin: 0 !important;
        height: 100% !important;
        height: 100dvh !important;
    }

    .container-fluid {
        flex: 1 1 auto !important;
        display: flex !important;
        flex-direction: column !important;
        height: 100% !important;
        height: 100dvh !important;
        padding: 0 !important;
        margin: 0 !important;
        overflow: hidden !important;
    }

    .footer {
        display: none !important;
    }

    .react-app-wrapper {
        width: 100% !important;
        height: 100% !important;
        height: 100dvh !important;
        flex: 1 1 auto !important;
        overflow: hidden !important;
        background: #f8fafc;
        position: relative !important;
    }

    .react-app-wrapper iframe {
        width: 100% !important;
        height: 100% !important;
        height: 100dvh !important;
        border: none !important;
        display: block !important;
    }

    /* 📱 MODO MÓVIL Y MODO TÉCNICO (Pantalla Completa Inmersiva) */
    <?php if ($esTecnico): ?>
    .navbar-custom, .leftside-menu {
        display: none !important;
    }
    .content-page {
        margin-left: 0 !important;
        padding: 0 !important;
    }
    .react-app-wrapper {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        width: 100vw !important;
        height: 100dvh !important;
        z-index: 9999 !important;
    }
    <?php else: ?>
    @media (max-width: 768px) {
        .navbar-custom, .leftside-menu {
            display: none !important;
        }
        .content-page {
            margin-left: 0 !important;
            padding: 0 !important;
        }
        .react-app-wrapper {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 100vw !important;
            height: 100dvh !important;
            z-index: 9999 !important;
        }
    }
    <?php endif; ?>

    /* 🟢 Botón flotante discreto arriba para volver o ver menú cuando se requiera */
    .btn-toggle-menu-tec {
        position: fixed;
        top: 8px;
        right: 8px;
        z-index: 100000;
        background: rgba(15, 23, 42, 0.85);
        color: #fff;
        border: 1px solid rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(8px);
        padding: 4px 10px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 4px;
        opacity: 0.4;
        transition: opacity 0.2s ease, transform 0.2s ease;
    }
    .btn-toggle-menu-tec:hover, .btn-toggle-menu-tec:active {
        opacity: 1;
        transform: scale(1.05);
    }
</style>

<!-- Botón flotante para salir o ver menú PHP -->
<a href="<?= base_url() ?>login/logout" class="btn-toggle-menu-tec" title="Cerrar Sesión">
    <span>🚪 Salir</span>
</a>

<div class="react-app-wrapper">
    <iframe 
        id="reactAppIframe"
        src="<?= base_url() ?>public/dist_react/index.html?v=<?= $v ?>&userId=<?= urlencode($userId) ?>&userName=<?= urlencode($userName) ?>&userRol=<?= urlencode($userRol) ?>&rolNombre=<?= urlencode($rolNombre) ?><?= $viewHash ?>" 
        title="Módulo de Órdenes de Trabajo"
    ></iframe>
</div>

<script>
// Ajuste dinámico de altura exacta para evitar recortes en celulares
function resetAppHeight() {
    var vh = window.innerHeight;
    var iframe = document.getElementById('reactAppIframe');
    if (iframe) {
        iframe.style.height = vh + 'px';
    }
}
window.addEventListener('resize', resetAppHeight);
window.addEventListener('orientationchange', function() {
    setTimeout(resetAppHeight, 200);
});
resetAppHeight();
</script>
`;

fs.writeFileSync(orderIndexPath, newContent, 'utf8');
console.log('✅ app/views/order/index.php actualizado con modo pantalla completa 100dvh y auto-ocultamiento de barras');
