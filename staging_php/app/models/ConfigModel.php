<?php
// app/models/ConfigModel.php — ARCHIVO NUEVO

class ConfigModel extends Model
{
    protected $table = 'configuracion';
    protected $id    = 'id';

    // Obtener todas las configuraciones agrupadas
    public function listar_()
    {
        return $this->getAll(
            "SELECT * FROM {$this->table} ORDER BY grupo ASC, id ASC"
        );
    }

    // Obtener un valor por clave
    public function obtener_($clave)
    {
        return $this->getOne(
            "SELECT * FROM {$this->table} WHERE clave = :c",
            [':c' => $clave]
        );
    }

    // Guardar múltiples configuraciones (viene del formulario)
    public function guardar_()
    {
        try {
            $claves = $_POST['clave']  ?? [];
            $valores = $_POST['valor'] ?? [];

            if (empty($claves)) {
                return ['success' => false, 'mensaje' => 'No hay datos para guardar'];
            }

            foreach ($claves as $i => $clave) {
                $valor = $valores[$i] ?? '';
                $clave = trim($clave);
                if (!$clave) continue;

                // UPSERT: inserta la clave si aún no existe y la actualiza si ya existe
                $this->query(
                    "INSERT INTO {$this->table} (clave, valor, grupo, updated_at)
                     VALUES (:c, :v, 'general', NOW())
                     ON DUPLICATE KEY UPDATE valor = VALUES(valor), updated_at = NOW()",
                    [':v' => $valor, ':c' => $clave]
                );
            }

            // Invalidar cookie WIN si se cambió credencial (forzar re-login)
            $clavesTR = ['TR_USER', 'TR_PASSWORD'];
            $hayCambioTR = false;
            foreach ($claves as $c) {
                if (in_array(trim($c), $clavesTR)) {
                    $hayCambioTR = true;
                    break;
                }
            }
            if ($hayCambioTR) {
                $cookieFile = __DIR__ . '/../controllers/cookies.txt';
                if (file_exists($cookieFile)) {
                    unlink($cookieFile);
                }
            }

            return ['success' => true, 'mensaje' => 'Configuración guardada correctamente'];
        } catch (Exception $e) {
            return ['success' => false, 'mensaje' => 'Error: ' . $e->getMessage()];
        }
    }

    // Obtener config agrupada para la vista
    public function listarAgrupada_()
    {
        $rows   = $this->listar_();
        $grupos = [];
        foreach ($rows as $row) {
            $grupos[$row->grupo][] = $row;
        }
        return $grupos;
    }
}
