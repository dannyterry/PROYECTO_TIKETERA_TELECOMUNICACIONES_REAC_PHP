<?php
// cespedes/app/models/LoginModel.php — REEMPLAZAR COMPLETO

require_once __DIR__ . '/PermitModel.php';

class LoginModel extends Model
{
    protected $table = 'usuarios';
    protected $id    = 'id_usuario';

    
    public function marcarOnline_($id_usuario)
    {
        try {
            $sql = "UPDATE {$this->table} SET ultimo_acceso = NOW(), esta_online = 1 WHERE {$this->id} = :id";
            $this->query($sql, [':id' => $id_usuario]);
        } catch (Exception $e) {}
    }

    public function marcarOffline_($id_usuario)
    {
        try {
            $sql = "UPDATE {$this->table} SET esta_online = 0 WHERE {$this->id} = :id";
            $this->query($sql, [':id' => $id_usuario]);
        } catch (Exception $e) {}
    }

    public function validar_($usuario, $password)
    {
        try {
            $sql = "SELECT u.*, r.nombre AS nombre_rol
                    FROM {$this->table} u
                    INNER JOIN roles r ON u.id_rol = r.id_rol
                    WHERE u.usuario  = :usuario
                      AND u.password = :password
                      AND u.estado   = 'Activo'
                    LIMIT 1";

            $response = $this->getOne($sql, [':usuario' => $usuario, ':password' => $password]);

            if ($response) {
                return ["success" => true, "data" => $response];
            }
            return ["success" => false, "mensaje" => "Usuario o contraseña incorrectos"];
        } catch (Exception $e) {
            return ["success" => false, "mensaje" => "Error al validar: " . $e->getMessage()];
        }
    }

    /**
     * Devuelve array de claves de permisos activos del rol, ej: ['ordenes.ver','ordenes.liquidar',...]
     */
    public function obtenerPermisos_($id_rol)
    {
        $sql  = "SELECT p.clave, p.modulo
                 FROM permisos p
                 INNER JOIN roles_permisos rp ON rp.id_permiso = p.id_permiso
                 WHERE rp.id_rol = :id_rol
                   AND p.estado  = 'Activo'";
        $rows = $this->getAll($sql, [':id_rol' => $id_rol]);

        $permisos = [];
        foreach ($rows as $r) {
            $permisos[] = $r->clave;
        }
        return $permisos;
    }

    public function obtenerModulo_($id_rol)
    {
        switch ((int)$id_rol) {
            case 2: // TÉCNICO DE CAMPO
                return 'ordenes';
            case 4: // GESTIÓN
                return 'ordenes';
            case 5: // RECURSOS HUMANOS
                return 'recursos_humanos/usuarios';
            case 3: // ALMACÉN
                return 'inventario/stock';
            case 1: // ADMINISTRACIÓN
            case 6: // SUPERVISIÓN
            case 7: // OPERACIONES
            default:
                return 'reportes';
        }
    }

    // ── Métodos heredados sin cambios ────────────────────────────────
    public function listar_()
    {
        $sql = "SELECT * FROM combustibles";
        return $this->getAll($sql);
    }

    public function editar_($id)
    {
        try {
            $sql      = "SELECT * FROM {$this->table} WHERE {$this->id} = :id";
            $response = $this->getOne($sql, [':id' => $id]);
            if ($response) {
                return ["success" => true, "data" => $response];
            }
            return ["success" => false, "mensaje" => "Registro no encontrado"];
        } catch (Exception $e) {
            return ["success" => false, "mensaje" => $e->getMessage()];
        }
    }

    public function agregar_()
    {
        return ["success" => false, "mensaje" => "No implementado"];
    }

    public function eliminar_($id)
    {
        return ["success" => false, "mensaje" => "No implementado"];
    }
}
