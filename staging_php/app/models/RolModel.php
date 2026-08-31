<?php

class RolModel extends Model
{
    protected $table = 'roles';
    protected $id = 'id_rol';

    // Método para obtener todos los registros (con sus áreas asignadas)
    public function listar_()
    {
        $sql = "SELECT r.*, GROUP_CONCAT(a.nombre ORDER BY a.nombre ASC SEPARATOR '||') AS areas_str
                FROM {$this->table} r
                LEFT JOIN roles_areas ra ON ra.id_rol = r.id_rol
                LEFT JOIN areas a ON a.id_area = ra.id_area
                GROUP BY r.{$this->id}
                ORDER BY r.{$this->id} DESC";
        $rows = $this->getAll($sql);
        foreach ($rows as $row) {
            $row->areas = $row->areas_str ? explode('||', $row->areas_str) : [];
            unset($row->areas_str);
        }
        return $rows;
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
                // Áreas asignadas al rol (array de id_area)
                $response->areas = $this->listarAreasDeRol_($id);

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

    // Método para obtener todas las áreas del catálogo
    public function listarAreas_()
    {
        $sql = "SELECT * FROM areas
                WHERE estado = 'Activo'
                ORDER BY nombre ASC";
        return $this->getAll($sql);
    }

    // Método para obtener las áreas asignadas a un rol
    public function listarAreasDeRol_($id_rol)
    {
        $sql = "SELECT a.id_area
                FROM areas a
                INNER JOIN roles_areas ra ON ra.id_area = a.id_area
                WHERE ra.id_rol = :id_rol";
        $rows = $this->getAll($sql, [':id_rol' => $id_rol]);
        return array_map(function ($row) {
            return (int) $row->id_area;
        }, $rows);
    }

    // Método para obtener todos los roles con sus áreas asignadas.
    // Devuelve: [ { id_rol, nombre, areas: [ { id_area, nombre } ] } ]
    public function listarAreasPorRol_()
    {
        $sql = "SELECT r.id_rol, r.nombre, a.id_area, a.nombre AS area
                FROM {$this->table} r
                LEFT JOIN roles_areas ra ON ra.id_rol = r.id_rol
                LEFT JOIN areas a ON a.id_area = ra.id_area
                ORDER BY r.id_rol ASC, a.nombre ASC";
        $rows = $this->getAll($sql);

        $roles = [];
        foreach ($rows as $row) {
            if (!isset($roles[$row->id_rol])) {
                $roles[$row->id_rol] = [
                    "id_rol" => (int) $row->id_rol,
                    "nombre" => $row->nombre,
                    "areas"  => []
                ];
            }
            if ($row->id_area) {
                $roles[$row->id_rol]["areas"][] = [
                    "id_area" => (int) $row->id_area,
                    "nombre"  => $row->area
                ];
            }
        }
        return array_values($roles);
    }

    // Método para agregar una nueva área al catálogo
    public function agregarArea_()
    {
        $nombre = trim($_POST['nombre'] ?? '');
        if ($nombre === '') {
            return [
                "success" => false,
                "mensaje" => "El nombre del área es obligatorio."
            ];
        }

        try {
            $sql = "INSERT INTO areas (nombre, estado) VALUES (:nombre, 'Activo')";
            $this->query($sql, [':nombre' => $nombre]);
            return [
                "success" => true,
                "mensaje" => "Área agregada correctamente",
                "id_area" => (int) $this->lastInsertId(),
                "nombre"  => $nombre
            ];
        } catch (Exception $e) {
            return [
                "success" => false,
                "mensaje" => "Error al guardar el área: " . $e->getMessage()
            ];
        }
    }

    // Reemplaza las áreas asignadas a un rol (borra y vuelve a insertar)
    private function guardarAreasRol_($id_rol, $areas)
    {
        $sql = "DELETE FROM roles_areas WHERE id_rol = :id_rol";
        $this->query($sql, [':id_rol' => $id_rol]);

        $areas = array_filter(array_map('intval', (array) $areas));
        if (!empty($areas)) {
            $sql = "INSERT INTO roles_areas (id_rol, id_area) VALUES (:id_rol, :id_area)";
            foreach ($areas as $id_area) {
                $this->query($sql, [':id_rol' => $id_rol, ':id_area' => $id_area]);
            }
        }
    }

    // Método para agregar un registro
    public function agregar_()
    {
        $id = $_POST[$this->id];
        $nombre = $_POST['nombre'];
        $descripcion = $_POST['descripcion'];
        $estado = $_POST['estado'];
        $areas = $_POST['areas'] ?? [];

        try {
            $this->beginTransaction();

            if (!empty($id) && $id != 0) {
                // Actualizar
                $sql = "UPDATE {$this->table} SET nombre = :nombre, descripcion = :descripcion, estado = :estado";

                $params = [
                    ':nombre' => $nombre,
                    ':descripcion' => $descripcion,
                    ':estado' => $estado,
                    ':id' => $id
                ];


                $sql .= " WHERE {$this->id} = :id";
                $this->query($sql, $params);

                $this->guardarAreasRol_($id, $areas);

                $this->commit();

                return [
                    "success" => true,
                    "mensaje" => "Registro actualizado correctamente"
                ];
            } else {
                // Insertar nuevo
                $sql = "INSERT INTO {$this->table} (nombre, descripcion, estado)
                    VALUES (:nombre, :descripcion, :estado)";
                $params = [
                    ':nombre' => $nombre,
                    ':descripcion' => $descripcion,
                    ':estado' => $estado,
                ];

                $this->query($sql, $params);

                $nuevoId = $this->lastInsertId();
                $this->guardarAreasRol_($nuevoId, $areas);

                $this->commit();

                return [
                    "success" => true,
                    "mensaje" => "Registro creado correctamente"
                ];
            }
        } catch (Exception $e) {
            if ($this->db->inTransaction()) {
                $this->rollBack();
            }
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
