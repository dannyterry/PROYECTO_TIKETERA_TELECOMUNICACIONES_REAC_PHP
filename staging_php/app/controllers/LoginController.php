<?php
// cespedes/app/controllers/LoginController.php — REEMPLAZAR COMPLETO

class LoginController extends Controller
{
    private $loginModel;

    public function __construct()
    {
        parent::__construct();
        $this->loginModel = $this->model('LoginModel');
    }

    public function index()
    {
        $data = [
            'titulo' => "Login",
            'js'     => "login",
            'modal'  => false,
        ];
        $this->view('login/index', $data);
    }

    public function validar()
    {
        $usuario  = $_POST['usuario']  ?? '';
        $password = $_POST['password'] ?? '';

        $response = $this->loginModel->validar_($usuario, $password);

        if ($response['success']) {
            $user = $response['data'];
            $modulo = 'reportes';

            // Cargar permisos del rol como array de claves "modulo.accion"
            $permisos = $this->loginModel->obtenerPermisos_($user->id_rol);
            $modulo = $this->loginModel->obtenerModulo_($user->id_rol);

            $_SESSION['auth'] = [
                'id_usuario'  => $user->id_usuario,
                'id_rol'      => $user->id_rol,
                'usuario'     => $user->usuario,
                'nombres'     => $user->nombres,
                'apellidos'   => $user->apellidos ?? trim(($user->primer_apellido ?? '') . ' ' . ($user->segundo_apellido ?? '')),
                'rol'         => $user->nombre_rol,
                'img_usuario' => $user->foto_personal ?? null,   // ← NUEVO
                'permisos'    => $permisos,
                'modulo'      => $modulo
            ];
            $_SESSION['login'] = true;
            $this->loginModel->marcarOnline_($user->id_usuario);


            echo json_encode([
                "success" => true,
                "redirect" => $modulo
            ], JSON_UNESCAPED_UNICODE);
        } else {
            echo json_encode($response, JSON_UNESCAPED_UNICODE);
        }
    }

    public function salir()
    {
        if (!empty($_SESSION['auth']['id_usuario'])) {
            $this->loginModel->marcarOffline_($_SESSION['auth']['id_usuario']);
        }
        session_destroy();
        header("Location: " . base_url());
        exit();
    }
    private function _dummySalir()
    {
        session_destroy();
        header("Location: " . base_url());
        exit();
    }

    // Métodos heredados sin cambios
    public function listar()
    {
        $unidades = $this->loginModel->listar_();
        echo json_encode($unidades, JSON_UNESCAPED_UNICODE);
    }

    public function agregar()
    {
        $respuesta = $this->loginModel->agregar_();
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }

    public function editar($id)
    {
        $respuesta = $this->loginModel->editar_($id);
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }

    public function eliminar($id)
    {
        $respuesta = $this->loginModel->eliminar_($id);
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }
}
