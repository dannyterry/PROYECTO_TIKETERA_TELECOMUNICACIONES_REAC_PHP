<?php

class SupplierController extends Controller
{
    private $supplierModel;

    public function __construct()
    {
        parent::__construct();
        $this->supplierModel = $this->model('SupplierModel');
    }

    // ========== Metodo index ==========
    public function index()
    {
        $this->requierePermisoVista('proveedores.ver');

        $data = [
            'titulo' => "Proveedores",
            'js' => "proveedores",
            'modal' => true,
            'form' => "proveedores_form"
        ];

        $this->view('inventory/supplier/index', $data);
    }

    // ========== Metodo listar ==========
    public function listar()
    {
        $this->requierePermiso('proveedores.ver');
        $unidades = $this->supplierModel->listar_();
        echo json_encode($unidades, JSON_UNESCAPED_UNICODE);
    }

    // ========== Metodo agregar ==========
    public function agregar()
    {
        $this->requierePermiso('proveedores.crear');
        $respuesta = $this->supplierModel->agregar_();
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }

    // ========== Metodo editar ==========
    public function editar($id)
    {
        $this->requierePermiso('proveedores.editar');
        $respuesta = $this->supplierModel->editar_($id);
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }

    // ========== Metodo eliminar ==========
    public function eliminar($id)
    {
        $this->requierePermiso('proveedores.eliminar');
        $respuesta = $this->supplierModel->eliminar_($id);
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }
}
