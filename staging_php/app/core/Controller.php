<?php
// cespedes/app/core/Controller.php — REEMPLAZAR COMPLETO

class Controller
{
    protected $notificaciones = [];
    protected $total_no_leidas = 0;

    public function __construct()
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        $controllerActual = strtolower(str_replace('Controller', '', get_class($this)));

        // Si NO está logueado y NO es el login → redirigir
        if (!isset($_SESSION['auth']) && $controllerActual !== 'login') {
            header("Location: " . base_url() . "login");
            exit();
        }


        if (isset($_SESSION['auth']['rol']) && $_SESSION['auth']['rol'] == 'ADMINISTRACION') {
            $id_usuario = (int)($_SESSION['auth']['id_usuario'] ?? 0);
            if ($id_usuario > 0) {
                $alertasModel = $this->model('AlertasModel');
                $alertasModel->sincronizar($id_usuario);
                $this->notificaciones = $alertasModel->listar($id_usuario, 50);
                $this->total_no_leidas = $alertasModel->contarNoLeidas($id_usuario);
            }
        }
    }

    /**
     * Verifica si el usuario actual tiene el permiso indicado.
     * Uso: $this->tienePermiso('ordenes.liquidar')
     * El Administrador (id_rol=1) tiene acceso a todo.
     */
    protected function tienePermiso($clave)
    {
        if (!isset($_SESSION['auth'])) return false;

        // El administrador (rol ID 1) tiene acceso total
        if (($_SESSION['auth']['id_rol'] ?? 0) == 1) return true;

        $permisos = $_SESSION['auth']['permisos'] ?? [];
        return in_array($clave, $permisos);
    }

    /**
     * Si no tiene permiso, devuelve JSON de error y termina.
     * Útil en métodos AJAX.
     */
    protected function requierePermiso($clave)
    {
        if (!$this->tienePermiso($clave)) {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'mensaje' => 'No tienes permiso para realizar esta acción.'
            ], JSON_UNESCAPED_UNICODE);
            exit();
        }
    }

    /**
     * Si no tiene permiso para ver una página, redirige al primer módulo
     * que SÍ puede ver (evita bucles de redirección al propio dashboard).
     */
    protected function requierePermisoVista($clave)
    {
        if (!$this->tienePermiso($clave)) {
            header("Location: " . base_url() . $this->primeraRutaPermitida());
            exit();
        }
    }

    /**
     * Ruta del primer módulo con permiso 'X.ver' según el catálogo de
     * PermitModel. Si el usuario no tiene ningún permiso, cierra sesión.
     */
    protected function primeraRutaPermitida()
    {
        require_once __DIR__ . '/../models/PermitModel.php';

        // El administrador siempre tiene acceso a todo
        if (($_SESSION['auth']['id_rol'] ?? 0) == 1) {
            return 'reportes';
        }

        $permisos = $_SESSION['auth']['permisos'] ?? [];

        foreach (PermitModel::modulos() as $grupo) {
            foreach (array_keys($grupo['modulos']) as $modulo) {
                if (in_array($modulo . '.ver', $permisos)) {
                    return PermitModel::rutaModulo($modulo);
                }
            }
        }

        return 'login/salir';
    }

    protected function view($view, $data = [])
    {
        $headerPath = __DIR__ . '/../views/templates/header.php';
        $viewPath   = __DIR__ . '/../views/' . $view . '.php';
        $modalPath  = __DIR__ . '/../views/templates/modal.php';
        $footerPath = __DIR__ . '/../views/templates/footer.php';

        if (file_exists($viewPath)) {
            $data['notificaciones'] = $this->notificaciones ?? [];
            $data['total_no_leidas'] = $this->total_no_leidas ?? 0;
            extract($data);

            if ($view != "login/index") {
                require_once $headerPath;
            }

            require_once $viewPath;

            if (!empty($modal)) {
                if (!isset($form_ver)) $form_ver = false;
                require_once $modalPath;
            }

            if ($view != "login") {
                require_once $footerPath;
            }
        } else {
            die("La vista '$view' no existe.");
        }
    }

    protected function model($model)
    {
        $modelPath = __DIR__ . '/../models/' . $model . '.php';
        if (file_exists($modelPath)) {
            require_once $modelPath;
            return new $model();
        }
        die("El modelo '$model' no existe.");
    }
}
