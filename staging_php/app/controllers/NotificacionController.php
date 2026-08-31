<?php

class NotificacionController extends Controller
{
    /**
     * AJAX: marca todas las notificaciones del usuario como leídas.
     */
    public function marcar_todas()
    {
        $id_usuario = (int)($_SESSION['auth']['id_usuario'] ?? 0);
        if ($id_usuario <= 0) {
            echo json_encode(['success' => false, 'mensaje' => 'Sesión no válida']);
            return;
        }

        $model = $this->model('AlertasModel');
        $model->marcarTodasLeidas($id_usuario);

        echo json_encode(['success' => true]);
    }

    /**
     * Abre una notificación: la marca como leída y redirige al módulo.
     */
    public function ir($id)
    {
        $id_usuario = (int)($_SESSION['auth']['id_usuario'] ?? 0);
        $model = $this->model('AlertasModel');

        $noti = $model->marcarLeida((int)$id, $id_usuario);
        $url = $noti ? $noti->url : 'dashboard';

        header('Location: ' . base_url() . $url);
        exit();
    }
}
