<?php
// app/views/templates/header.php — REEMPLAZAR COMPLETO
// CAMBIOS: Menú con condicionales de permisos desde $_SESSION['auth']
// El Administrador (id_rol=1) ve todo. Los demás solo ven lo que tienen permiso.

$permisos   = $_SESSION['auth']['permisos'] ?? [];
$id_rol     = $_SESSION['auth']['id_rol']   ?? 0;
$es_admin   = ($id_rol == 1);

// Helper: ¿puede ver este módulo?
function puedeVer($modulo, $permisos, $es_admin)
{
    if ($es_admin) return true;
    return in_array($modulo . '.ver', $permisos);
}
?>





<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="utf-8" />
    <title><?= NAME_EMPRESA ?></title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta content="A fully featured admin theme which can be used to build CRM, CMS, etc." name="description" />
    <meta content="Coderthemes" name="author" />
    <link rel="shortcut icon" href="<?= url_assets() ?>assets/images/LOGO_CORPORACION_SM.png" />
    <link href="<?= url_assets() ?>assets/css/vendor/dataTables.bootstrap5.css" rel="stylesheet" type="text/css" />
    <link href="<?= url_assets() ?>assets/css/vendor/responsive.bootstrap5.css" rel="stylesheet" type="text/css" />
    <link href="<?= url_assets() ?>assets/css/vendor/buttons.bootstrap5.css" rel="stylesheet" type="text/css" />
    <link href="<?= url_assets() ?>assets/css/vendor/select.bootstrap5.css" rel="stylesheet" type="text/css" />
    <link href="<?= url_assets() ?>assets/css/vendor/fixedHeader.bootstrap5.css" rel="stylesheet" type="text/css" />
    <link href="<?= url_assets() ?>assets/css/vendor/fixedColumns.bootstrap5.css" rel="stylesheet" type="text/css" />
    <link href="<?= url_assets() ?>assets/css/icons.min.css" rel="stylesheet" type="text/css" />
    <link href="<?= url_assets() ?>assets/css/app.min.css" rel="stylesheet" type="text/css" id="app-style" />
</head>

<style>
    .ocultar {
        display: none;
    }

    /* El tema Hyper estira el body a 1600px cuando el sidebar está en modo
       condensado, generando un gran espacio en blanco bajo el contenido.
       Lo neutralizamos: el body se ajusta al alto real de la página. */
    body[data-leftbar-compact-mode="condensed"]:not(.authentication-bg) {
        min-height: 0 !important;
    }

    /* ---- Notificaciones ---- */
    .notif-badge {
        position: absolute;
        top: 15px;
        right: 5px;
        min-width: 18px;
        height: 18px;
        padding: 0 5px;
        border-radius: 9px;
        background: #fa5c7c;
        color: #fff;
        font-size: 10px;
        font-weight: 700;
        line-height: 18px;
        text-align: center;
    }
    .notif-dropdown {
        width: 360px;
        max-width: calc(100vw - 24px);
    }
    .notif-body {
        max-height: 460px;
        overflow-y: auto;
    }
    .notif-item {
        display: flex !important;
        align-items: flex-start;
        gap: 12px;
        padding: 12px 16px !important;
        border-bottom: 1px solid #eef2f7;
    }
    .notif-item.unread-noti {
        background: #eef4ff;
    }
    .notif-item.unread-noti:hover {
        background: #e0ecff;
    }
    .notif-item.read-noti {
        background: #fff;
        opacity: .9;
    }
    .notif-item .notify-icon {
        float: none;
        flex: 0 0 auto;
    }
    .notif-item .notify-details {
        margin: 0;
        flex: 1 1 auto;
        min-width: 0;
    }
    .notif-titulo {
        display: block;
        font-weight: 600;
        font-size: .85rem;
        line-height: 1.3;
        color: #313a46;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .notif-mensaje {
        display: block;
        font-size: .78rem;
        line-height: 1.35;
        margin-top: 2px;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
    .notif-fecha {
        display: block;
        font-size: .7rem;
        margin-top: 3px;
    }
    .notif-punto {
        display: inline-block;
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #0d6efd;
        margin-left: 5px;
        vertical-align: middle;
    }
    .notif-icon-danger {
        background: #fdeaea;
        color: #dc3545;
    }
    .notif-icon-warning {
        background: #fff4e0;
        color: #f0ad4e;
    }
    .notif-icon-info {
        background: #e3f4fd;
        color: #0dcaf0;
    }
    .notif-icon-secondary {
        background: #eef2f7;
        color: #6c757d;
    }
</style>

<body class="loading"
    data-layout-color="light"
    data-leftbar-theme="dark"
    data-layout-mode="fluid"
    data-leftbar-compact-mode="condensed"
    data-rightbar-onstart="true">
    <div class="wrapper">

        <!-- ========== Left Sidebar ========== -->
        <div class="leftside-menu">
            <a href="index.html" class="logo text-center logo-light">
                <span class="logo-lg">
                    <img src="<?= url_assets() ?>assets/images/LOGO_CORPORACION_DARK.png" alt="" height="48" />
                </span>
                <span class="logo-sm">
                    <img src="<?= url_assets() ?>assets/images/LOGO_CORPORACION_SM_DARK.png" alt="" height="32" />
                </span>
            </a>
            <a href="index.html" class="logo text-center logo-dark">
                <span class="logo-lg"><img src="<?= url_assets() ?>assets/images/logo-dark.png" alt="" height="16" /></span>
                <span class="logo-sm"><img src="<?= url_assets() ?>assets/images/logo_sm_dark.png" alt="" height="16" /></span>
            </a>

            <div class="h-100" id="leftside-menu-container" data-simplebar>
                <ul class="side-nav">
                    <li class="side-nav-title side-nav-item">Sistema</li>

                    <!-- Dashboard -->
                    <?php if (puedeVer('dashboard', $permisos, $es_admin)): ?>
                        <li class="side-nav-item">
                            <a href="<?= base_url() ?>reportes" class="side-nav-link">
                                <i class="uil-home-alt"></i>
                                <span> Dashboard </span>
                            </a>
                        </li>
                    <?php endif; ?>

                    <!-- Órdenes -->
                    <?php if (puedeVer('ordenes', $permisos, $es_admin)): ?>
                        <li class="side-nav-item">
                            <a href="<?= base_url() ?>ordenes" class="side-nav-link">
                                <i class="uil-clipboard-alt"></i>
                                <span> Órdenes </span>
                            </a>
                        </li>
                    <?php endif; ?>

                    <!-- Liquidaciones -->
                    <?php if (puedeVer('liquidaciones', $permisos, $es_admin)): ?>
                        <li class="side-nav-item">
                            <a href="<?= base_url() ?>liquidaciones" class="side-nav-link">
                                <i class="uil-invoice"></i>
                                <span> Liquidaciones </span>
                            </a>
                        </li>
                    <?php endif; ?>

                    <!-- Pagos a técnicos -->
                    <?php if (puedeVer('pagos', $permisos, $es_admin)): ?>
                        <li class="side-nav-item">
                            <a href="<?= base_url() ?>pagos" class="side-nav-link">
                                <i class="uil-usd-circle"></i>
                                <span> Pagos </span>
                            </a>
                        </li>
                    <?php endif; ?>

                    <!-- Correos -->
                    <?php if (puedeVer('correos', $permisos, $es_admin)): ?>
                        <li class="side-nav-item">
                            <a href="<?= base_url() ?>correos" class="side-nav-link">
                                <i class="uil-envelope"></i>
                                <span> Correos </span>
                            </a>
                        </li>
                    <?php endif; ?>

                    <!-- Configuración -->
                    <?php
                    $verMotivos = puedeVer('motivos', $permisos, $es_admin);
                    $verTipoTrabajo = puedeVer('tipo_trabajo', $permisos, $es_admin);
                    $verSistema = puedeVer('configuracion', $permisos, $es_admin);
                    if ($verMotivos || $verTipoTrabajo || $verSistema):
                    ?>
                        <li class="side-nav-item">
                            <a data-bs-toggle="collapse" href="#Config" aria-expanded="false" class="side-nav-link">
                                <i class="uil-cog"></i>
                                <span> Configuración </span>
                                <span class="menu-arrow"></span>
                            </a>
                            <div class="collapse" id="Config">
                                <ul class="side-nav-second-level">
                                    <?php if ($verMotivos): ?>
                                        <li><a href="<?= base_url() ?>configuracion/motivos">Motivos</a></li>
                                    <?php endif; ?>

                                    <?php if ($verTipoTrabajo): ?>
                                        <li><a href="<?= base_url() ?>configuracion/tipo_trabajo">Tipos de trabajo</a></li>
                                    <?php endif; ?>

                                    <?php if ($verSistema): ?>
                                        <li><a href="<?= base_url() ?>configuracion/sistema">Sistema</a></li>
                                    <?php endif; ?>
                                </ul>
                            </div>
                        </li>
                    <?php endif; ?>

                    <!-- Recursos Humanos -->
                    <?php
                    $verUsuarios    = puedeVer('usuarios',     $permisos, $es_admin);
                    $verRoles       = puedeVer('roles',        $permisos, $es_admin);
                    $verPermisos    = puedeVer('permisos',     $permisos, $es_admin);
                    $verHorarios    = puedeVer('horarios',     $permisos, $es_admin);
                    $verAsistencias = puedeVer('asistencias',  $permisos, $es_admin);
                    $hayRRHH        = $verUsuarios || $verRoles || $verPermisos || $verHorarios || $verAsistencias;

                    if ($hayRRHH):
                    ?>
                        <li class="side-nav-item">
                            <a data-bs-toggle="collapse" href="#rrhhConfig" aria-expanded="false" class="side-nav-link">
                                <i class="uil-user-square"></i>
                                <span> Recursos Humanos </span>
                                <span class="menu-arrow"></span>
                            </a>
                            <div class="collapse" id="rrhhConfig">
                                <ul class="side-nav-second-level">
                                    <?php if ($verUsuarios): ?>
                                        <li><a href="<?= base_url() ?>recursos_humanos/usuarios">Personal / Empleados</a></li>
                                    <?php endif; ?>
                                    <?php if ($verRoles): ?>
                                        <li><a href="<?= base_url() ?>recursos_humanos/roles">Roles</a></li>
                                    <?php endif; ?>
                                    <?php if ($verPermisos): ?>
                                        <li><a href="<?= base_url() ?>recursos_humanos/permisos">Permisos</a></li>
                                    <?php endif; ?>
                                    <?php if ($verHorarios): ?>
                                        <li><a href="<?= base_url() ?>recursos_humanos/horarios">Horarios</a></li>
                                    <?php endif; ?>
                                    <?php if ($verAsistencias): ?>
                                        <li><a href="<?= base_url() ?>recursos_humanos/asistencias">Asistencias</a></li>
                                    <?php endif; ?>
                                </ul>
                            </div>
                        </li>
                    <?php endif; ?>

                    <!-- Inventario -->
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
                    <?php endif; ?>

                    <!-- Personal -->
                    <?php if (puedeVer('trabajadores', $permisos, $es_admin)): ?>
                        <li class="side-nav-item">
                            <a data-bs-toggle="collapse" href="#personal" class="side-nav-link">
                                <i class="uil-users-alt"></i>
                                <span> Personal </span>
                                <span class="menu-arrow"></span>
                            </a>
                            <div class="collapse" id="personal">
                                <ul class="side-nav-second-level">
                                    <li><a href="<?= base_url() ?>personal/trabajadores">Trabajadores</a></li>
                                </ul>
                            </div>
                        </li>
                    <?php endif; ?>

                    <!-- Movilidad -->
                    <?php
                    $verVehiculos       = puedeVer('vehiculos',      $permisos, $es_admin);
                    $verMarcas          = puedeVer('marcas',         $permisos, $es_admin);
                    $verModelos         = puedeVer('modelos',        $permisos, $es_admin);
                    $verTiposVehiculo   = puedeVer('tipos_vehiculo', $permisos, $es_admin);
                    $verCombustibles    = puedeVer('combustibles',   $permisos, $es_admin);
                    $hayMovilidad = $verVehiculos || $verMarcas || $verModelos || $verTiposVehiculo || $verCombustibles;

                    if ($hayMovilidad):
                    ?>
                        <li class="side-nav-item">
                            <a data-bs-toggle="collapse" href="#vehiculosMenu" class="side-nav-link">
                                <i class="uil-car"></i>
                                <span> Movilidad </span>
                                <span class="menu-arrow"></span>
                            </a>
                            <div class="collapse" id="vehiculosMenu">
                                <ul class="side-nav-second-level">
                                    <?php if ($verVehiculos): ?>
                                        <li><a href="<?= base_url() ?>movilidad/vehiculos">Vehículos</a></li>
                                    <?php endif; ?>
                                    <?php if ($verMarcas): ?>
                                        <li><a href="<?= base_url() ?>movilidad/marcas">Marcas</a></li>
                                    <?php endif; ?>
                                    <?php if ($verModelos): ?>
                                        <li><a href="<?= base_url() ?>movilidad/modelos">Modelos</a></li>
                                    <?php endif; ?>
                                    <?php if ($verTiposVehiculo): ?>
                                        <li><a href="<?= base_url() ?>movilidad/tipos_vehiculo">Tipos de vehículo</a></li>
                                    <?php endif; ?>

                                </ul>
                            </div>
                        </li>
                    <?php endif; ?>

                    <!-- Reportes -->
                    <!-- <li class="side-nav-item">
                        <a href="<?= base_url() ?>reportes" class="side-nav-link">
                            <i class="uil-file-alt"></i>
                            <span> Reportes </span>
                        </a>
                    </li> -->

                </ul>
                <div class="clearfix"></div>
            </div>
        </div>
        <!-- Left Sidebar End -->

        <div class="content-page">
            <div class="content">
                <!-- Topbar -->
                <div class="navbar-custom">
                    <ul class="list-unstyled topbar-menu float-end mb-0">

                        <!-- RECARGAR PÁGINA SIN CACHÉ -->
                        <li class="dropdown notification-list" id="liRecargarGlobal">
                            <a class="nav-link" href="#" id="btnRecargarGlobal"
                                role="button"
                                title="Recargar página sin caché (equivale a Ctrl+F5)">
                                <i class="mdi mdi-refresh noti-icon"></i>
                            </a>
                        </li>

                        <script>
                            // Recarga de raíz sin usar caché en cualquier
                            // dispositivo. location.reload(true) ya no funciona
                            // en navegadores modernos, así que se agrega un
                            // parámetro único a la URL para forzar la descarga
                            // limpia (equivale a Ctrl+F5).
                            document.addEventListener("DOMContentLoaded", function () {
                                var btn = document.getElementById("btnRecargarGlobal");
                                if (!btn) return;
                                btn.addEventListener("click", function (e) {
                                    e.preventDefault();
                                    var url = new URL(window.location.href);
                                    url.searchParams.delete("_cb");
                                    url.searchParams.set("_cb", Date.now());
                                    window.location.href = url.toString();
                                });
                            });
                        </script>

                        <!-- NOTIFICACIONES -->
                        <?php
                        $notificaciones = $notificaciones ?? [];
                        $total_no_leidas = (int)($total_no_leidas ?? 0);

                        if (!function_exists('_tiempo_relativo')) {
                            function _tiempo_relativo($fecha)
                            {
                                $diff = time() - strtotime($fecha);
                                if ($diff < 60) return 'Ahora';
                                if ($diff < 3600) return floor($diff / 60) . ' min';
                                if ($diff < 86400) return floor($diff / 3600) . ' h';
                                if ($diff < 604800) return floor($diff / 86400) . ' d';
                                return date('d M', strtotime($fecha));
                            }
                        }

                        $_iconos_notif = [
                            'stock'               => ['mdi-package-variant', 'danger'],
                            'soat_por_vencer'     => ['mdi-car-clock', 'warning'],
                            'soat_vencido'        => ['mdi-alert-circle', 'danger'],
                            'revision_por_vencer' => ['mdi-wrench-clock', 'warning'],
                            'revision_vencida'    => ['mdi-alert-outline', 'danger'],
                            'mantenimiento'       => ['mdi-tools', 'info'],
                        ];
                        ?>
                        <li class="dropdown notification-list">

                            <a class="nav-link dropdown-toggle arrow-none"
                                data-bs-toggle="dropdown"
                                href="#"
                                role="button"
                                aria-expanded="false">

                                <i class="dripicons-bell noti-icon"></i>

                                <?php if ($total_no_leidas > 0) { ?>
                                    <span class="notif-badge" id="notifBadge"><?= $total_no_leidas ?></span>
                                <?php } ?>

                            </a>

                            <div class="dropdown-menu dropdown-menu-end dropdown-menu-animated dropdown-lg py-0 notif-dropdown">

                                <!-- HEADER -->
                                <div class="p-3 d-flex align-items-center justify-content-between border-bottom border-dashed">

                                    <div>
                                        <h6 class="m-0 font-16 fw-semibold">Notificaciones</h6>
                                        <small class="text-muted" id="notifResumen">
                                            <?= $total_no_leidas > 0 ? $total_no_leidas . ' sin leer' : 'Todo leído' ?>
                                        </small>
                                    </div>

                                    <?php if ($total_no_leidas > 0) { ?>
                                        <button type="button" class="btn btn-sm btn-outline-primary" id="btnMarcarLeidas">
                                            Marcar todas
                                        </button>
                                    <?php } ?>

                                </div>

                                <!-- BODY -->
                                <div class="notif-body">

                                    <?php if (empty($notificaciones)) { ?>

                                        <div class="p-5 text-center text-muted">
                                            <i class="mdi mdi-bell-off font-24 d-block mb-2"></i>
                                            No hay notificaciones
                                        </div>

                                    <?php } else { ?>

                                        <?php foreach ($notificaciones as $n) { ?>

                                            <?php
                                            $_icono = $_iconos_notif[$n->tipo] ?? ['mdi-bell-ring', 'secondary'];
                                            $_leida = ((int)$n->leida === 1);
                                            ?>

                                            <a href="<?= base_url() ?>notificaciones/ir/<?= (int)$n->id ?>"
                                                class="dropdown-item notify-item notif-item <?= $_leida ? 'read-noti' : 'unread-noti' ?>">

                                                <span class="notify-icon notif-icon-<?= $_icono[1] ?>">
                                                    <i class="mdi <?= $_icono[0] ?>"></i>
                                                </span>

                                                <p class="notify-details notif-detalles">
                                                    <span class="notif-titulo">
                                                        <?= htmlspecialchars($n->titulo) ?>
                                                        <?php if (!$_leida) { ?>
                                                            <span class="notif-punto"></span>
                                                        <?php } ?>
                                                    </span>
                                                    <small class="text-muted notif-mensaje"><?= htmlspecialchars($n->mensaje) ?></small>
                                                    <small class="notif-fecha"><?= _tiempo_relativo($n->fecha_creacion) ?></small>
                                                </p>

                                            </a>

                                        <?php } ?>

                                    <?php } ?>

                                </div>

                                <!-- FOOTER -->
                                <?php if (!empty($notificaciones)) { ?>
                                    <div class="p-2 text-center border-top">
                                        <small class="text-muted">Toca una notificación para ir al módulo</small>
                                    </div>
                                <?php } ?>

                            </div>
                        </li>

                        <script>
                            document.addEventListener("DOMContentLoaded", function () {
                                const btnMarcar = document.getElementById("btnMarcarLeidas");
                                if (!btnMarcar) return;

                                btnMarcar.addEventListener("click", function () {
                                    btnMarcar.disabled = true;
                                    btnMarcar.textContent = "Procesando...";

                                    fetch("<?= base_url() ?>notificaciones/marcar_todas", {
                                        method: "POST"
                                    })
                                        .then(function (r) { return r.json(); })
                                        .then(function (res) {
                                            const badge = document.getElementById("notifBadge");
                                            if (badge) badge.remove();
                                            const resumen = document.getElementById("notifResumen");
                                            if (resumen) resumen.textContent = "Todo leído";
                                            document.querySelectorAll(".notif-item.unread-noti").forEach(function (el) {
                                                el.classList.remove("unread-noti");
                                                el.classList.add("read-noti");
                                                const punto = el.querySelector(".notif-punto");
                                                if (punto) punto.remove();
                                            });
                                            btnMarcar.remove();
                                        })
                                        .catch(function () {
                                            btnMarcar.disabled = false;
                                            btnMarcar.textContent = "Marcar todas";
                                        });
                                });
                            });
                        </script>



                        <li class="dropdown notification-list">
                            <a class="nav-link dropdown-toggle nav-user arrow-none me-0"
                                data-bs-toggle="dropdown" href="#" role="button">
                                <span class="account-user-avatar">
                                    <?php

                                    $_avatar_img = $_SESSION['auth']['img_usuario'] ?? null;
                                    $_avatar_src = $_avatar_img
                                        ? url_assets() . RUTA_IMG_USUARIO_HEADER . $_avatar_img
                                        : url_assets() . 'assets/images/users/avatar-1.jpg';
                                    ?>
                                    <img src="<?= $_avatar_src ?>"
                                        alt="user-image"
                                        class="rounded-circle"
                                        style="width:32px;height:32px;object-fit:cover;"
                                        onerror="this.src='<?= url_assets() ?>assets/images/users/avatar-1.jpg'" />

                                </span>
                                <span>
                                    <span class="account-user-name"><?= htmlspecialchars($_SESSION['auth']['nombres']) ?></span>
                                    <span class="account-position"><?= htmlspecialchars($_SESSION['auth']['rol']) ?></span>
                                </span>
                            </a>
                            <div class="dropdown-menu dropdown-menu-end dropdown-menu-animated topbar-dropdown-menu profile-dropdown">
                                <div class="dropdown-header noti-title">
                                    <h6 class="text-overflow m-0">Bienvenido!</h6>
                                </div>
                                <a href="<?= base_url() ?>login/salir" class="dropdown-item notify-item">
                                    <i class="mdi mdi-logout me-1"></i>
                                    <span>Salir</span>
                                </a>
                            </div>
                        </li>
                    </ul>
                    <button class="button-menu-mobile open-left">
                        <i class="mdi mdi-menu"></i>
                    </button>
                </div>
                <!-- end Topbar -->

                <div class="container-fluid">
                    <?php if (empty($ocultar_titulo)): ?>
                        <div class="row">
                            <div class="col-12">
                                <div class="page-title-box">
                                    <div class="page-title-right">
                                        <ol class="breadcrumb m-0">
                                            <li class="breadcrumb-item">
                                                <a href="<?= base_url() ?>"><?= NAME_EMPRESA ?></a>
                                            </li>
                                            <li class="breadcrumb-item active"><?= $titulo ?></li>
                                        </ol>
                                    </div>
                                    <h4 class="page-title"><?= $titulo ?></h4>
                                </div>
                            </div>
                        </div>
                    <?php endif; ?>
