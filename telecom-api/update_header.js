const fs = require('fs');
const path = 'C:/xampp/htdocs/corporacionescepe/app/views/templates/header.php';

let content = fs.readFileSync(path, 'utf8');

const targetOld = `                    <!-- Inventario -->
                    <?php
                    $verProductos   = puedeVer('productos',   $permisos, $es_admin);
                    $verCategorias  = puedeVer('categorias',  $permisos, $es_admin);
                    $verAlmacenes   = puedeVer('almacenes',   $permisos, $es_admin);
                    $verProveedores = puedeVer('proveedores', $permisos, $es_admin);
                    $verCompras     = puedeVer('compras',     $permisos, $es_admin);
                    $verMovimientos = puedeVer('movimientos', $permisos, $es_admin);
                    $verStock       = puedeVer('stock',       $permisos, $es_admin);
                    $hayInventario  = $verProductos || $verCategorias || $verAlmacenes
                        || $verProveedores || $verCompras || $verMovimientos || $verStock;

                    if ($hayInventario):
                    ?>
                        <li class="side-nav-item">
                            <a data-bs-toggle="collapse" href="#inventarioConfig" aria-expanded="false" class="side-nav-link">
                                <i class="uil-package"></i>
                                <span> Inventario </span>
                                <span class="menu-arrow"></span>
                            </a>
                            <div class="collapse" id="inventarioConfig">
                                <ul class="side-nav-second-level">
                                    <?php if ($verProductos):   ?><li><a href="<?= base_url() ?>inventario/productos">Productos</a></li><?php endif; ?>
                                    <?php if ($verCategorias):  ?><li><a href="<?= base_url() ?>inventario/categorias">Categorias</a></li><?php endif; ?>
                                    <?php if ($verAlmacenes):   ?><li><a href="<?= base_url() ?>inventario/almacenes">Almacenes</a></li><?php endif; ?>
                                    <?php if ($verProveedores): ?><li><a href="<?= base_url() ?>inventario/proveedores">Proveedores</a></li><?php endif; ?>
                                    <?php if ($verCompras):     ?><li><a href="<?= base_url() ?>inventario/compras">Compras</a></li><?php endif; ?>
                                    <?php if ($verMovimientos): ?><li><a href="<?= base_url() ?>inventario/movimientos">Movimientos</a></li><?php endif; ?>
                                    <?php if ($verStock):       ?><li><a href="<?= base_url() ?>inventario/stock">Stock</a></li><?php endif; ?>
                                </ul>
                            </div>
                        </li>
                    <?php endif; ?>`;

const targetNew = `                    <!-- Inventario -->
                    <?php
                    $verProductos   = puedeVer('productos',   $permisos, $es_admin);
                    $verCategorias  = puedeVer('categorias',  $permisos, $es_admin);
                    $verProveedores = puedeVer('proveedores', $permisos, $es_admin);
                    $hayInventario  = $verProductos || $verCategorias || $verProveedores;

                    if ($hayInventario):
                    ?>
                        <li class="side-nav-item">
                            <a data-bs-toggle="collapse" href="#inventarioConfig" aria-expanded="false" class="side-nav-link">
                                <i class="uil-package"></i>
                                <span> Inventario </span>
                                <span class="menu-arrow"></span>
                            </a>
                            <div class="collapse" id="inventarioConfig">
                                <ul class="side-nav-second-level">
                                    <?php if ($verProductos):   ?><li><a href="<?= base_url() ?>inventario/productos">Productos</a></li><?php endif; ?>
                                    <?php if ($verCategorias):  ?><li><a href="<?= base_url() ?>inventario/categorias">Categorias</a></li><?php endif; ?>
                                    <?php if ($verProveedores): ?><li><a href="<?= base_url() ?>inventario/proveedores">Proveedores</a></li><?php endif; ?>
                                </ul>
                            </div>
                        </li>
                    <?php endif; ?>`;

if (content.includes('<?php if ($verAlmacenes):')) {
  // Replace the old section
  content = content.replace(targetOld, targetNew);
  // Also if CRLF differences:
  if (content.includes('<?php if ($verAlmacenes):')) {
    const regex = /<!-- Inventario -->[\s\S]*?<\?php endif; \?>\r?\n\r?\n\s*<!-- Personal -->/;
    const replacement = `${targetNew}\n\n                    <!-- Personal -->`;
    content = content.replace(regex, replacement);
  }
  fs.writeFileSync(path, content, 'utf8');
  console.log('✅ header.php actualizado con éxito: se mantuvieron solo Productos, Categorias y Proveedores.');
} else {
  console.log('ℹ️ Ya estaba actualizado o no se encontró el bloque.');
}
