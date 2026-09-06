<?php

class ReasonModel extends Model
{
    protected $table = 'motivos';
    protected $id = 'id_motivo';

    // Método para obtener todos los registros
    public function listar_()
    {
        $sql = "SELECT * FROM {$this->table} ORDER BY {$this->id} DESC";
        return $this->getAll($sql);
    }

    // Metodo listar solo activos
    public function listarActivos_()
    {
        $sql = "SELECT * FROM {$this->table} 
                WHERE estado = 'Activo' 
                ORDER BY {$this->id} DESC";
        return $this->getAll($sql);
    }

    // Método para obtener registro con id
    public function editar_($id)
    {
        try {
            $sql = "SELECT * FROM {$this->table} WHERE {$this->id} = :id";
            $params = [':id' => $id];
            $response = $this->getOne($sql, $params);

            if ($response) {
                return [
                    "success" => true,
                    "data" => $response
                ];
            } else {
                return [
                    "success" => false,
                    "mensaje" => "Registro no encontrado"
                ];
            }
        } catch (Exception $e) {
            return [
                "success" => false,
                "mensaje" => "Error al obtener registro: " . $e->getMessage()
            ];
        }
    }

    // Método para agregar un registro
    public function agregar_()
    {
        $id = $_POST[$this->id];
        $nombre = $_POST['nombre'];
        $tipo_trabajo = trim($_POST['tipo_trabajo'] ?? '') ?: null;
        $precio_compra = $_POST['precio_compra'];
        $precio_venta = $_POST['precio_venta'];
        $estado = $_POST['estado'];
        $limites_materiales = $this->_normalizarLimites($_POST['limites_materiales'] ?? '');

        try {
            if (!empty($id) && $id != 0) {
                // Actualizar
                $sql = "UPDATE {$this->table} SET nombre = :nombre, tipo_trabajo = :tipo_trabajo, precio_compra = :precio_compra, precio_venta = :precio_venta, estado = :estado, limites_materiales = :limites_materiales";

                $params = [
                    ':nombre' => $nombre,
                    ':tipo_trabajo' => $tipo_trabajo,
                    ':precio_compra' => $precio_compra,
                    ':precio_venta' => $precio_venta,
                    ':estado' => $estado,
                    ':limites_materiales' => $limites_materiales,
                    ':id' => $id
                ];


                $sql .= " WHERE {$this->id} = :id";
                $this->query($sql, $params);

                return [
                    "success" => true,
                    "mensaje" => "Registro actualizado correctamente"
                ];
            } else {
                // Insertar nuevo
                $sql = "INSERT INTO {$this->table} (nombre, tipo_trabajo, precio_compra, precio_venta, estado, limites_materiales)
                    VALUES (:nombre, :tipo_trabajo, :precio_compra, :precio_venta, :estado, :limites_materiales)";
                $params = [
                    ':nombre' => $nombre,
                    ':tipo_trabajo' => $tipo_trabajo,
                    ':precio_compra' => $precio_compra,
                    ':precio_venta' => $precio_venta,
                    ':estado' => $estado,
                    ':limites_materiales' => $limites_materiales,
                ];

                $this->query($sql, $params);

                return [
                    "success" => true,
                    "mensaje" => "Registro creado correctamente"
                ];
            }
        } catch (Exception $e) {
            return [
                "success" => false,
                "mensaje" => "Error al guardar: " . $e->getMessage()
            ];
        }
    }

    // ── Límites de materiales ──────────────────────────────────────────
    // Convierte el JSON de límites enviado por el formulario en una lista
    // limpia [{id_producto, cantidad}] o null si no hay límites.
    private function _normalizarLimites($json)
    {
        $arr = json_decode((string)$json, true);
        if (!is_array($arr)) return null;

        $map = [];
        foreach ($arr as $item) {
            $id   = (int)($item['id_producto'] ?? 0);
            $cant = (float)($item['cantidad'] ?? 0);
            if ($id > 0 && $cant > 0) {
                $map[$id] = $cant;
            }
        }

        if (!$map) return null;

        $lista = [];
        foreach ($map as $pid => $cant) {
            $lista[] = ['id_producto' => $pid, 'cantidad' => $cant];
        }
        return json_encode($lista, JSON_UNESCAPED_UNICODE);
    }

    // Método para eliminar un registro
    public function eliminar_($id)
    {
        try {
            $sql = "DELETE FROM {$this->table} WHERE {$this->id} = :id";
            $params = [':id' => $id];

            $this->query($sql, $params);

            return [
                "success" => true,
                "mensaje" => "Registro Eliminado correctamente."
            ];
        } catch (Exception $e) {
            return [
                "success" => false,
                "mensaje" => "Error al eliminar: " . $e->getMessage()
            ];
        }
    }
}
