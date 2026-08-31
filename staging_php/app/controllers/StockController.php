<?php
// cespedes/app/controllers/StockController.php — REEMPLAZAR COMPLETO

class StockController extends Controller
{
    private $stockModel;
    private $storeModel;
    private $productModel;
    private $categoryModel;
    private $staffModel;

    public function __construct()
    {
        parent::__construct();
        $this->stockModel    = $this->model('StockModel');
        $this->storeModel    = $this->model('StoreModel');
        $this->productModel  = $this->model('ProductModel');
        $this->categoryModel = $this->model('CategoryModel');
        $this->staffModel    = $this->model('StaffModel');
    }

    public function index()
    {
        $this->requierePermisoVista('stock.ver');

        $almacenes  = $this->storeModel->listar_();
        $categorias = $this->categoryModel->listarActivos_();
        $tecnicos   = $this->staffModel->worker_listar_();

        $data = [
            'titulo'     => 'Stock de Inventario',
            'ocultar_titulo' => true, 'js' => null,
            'modal'      => false,
            'almacenes'  => $almacenes,
            'categorias' => $categorias,
            'tecnicos'   => $tecnicos,
        ];

        $this->view('inventory/stock/index', $data);
    }

    /** Lista stock de almacén con conteos de series (agrupado por producto) */
    public function listar()
    {
        $this->requierePermiso('stock.ver');
        $data = $this->stockModel->listar_();
        echo json_encode($data, JSON_UNESCAPED_UNICODE);
    }

    /** Detalle de series de un producto */
    public function series($id_producto)
    {
        $this->requierePermiso('stock.ver');
        $data = $this->stockModel->series_producto_($id_producto);
        echo json_encode(['success' => true, 'data' => $data ?? []], JSON_UNESCAPED_UNICODE);
    }

    /** Stock asignado a técnicos */
    public function tecnicos()
    {
        $this->requierePermiso('stock.ver');
        $data = $this->stockModel->stock_tecnicos_();
        echo json_encode(['success' => true, 'data' => $data ?? []], JSON_UNESCAPED_UNICODE);
    }

    /** Stock por producto PARA un técnico (tab stockeo a técnico) */
    public function stock_tecnico($id)
    {
        $this->requierePermiso('stock.ver');
        $data = $this->stockModel->stock_tecnico_($id);
        echo json_encode(['success' => true, 'data' => $data ?? []], JSON_UNESCAPED_UNICODE);
    }

    /** Stockeo rápido a un técnico (entregar/devolver en lote) */
    public function stockear_tecnico()
    {
        $this->requierePermiso('stock.editar');
        $respuesta = $this->stockModel->stockear_tecnico_();
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }

    /** Devolver todo el stock de un técnico al almacén */
    public function devolver_todo_tecnico()
    {
        $this->requierePermiso('stock.editar');
        echo json_encode($this->stockModel->devolver_todo_tecnico_(), JSON_UNESCAPED_UNICODE);
    }

    /** Devolver el metraje de un producto DROP al almacén */
    public function devolver_drop()
    {
        $this->requierePermiso('stock.editar');
        echo json_encode($this->stockModel->devolver_drop_(), JSON_UNESCAPED_UNICODE);
    }

    public function editar($id)
    {
        $this->requierePermiso('stock.editar');
        echo json_encode($this->stockModel->editar_($id), JSON_UNESCAPED_UNICODE);
    }

    public function eliminar($id)
    {
        $this->requierePermiso('stock.eliminar');
        echo json_encode($this->stockModel->eliminar_($id), JSON_UNESCAPED_UNICODE);
    }
}

