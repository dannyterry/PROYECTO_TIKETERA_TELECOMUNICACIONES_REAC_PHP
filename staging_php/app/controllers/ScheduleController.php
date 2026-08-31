<?php

class ScheduleController extends Controller
{
    private $scheduleModel;

    public function __construct()
    {
        parent::__construct();
        $this->scheduleModel = $this->model('ScheduleModel');
    }

    // ========== Metodo index ==========
    public function index()
    {
        $this->requierePermisoVista('horarios.ver');

        $data = [
            'titulo' => "Horario",
            'js' => "horarios",
            'modal' => true,
            'form' => 'horarios_form',
        ];

        $this->view('human_resources/schedule/index', $data);
    }

    // ========== Metodo listar ==========
    public function listar()
    {
        $this->requierePermiso('horarios.ver');
        $unidades = $this->scheduleModel->listar_();
        echo json_encode($unidades, JSON_UNESCAPED_UNICODE);
    }

    // ========== Metodo agregar ==========
    public function agregar()
    {
        $this->requierePermiso('horarios.crear');
        $respuesta = $this->scheduleModel->agregar_();
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }

    // ========== Metodo editar ==========
    public function editar($id)
    {
        $this->requierePermiso('horarios.editar');
        $respuesta = $this->scheduleModel->editar_($id);
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }

    // ========== Metodo eliminar ==========
    public function eliminar($id)
    {
        $this->requierePermiso('horarios.eliminar');
        $respuesta = $this->scheduleModel->eliminar_($id);
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }
}
