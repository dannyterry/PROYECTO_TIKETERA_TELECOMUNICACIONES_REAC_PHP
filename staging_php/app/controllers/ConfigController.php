<?php
// app/controllers/ConfigController.php — ARCHIVO NUEVO

class ConfigController extends Controller
{
    private $configModel;

    public function __construct()
    {
        parent::__construct();
        // Solo el administrador puede acceder
        $this->requierePermisoVista('configuracion.ver');
        $this->configModel = $this->model('ConfigModel');
    }

    public function index()
    {
        $grupos = $this->configModel->listarAgrupada_();

        $data = [
            'titulo' => 'Configuración del Sistema',
            'js'     => 'configuracion',
            'modal'  => false,
            'grupos' => $grupos,
        ];

        $this->view('configuration/config/index', $data);
    }

    public function guardar()
    {
        $this->requierePermiso('configuracion.editar');
        $respuesta = $this->configModel->guardar_();
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }
}
