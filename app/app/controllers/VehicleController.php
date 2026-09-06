<?php

class VehicleController extends Controller
{
    private $vehicleModel;
    private $brandModel;
    private $patternModel;
    private $vehicleTypeModel;
    private $fuelModel;

    public function __construct()
    {
        parent::__construct();
        $this->vehicleModel = $this->model("VehicleModel");
        $this->brandModel = $this->model("BrandModel");
        $this->patternModel = $this->model("PatternModel");
        $this->vehicleTypeModel = $this->model("VehicleTypeModel");
        $this->fuelModel = $this->model("FuelModel");
    }

    // ========== Metodo index ==========
    public function index()
    {
        $this->requierePermisoVista("vehiculos.ver");

        $data = [
            "titulo" => "Vehículos y Flota",
            "ocultar_titulo" => true,
            "js" => null,
            "modal" => false
        ];

        $this->view("mobility/vehicle/index", $data);
    }

    // ========== Metodo listar ==========
    public function listar()
    {
        $this->requierePermiso("vehiculos.ver");
        $unidades = $this->vehicleModel->listar_();
        echo json_encode($unidades, JSON_UNESCAPED_UNICODE);
    }

    // ========== Metodo agregar ==========
    public function agregar()
    {
        $this->requierePermiso("vehiculos.crear");
        $respuesta = $this->vehicleModel->agregar_();
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }

    // ========== Metodo eliminar ==========
    public function eliminar($id)
    {
        $this->requierePermiso("vehiculos.eliminar");
        $respuesta = $this->vehicleModel->eliminar_($id);
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }

    // ========== Metodo buscar ==========
    public function buscar($id)
    {
        $this->requierePermiso("vehiculos.editar");
        $unidad = $this->vehicleModel->buscar_($id);
        echo json_encode($unidad, JSON_UNESCAPED_UNICODE);
    }

    // ========== Metodo actualizar ==========
    public function actualizar($id)
    {
        $this->requierePermiso("vehiculos.editar");
        $respuesta = $this->vehicleModel->actualizar_($id);
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }
}

