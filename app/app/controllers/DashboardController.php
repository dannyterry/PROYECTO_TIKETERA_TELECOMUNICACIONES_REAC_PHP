<?php
// app/controllers/DashboardController.php — REEMPLAZAR COMPLETO

class DashboardController extends Controller
{
    private $dashboardModel;

    public function __construct()
    {
        parent::__construct();
        $this->dashboardModel = $this->model('DashboardModel');
    }

    public function index()
    {
        $id_rol     = $_SESSION['auth']['id_rol']     ?? 0;
        $id_usuario = $_SESSION['auth']['id_usuario'] ?? 0;
        $id_tecnico = null;

        // Si es técnico, obtener su id_trabajador para filtrar
        if ($id_rol != 1) {
            $staffModel = $this->model('StaffModel');
            $trab       = $staffModel->buscar_trabajador_por_usuario_($id_usuario);
            $id_tecnico = $trab ? $trab->id_trabajador : null;
        }

        // KPIs — filtrados si es técnico
        $total_ordenes    = 0;
        $total_materiales = 0;
        $total_usuarios   = 0;
        $total_vehiculos  = 0;

        $r_ordenes = $this->dashboardModel->obtenerTotal_(
            "ordenes" . ($id_tecnico ? " WHERE id_tecnico = $id_tecnico" : "")
        );
        $r_materiales = $this->dashboardModel->obtenerTotal_("productos");
        $r_usuarios   = $this->dashboardModel->obtenerTotal_("usuarios");
        $r_vehiculos  = $this->dashboardModel->obtenerTotal_("vehiculos");

        if ($r_ordenes)    $total_ordenes    = $r_ordenes['data']->total_registros;
        if ($r_materiales) $total_materiales = $r_materiales['data']->total_registros;
        if ($r_usuarios)   $total_usuarios   = $r_usuarios['data']->total_registros;
        if ($r_vehiculos)  $total_vehiculos  = $r_vehiculos['data']->total_registros;

        $data = [
            'ocultar_titulo' => true,
            'titulo'          => 'Dashboard',
            'js'              => 'dashboard',
            'modal'           => false,
            'total_usuarios'  => $total_usuarios,
            'total_ordenes'   => $total_ordenes,
            'total_vehiculos' => $total_vehiculos,
            'total_materiales' => $total_materiales,
            'es_tecnico'      => ($id_rol != 1),
            'id_tecnico'      => $id_tecnico,
        ];

        $this->view('dashboard/index', $data);
    }

    public function listar()
    {
        $unidades = $this->dashboardModel->listar_();
        echo json_encode($unidades, JSON_UNESCAPED_UNICODE);
    }

    public function agregar()
    {
        $respuesta = $this->dashboardModel->agregar_();
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }

    public function editar($id)
    {
        $respuesta = $this->dashboardModel->editar_($id);
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }

    public function eliminar($id)
    {
        $respuesta = $this->dashboardModel->eliminar_($id);
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }

    // Endpoints AJAX — todos filtran por técnico si aplica
    public function ordenes_estado()
    {
        $id_tecnico = $_GET['id_tecnico'] ?? null;
        $data = $this->dashboardModel->obtenerOrdenesPorEstado_($id_tecnico);
        echo json_encode(['success' => true, 'data' => $data ?? []], JSON_UNESCAPED_UNICODE);
    }

    public function liquidaciones_recientes()
    {
        $id_tecnico = $_GET['id_tecnico'] ?? null;
        $data = $this->dashboardModel->obtenerLiquidacionesRecientes_($id_tecnico);
        echo json_encode(['success' => true, 'data' => $data ?? []], JSON_UNESCAPED_UNICODE);
    }

    public function top_materiales()
    {
        $id_tecnico = $_GET['id_tecnico'] ?? null;
        $data = $this->dashboardModel->obtenerTopMateriales_($id_tecnico);
        echo json_encode(['success' => true, 'data' => $data ?? []], JSON_UNESCAPED_UNICODE);
    }

    public function top_tecnicos()
    {
        $data = $this->dashboardModel->obtenerTopTecnicos_();
        echo json_encode(['success' => true, 'data' => $data ?? []], JSON_UNESCAPED_UNICODE);
    }
}
