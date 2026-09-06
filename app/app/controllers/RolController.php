<?php

class RolController extends Controller
{
    private $rolModel;

    public function __construct()
    {
        parent::__construct();
        $this->rolModel = $this->model('RolModel');
    }

    // ========== Metodo index ==========
    public function index()
    {
        $this->requierePermisoVista('roles.ver');

        $data = [
            'titulo' => "Roles",
            'js' => "roles",
            'modal' => true,
            'form' => "roles_form",
            'areas' => $this->rolModel->listarAreas_()
        ];

        $this->view('human_resources/rol/index', $data);
    }

    // ========== Metodo listar ==========
    public function listar()
    {
        $this->requierePermiso('roles.ver');
        $unidades = $this->rolModel->listar_();
        echo json_encode($unidades, JSON_UNESCAPED_UNICODE);
    }

    // ========== Metodo agregar ==========
    public function agregar()
    {
        $this->requierePermiso('roles.crear');
        $respuesta = $this->rolModel->agregar_();
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }

    // ========== Metodo editar ==========
    public function editar($id)
    {
        $this->requierePermiso('roles.editar');
        $respuesta = $this->rolModel->editar_($id);
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }

    // ========== Metodo eliminar ==========
    public function eliminar($id)
    {
        $this->requierePermiso('roles.eliminar');
        $respuesta = $this->rolModel->eliminar_($id);
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }

    // ========== Todos los roles con sus áreas (para el combo del usuario) ==========
    public function areas_por_rol()
    {
        $this->requierePermiso('roles.ver');
        echo json_encode($this->rolModel->listarAreasPorRol_(), JSON_UNESCAPED_UNICODE);
    }

    // ========== Agregar un área nueva al catálogo (desde el form de rol) ==========
    public function agregar_area()
    {
        $this->requierePermiso('roles.editar');
        $respuesta = $this->rolModel->agregarArea_();
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }
}
