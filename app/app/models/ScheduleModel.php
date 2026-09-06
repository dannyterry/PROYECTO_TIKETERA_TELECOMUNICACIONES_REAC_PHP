<?php

class ScheduleModel extends Model
{
    protected $table = 'horarios';
    protected $id = 'id_horario';

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
        $hora_entrada = $_POST['hora_entrada'];
        $hora_salida = $_POST['hora_salida'];
        $tolerancia_min = $_POST['tolerancia_min'];
        $estado = $_POST['estado'];

        try {
            if (!empty($id) && $id != 0) {
                // Actualizar
                $sql = "UPDATE {$this->table} SET nombre = :nombre, hora_entrada = :hora_entrada, hora_salida = :hora_salida, tolerancia_min = :tolerancia_min, estado = :estado";

                $params = [
                    ':nombre' => $nombre,
                    ':hora_entrada' => $hora_entrada,
                    ':hora_salida' => $hora_salida,
                    ':tolerancia_min' => $tolerancia_min,
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
                $sql = "INSERT INTO {$this->table} (nombre, hora_entrada, hora_salida, tolerancia_min, estado)
                    VALUES (:nombre, :hora_entrada, :hora_salida, :tolerancia_min, :estado)";
                $params = [
                    ':nombre' => $nombre,
                    ':hora_entrada' => $hora_entrada,
                    ':hora_salida' => $hora_salida,
                    ':tolerancia_min' => $tolerancia_min,
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
