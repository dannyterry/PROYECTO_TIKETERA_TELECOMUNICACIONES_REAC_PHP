<?php
// app/controllers/ProductController.php — REEMPLAZAR COMPLETO

class ProductController extends Controller
{
    private $productModel;
    private $storeModel;
    private $categoryModel;

    public function __construct()
    {
        parent::__construct();
        $this->productModel  = $this->model('ProductModel');
        $this->storeModel    = $this->model('StoreModel');
        $this->categoryModel = $this->model('CategoryModel');
    }

    public function index()
    {
        $this->requierePermisoVista('productos.ver');

        $almacenes  = $this->storeModel->listar_();
        $categorias = $this->categoryModel->listar_();

        $data = [
            'titulo'     => 'Productos',
            'ocultar_titulo' => true, 'js' => null, 'modal' => false,
            'form'       => 'productos_form',
            'modal_size' => 'modal-lg',
            'almacenes'  => $almacenes,
            'categorias' => $categorias,
        ];
        $this->view('inventory/product/index', $data);
    }

    public function listar()
    {
        $this->requierePermiso('productos.ver');
        echo json_encode($this->productModel->listar_(), JSON_UNESCAPED_UNICODE);
    }

    // Catálogo de EQUIPOS activos (categoría_liquidar = 'EQUIPO'). Lo usa el
    // técnico al dar de baja un equipo por cámara: solo necesita ver el tipo
    // de equipo, por eso no requiere permiso de productos sino el de liquidar.
    public function listar_equipos()
    {
        $this->requierePermiso('ordenes.liquidar');
        echo json_encode($this->productModel->listarEquipos_() ?? [], JSON_UNESCAPED_UNICODE);
    }

    // Nuevo: endpoint para generar código automático
    public function generar_codigo()
    {
        $this->requierePermiso('productos.crear');
        echo json_encode([
            'success' => true,
            'codigo'  => $this->productModel->generarCodigo_()
        ]);
    }

    public function validar_serie()
    {
        $this->requierePermiso('productos.ver');
        $serie = $_POST['serie'] ?? '';

        $existe = $this->productModel->existe_serie_($serie);

        echo json_encode([
            'existe' => $existe
        ]);
    }


    // Nuevo: endpoint para series disponibles (usado por Movimientos)
    public function listar_ps()
    {
        $this->requierePermiso('productos.ver');
        echo json_encode($this->productModel->listar_ps_() ?? [], JSON_UNESCAPED_UNICODE);
    }

    public function agregar()
    {
        $this->requierePermiso('productos.crear');
        echo json_encode($this->productModel->agregar_(), JSON_UNESCAPED_UNICODE);
    }

    public function editar($id)
    {
        $this->requierePermiso('productos.editar');
        echo json_encode($this->productModel->editar_($id), JSON_UNESCAPED_UNICODE);
    }

    public function eliminar($id)
    {
        $this->requierePermiso('productos.eliminar');
        echo json_encode($this->productModel->eliminar_($id), JSON_UNESCAPED_UNICODE);
    }
}

