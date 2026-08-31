<?php

class BrandController extends Controller
{
    private $brandModel;

    public function __construct()
    {
        parent::__construct();
        $this->brandModel = $this->model('BrandModel');
    }

    // ========== Metodo index ==========
    public function index()
    {
        $this->requierePermisoVista('marcas.ver');

        $data = [
            'titulo' => "Marcas",
            'js' => "marcas",
            'modal' => true,
            'form' => "marcas_form"
        ];

        $this->view('mobility/brand/index', $data);
    }

    // ========== Metodo listar ==========
    public function listar()
    {
        $this->requierePermiso('marcas.ver');
        $unidades = $this->brandModel->listar_();
        echo json_encode($unidades, JSON_UNESCAPED_UNICODE);
    }

    // ========== Metodo agregar ==========
    public function agregar()
    {
        $this->requierePermiso('marcas.crear');
        $respuesta = $this->brandModel->agregar_();
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }

    // ========== Metodo editar ==========
    public function editar($id)
    {
        $this->requierePermiso('marcas.editar');
        $respuesta = $this->brandModel->editar_($id);
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }

    // ========== Metodo eliminar ==========
    public function eliminar($id)
    {
        $this->requierePermiso('marcas.eliminar');
        $respuesta = $this->brandModel->eliminar_($id);
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }
}
