<?php

class TipoTrabajoModel extends Model
{
    protected $table = 'tipos_trabajo';
    protected $id = 'id_tipo_trabajo';

    // Método para obtener todos los registros
    public function listar_()
    {
        $sql = "SELECT * FROM {$this->table} ORDER BY nombre ASC";
        return $this->getAll($sql);
    }

    // Metodo listar solo activos
    public function listarActivos_()
    {
        $sql = "SELECT * FROM {$this->table}
                WHERE estado = 'Activo'
                ORDER BY nombre ASC";
        return $this->getAll($sql);
    }

    // Nombres de los tipos de trabajo activos (para dropdowns de órdenes
    // y motivos). Devuelve un array plano de strings.
    public function listarNombres_()
    {
        $rows = $this->getAll(
            "SELECT nombre FROM {$this->table}
             WHERE estado = 'Activo'
             ORDER BY nombre ASC"
        );

        return array_column(
            array_map(fn($r) => (array)$r, $rows),
            'nombre'
        );
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
        $nombre = trim($_POST['nombre'] ?? '');
        $estado = $_POST['estado'];

        if ($nombre === '') {
            return ["success" => false, "mensaje" => "El nombre es obligatorio"];
        }

        try {
            if (!empty($id) && $id != 0) {
                // Actualizar
                $sql = "UPDATE {$this->table} SET nombre = :nombre, estado = :estado";

                $params = [
                    ':nombre' => $nombre,
                    ':estado' => $estado,
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
                $sql = "INSERT INTO {$this->table} (nombre, estado)
                    VALUES (:nombre, :estado)";
                $params = [
                    ':nombre' => $nombre,
                    ':estado' => $estado,
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
