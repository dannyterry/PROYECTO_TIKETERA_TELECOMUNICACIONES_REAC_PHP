<?php

class LiquidationController extends Controller
{
    private $liquidationModel;

    public function __construct()
    {
        parent::__construct();
        $this->liquidationModel = $this->model('LiquidationModel');
    }

    // ========== Vista principal ==========
    public function index()
    {
        $this->requierePermisoVista('liquidaciones.ver');

        $data = [
            'titulo' => "Liquidaciones",
            'js'     => "liquidaciones",
            'modal'  => false,
            'puedeAprobar' => $this->tienePermiso('liquidaciones.aprobar'),
        ];

        $this->view('liquidation/index', $data);
    }

    // ========== Resumen por técnico (tabla izquierda) ==========
    public function resumen_tecnicos()
    {
        $this->requierePermiso('liquidaciones.ver');

        $desde = $_GET['desde'] ?? null;
        $hasta = $_GET['hasta'] ?? null;

        $data = $this->liquidationModel->resumen_tecnicos_($desde, $hasta);
        echo json_encode(['success' => true, 'data' => $data ?? []], JSON_UNESCAPED_UNICODE);
    }

    // ========== Liquidaciones de un técnico (drill-down) ==========
    public function por_tecnico($id_trabajador)
    {
        $this->requierePermiso('liquidaciones.ver');

        $desde = $_GET['desde'] ?? null;
        $hasta = $_GET['hasta'] ?? null;

        $data = $this->liquidationModel->por_tecnico_($id_trabajador, $desde, $hasta);
        echo json_encode(['success' => true, 'data' => $data ?? []], JSON_UNESCAPED_UNICODE);
    }

    // ========== Detalle completo de una liquidación ==========
    // Se permite con 'liquidaciones.ver' (módulo de reporte admin) O con
    // 'ordenes.liquidar' (un técnico viendo su propia liquidación desde
    // el botón "Liquidación" en Órdenes) — no exigimos el permiso admin
    // completo solo para que alguien vea algo que él mismo liquidó.
    public function detalle($id_liquidacion)
    {
        $tienePermisoAdmin   = $this->tienePermiso('liquidaciones.ver');
        $tienePermisoTecnico = $this->tienePermiso('ordenes.liquidar');

        if (!$tienePermisoAdmin && !$tienePermisoTecnico) {
            http_response_code(403);
            echo json_encode(['success' => false, 'mensaje' => 'No tienes permiso para realizar esta acción.'], JSON_UNESCAPED_UNICODE);
            return;
        }

        // Sin el permiso admin, solo puede ver sus propias liquidaciones
        if (!$tienePermisoAdmin) {
            $id_usuario = $_SESSION['auth']['id_usuario'] ?? null;

            if (!$id_usuario || !$this->liquidationModel->esDuenio_($id_liquidacion, $id_usuario)) {
                http_response_code(403);
                echo json_encode(['success' => false, 'mensaje' => 'No tienes permiso para ver esta liquidación.'], JSON_UNESCAPED_UNICODE);
                return;
            }
        }

        $data = $this->liquidationModel->detalle_($id_liquidacion);

        if (!$data) {
            echo json_encode(['success' => false, 'mensaje' => 'Liquidación no encontrada'], JSON_UNESCAPED_UNICODE);
            return;
        }

        echo json_encode(['success' => true, 'data' => $data], JSON_UNESCAPED_UNICODE);
    }

    // ========== Aprobar / Rechazar una liquidación ==========
    // Al rechazar se exige un motivo (visible para el técnico) y el modelo
    // revierte todo el movimiento de stock generado por la liquidación.
    public function cambiar_estado($id_liquidacion)
    {
        $this->requierePermiso('liquidaciones.aprobar');

        $nuevo_estado   = $_POST['estado']        ?? '';
        $motivo_rechazo = $_POST['motivo_rechazo'] ?? null;

        $respuesta = $this->liquidationModel->cambiar_estado_($id_liquidacion, $nuevo_estado, $motivo_rechazo);
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }
}
