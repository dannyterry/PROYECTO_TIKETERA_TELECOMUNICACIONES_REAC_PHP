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

// Lee el JSON de comisiones guardado (devuelve [] si no existe o es inválido)
function _leerComisionesCache($cacheFile)
{
    if (!file_exists($cacheFile)) {
        return [];
    }
    $data = json_decode(file_get_contents($cacheFile), true);
    return is_array($data) ? $data : [];
}

// Consulta las comisiones AFP vigentes desde la SBS (con caché de 24h en disco)
function obtenerComisionesAFP()
{
    $cacheFile = __DIR__ . '/comisiones_afp_sbs.json';
    $cacheTime = 86400; // 24 horas (86400 segundos)

    if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < $cacheTime) {
        $data = json_decode(file_get_contents($cacheFile), true);
        if (!empty($data)) {
            return $data;
        }
    }

    $cookies = ".ASPXANONYMOUS=aUqjZxc_s_Wc9pD-sTR_x3-PNLdUgCDp2Sw5DOtT71ul7c60L-3IZ23towCXrqTgH8bgu5i54uX7_ujySx8mrNoOfO5q_4tJuzp3XLL49ZHdV5Yi0; " .
        "ASP.NET_SessionId=iicilu554de5ps55jyxz322n; " .
        "visid_incap_2355492=htuDPcDfSSyMx4SSulQ5+a2BRWoAAAAAQkIPAAAAAACA7GzFAbXg/GRtgYQJSz69SCo8aMIN33nW; " .
        "visid_incap_2471123=udih7bWUTL2pmF7vWDuIcNCBRWoAAAAAQUIPAAAAAAC6AcWoSDVkHlVnEHjKISLT; " .
        "visid_incap_2473956=rkUbifjWRUGbixb1iuTI65KARWoAAAAAQUIPAAAAAABwSPiI7A8cMQqHh/JyXsjd; " .
        "incap_ses_1729_2355492=XtnpPSD6KgDzgA0y/KT+F7PjeWoAAAAAFmtF5RMe31ZldCLYklFn6g==; " .
        "dtCookie=v_4_srv_7_sn_032186B49830C91C223F5FD6E4CC8A0F_perc_100000_ol_0_mul_1_app-3Aa7babc1dd8d57c64_0; " .
        "TS01fc2e41=019955ae162f6daf8690bf74ab86ab8fef721eb7e5e8a85924b1ee522c367e7e3928a65392b38bb98ba77e42fdb647258e1704cd7298fe1182d056ace78d17c036361db35905e394a022a98876ae3470811bcb1aa7";

    $url = "https://www.sbs.gob.pe/app/spp/empleadores/comisiones_spp/Paginas/comision_prima.aspx";

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_ENCODING, ''); // Descomprimir gzip/deflate
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);

    curl_setopt($ch, CURLOPT_COOKIE, $cookies);

    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);

    $headers = [
        'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language: es-ES,es;q=0.9,en;q=0.8',
        'Cache-Control: no-cache',
        'Pragma: no-cache',
        'Sec-Ch-Ua: "Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        'Sec-Ch-Ua-Mobile: ?0',
        'Sec-Ch-Ua-Platform: "Windows"',
        'Sec-Fetch-Dest: document',
        'Sec-Fetch-Mode: navigate',
        'Sec-Fetch-Site: none',
        'Sec-Fetch-User: ?1',
        'Upgrade-Insecure-Requests: 1'
    ];
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

    $html = curl_exec($ch);
    $curlError = curl_error($ch); // capturar el error ANTES de cerrar el handle
    curl_close($ch);

    // Si la conexión falló a nivel de red, usamos la caché previa
    if (!$html || !empty($curlError)) {
        return _leerComisionesCache($cacheFile);
    }
    // 3. Extracción de los datos basada en la clase CSS 'JER_filaContenido'
    libxml_use_internal_errors(true);
    $dom = new DOMDocument();
    @$dom->loadHTML('<?xml encoding="UTF-8">' . $html);
    libxml_clear_errors();
    $xpath = new DOMXPath($dom);

    // Consulta XPath exacta para obtener únicamente las filas de datos de las AFP
    $filas = $xpath->query("//tr[contains(@class, 'JER_filaContenido')]");
    $resultado = [];
    foreach ($filas as $fila) {
        $columnas = $fila->getElementsByTagName('td');
        if ($columnas->length >= 5) {
            // Limpiar saltos de línea y espacios HTML especiales (&nbsp;)
            $afpRaw = $columnas->item(0)->nodeValue;
            $afpRaw = str_replace(["\xc2\xa0", "&nbsp;"], ' ', $afpRaw);
            $afpNombre = strtoupper(trim(preg_replace('/\s+/', ' ', $afpRaw)));
            if (in_array($afpNombre, ['HABITAT', 'INTEGRA', 'PRIMA', 'PROFUTURO'])) {
                $resultado[$afpNombre] = [
                    'afp'                => $afpNombre,
                    'comision_flujo'     => trim($columnas->item(1)->nodeValue),
                    'comision_saldo'     => trim($columnas->item(2)->nodeValue),
                    'prima_seguro'       => trim($columnas->item(3)->nodeValue),
                    'aporte_obligatorio' => trim($columnas->item(4)->nodeValue)
                ];
            }
        }
    }

    // Si la extracción no encontró datos (SBS bloqueada por WAF, cookies
    // vencidas o página con estructura cambiada), usar la caché existente
    // en lugar de devolver vacío. Así siempre se muestran las comisiones
    // guardadas en el JSON.
    if (empty($resultado)) {
        return _leerComisionesCache($cacheFile);
    }

    // 4. Guardar en el archivo JSON únicamente si la extracción web tuvo éxito
    file_put_contents($cacheFile, json_encode($resultado, JSON_UNESCAPED_UNICODE));
    return $resultado;
}

// Igual que subirImagen() pero acepta también PDF (para CV, DNI, recibos, etc.)
function subirArchivo($inputName, $rutaDestino, $prefijo = 'doc_', $permitidos = ['pdf', 'jpg', 'jpeg', 'png'])
{
    if (empty($_FILES[$inputName]['name'])) {
        return null;
    }

    if (!is_dir($rutaDestino)) {
        mkdir($rutaDestino, 0777, true);
    }

    $extension = strtolower(pathinfo($_FILES[$inputName]['name'], PATHINFO_EXTENSION));

    if (!in_array($extension, $permitidos)) {
        throw new Exception("Formato no permitido en $inputName (solo: " . implode(', ', $permitidos) . ")");
    }

    $nombreArchivo = uniqid($prefijo) . '.' . $extension;

    if (!move_uploaded_file($_FILES[$inputName]['tmp_name'], $rutaDestino . $nombreArchivo)) {
        throw new Exception("Error al subir el archivo $inputName");
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
    // IMPORTANTE: WIN envía las columnas "Inicio de Visita" y "Fin de Visita"
    // en formato americano (M/D/YYYY h:mm:ss AM/PM), p. ej. "8/11/2026 7:39:52 AM"
    // que significa 11 de agosto de 2026. Esas columnas SIEMPRE llevan AM/PM,
    // así que los formatos US se prueban primero (solo coinciden si hay AM/PM).
    // El resto de columnas ("Fecha Visita", "Fecha Solicitud") usan DD/MM/YYYY
    // sin AM/PM y siguen siendo interpretadas como DD/MM.
    $formatos = [
        'm/d/Y g:i:s A',  // 8/11/2026 7:39:52 AM  (US — Inicio/Fin de Visita de WIN)
        'm/d/Y g:i A',    // 8/11/2026 7:39 AM
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

function tienePermiso($permiso)
{
    // El administrador (rol ID 1) tiene acceso a todo
    if (($_SESSION['auth']['id_rol'] ?? 0) == 1) return true;

    return in_array(
        $permiso,
        $_SESSION['auth']['permisos'] ?? []
    );
}
