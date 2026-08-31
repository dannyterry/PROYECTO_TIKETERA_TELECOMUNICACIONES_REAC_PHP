<?php

class StaffController extends Controller
{
    private $staffModel;
    private $userModel;
    private $scheduleModel;
    private $vehicleModel;
    private $productModel;

    public function __construct()
    {
        parent::__construct();
        $this->staffModel = $this->model('StaffModel');
        $this->userModel = $this->model('UserModel');
        $this->scheduleModel = $this->model('ScheduleModel');
        $this->vehicleModel = $this->model('VehicleModel');
        $this->productModel = $this->model('ProductModel');
    }

    // ========== Metodo index ==========
    public function index()
    {
        $data = [
            'titulo' => "Personal",
            'js' => "staff",
            'modal' => false,
        ];

        $this->view('staff/index', $data);
    }

    // ========== Metodo tecnicos ==========
    public function worker()
    {
        $this->requierePermisoVista('trabajadores.ver');

        $usuarios = $this->userModel->listar_();
        $vehiculos = $this->vehicleModel->listar_();
        $horarios = $this->scheduleModel->listar_();
        $productos = $this->productModel->listar_ps_();

        $data = [
            'titulo' => "Trabajadores",
            'js' => "trabajadores",
            'modal' => true,
            'form' => "trabajadores_form",
            'form2' => "trabajadores_stock_form",
            'usuarios' => $usuarios,
            'horarios' => $horarios,
            'vehiculos' => $vehiculos,
            'productos' => $productos,
            'modal_size' => 'modal-lg'
        ];

        $this->view('staff/worker/index', $data);
    }

    // ========== Metodo listar ==========
    public function worker_listar()
    {
        $this->requierePermiso('trabajadores.ver');
        $unidades = $this->staffModel->worker_listar_();
        echo json_encode($unidades, JSON_UNESCAPED_UNICODE);
    }

    // ========== Metodo obtener stockear ==========
    public function obtener_stock($id)
    {
        $this->requierePermiso('trabajadores.ver');
        $respuesta = $this->staffModel->obtener_stock_($id);
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }

    // ========== Metodo stockear ==========
    public function agregar_stock()
    {
        $this->requierePermiso('trabajadores.editar');
        $respuesta = $this->staffModel->agregar_stock_();
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }


    // ========== Metodo listar ==========
    public function listar()
    {
        $this->requierePermiso('trabajadores.ver');
        $unidades = $this->staffModel->listar_();
        echo json_encode($unidades, JSON_UNESCAPED_UNICODE);
    }

    // ========== Metodo agregar ==========
    public function agregar()
    {
        $this->requierePermiso('trabajadores.crear');
        $respuesta = $this->staffModel->agregar_();
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }

    // ========== Metodo editar ==========
    public function editar($id)
    {
        $this->requierePermiso('trabajadores.editar');
        $respuesta = $this->staffModel->editar_($id);
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }

    // ========== Metodo eliminar ==========
    public function eliminar($id)
    {
        $this->requierePermiso('trabajadores.eliminar');
        $respuesta = $this->staffModel->eliminar_($id);
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }
}
