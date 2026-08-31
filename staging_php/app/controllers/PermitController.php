<?php
// cespedes/app/controllers/PermitController.php — REEMPLAZAR COMPLETO

class PermitController extends Controller
{
    private $permitModel;
    private $rolModel;

    public function __construct()
    {
        parent::__construct();
        $this->permitModel = $this->model('PermitModel');
        $this->rolModel    = $this->model('RolModel');
    }

    /** Vista principal — cards por rol */
    public function index()
    {
        $this->requierePermisoVista('permisos.ver');

        $roles = $this->rolModel->listar_();

        $data = [
            'titulo'   => 'Permisos',
            'js'       => 'permisos',
            'modal'    => false,
            'roles'    => $roles,
            // Catálogo completo agrupado por área (vista + JS)
            'modulos'  => PermitModel::modulos(),
            'acciones' => PermitModel::acciones(),
        ];

        $this->view('human_resources/permit/index', $data);
    }

    /** Resumen de roles (para las cards: total permisos, módulos activos) */
    public function resumen()
    {
        $this->requierePermiso('permisos.ver');
        $data = $this->permitModel->resumen_roles_();
        echo json_encode(['success' => true, 'data' => $data ?? []], JSON_UNESCAPED_UNICODE);
    }

    /** Claves de permisos activos de un rol */
    public function listar($id_rol)
    {
        $this->requierePermiso('permisos.ver');
        $permisos = $this->permitModel->listar_por_rol_($id_rol);
        echo json_encode(['success' => true, 'data' => $permisos], JSON_UNESCAPED_UNICODE);
    }

    /** Guardar permisos (sincronización completa) */
    public function guardar()
    {
        $this->requierePermiso('permisos.editar');
        $respuesta = $this->permitModel->guardar_();
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }

    /** Quitar todos los permisos de un rol */
    public function eliminar($id_rol)
    {
        $this->requierePermiso('permisos.editar');
        $respuesta = $this->permitModel->eliminar_rol_($id_rol);
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }
}
