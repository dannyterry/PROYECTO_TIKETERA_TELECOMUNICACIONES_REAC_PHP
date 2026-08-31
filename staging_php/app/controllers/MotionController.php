<?php
// app/controllers/MotionController.php — REEMPLAZAR COMPLETO
// FIX: no pasaba 'form2' → modal.php lanzaba "undefined variable $form2"
// NUEVO: pasa productos_con_series para el selector de series en el form

class MotionController extends Controller
{
    private $motionModel;
    private $productModel;
    private $storeModel;

    public function __construct()
    {
        parent::__construct();
        $this->motionModel  = $this->model('MotionModel');
        $this->productModel = $this->model('ProductModel');
        $this->storeModel   = $this->model('StoreModel');
    }

    public function index()
    {
        $this->requierePermisoVista('movimientos.ver');

        $productos           = $this->productModel->listar_();
        $almacenes           = $this->storeModel->listar_();
        $productos_con_series = $this->productModel->listar_ps_(); // para selector de series

        $data = [
            'titulo'               => 'Movimientos',
            'js'                   => 'movimientos',
            'modal'                => true,
            'form'                 => 'movimientos_form',
            'form2'                => false,          // ← FIX: evita undefined variable
            'modal_size'           => 'modal-lg',
            'almacenes'            => $almacenes,
            'productos'            => $productos,
            'productos_con_series' => $productos_con_series,
        ];

        $this->view('inventory/motion/index', $data);
    }

    public function listar()
    {
        $this->requierePermiso('movimientos.ver');
        echo json_encode($this->motionModel->listar_(), JSON_UNESCAPED_UNICODE);
    }

    public function agregar()
    {
        $this->requierePermiso('movimientos.crear');
        echo json_encode($this->motionModel->agregar_(), JSON_UNESCAPED_UNICODE);
    }

    public function editar($id)
    {
        $this->requierePermiso('movimientos.editar');
        echo json_encode($this->motionModel->editar_($id), JSON_UNESCAPED_UNICODE);
    }

    public function eliminar($id)
    {
        $this->requierePermiso('movimientos.eliminar');
        echo json_encode($this->motionModel->eliminar_($id), JSON_UNESCAPED_UNICODE);
    }
}
