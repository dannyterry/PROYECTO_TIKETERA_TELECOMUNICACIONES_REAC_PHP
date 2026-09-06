<?php

class ReasonController extends Controller
{
    private $reasonModel;
    private $tipoTrabajoModel;
    private $productModel;

    public function __construct()
    {
        parent::__construct();
        $this->reasonModel = $this->model('ReasonModel');
        $this->tipoTrabajoModel = $this->model('TipoTrabajoModel');
        $this->productModel = $this->model('ProductModel');
    }

    // ========== Metodo index ==========
    public function index()
    {
        $this->requierePermisoVista('motivos.ver');

        $data = [
            'titulo'        => "Motivos",
            'js'            => "motivos",
            'modal'         => true,
            'form'          => "motivos_form",
            'tipo_trabajos' => $this->tipoTrabajoModel->listarNombres_(),
            'productos'     => array_map(function ($p) {
                return [
                    'id_producto' => (int)$p->id_producto,
                    'nombre'      => $p->nombre,
                    'es_drop'     => (int)($p->es_drop ?? 0)
                ];
            }, $this->productModel->listar_())
        ];

        $this->view('configuration/reason/index', $data);
    }

    // ========== Metodo listar ==========
    public function listar()
    {
        $this->requierePermiso('motivos.ver');
        $unidades = $this->reasonModel->listar_();
        echo json_encode($unidades, JSON_UNESCAPED_UNICODE);
    }

    // ========== Metodo agregar ==========
    public function agregar()
    {
        $this->requierePermiso('motivos.crear');
        $respuesta = $this->reasonModel->agregar_();
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }

    // ========== Metodo editar ==========
    public function editar($id)
    {
        $this->requierePermiso('motivos.editar');
        $respuesta = $this->reasonModel->editar_($id);
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }

    // ========== Metodo eliminar ==========
    public function eliminar($id)
    {
        $this->requierePermiso('motivos.eliminar');
        $respuesta = $this->reasonModel->eliminar_($id);
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }
}
