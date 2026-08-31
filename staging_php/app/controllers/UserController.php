<?php

class UserController extends Controller
{
    private $userModel;
    private $rolModel;

    public function __construct()
    {
        parent::__construct();
        $this->userModel = $this->model('UserModel');
        $this->rolModel = $this->model('RolModel');
    }

    // ========== Metodo index ==========
    public function index()
    {
        $this->requierePermisoVista('usuarios.ver');

        $roles = $this->rolModel->listar_();

        $data = [
            'titulo' => "Personal / Empleados",
            'ocultar_titulo' => true,
            'js' => null,
            'modal' => false,
            'roles' => $roles
        ];

        $this->view('human_resources/user/index', $data);
    }

    // ========== Metodo listar ==========
    public function listar()
    {
        $this->requierePermiso('usuarios.ver');
        $unidades = $this->userModel->listar_();
        echo json_encode($unidades, JSON_UNESCAPED_UNICODE);
    }

    // ========== Metodo agregar ==========
    public function agregar()
    {
        $this->requierePermiso('usuarios.crear');
        $respuesta = $this->userModel->agregar_();
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }

    // ========== Metodo editar ==========
    public function editar($id)
    {
        $this->requierePermiso('usuarios.editar');
        $respuesta = $this->userModel->editar_($id);
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }

    // ========== Metodo eliminar ==========
    public function eliminar($id)
    {
        $this->requierePermiso('usuarios.eliminar');
        $respuesta = $this->userModel->eliminar_($id);
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }

    // ========== Activar / Inactivar rápido desde el listado ==========
    public function cambiar_estado($id)
    {
        $this->requierePermiso('usuarios.editar');
        $estado = $_POST['estado'] ?? '';
        $respuesta = $this->userModel->cambiar_estado_($id, $estado);
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }

    // ========== Consultar DNI (apiperu.dev) ==========
    public function consultar_dni($dni)
    {
        $this->requierePermiso('usuarios.ver');
        $respuesta = $this->userModel->consultar_dni_($dni);
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }

    // ========== Consultar RUC (apiperu.dev) ==========
    public function consultar_ruc($ruc)
    {
        $this->requierePermiso('usuarios.ver');
        $respuesta = $this->userModel->consultar_ruc_($ruc);
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }

    // ========== Comisiones pensionarias (ONP fijo + AFP desde SBS) ==========
    public function comisiones_pensionarias()
    {
        $afp = obtenerComisionesAFP();

        echo json_encode([
            "success" => true,
            "onp" => [
                "aporte_obligatorio" => "13.00%",
                "info" => "La ONP aplica una retención única del 13% sobre la remuneración bruta. No incluye cobro de comisiones ni primas de seguro por separado."
            ],
            "afp" => $afp
        ], JSON_UNESCAPED_UNICODE);
    }
}
