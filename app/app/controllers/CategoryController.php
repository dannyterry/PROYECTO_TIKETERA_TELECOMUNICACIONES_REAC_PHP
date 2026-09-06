<?php

class CategoryController extends Controller
{
    private $categoryModel;

    public function __construct()
    {
        parent::__construct();
        $this->categoryModel = $this->model('CategoryModel');
    }

    // ========== Metodo index ==========
    public function index()
    {
        $this->requierePermisoVista('categorias.ver');

        $data = [
            'titulo' => "Categorias",
            'js' => "categorias",
            'modal' => true,
            'form' => "categorias_form"
        ];

        $this->view('inventory/category/index', $data);
    }

    // ========== Metodo listar ==========
    public function listar()
    {
        $this->requierePermiso('categorias.ver');
        $unidades = $this->categoryModel->listar_();
        echo json_encode($unidades, JSON_UNESCAPED_UNICODE);
    }

    // ========== Metodo agregar ==========
    public function agregar()
    {
        $this->requierePermiso('categorias.crear');
        $respuesta = $this->categoryModel->agregar_();
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }

    // ========== Metodo editar ==========
    public function editar($id)
    {
        $this->requierePermiso('categorias.editar');
        $respuesta = $this->categoryModel->editar_($id);
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }

    // ========== Metodo eliminar ==========
    public function eliminar($id)
    {
        $this->requierePermiso('categorias.eliminar');
        $respuesta = $this->categoryModel->eliminar_($id);
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }
}
