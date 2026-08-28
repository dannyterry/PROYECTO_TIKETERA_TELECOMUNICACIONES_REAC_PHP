const fs = require('fs');
const path = require('path');

const inventoryViewsDir = 'C:\\xampp\\htdocs\\corporacionescepe\\app\\views\\inventory';
const viewDirs = ['buy', 'store', 'motion', 'product', 'stock'];

const hashMapping = {
  buy: '#compras',
  store: '#compras',
  motion: '#despacho',
  product: '#almacen',
  stock: '#almacen'
};

const titleMapping = {
  buy: 'Compras de Inventario',
  store: 'Compras de Inventario',
  motion: 'Despacho de Materiales',
  product: 'Catálogo de Productos',
  stock: 'Stock General'
};

for (const dir of viewDirs) {
  const filePath = path.join(inventoryViewsDir, dir, 'index.php');
  if (fs.existsSync(filePath)) {
    const hash = hashMapping[dir] || '#almacen';
    const title = titleMapping[dir] || 'Inventario';
    const content = `<?php
$userId = $_SESSION['id_usuario'] ?? '';
$userName = $_SESSION['nombre'] ?? '';
$distHtml = dirname(__DIR__, 4) . '/public/dist_react/index.html';
$v = file_exists($distHtml) ? filemtime($distHtml) : time();
?>
<div style="width: 100%; height: calc(100vh - 110px); min-height: 800px; margin: 0; padding: 0; overflow: hidden; background: #f8fafc; border-radius: 16px;">
    <iframe src="<?= base_url() ?>public/dist_react/index.html?v=<?= $v ?>&userId=<?= urlencode($userId) ?>&userName=<?= urlencode($userName) ?>${hash}" style="width: 100%; height: 100%; border: none;" title="${title}"></iframe>
</div>
`;
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ Updated:', filePath);
  }
}
