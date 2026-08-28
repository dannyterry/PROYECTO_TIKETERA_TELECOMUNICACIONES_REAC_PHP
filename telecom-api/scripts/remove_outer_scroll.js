const fs = require('fs');

const views = [
  {
    path: 'C:\\xampp\\htdocs\\corporacionescepe\\app\\views\\human_resources\\user\\index.php',
    depth: 4,
    hash: 'personal',
    title: 'Módulo de Personal y RRHH',
    bg: '#f8fafc'
  },
  {
    path: 'C:\\xampp\\htdocs\\corporacionescepe\\app\\views\\order\\index.php',
    depth: 3,
    hash: 'ordenes',
    isOrder: true,
    title: 'Módulo de Órdenes de Trabajo',
    bg: '#f8fafc'
  },
  {
    path: 'C:\\xampp\\htdocs\\corporacionescepe\\app\\views\\report\\index.php',
    depth: 2,
    hash: 'dashboard',
    title: 'Panel Ejecutivo & Reportes React',
    bg: '#0f172a'
  },
  {
    path: 'C:\\xampp\\htdocs\\corporacionescepe\\app\\views\\dashboard\\index.php',
    depth: 2,
    hash: 'dashboard',
    title: 'Panel Ejecutivo & Torre de Control',
    bg: '#0f172a'
  },
  {
    path: 'C:\\xampp\\htdocs\\corporacionescepe\\app\\views\\inventory\\product\\index.php',
    depth: 4,
    hash: 'almacen',
    title: 'Catálogo de Productos',
    bg: '#f8fafc'
  },
  {
    path: 'C:\\xampp\\htdocs\\corporacionescepe\\app\\views\\inventory\\stock\\index.php',
    depth: 4,
    hash: 'almacen',
    title: 'Stock General',
    bg: '#f8fafc'
  },
  {
    path: 'C:\\xampp\\htdocs\\corporacionescepe\\app\\views\\inventory\\buy\\index.php',
    depth: 4,
    hash: 'compras',
    title: 'Compras de Inventario',
    bg: '#f8fafc'
  },
  {
    path: 'C:\\xampp\\htdocs\\corporacionescepe\\app\\views\\inventory\\store\\index.php',
    depth: 4,
    hash: 'almacen',
    title: 'Almacenes',
    bg: '#f8fafc'
  },
  {
    path: 'C:\\xampp\\htdocs\\corporacionescepe\\app\\views\\inventory\\motion\\index.php',
    depth: 4,
    hash: 'despacho',
    title: 'Despacho de Materiales',
    bg: '#f8fafc'
  },
  {
    path: 'C:\\xampp\\htdocs\\corporacionescepe\\app\\views\\mobility\\vehicle\\index.php',
    depth: 4,
    hash: 'vehiculos',
    title: 'Módulo de Vehículos',
    bg: '#f8fafc'
  },
  {
    path: 'C:\\xampp\\htdocs\\corporacionescepe\\app\\views\\mobility\\fuel\\index.php',
    depth: 4,
    hash: 'combustibles',
    title: 'Módulo de Combustibles',
    bg: '#f8fafc'
  }
];

views.forEach(item => {
  if (fs.existsSync(item.path)) {
    let orderRoleLogic = '';
    let targetHash = `#${item.hash}`;

    if (item.isOrder) {
      orderRoleLogic = `
$idRol = (int)($_SESSION['auth']['id_rol'] ?? 0);
$rolNombre = strtoupper(trim($_SESSION['auth']['rol'] ?? ''));
$esTecnico = ($idRol === 2 || stripos($rolNombre, 'TECNIC') !== false);
$viewHash = $esTecnico ? '#portal-tecnico' : '#ordenes';
`;
      targetHash = '<?= $viewHash ?>';
    }

    const template = `<?php
$userId = $_SESSION['auth']['id_usuario'] ?? $_SESSION['id_usuario'] ?? '';
$userName = $_SESSION['auth']['nombres'] ?? $_SESSION['auth']['nombre'] ?? $_SESSION['nombre'] ?? '';
if (!empty($_SESSION['auth']['apellidos'])) {
    $userName .= ' ' . $_SESSION['auth']['apellidos'];
}
$userRol = (string)($_SESSION['auth']['id_rol'] ?? '');
$rolNombre = strtoupper(trim($_SESSION['auth']['rol'] ?? ''));
${orderRoleLogic}
$distHtml = dirname(__DIR__, ${item.depth}) . '/public/dist_react/index.html';
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
        background: ${item.bg};
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
        src="<?= base_url() ?>public/dist_react/index.html?v=<?= $v ?>&userId=<?= urlencode($userId) ?>&userName=<?= urlencode($userName) ?>&userRol=<?= urlencode($userRol) ?>&rolNombre=<?= urlencode($rolNombre) ?>${targetHash}" 
        title="${item.title}"
    ></iframe>
</div>
`;

    fs.writeFileSync(item.path, template, 'utf8');
    console.log('✅ Updated with role parameters:', item.path);
  }
});
