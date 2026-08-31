<?php

class TipoTrabajoController extends Controller
{
    private $tipoTrabajoModel;

    public function __construct()
    {
        parent::__construct();
        $this->tipoTrabajoModel = $this->model('TipoTrabajoModel');
    }

    // ========== Metodo index ==========
    public function index()
    {
        $this->requierePermisoVista('tipo_trabajo.ver');

        $data = [
            'titulo' => "Tipos de trabajo",
            'js'     => "tipo_trabajo",
            'modal'  => true,
            'form'   => "tipo_trabajo_form",
        ];

        $this->view('configuration/tipo_trabajo/index', $data);
    }

    // ========== Metodo listar ==========
    public function listar()
    {
        $this->requierePermiso('tipo_trabajo.ver');
        echo json_encode($this->tipoTrabajoModel->listar_(), JSON_UNESCAPED_UNICODE);
    }

    // ========== Metodo agregar ==========
    public function agregar()
    {
        $this->requierePermiso('tipo_trabajo.crear');
        echo json_encode($this->tipoTrabajoModel->agregar_(), JSON_UNESCAPED_UNICODE);
    }

    // ========== Metodo editar ==========
    public function editar($id)
    {
        $this->requierePermiso('tipo_trabajo.editar');
        echo json_encode($this->tipoTrabajoModel->editar_($id), JSON_UNESCAPED_UNICODE);
    }

    // ========== Metodo eliminar ==========
    public function eliminar($id)
    {
        $this->requierePermiso('tipo_trabajo.eliminar');
        echo json_encode($this->tipoTrabajoModel->eliminar_($id), JSON_UNESCAPED_UNICODE);
    }
}
