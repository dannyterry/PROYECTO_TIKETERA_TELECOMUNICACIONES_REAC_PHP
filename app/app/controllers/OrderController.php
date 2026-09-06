<?php



class OrderController extends Controller

{

    private $orderModel;

    private $staffModel;

    private $tipoTrabajoModel;



    public function __construct()

    {

        parent::__construct();

        $this->orderModel = $this->model('OrderModel');

        $this->staffModel = $this->model('StaffModel');

        $this->tipoTrabajoModel = $this->model('TipoTrabajoModel');
    }



    // ========== Metodo index ==========
    public function index()
    {
        $this->requierePermisoVista('ordenes.ver');

        $data = [
            'titulo' => "Órdenes de Trabajo",
            'ocultar_titulo' => true,
            'js' => null,
            'modal' => false
        ];

        $this->view('order/index', $data);
    }



    // ========== Metodo listar ==========

    public function listar()

    {

        $id_rol     = $_SESSION['auth']['id_rol']     ?? 0;

        $id_usuario = $_SESSION['auth']['id_usuario'] ?? 0;



        // Si NO es administrador (id_rol != 1), filtrar solo sus órdenes

        if ($id_rol != 1) {

            $staffModel = $this->model('StaffModel');

            // Buscar id_trabajador del usuario logueado

            $trab = $staffModel->buscar_trabajador_por_usuario_($id_usuario);

            $id_tecnico = $trab ? $trab->id_trabajador : null;
        } else {

            $id_tecnico = null; // admin ve todas

        }



        $unidades = $this->orderModel->listar_($id_tecnico);

        echo json_encode($unidades, JSON_UNESCAPED_UNICODE);
    }



    // ========== Metodo agregar ==========

    public function agregar()

    {

        $respuesta = $this->orderModel->agregar_();

        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }



    // ========== Metodo editar ==========

    public function editar($id)

    {

        $respuesta = $this->orderModel->editar_($id);

        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }


    // ========== Metodo mi_stock (para el botón "Mi stock" del técnico) ==========

    public function mi_stock()

    {

        $id_usuario = $_SESSION['auth']['id_usuario'] ?? null;



        if (!$id_usuario) {

            echo json_encode(['success' => false, 'mensaje' => 'Sesión inválida.'], JSON_UNESCAPED_UNICODE);

            return;

        }



        $respuesta = $this->orderModel->mi_stock_($id_usuario);

        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }



    // ========== Dar de baja un equipo desde el stock del técnico ==========

    // El técnico elige una serie de su stock y la da de baja con un clic,
    // sin digitar el número de serie.

    public function dar_baja()

    {

        $this->requierePermiso('ordenes.liquidar');



        $id_usuario = $_SESSION['auth']['id_usuario'] ?? null;

        if (!$id_usuario) {

            echo json_encode(['success' => false, 'mensaje' => 'Sesión inválida.'], JSON_UNESCAPED_UNICODE);

            return;

        }



        $id_producto_serie = $_POST['id_producto_serie'] ?? null;

        $respuesta = $this->orderModel->dar_baja_($id_usuario, $id_producto_serie);

        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }



    // ========== Metodo ver ==========

    public function ver($id)

    {

        try {

            if (empty($id)) {

                throw new Exception("ID inválido.");
            }



            $OrdeVisiId = $this->obtenerDetalleOrden($id);



            if (empty($OrdeVisiId)) {

                throw new Exception("No se encontró la orden.");
            }



            $lista_tareas = $this->obtenerDetalleOrdenTarea($OrdeVisiId);



            $orden = $this->orderModel->buscar_por_numero_($id);

            $id_orden = $orden ? $orden->id_orden : null;



            echo json_encode([

                "success"  => true,

                "data"     => $lista_tareas ?? [],

                "id_orden" => $id_orden

            ], JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {

            http_response_code(400);

            echo json_encode([

                "success" => false,

                "message" => $e->getMessage()

            ], JSON_UNESCAPED_UNICODE);
        }
    }



    // ========== Metodo ver ==========

    public function consulta($id, $index)

    {



        try {



            if (empty($id)) {

                throw new Exception("ID inválido.");
            }





            $lista_detalle_tareas = $this->obtenerDetalleOrdenTareaDeta($id, $index);



            echo json_encode([

                "success" => true,

                "data" => $lista_detalle_tareas ?? []

            ], JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {



            http_response_code(400);



            echo json_encode([

                "success" => false,

                "message" => $e->getMessage()

            ], JSON_UNESCAPED_UNICODE);
        }
    }





    // ========== Metodo actualizar llamada ==========

    public function actualizar_llamada()

    {

        $id = $_POST['id'];

        $llamada = $_POST['llamada_inconcert'];



        $respuesta = $this->orderModel->actualizar_llamada_($id, $llamada);

        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }



    // ========== Metodo actualizar tecnico ==========

    public function actualizar_tecnico()

    {

        $id = $_POST['id'];

        $id_tecnico = $_POST['id_tecnico'];



        $respuesta = $this->orderModel->actualizar_tecnico_($id, $id_tecnico);

        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }



    // ========== Metodo actualizar tecnico reemplazo ==========

    public function actualizar_tecnico_reemplazo()

    {

        $id = $_POST['id'];

        $id_tecnico_reemplazo = $_POST['id_tecnico_reemplazo'];



        $respuesta = $this->orderModel->actualizar_tecnico_reemplazo_($id, $id_tecnico_reemplazo);

        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }



    // ========== Metodo actualizar motivo ==========

    public function actualizar_motivo()

    {

        $id = $_POST['id'];

        $tipo_trabajo = $_POST['tipo_trabajo'];



        $respuesta = $this->orderModel->actualizar_motivo_($id, $tipo_trabajo);

        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }



    // ========== Metodo actualizar masivo ==========

    public function actualizar_masivo()

    {

        // La sincronización con WIN puede tardar varios minutos (1 request por orden).

        // Quitamos el límite de tiempo de ejecución solo para este proceso.

        set_time_limit(0);

        ignore_user_abort(true);



        // IMPORTANTE: cerramos la sesión aquí. Por defecto PHP mantiene un lock

        // exclusivo sobre el archivo de sesión durante toda la petición, así que

        // si no la liberamos, el polling de "progreso_sincronizacion" (que usa

        // la misma sesión del navegador) se queda esperando ese lock y termina

        // agotando su propio tiempo de ejecución sin poder leer el progreso.

        // Ya no necesitamos leer/escribir $_SESSION en el resto de este método.

        session_write_close();



        // Reiniciamos el progreso antes de empezar

        @unlink($this->progresoPath());

        $this->guardarProgreso(0, 0, 0, 0, 'Iniciando sincronización...');



        $ordenes = $this->obtenerOrdenesWin();



        $this->guardarProgreso(count($ordenes), count($ordenes), null, null, 'Guardando en la base de datos...');



        $respuesta = $this->orderModel->insertar_desde_win_($ordenes);



        // Limpiamos el archivo de progreso al terminar

        @unlink($this->progresoPath());



        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }



    // ========== Metodo consultar progreso de la sincronización ==========

    // El frontend hace polling a este endpoint mientras "actualizar_masivo" sigue corriendo.

    public function progreso_sincronizacion()

    {

        // Cerramos la sesión de inmediato: este endpoint solo lee un archivo

        // temporal, no necesita mantener el lock de sesión abierto.

        session_write_close();



        $path = $this->progresoPath();



        if (!file_exists($path)) {

            echo json_encode([

                "actual" => 0,

                "total" => 0,

                "pagina" => null,

                "total_paginas" => null,

                "mensaje" => "Esperando..."

            ], JSON_UNESCAPED_UNICODE);

            return;
        }



        $contenido = file_get_contents($path);

        echo $contenido ?: json_encode(["actual" => 0, "total" => 0, "mensaje" => "Esperando..."]);
    }



    // Ruta del archivo temporal de progreso, único por sesión de usuario

    private function progresoPath()

    {

        return sys_get_temp_dir() . '/cespedes_sync_progreso_' . session_id() . '.json';
    }



    // Guarda el avance actual en un archivo temporal (no usamos $_SESSION porque

    // el request principal mantiene el lock de sesión abierto durante todo el proceso)

    private function guardarProgreso($actual, $total, $pagina = null, $total_paginas = null, $mensaje = null)

    {

        @file_put_contents($this->progresoPath(), json_encode([

            "actual" => $actual,

            "total" => $total,

            "pagina" => $pagina,

            "total_paginas" => $total_paginas,

            "mensaje" => $mensaje

        ], JSON_UNESCAPED_UNICODE));
    }



    // ========== Metodo obtener estado ==========

    public function obtener_estado($id)

    {

        $respuesta = $this->obtenerEstado($id);



        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }



    // ========== Metodo eliminar ==========

    public function eliminar($id)

    {

        $respuesta = $this->orderModel->eliminar_($id);

        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }





    // ================== METODOS ORDENES WIN ==================

    private function loginWin($cookieFile)

    {

        $login_url = TR_URL_LOGIN;



        $payload = [

            "CodiUsua" => TR_USER,

            "Contraseña" => TR_PASSWORD,

            "CodiSuscrip" => TR_COD_SUS,

            "Navegador" => TR_NAVEGADOR,

            "Query" => TR_QUERY,

            "AutenDoblePasoCodi" => TR_AUTH,

            "LoginInterno" => TR_LOGIN_IN

        ];



        $ch = curl_init($login_url);



        curl_setopt_array($ch, [

            CURLOPT_RETURNTRANSFER => true,

            CURLOPT_POST => true,

            CURLOPT_HTTPHEADER => [

                "Content-Type: application/json; charset=utf-8",

                "X-Requested-With: XMLHttpRequest",

                "User-Agent: Mozilla/5.0"

            ],

            CURLOPT_POSTFIELDS => json_encode($payload),

            CURLOPT_COOKIEJAR => $cookieFile,

            CURLOPT_COOKIEFILE => $cookieFile

        ]);



        $response = curl_exec($ch);

        curl_close($ch);



        return $response;
    }



    private function cargarGrillaWin($cookieFile, $numeroPagina = 1)

    {

        date_default_timezone_set('America/Lima');



        $url_grilla = TR_URL_GRILLA;



        // $fechaActual = date('d/m/Y');

        $fechaActual1 = date('d/m/Y', strtotime('-1 day'));

        $fechaActual2 = date('d/m/Y', strtotime('-0 day'));



        $json_grilla = [

            "Empresa" => "0",

            "IdProyec" => "",

            "Motivo" => "0",

            "MotivosReproId" => "0",

            "Nombre" => "",

            "NumeDocu" => "",

            "OrdenId" => "",

            "Pais" => "0",

            "conexion" => "0",

            "cuadrilla" => "0",

            "estado" => "0",

            "fechaEstaDesde" => "",

            "fechaEstaHasta" => "",

            "fechaSoliDesde" => "",

            "fechaSoliHasta" => "",

            "fechaVisiDesde" => $fechaActual1,

            "fechaVisiHasta" => $fechaActual2,

            "idPage" => 74,

            "localidad" => "0",

            "pagiActu" => $numeroPagina,

            "producto" => null,

            "provincia" => "0",

            "region" => "0",

            "suscrip" => "",

            "tipoOrden" => 1,

            "tipoProduc" => "0",

            "tipoTraba" => "0",

            "tipoUbi" => "",

            "ubi" => "",

            "zona" => "0"

        ];



        $ch = curl_init($url_grilla);



        curl_setopt_array($ch, [

            CURLOPT_RETURNTRANSFER => true,

            CURLOPT_POST => true,

            CURLOPT_HTTPHEADER => [

                "Content-Type: application/json; charset=utf-8",

                "X-Requested-With: XMLHttpRequest",

                "User-Agent: Mozilla/5.0"

            ],

            CURLOPT_POSTFIELDS => json_encode($json_grilla),

            CURLOPT_COOKIEJAR => $cookieFile,

            CURLOPT_COOKIEFILE => $cookieFile

        ]);



        $response = curl_exec($ch);

        curl_close($ch);



        return $response;
    }



    public function obtenerOrdenesWin()

    {

        $cookieFile = __DIR__ . "/cookies.txt";



        if (!file_exists($cookieFile)) {

            $this->loginWin($cookieFile);
        }



        $response = $this->cargarGrillaWin($cookieFile, 1);

        $resp_json = json_decode($response, true);



        $sesion_invalida = false;



        if (!isset($resp_json['d'])) {

            $sesion_invalida = true;
        } else {



            $decoded = base64_decode($resp_json['d']);

            $data_json = json_decode($decoded, true);



            if (

                !isset($data_json['html']) ||

                empty($data_json['html']) ||

                !isset($data_json['registros'])

            ) {

                $sesion_invalida = true;
            }
        }



        if ($sesion_invalida) {



            if (file_exists($cookieFile)) {

                unlink($cookieFile);
            }



            $this->loginWin($cookieFile);



            $response = $this->cargarGrillaWin($cookieFile, 1);

            $resp_json = json_decode($response, true);



            if (!isset($resp_json['d'])) {

                throw new Exception("No se pudo iniciar sesión en WIN.");
            }



            $decoded = base64_decode($resp_json['d']);

            $data_json = json_decode($decoded, true);
        }



        $decoded_registro = base64_decode($data_json['registros']);

        $total_registros = json_decode($decoded_registro, true);



        $por_pagina = 30;

        $total_paginas = ceil($total_registros / $por_pagina);



        $todas_las_ordenes = [];



        $this->guardarProgreso(0, $total_registros, 0, $total_paginas, 'Descargando listado de órdenes...');



        for ($pagina = 1; $pagina <= $total_paginas; $pagina++) {



            $response = $this->cargarGrillaWin($cookieFile, $pagina);

            $resp_json = json_decode($response, true);



            if (!isset($resp_json['d'])) {

                continue;
            }



            $decoded = base64_decode($resp_json['d']);

            $data_json = json_decode($decoded, true);



            $html_base64 = $data_json['html'];

            $decoded_html = base64_decode($html_base64);



            $ordenes = $this->parsearHtml($decoded_html);



            $todas_las_ordenes = array_merge($todas_las_ordenes, $ordenes);



            $this->guardarProgreso(

                min($pagina * $por_pagina, $total_registros),

                $total_registros,

                $pagina,

                $total_paginas,

                "Descargando página {$pagina} de {$total_paginas}..."

            );
        }



        // ── A partir de aquí solo pedimos el detalle (hora_asignacion) a WIN ──

        // para las órdenes que realmente lo necesitan: las que son nuevas en

        // nuestra BD, o las que ya existen pero todavía no tienen esa hora

        // registrada. Una vez que una orden queda "Asignada" esa hora no

        // vuelve a cambiar, así que no tiene sentido re-consultarla en cada

        // sincronización. Esto evita cientos de llamadas innecesarias cuando

        // la mayoría de las órdenes ya están al día.

        $numeros = array_column($todas_las_ordenes, 'numero');

        $horasExistentes = $this->orderModel->obtener_horas_asignacion_($numeros);



        $pendientesDetalle = [];

        foreach ($todas_las_ordenes as $indice => $orden) {

            $numero = $orden['numero'];

            $yaTieneHora = array_key_exists($numero, $horasExistentes) && !empty($horasExistentes[$numero]);



            if (!$yaTieneHora) {

                $pendientesDetalle[] = $indice;
            }
        }



        $totalPendientes = count($pendientesDetalle);

        $procesadas = 0;



        $this->guardarProgreso(

            0,

            max($totalPendientes, 1),

            null,

            null,

            $totalPendientes > 0

                ? "Obteniendo detalle de {$totalPendientes} orden(es) nueva(s) o pendiente(s)..."

                : "Sin cambios que requieran detalle adicional."

        );



        foreach ($pendientesDetalle as $indice) {



            $id = $todas_las_ordenes[$indice]['numero'];

            $todas_las_ordenes[$indice]['hora_asignacion'] = formatearFecha($this->obtenerEstado($id) ?? null);



            $procesadas++;

            $this->guardarProgreso(

                $procesadas,

                $totalPendientes,

                null,

                null,

                "Procesando orden {$procesadas} de {$totalPendientes}..."

            );
        }



        return $todas_las_ordenes;
    }



    private function parsearHtml($decoded_html)

    {

        libxml_use_internal_errors(true);



        $decoded_html = mb_convert_encoding($decoded_html, 'HTML-ENTITIES', 'UTF-8');



        $dom = new DOMDocument();

        $dom->loadHTML('<table>' . $decoded_html . '</table>');



        $xpath = new DOMXPath($dom);



        static $headers_global = [];



        $headers = [];

        $ths = $xpath->query("//thead/tr/th");



        if ($ths->length > 0) {

            foreach ($ths as $th) {

                $headers[] = trim(preg_replace('/\s+/', ' ', $th->textContent));
            }

            $headers_global = $headers;
        } else {

            $headers = $headers_global;
        }



        $rows = $xpath->query("//tr");



        $resultado = [];



        foreach ($rows as $row) {



            $cols = $row->getElementsByTagName("td");



            if ($cols->length == 0) {

                continue;
            }



            $fila = [];



            foreach ($cols as $index => $col) {



                $columna = $headers[$index] ?? "col_" . $index;



                // $texto = trim(preg_replace('/\s+/', ' ', $col->textContent));

                if ($columna === 'Cliente') {



                    $nombre = '';



                    $divs = $col->getElementsByTagName('div');



                    foreach ($divs as $div) {

                        if ($div->getAttribute('class') === 'tx-inverse') {

                            $nombre = trim($div->textContent);

                            break;
                        }
                    }



                    $texto = $nombre;
                } else {

                    $texto = trim(preg_replace('/\s+/', ' ', $col->textContent));
                }



                $fila[$columna] = $texto;
            }



            $resultado[] = $this->mapearOrden($fila);
        }



        return $resultado;
    }



    private function mapearOrden($fila)

    {

        return [



            'numero' => $fila['Nº'] ?? null,

            'fecha_solicitud' => formatearFecha($fila['Fecha Solicitud'] ?? null),

            'cliente' => $fila['Cliente'] ?? null,

            'inicio_visita' => formatearFecha($fila['Inicio de Visita'] ?? null),

            'fin_visita' => formatearFecha($fila['Fin de Visita'] ?? null),

            'motivo_finalizacion' => $fila['Motivo de Finalización'] ?? null,

            'datos_tecnicos' => $fila['Datos Técnicos'] ?? null,

            'tipo_trabajo' => $fila['Tipo Trabajo'] ?? null,

            'georeferencia' => $fila['Georeferencia'] ?? null,

            'motivo_cancelacion' => $fila['Motivo de Cancelación'] ?? null,

            'numero_documento' => $fila['Número Documento'] ?? null,

            'movil' => $fila['Móvil'] ?? null,

            'codigo_seguimiento' => $fila['Código De Seguimiento'] ?? null,

            'region_zona' => $fila['Región / Zona'] ?? null,

            'fecha_visita' => formatearFecha($fila['Fecha Visita'] ?? null),

            'cod_seguimiento_cliente' => $fila['Cod Seguimiento Cliente'] ?? null,

            'direccion' => $fila['Dirección'] ?? null,

            'estado' => $fila['Estado'] ?? null,

            'cuadrilla' => $fila['Cuadrilla'] ?? null,

            'tipo_orden' => $fila['Tipo Orden'] ?? null,

            'motivo' => $fila['Motivo'] ?? null,

            'ubicacion' => $fila['Ubicación'] ?? null,

            'fecha_estado' => formatearFecha($fila['Fecha Estado'] ?? null),

            'motivo_anulacion' => $fila['Motivo de Anulación'] ?? null,

            'motivo_regestion' => $fila['Motivo Regestión'] ?? null,

            'motivo_suspension' => $fila['Motivo de Suspensión'] ?? null,

            'pais_empresa' => $fila['País / Empresa'] ?? null,

            'email' => $fila['Email'] ?? null,

            'tipo_ubicacion' => $fila['Tipo Ubicación'] ?? null,

            'codigo_postal' => $fila['Código Postal'] ?? null,

            'tipo_documento' => $fila['Tipo Documento'] ?? null,

            'producto' => $fila['Producto'] ?? null,

            'id_proyecto' => $fila['Id de Proyecto'] ?? null,

            'proveedor' => $fila['Proveedeor'] ?? null,

            'localidad' => $fila['Localidad'] ?? null,

            'motivo_trabajo' => $fila['Motivo Trabajo'] ?? null,

            'prioridad' => $fila['Prioridad'] ?? null,

            'historial_estados' => $fila['Historial de Estados'] ?? null,

            'fijo' => $fila['Fijo'] ?? null,

            'sector_operativo' => $fila['Sector Operativo'] ?? null,

            'suscripcion' => $fila['Suscripción'] ?? null



        ];
    }











    // ================== METODO OBTENER ORDEN DETALLE ==================



    private function cargarPayloadOrden($cookieFile, $id)

    {

        $url_grilla = TR_URL_VISITA_GRILLA;



        $json_grilla = [

            "IdPage" => "74_Formu",

            "OrdenId" => $id,

            "pagiActu" => 1

        ];



        $ch = curl_init($url_grilla);



        curl_setopt_array($ch, [

            CURLOPT_RETURNTRANSFER => true,

            CURLOPT_POST => true,

            CURLOPT_HTTPHEADER => [

                "Content-Type: application/json; charset=utf-8",

                "X-Requested-With: XMLHttpRequest",

                "User-Agent: Mozilla/5.0"

            ],

            CURLOPT_POSTFIELDS => json_encode($json_grilla),

            CURLOPT_COOKIEJAR => $cookieFile,

            CURLOPT_COOKIEFILE => $cookieFile

        ]);



        $response = curl_exec($ch);

        curl_close($ch);



        return $response;
    }



    public function obtenerDetalleOrden($id)

    {



        $OrdeVisiId = 0;



        $cookieFile = __DIR__ . "/cookies.txt";



        if (!file_exists($cookieFile)) {

            $this->loginWin($cookieFile);
        }



        $response = $this->cargarPayloadOrden($cookieFile, $id);

        $resp_json = json_decode($response, true);



        $sesion_invalida = false;



        if (!isset($resp_json['d'])) {

            $sesion_invalida = true;
        } else {



            $decoded = base64_decode($resp_json['d']);

            $data_json = json_decode($decoded, true);





            if (

                !isset($data_json['html']) ||

                empty($data_json['html'])

            ) {

                $sesion_invalida = true;
            }
        }



        if ($sesion_invalida) {



            if (file_exists($cookieFile)) {

                unlink($cookieFile);
            }



            $this->loginWin($cookieFile);



            $response = $this->cargarPayloadOrden($cookieFile, $id);

            $resp_json = json_decode($response, true);



            if (!isset($resp_json['d'])) {

                throw new Exception("No se pudo iniciar sesión en WIN.");
            }



            $decoded = base64_decode($resp_json['d']);

            $data_json = json_decode($decoded, true);
        }



        $html_base64 = $data_json['html'];

        $decoded_html = base64_decode($html_base64);





        if (preg_match('/seleccionarVisita74_Formu\(&quot;\s*(\d+)/', $decoded_html, $match)) {

            $id_ = $match[1];

            $OrdeVisiId = $id_;
        }



        return $OrdeVisiId;
    }









    // ================== METODO OBTENER ORDEN TAREA DETALLE ==================

    private function cargarPayloadOrdenTarea($cookieFile, $id)

    {

        $url_grilla = TR_URL_VISITA_TAREA_GRILLA;



        $json_grilla = [

            "EsCliente" => "",

            "EsSeguimiento" => "S",

            "IdPage" => "74_Formu",

            "OrdeVisiId" => " " . $id,

        ];



        $ch = curl_init($url_grilla);



        curl_setopt_array($ch, [

            CURLOPT_RETURNTRANSFER => true,

            CURLOPT_POST => true,

            CURLOPT_HTTPHEADER => [

                "Content-Type: application/json; charset=utf-8",

                "X-Requested-With: XMLHttpRequest",

                "User-Agent: Mozilla/5.0"

            ],

            CURLOPT_POSTFIELDS => json_encode($json_grilla),

            CURLOPT_COOKIEJAR => $cookieFile,

            CURLOPT_COOKIEFILE => $cookieFile

        ]);



        $response = curl_exec($ch);

        curl_close($ch);



        return $response;
    }



    public function obtenerDetalleOrdenTarea($OrdeVisiId)

    {





        $cookieFile = __DIR__ . "/cookies.txt";



        if (!file_exists($cookieFile)) {

            $this->loginWin($cookieFile);
        }



        $response = $this->cargarPayloadOrdenTarea($cookieFile, $OrdeVisiId);

        $resp_json = json_decode($response, true);



        $sesion_invalida = false;



        if (!isset($resp_json['d'])) {

            $sesion_invalida = true;
        } else {



            $decoded = base64_decode($resp_json['d']);

            $data_json = json_decode($decoded, true);





            if (

                !isset($data_json['html']) ||

                empty($data_json['html'])

            ) {

                $sesion_invalida = true;
            }
        }



        if ($sesion_invalida) {



            if (file_exists($cookieFile)) {

                unlink($cookieFile);
            }



            $this->loginWin($cookieFile);



            $response = $this->cargarPayloadOrdenTarea($cookieFile, $OrdeVisiId);

            $resp_json = json_decode($response, true);



            if (!isset($resp_json['d'])) {

                throw new Exception("No se pudo iniciar sesión en WIN.");
            }



            $decoded = base64_decode($resp_json['d']);

            $data_json = json_decode($decoded, true);
        }



        $html_base64 = $data_json['html'];

        $decoded_html = base64_decode($html_base64);



        libxml_use_internal_errors(true);



        $dom = new DOMDocument();

        $dom->loadHTML($decoded_html);



        $xpath = new DOMXPath($dom);



        // 🔎 Buscar todas las cards

        $cards = $xpath->query("//div[@class='card']");

        $resultado = [];



        foreach ($cards as $index => $card) {



            $item = [

                'index' => $index,

                'id' => null,

                'titulo' => null,

                'estado' => null,

                'imagen_base64' => null,

                'onclick_id' => null,

                'collapse_id' => null,

                'icons' => []

            ];



            // 🔹 ID GENERAL (input hidden)

            $input = $xpath->query(".//input[contains(@id,'txtOrdeTrabaTareId')]", $card);

            if ($input->length > 0) {

                $item['id'] = $input->item(0)->getAttribute("value");
            }



            // 🔹 TITULO (FOTO DOMICILIO)

            $titulo = $xpath->query(".//h5//span", $card);

            if ($titulo->length > 0) {

                $item['titulo'] = trim($titulo->item(0)->textContent);
            }



            // 🔹 ESTADO (Pendiente)

            $estado = $xpath->query(".//div[contains(@class,'col-3')]//span", $card);

            if ($estado->length > 0) {

                $item['estado'] = trim($estado->item(0)->textContent);
            }



            // 🔹 IMAGEN

            $img = $xpath->query(".//img", $card);

            if ($img->length > 0) {

                $item['imagen_base64'] = $img->item(0)->getAttribute("src");
            }



            // 🔹 ONCLICK ID

            $onclick = $xpath->query(".//div[contains(@class,'accord-Tittle')]", $card);

            if ($onclick->length > 0) {

                $onclick_attr = $onclick->item(0)->getAttribute("onClick");

                if (preg_match("/\((\d+),/", $onclick_attr, $match)) {

                    $item['onclick_id'] = $match[1];
                }
            }



            // 🔹 COLLAPSE ID

            $collapse = $xpath->query(".//div[contains(@class,'collapse')]", $card);

            if ($collapse->length > 0) {

                $item['collapse_id'] = $collapse->item(0)->getAttribute("id");
            }



            // 🔹 ICONOS (todas las clases fas)

            $icons = $xpath->query(".//i[contains(@class,'fas')]", $card);

            foreach ($icons as $icon) {

                $item['icons'][] = [

                    'class' => $icon->getAttribute("class"),

                    'style' => $icon->getAttribute("style")

                ];
            }



            $resultado[] = $item;
        }



        return $resultado;
    }





    // ================== METODO OBTENER ORDEN TAREA DETALLE ==================

    private function cargarPayloadOrdenTareaDeta($cookieFile, $id, $index)

    {

        $url_grilla = TR_URL_CONSULTAR_TAREA;



        $json_grilla = [

            "EsCliente" => "",

            "EsSeguimiento" => "S",

            "IdPage" => "74_Formu",

            "Index" => $index,

            "OrdeTrabaTareId" => $id,

            "TipoHora" => "2",

        ];



        $ch = curl_init($url_grilla);



        curl_setopt_array($ch, [

            CURLOPT_RETURNTRANSFER => true,

            CURLOPT_POST => true,

            CURLOPT_HTTPHEADER => [

                "Content-Type: application/json; charset=utf-8",

                "X-Requested-With: XMLHttpRequest",

                "User-Agent: Mozilla/5.0"

            ],

            CURLOPT_POSTFIELDS => json_encode($json_grilla),

            CURLOPT_COOKIEJAR => $cookieFile,

            CURLOPT_COOKIEFILE => $cookieFile

        ]);



        $response = curl_exec($ch);

        curl_close($ch);



        return $response;
    }



    public function obtenerDetalleOrdenTareaDeta($id, $index)

    {





        $cookieFile = __DIR__ . "/cookies.txt";



        if (!file_exists($cookieFile)) {

            $this->loginWin($cookieFile);
        }



        $response = $this->cargarPayloadOrdenTareaDeta($cookieFile, $id, $index);

        $resp_json = json_decode($response, true);



        $sesion_invalida = false;



        if (!isset($resp_json['d'])) {

            $sesion_invalida = true;
        } else {



            $decoded = base64_decode($resp_json['d']);

            $data_json = json_decode($decoded, true);





            if (

                !isset($data_json['html']) ||

                empty($data_json['html'])

            ) {

                $sesion_invalida = true;
            }
        }



        if ($sesion_invalida) {



            if (file_exists($cookieFile)) {

                unlink($cookieFile);
            }



            $this->loginWin($cookieFile);



            $response = $this->cargarPayloadOrdenTareaDeta($cookieFile, $id, $index);

            $resp_json = json_decode($response, true);



            if (!isset($resp_json['d'])) {

                throw new Exception("No se pudo iniciar sesión en WIN.");
            }



            $decoded = base64_decode($resp_json['d']);

            $data_json = json_decode($decoded, true);
        }



        $html_base64 = $data_json['html'];

        $decoded_html = base64_decode($html_base64);



        libxml_use_internal_errors(true);



        $dom = new DOMDocument();

        $dom->loadHTML('<?xml encoding="UTF-8">' . $decoded_html);



        $xpath = new DOMXPath($dom);



        $data = [];





        $spans = $xpath->query("//table//span");



        $data["coordenadas_inicio"] = [

            "gd"  => trim($spans->item(0)?->textContent ?? ''),

            "gms" => trim($spans->item(1)?->textContent ?? '')

        ];



        $data["coordenadas_fin"] = [

            "gd"  => trim($spans->item(2)?->textContent ?? ''),

            "gms" => trim($spans->item(3)?->textContent ?? '')

        ];





        $descripcionNode = $xpath->query("//div[contains(@class,'col-12')]//p")->item(0);

        $data["descripcion"] = trim($descripcionNode?->textContent ?? '');



        $checkbox = $xpath->query("//input[@type='checkbox']")->item(0);

        $data["obligatorio"] = $checkbox?->hasAttribute("checked") ? true : false;



        $divs = $xpath->query("//div[contains(@class,'col-2')]");



        foreach ($divs as $div) {



            $texto = trim($div->textContent);



            if (str_contains($texto, "Estimado:")) {

                $data["estimado"] = trim($xpath->query(".//span", $div)->item(0)?->textContent ?? '');
            }



            if (str_contains($texto, "Inicio:")) {

                $data["inicio"] = trim($xpath->query(".//span", $div)->item(0)?->textContent ?? '');
            }



            if (str_contains($texto, "Fin:")) {

                $data["fin"] = trim($xpath->query(".//span", $div)->item(0)?->textContent ?? '');
            }



            if (str_contains($texto, "Duración:")) {

                $data["duracion"] = trim($xpath->query(".//span", $div)->item(0)?->textContent ?? '');
            }



            if (str_contains($texto, "Motivo:")) {

                $data["motivo"] = trim($xpath->query(".//span", $div)->item(0)?->textContent ?? '');
            }
        }





        $obsNode = $xpath->query("//strong[contains(text(),'Observaciones')]")->item(0);



        $data["observaciones"] = "";



        $data["fotografias"] = [];



        $cards = $xpath->query("//div[contains(concat(' ', normalize-space(@class), ' '), ' card ')]");



        foreach ($cards as $card) {



            $titulo = trim(

                $xpath->query(".//h5", $card)->item(0)?->textContent ?? ''

            );



            $img = $xpath->query(".//img", $card)->item(0);

            $imagen = $img?->getAttribute("src") ?? '';



            $data["fotografias"][] = [

                "titulo" => $titulo,

                "imagen" => $imagen

            ];
        }



        return $data;
    }





    // ================== METODO OBTENER ESTADO ==================



    private function cargarPayloadEstado($cookieFile, $id)

    {

        $url_grilla = TR_URL_ESTADO;



        $json_grilla = [

            "IdPage" => "74_Formu",

            "OrdenId" => $id

        ];



        $ch = curl_init($url_grilla);



        curl_setopt_array($ch, [

            CURLOPT_RETURNTRANSFER => true,

            CURLOPT_POST => true,

            CURLOPT_HTTPHEADER => [

                "Content-Type: application/json; charset=utf-8",

                "X-Requested-With: XMLHttpRequest",

                "User-Agent: Mozilla/5.0"

            ],

            CURLOPT_POSTFIELDS => json_encode($json_grilla),

            CURLOPT_COOKIEJAR => $cookieFile,

            CURLOPT_COOKIEFILE => $cookieFile

        ]);



        $response = curl_exec($ch);

        curl_close($ch);



        return $response;
    }



    public function obtenerEstado($id)

    {



        $cookieFile = __DIR__ . "/cookies.txt";



        if (!file_exists($cookieFile)) {

            $this->loginWin($cookieFile);
        }



        $response = $this->cargarPayloadEstado($cookieFile, $id);

        $resp_json = json_decode($response, true);



        $sesion_invalida = false;



        if (!isset($resp_json['d'])) {

            $sesion_invalida = true;
        } else {



            $decoded = base64_decode($resp_json['d']);

            $data_json = json_decode($decoded, true);





            if (

                !isset($data_json['html']) ||

                empty($data_json['html'])

            ) {

                $sesion_invalida = true;
            }
        }



        $html_base64 = $data_json['html'];

        $decoded_html = base64_decode($html_base64);





        libxml_use_internal_errors(true);



        $dom = new DOMDocument();

        $dom->loadHTML('<?xml encoding="UTF-8">' . $decoded_html);



        $xpath = new DOMXPath($dom);



        $fecha_asignada = null;



        $rows = $xpath->query("//table/tbody/tr");







        foreach ($rows as $row) {



            // obtener columnas

            $th = $xpath->query("./th", $row)->item(0);

            $tds = $xpath->query("./td", $row);



            // estado = segunda columna

            $estado = trim($tds->item(0)?->textContent ?? '');



            if ($estado === 'Asignada') {



                // fecha = primera columna

                $fecha_asignada = trim($th?->textContent ?? '');



                break;
            }
        }



        return $fecha_asignada;
    }











    // ========== METODO LIQUIDAR ==========

    // Agrega este método dentro de la clase OrderController

    public function liquidar()

    {

        $this->requierePermiso('ordenes.liquidar');

        $respuesta = $this->orderModel->liquidar_();

        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }





    // ========== Listar liquidaciones de una orden ==========

    public function listar_liquidaciones($id)

    {

        $data = $this->orderModel->listar_liquidaciones_($id);

        echo json_encode(['success' => true, 'data' => $data ?? []], JSON_UNESCAPED_UNICODE);
    }
}
