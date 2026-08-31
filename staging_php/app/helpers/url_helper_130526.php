<?php

function url_assets($path = '')
{
    return BASE_URL . 'public/' . trim($path, '/');
}

function base_url()
{
    return BASE_URL;
}

function getHead($data = [])
{
    $viewPath = __DIR__ . '/../views/templates/head.php';
    require_once $viewPath;
}

function getHeader($data = [])
{
    $viewPath = __DIR__ . '/../views/templates/header.php';
    require_once $viewPath;
}

function getFooter($data = [])
{
    $viewPath = __DIR__ . '/../views/templates/footer.php';
    require_once $viewPath;
}

function getJS($data = [])
{
    $viewPath = __DIR__ . '/../views/templates/js.php';
    require_once $viewPath;
}

function getModal($data = [])
{
    $viewPath = __DIR__ . '/../views/templates/modal.php';
    require_once $viewPath;
}

function getPop($data = [])
{
    $viewPath = __DIR__ . '/../views/templates/pop.php';
    require_once $viewPath;
}

function getNavegador($data = [])
{
    $viewPath = __DIR__ . '/../views/templates/navegador.php';
    require_once $viewPath;
}

function subirImagen($inputName, $rutaDestino, $prefijo = 'img_')
{
    if (empty($_FILES[$inputName]['name'])) {
        return null;
    }

    if (!is_dir($rutaDestino)) {
        mkdir($rutaDestino, 0777, true);
    }

    // Obtener extensión
    $extension = strtolower(pathinfo($_FILES[$inputName]['name'], PATHINFO_EXTENSION));

    // Extensiones permitidas
    $permitidos = ['jpg', 'jpeg', 'png', 'webp'];

    if (!in_array($extension, $permitidos)) {
        throw new Exception("Formato de imagen no permitido en $inputName");
    }

    // Crear carpeta si no existe
    if (!is_dir($rutaDestino)) {
        mkdir($rutaDestino, 0777, true);
    }

    // Generar nombre único
    $nombreArchivo = uniqid($prefijo) . '.' . $extension;

    // Mover archivo
    if (!move_uploaded_file($_FILES[$inputName]['tmp_name'], $rutaDestino . $nombreArchivo)) {
        throw new Exception("Error al subir la imagen $inputName");
    }

    return $nombreArchivo;
}

// NORMALIZAR DATA
function safe($data, $key, $default = null)
{
    return isset($data[$key]) && trim($data[$key]) !== ''
        ? trim($data[$key])
        : $default;
}

// NORMALIZAR FECHA
function formatearFecha($fecha)
{
    if (!$fecha) return null;

    // Normalizar AM/PM en español
    $fecha = str_replace([' a. m.', ' a.m.'], ' AM', $fecha);
    $fecha = str_replace([' p. m.', ' p.m.'], ' PM', $fecha);
    $fecha = trim($fecha);

    // Probar formatos en orden de prioridad
    // DD/MM/YYYY primero — es el formato que usa WIN
    $formatos = [
        'd/m/Y g:i:s A',  // 03/07/2026 9:15:00 AM
        'd/m/Y g:i A',    // 03/07/2026 9:15 AM
        'd/m/Y H:i:s',    // 03/07/2026 09:15:00
        'd/m/Y H:i',      // 03/07/2026 09:15
        'd/m/Y',          // 03/07/2026
        'Y-m-d H:i:s',    // 2026-07-03 09:15:00  (ya correcto)
        'Y-m-d H:i',      // 2026-07-03 09:15
        'Y-m-d',          // 2026-07-03
        'd-m-Y H:i:s',    // 03-07-2026 09:15:00
        'd-m-Y',          // 03-07-2026
    ];

    foreach ($formatos as $fmt) {
        $dt = DateTime::createFromFormat($fmt, $fecha);
        if ($dt !== false) {
            $errors = DateTime::getLastErrors();

            if ($errors === false || $errors['error_count'] === 0) {
                return $dt->format('Y-m-d H:i:s');
            }
        }
    }

    // Último recurso para formatos en inglés (Jul 3, 2026 etc.)
    $ts = strtotime($fecha);
    return $ts ? date('Y-m-d H:i:s', $ts) : null;
}
