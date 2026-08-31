<?php

class FuelController extends Controller
{
    private $fuelModel;

    public function __construct()
    {
        parent::__construct();
        $this->fuelModel = $this->model("FuelModel");
    }

    // ========== Metodo index ==========
    public function index()
    {
        $this->requierePermisoVista("combustibles.ver");

        $data = [
            "titulo" => "Control de Combustible",
            "ocultar_titulo" => true,
            "js" => null,
            "modal" => false
        ];

        $this->view("mobility/fuel/index", $data);
    }

    // ========== Metodo listar ==========
    public function listar()
    {
        $this->requierePermiso("combustibles.ver");
        $unidades = $this->fuelModel->listar_();
        echo json_encode($unidades, JSON_UNESCAPED_UNICODE);
    }

    // ========== Metodo agregar ==========
    public function agregar()
    {
        $this->requierePermiso("combustibles.crear");
        $respuesta = $this->fuelModel->agregar_();
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }

    // ========== Metodo eliminar ==========
    public function eliminar($id)
    {
        $this->requierePermiso("combustibles.eliminar");
        $respuesta = $this->fuelModel->eliminar_($id);
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }

    // ========== Metodo buscar ==========
    public function buscar($id)
    {
        $this->requierePermiso("combustibles.editar");
        $unidad = $this->fuelModel->buscar_($id);
        echo json_encode($unidad, JSON_UNESCAPED_UNICODE);
    }

    // ========== Metodo actualizar ==========
    public function actualizar($id)
    {
        $this->requierePermiso("combustibles.editar");
        $respuesta = $this->fuelModel->actualizar_($id);
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }
}

