<?php

class HomeModel extends Model
{
    // Método para obtener todos los registros
    public function getAll_()
    {
        $sql = "SELECT * FROM volumes";
        return $this->getAll($sql);
    }

    // Método para obtener registro con id
    public function getById_($id)
    {
        $sql = "SELECT * FROM volumes WHERE idVolume = '$id'";
        return $this->getOne($sql);
    }

    // Método para agregar un registro
    public function create_()
    {
        $id = $_POST['id'];
        $title = $_POST['title'];
        $state = $_POST['state_'];

        if (!empty($id) && $id != 0) {
            // Actualizar registro existente
            $sql = "UPDATE volumes SET title = :title, state_ = :state_ WHERE idVolume = :id";
            $params = [
                ':id' => $id,
                ':title' => $title,
                ':state_' => $state
            ];
        } else {
            // Crear nuevo registro
            $sql = "INSERT INTO volumes (title, state_) VALUES (:title, :state_)";
            $params = [
                ':title' => $title,
                ':state_' => $state
            ];
        }

        return $this->query($sql, $params);
    }

    // Eliminar registro
    public function delete_($id)
    {
        $sql = "DELETE FROM volumes WHERE idVolume = '$id'";
        return $this->query($sql);
    }
}
