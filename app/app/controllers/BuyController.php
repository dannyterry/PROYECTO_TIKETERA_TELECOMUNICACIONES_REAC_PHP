<?php
// app/controllers/BuyController.php — REEMPLAZAR COMPLETO
// FIX: pasaba $this->productModel->listar_() (sin series), ahora pasa listar_ps_()
// para que el form sepa qué productos manejan series y cuáles no.

class BuyController extends Controller
{
    private $buyModel;
    private $productModel;
    private $supplierModel;
    private $storeModel;

    public function __construct()
    {
        parent::__construct();
        $this->buyModel      = $this->model('BuyModel');
        $this->productModel  = $this->model('ProductModel');
        $this->supplierModel = $this->model('SupplierModel');
        $this->storeModel    = $this->model('StoreModel');
    }

    public function index()
    {
        $this->requierePermisoVista('compras.ver');

        // listar_ps_() devuelve productos con sus series DISPONIBLES agrupadas
        $productos   = $this->productModel->listar_ps_();
        $proveedores = $this->supplierModel->listar_();
        $almacenes   = $this->storeModel->listar_();

        $data = [
            'titulo'     => 'Compras',
            'js'         => 'compras',
            'modal'      => true,
            'form'       => 'compras_form',
            'form2'      => false,
            'modal_size' => 'modal-lg',
            'proveedores' => $proveedores,
            'almacenes'   => $almacenes,
            'productos'   => $productos,
        ];

        $this->view('inventory/buy/index', $data);
    }

    public function listar()
    {
        $this->requierePermiso('compras.ver');
        echo json_encode($this->buyModel->listar_(), JSON_UNESCAPED_UNICODE);
    }

    public function agregar()
    {
        $this->requierePermiso('compras.crear');
        echo json_encode($this->buyModel->agregar_(), JSON_UNESCAPED_UNICODE);
    }

    public function editar($id)
    {
        $this->requierePermiso('compras.editar');
        echo json_encode($this->buyModel->editar_($id), JSON_UNESCAPED_UNICODE);
    }

    public function eliminar($id)
    {
        $this->requierePermiso('compras.eliminar');
        echo json_encode($this->buyModel->eliminar_($id), JSON_UNESCAPED_UNICODE);
    }
}
