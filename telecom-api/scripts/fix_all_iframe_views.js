const fs = require('fs');

const viewsToUpdate = [
  {
    path: 'C:\\xampp\\htdocs\\corporacionescepe\\app\\views\\human_resources\\user\\index.php',
    depth: 4,
    hash: 'personal',
    title: 'Módulo de Personal y RRHH',
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
  },
  {
    path: 'C:\\xampp\\htdocs\\corporacionescepe\\app\\views\\inventory\\stock\\index.php',
    depth: 4,
    hash: 'almacen',
    title: 'Stock General',
    bg: '#f8fafc'
  },
  {
    path: 'C:\\xampp\\htdocs\\corporacionescepe\\app\\views\\inventory\\product\\index.php',
    depth: 4,
    hash: 'almacen',
    title: 'Catálogo de Productos',
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
  }
];

viewsToUpdate.forEach(item => {
  if (fs.existsSync(item.path)) {
    const code = `<?php
$userId = $_SESSION['auth']['id_usuario'] ?? $_SESSION['id_usuario'] ?? '';
$userName = $_SESSION['auth']['nombres'] ?? $_SESSION['auth']['nombre'] ?? $_SESSION['nombre'] ?? '';
if (!empty($_SESSION['auth']['apellidos'])) {
    $userName .= ' ' . $_SESSION['auth']['apellidos'];
}
$distHtml = dirname(__DIR__, ${item.depth}) . '/public/dist_react/index.html';
$v = file_exists($distHtml) ? filemtime($distHtml) : time();
?>
<div style="width: 100%; height: calc(100vh - 80px); min-height: 850px; margin: 0; padding: 0; padding-top: 4px; overflow: hidden; border-radius: 16px; box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.08);">
    <iframe 
        src="<?= base_url() ?>public/dist_react/index.html?v=<?= $v ?>&userId=<?= urlencode($userId) ?>&userName=<?= urlencode($userName) ?>#${item.hash}" 
        style="width: 100%; height: 100%; border: none; display: block; background: ${item.bg};" 
        title="${item.title}"
    ></iframe>
</div>
`;
    fs.writeFileSync(item.path, code, 'utf8');
    console.log('✅ Updated:', item.path);
  }
});
