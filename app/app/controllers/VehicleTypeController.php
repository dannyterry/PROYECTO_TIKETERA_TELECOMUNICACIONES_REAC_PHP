<?php

class VehicleTypeController extends Controller
{
    private $vehicleTypeModel;

    public function __construct()
    {
        parent::__construct();
        $this->vehicleTypeModel = $this->model('VehicleTypeModel');
    }

    // ========== Metodo index ==========
    public function index()
    {
        $this->requierePermisoVista('tipos_vehiculo.ver');

        $data = [
            'titulo' => "Tipos de Vehiculo",
            'js' => "tipos_vehiculo",
            'modal' => true,
            'form' => "tipos_vehiculo_form"
        ];

        $this->view('mobility/vehicleType/index', $data);
    }

    // ========== Metodo listar ==========
    public function listar()
    {
        $this->requierePermiso('tipos_vehiculo.ver');
        $unidades = $this->vehicleTypeModel->listar_();
        echo json_encode($unidades, JSON_UNESCAPED_UNICODE);
    }

    // ========== Metodo agregar ==========
    public function agregar()
    {
        $this->requierePermiso('tipos_vehiculo.crear');
        $respuesta = $this->vehicleTypeModel->agregar_();
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }

    // ========== Metodo editar ==========
    public function editar($id)
    {
        $this->requierePermiso('tipos_vehiculo.editar');
        $respuesta = $this->vehicleTypeModel->editar_($id);
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }

    // ========== Metodo eliminar ==========
    public function eliminar($id)
    {
        $this->requierePermiso('tipos_vehiculo.eliminar');
        $respuesta = $this->vehicleTypeModel->eliminar_($id);
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }
}
