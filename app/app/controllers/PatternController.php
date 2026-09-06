<?php

class PatternController extends Controller
{
    private $patternModel;

    public function __construct()
    {
        parent::__construct();
        $this->patternModel = $this->model('PatternModel');
    }

    // ========== Metodo index ==========
    public function index()
    {
        $this->requierePermisoVista('modelos.ver');

        $data = [
            'titulo' => "Modelos",
            'js' => "modelos",
            'modal' => true,
            'form' => "modelos_form"
        ];

        $this->view('mobility/pattern/index', $data);
    }

    // ========== Metodo listar ==========
    public function listar()
    {
        $this->requierePermiso('modelos.ver');
        $unidades = $this->patternModel->listar_();
        echo json_encode($unidades, JSON_UNESCAPED_UNICODE);
    }

    // ========== Metodo agregar ==========
    public function agregar()
    {
        $this->requierePermiso('modelos.crear');
        $respuesta = $this->patternModel->agregar_();
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }

    // ========== Metodo editar ==========
    public function editar($id)
    {
        $this->requierePermiso('modelos.editar');
        $respuesta = $this->patternModel->editar_($id);
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }

    // ========== Metodo eliminar ==========
    public function eliminar($id)
    {
        $this->requierePermiso('modelos.eliminar');
        $respuesta = $this->patternModel->eliminar_($id);
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }
}
