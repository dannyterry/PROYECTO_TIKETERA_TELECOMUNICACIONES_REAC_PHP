<?php
// app/config/constants.php — REEMPLAZAR COMPLETO

// ── Detección de entorno (Localhost vs Producción) ──────────────────────────
$isLocal = (!isset($_SERVER['HTTP_HOST']) || $_SERVER['HTTP_HOST'] === 'localhost' || $_SERVER['HTTP_HOST'] === '127.0.0.1' || strpos($_SERVER['HTTP_HOST'], 'localhost:') === 0);

if ($isLocal) {
    define('DB_HOST',     'localhost');
    define('DB_NAME',     'corporacionescepe_cespedes');
    define('DB_USER',     'root');
    define('DB_PASSWORD', '');
    define('BASE_URL',    'http://localhost/corporacionescepe/');
} else {
    // Configuración para el Hosting / Producción
    define('DB_HOST',     'localhost');
    define('DB_NAME',     'corporacioncespe_cespedes');
    define('DB_USER',     'corporacioncespe_miguel');
    define('DB_PASSWORD', 'corporacioncespe_123');
    define('BASE_URL',    'https://corporacioncespedes.com/');
}

// ── Rutas de imágenes (siempre hardcoded) ─────────────────────────────────
define('RUTA_IMG_VEHICULO', 'public/uploads/vehiculos/');
define('RUTA_IMG_USUARIO',  'public/uploads/usuarios/');
define('RUTA_IMG_USUARIO_HEADER',  'uploads/usuarios/');
define('RUTA_IMG_PRODUCTO', 'public/uploads/productos/');

// ── APIs externas (siempre hardcoded) ─────────────────────────────────────
define('API_DNI_URL',        'https://apiperu.dev/api/dni');
define('API_RUC_URL',        'https://apiperu.dev/api/ruc');
define('API_CONSULTA_TOKEN', 'Bearer fda7b7234f457a51ff7ef8a2dd6ea44e0d72854989987514c2f1c3432192e727');

// ── URLs del sistema WIN (siempre hardcoded) ──────────────────────────────
define('TR_URL_GRILLA',             'https://winbo-phx.azurewebsites.net/Paginas/OperadoresBO/misOrdenes.aspx/cargarGrilla');
define('TR_URL_ESTADO',             'https://winbo-phx.azurewebsites.net/Paginas/OrdenTrabajo/Formulario.aspx/CargarHistoEstaGrilla');

define('TR_URL_LOGIN',              'https://winbo-phx.azurewebsites.net/login.aspx/IniciarSesion');
define('TR_URL_VISITA_GRILLA',      'https://winbo-phx.azurewebsites.net/Paginas/OrdenTrabajo/Formulario.aspx/CargarVisitasGrilla');
define('TR_URL_VISITA_TAREA_GRILLA', 'https://winbo-phx.azurewebsites.net/Paginas/OrdenTrabajo/Formulario.aspx/CargarVisitasTareasGrilla');
define('TR_URL_CONSULTAR_TAREA',    'https://winbo-phx.azurewebsites.net/Paginas/OrdenTrabajo/Formulario.aspx/ConsultarTareaDeta');
define('TR_NAVEGADOR',              'PHP cURL');
define('TR_LOGIN_IN',               'S');

// ── Constantes editables: leer desde la BD ───────────────────────────────
// Si la tabla aún no existe o falla la consulta, usa los valores por defecto.
$_config_defaults = [
    'NAME_EMPRESA'       => 'Cespedes',
    'MONEDA'             => 'S/',
    'PORCENTAJE_GANANCIA' => 3,
    'PORCENTAJE_IVA'     => 0.21,
    'TR_USER'            => 'CESPEDES',
    'TR_PASSWORD'        => 'AVERIASCESPEDES2026',
    'TR_COD_SUS'         => 'WIN',
    'TR_QUERY'           => '',
    'TR_AUTH'            => '',
];

try {
    $__pdo = new PDO(
        'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
        DB_USER,
        DB_PASSWORD,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );

    $__stmt = $__pdo->query("SELECT clave, valor FROM configuracion");
    $__rows = $__stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($__rows as $__row) {
        $_config_defaults[$__row['clave']] = $__row['valor'];
    }
    unset($__pdo, $__stmt, $__rows, $__row);
} catch (Exception $__e) {
    // Si falla (ej: tabla no existe aún), sigue con los defaults
    error_log('[config] No se pudo leer configuracion de BD: ' . $__e->getMessage());
    unset($__e);
}

// Definir todas las constantes editables
foreach ($_config_defaults as $__k => $__v) {
    if (!defined($__k)) {
        define($__k, $__v);
    }
}
unset($_config_defaults, $__k, $__v);
