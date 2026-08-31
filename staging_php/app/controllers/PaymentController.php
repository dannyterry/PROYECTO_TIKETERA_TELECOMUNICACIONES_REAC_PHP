<?php
// app/controllers/PaymentController.php — REPORTE DE PAGOS A TÉCNICOS

class PaymentController extends Controller
{
    private $paymentModel;

    public function __construct()
    {
        parent::__construct();
        $this->paymentModel = $this->model('PaymentModel');
    }

    public function index()
    {
        $this->requierePermisoVista('pagos.ver');

        $data = [
            'titulo' => "Pagos a Técnicos",
            'js'     => "pagos"
        ];

        $this->view('payment/index', $data);
    }

    public function resumen()
    {
        $this->requierePermiso('pagos.ver');

        $desde = trim($_POST['desde'] ?? ($_GET['desde'] ?? ''));
        $hasta = trim($_POST['hasta'] ?? ($_GET['hasta'] ?? ''));
        $estado = trim($_POST['estado'] ?? ($_GET['estado'] ?? ''));

        echo json_encode(
            $this->paymentModel->resumen_($desde, $hasta, $estado),
            JSON_UNESCAPED_UNICODE
        );
    }

    public function detalle($id_trabajador)
    {
        $this->requierePermiso('pagos.ver');

        $desde = trim($_POST['desde'] ?? ($_GET['desde'] ?? ''));
        $hasta = trim($_POST['hasta'] ?? ($_GET['hasta'] ?? ''));
        $estado = trim($_POST['estado'] ?? ($_GET['estado'] ?? ''));

        echo json_encode(
            $this->paymentModel->por_tecnico_((int)$id_trabajador, $desde, $hasta, $estado),
            JSON_UNESCAPED_UNICODE
        );
    }
}
