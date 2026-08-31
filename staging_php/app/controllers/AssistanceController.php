<?php
// app/controllers/AssistanceController.php — REEMPLAZAR COMPLETO

class AssistanceController extends Controller
{
    private $assistanceModel;

    public function __construct()
    {
        parent::__construct();
        $this->assistanceModel = $this->model('AssistanceModel');
    }

    public function index()
    {
        $this->requierePermisoVista('asistencias.ver');

        $data = [
            'titulo' => 'Asistencias',
            'js'     => 'asistencias'
        ];
        $this->view('human_resources/assistance/index', $data);
    }

    public function listar()
    {
        $this->requierePermiso('asistencias.ver');

        $id_rol     = $_SESSION['auth']['id_rol']     ?? 0;
        $id_usuario = $_SESSION['auth']['id_usuario'] ?? 0;

        $fecha = trim($_POST['fecha'] ?? ($_GET['fecha'] ?? ''));
        if (!$fecha || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha)) {
            $fecha = date('Y-m-d');
        }

        // Técnico (no admin): solo ve sus propias asistencias
        if ($id_rol != 1) {
            $trab = $this->assistanceModel->buscar_trabajador_por_usuario_($id_usuario);
            $data = $trab
                ? $this->assistanceModel->listar_por_tecnico_($trab->id_trabajador, $fecha)
                : [];
        } else {
            $data = $this->assistanceModel->listar_por_fecha_($fecha);
        }

        echo json_encode([
            'success' => true,
            'fecha'   => $fecha,
            'data'    => $data ?? []
        ], JSON_UNESCAPED_UNICODE);
    }

    public function agregar()
    {
        echo json_encode(['success' => false, 'mensaje' => 'Solo lectura: no se permite crear asistencias manualmente']);
    }

    public function editar($id)
    {
        echo json_encode(['success' => false, 'mensaje' => 'Solo lectura: no se permite editar asistencias manualmente']);
    }

    public function eliminar($id)
    {
        echo json_encode(['success' => false, 'mensaje' => 'Solo lectura: no se permite eliminar asistencias manualmente']);
    }

    /**
     * Endpoint AJAX llamado desde function_ordenes.js al cargar
     * el detalle de foto domicilio (inicio y fin de la visita).
     *
     * POST: id_orden (int), inicio (datetime), fin (datetime)
     */
    public function registrar_auto()
    {
        $id_orden = (int)($_POST['id_orden'] ?? 0);
        $inicio   = $_POST['inicio']         ?? null;
        $fin      = $_POST['fin']            ?? null;

        if (!$id_orden || !$inicio) {
            echo json_encode([
                'success' => false,
                'mensaje' => 'Parámetros incompletos (id_orden e inicio requeridos)'
            ]);
            return;
        }

        $resultado = $this->assistanceModel->registrar_desde_orden_(
            $id_orden,
            $inicio,
            $fin
        );
        echo json_encode($resultado, JSON_UNESCAPED_UNICODE);
    }
}
