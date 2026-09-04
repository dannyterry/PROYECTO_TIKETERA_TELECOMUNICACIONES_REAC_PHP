<?php
// app/controllers/ReportController.php — REEMPLAZAR COMPLETO

class ReportController extends Controller
{
    private $reportModel;

    public function __construct()
    {
        parent::__construct();
        $this->reportModel = $this->model('ReportModel');
    }

    public function index()
    {
        $anios = $this->reportModel->anios_disponibles_();
        if (empty($anios)) $anios = [date('Y')];

        $data = [
            'titulo' => 'Reportes',
            'ocultar_titulo' => true,
            'js'     => false,
            'modal'  => false,
            'anios'  => $anios,
        ];

        $this->view('report/index', $data);
    }

    // ── Helper: leer desde/hasta del GET ─────────────────────────────────
    private function _rango()
    {
        return [
            'desde' => $_GET['desde'] ?? null,
            'hasta' => $_GET['hasta'] ?? null,
        ];
    }

    // ── AJAX endpoints ────────────────────────────────────────────────────

    public function kpis()
    {
        ['desde' => $d, 'hasta' => $h] = $this->_rango();
        echo json_encode(
            ['success' => true, 'data' => $this->reportModel->kpis_($d, $h)],
            JSON_UNESCAPED_UNICODE
        );
    }

    public function ordenes_estado()
    {
        ['desde' => $d, 'hasta' => $h] = $this->_rango();
        $data = $this->reportModel->ordenes_por_estado_($d, $h);
        echo json_encode(['success' => true, 'data' => $data ?? []], JSON_UNESCAPED_UNICODE);
    }

    public function ordenes_tecnico()
    {
        ['desde' => $d, 'hasta' => $h] = $this->_rango();
        $data = $this->reportModel->ordenes_por_tecnico_($d, $h);
        echo json_encode(['success' => true, 'data' => $data ?? []], JSON_UNESCAPED_UNICODE);
    }

    public function ordenes_mes()
    {
        $anio = $_GET['anio'] ?? date('Y');
        ['desde' => $d, 'hasta' => $h] = $this->_rango();
        $data = $this->reportModel->ordenes_por_mes_($anio, $d, $h);
        echo json_encode(['success' => true, 'data' => $data ?? []], JSON_UNESCAPED_UNICODE);
    }

    public function liquidaciones_tecnico()
    {
        ['desde' => $d, 'hasta' => $h] = $this->_rango();
        $data = $this->reportModel->liquidaciones_por_tecnico_($d, $h);
        echo json_encode(['success' => true, 'data' => $data ?? []], JSON_UNESCAPED_UNICODE);
    }

    public function materiales_usados()
    {
        ['desde' => $d, 'hasta' => $h] = $this->_rango();
        $data = $this->reportModel->materiales_mas_usados_($d, $h);
        echo json_encode(['success' => true, 'data' => $data ?? []], JSON_UNESCAPED_UNICODE);
    }

    public function stock_almacen()
    {
        $data = $this->reportModel->stock_por_almacen_();
        echo json_encode(['success' => true, 'data' => $data ?? []], JSON_UNESCAPED_UNICODE);
    }

    public function compras_proveedor()
    {
        $anio = $_GET['anio'] ?? date('Y');
        ['desde' => $d, 'hasta' => $h] = $this->_rango();
        $data = $this->reportModel->compras_por_proveedor_($anio, $d, $h);
        echo json_encode(['success' => true, 'data' => $data ?? []], JSON_UNESCAPED_UNICODE);
    }

    public function series_estado()
    {
        $data = $this->reportModel->series_por_estado_();
        echo json_encode(['success' => true, 'data' => $data ?? []], JSON_UNESCAPED_UNICODE);
    }

    public function movimientos_recientes()
    {
        $data = $this->reportModel->movimientos_recientes_();
        echo json_encode(['success' => true, 'data' => $data ?? []], JSON_UNESCAPED_UNICODE);
    }
}
