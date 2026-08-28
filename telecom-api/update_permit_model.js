const fs = require('fs');

const path = 'C:/xampp/htdocs/corporacionescepe/app/models/PermitModel.php';
let content = fs.readFileSync(path, 'utf8');

// 1. Modificar modulo ordenes para agregar ver_stock
content = content.replace(
  "'ordenes'       => ['nombre' => 'Órdenes',         'acciones' => ['ver', 'crear', 'editar', 'eliminar', 'liquidar', 'sincronizar']]",
  "'ordenes'       => ['nombre' => 'Órdenes',         'acciones' => ['ver', 'crear', 'editar', 'eliminar', 'liquidar', 'sincronizar', 'ver_stock']]"
);

// 2. Modificar acciones para agregar ver_stock
content = content.replace(
  "'enviar'      => 'Enviar',\n        ];",
  "'enviar'      => 'Enviar',\n            'ver_stock'   => 'Ver Stock',\n        ];"
);

fs.writeFileSync(path, content, 'utf8');
console.log('✅ PermitModel.php actualizado con la casilla Ver Stock!');
