<?php

class StoreController extends Controller
{
    private $storeModel;

    public function __construct()
    {
        parent::__construct();
        $this->storeModel = $this->model('StoreModel');
    }

    // ========== Metodo index ==========
    public function index()
    {
        $this->requierePermisoVista('almacenes.ver');

        $data = [
            'titulo' => "Almacenes",
            'js' => "almacenes",
            'modal' => true,
            'form' => "almacenes_form"
        ];

        $this->view('inventory/store/index', $data);
    }

    // ========== Metodo listar ==========
    public function listar()
    {
        $this->requierePermiso('almacenes.ver');
        $unidades = $this->storeModel->listar_();
        echo json_encode($unidades, JSON_UNESCAPED_UNICODE);
    }

    // ========== Metodo agregar ==========
    public function agregar()
    {
        $this->requierePermiso('almacenes.crear');
        $respuesta = $this->storeModel->agregar_();
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }

    // ========== Metodo editar ==========
    public function editar($id)
    {
        $this->requierePermiso('almacenes.editar');
        $respuesta = $this->storeModel->editar_($id);
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }

    // ========== Metodo eliminar ==========
    public function eliminar($id)
    {
        $this->requierePermiso('almacenes.eliminar');
        $respuesta = $this->storeModel->eliminar_($id);
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }
}
