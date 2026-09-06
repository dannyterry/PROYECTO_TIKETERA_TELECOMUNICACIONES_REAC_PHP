<?php

class UserModel extends Model
{
    protected $table = 'usuarios';
    protected $id = 'id_usuario';

    // Método para obtener todos los registros
    public function listar_()
    {
        $sql = "SELECT 
                u.*, r.nombre as nombre_rol
                FROM {$this->table} u
                INNER JOIN roles r ON r.id_rol = u.id_rol
                ORDER BY u.{$this->id} DESC";
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
        $id_rol = $_POST['id_rol'];
        $tipo_documento = $_POST['tipo_documento'];
        $documento = $_POST['documento'];
        $nombres = $_POST['nombres'];
        $apellidos = $_POST['apellidos'];
        $email = $_POST['email'];
        $usuario = $_POST['usuario'];
        $password = $_POST['password'];
        $numero_brevete = $_POST['numero_brevete'];
        $fecha_vencimiento_brevete = $_POST['fecha_vencimiento_brevete'];
        $estado = $_POST['estado'];

        // SUBIR IMG
        $nombre_img_doc_delantera = subirImagen('doc_delantera', RUTA_IMG_USUARIO, 'usu_');
        $nombre_img_doc_trasera = subirImagen('doc_trasera', RUTA_IMG_USUARIO, 'usu_');
        $nombre_img_brevete_delantera = subirImagen('brevete_delantera', RUTA_IMG_USUARIO, 'usu_');
        $nombre_img_brevete_trasera = subirImagen('brevete_trasera', RUTA_IMG_USUARIO, 'usu_');
        $nombre_img_foto_personal = subirImagen('foto_personal', RUTA_IMG_USUARIO, 'usu_');

        try {
            if (!empty($id) && $id != 0) {
                // Actualizar
                $sql = "UPDATE {$this->table} SET
                        id_rol = :id_rol,
                        tipo_documento = :tipo_documento,
                        documento = :documento,
                        nombres = :nombres,
                        apellidos = :apellidos,
                        email = :email,
                        usuario = :usuario,
                        numero_brevete = :numero_brevete,
                        fecha_vencimiento_brevete = :fecha_vencimiento_brevete,
                        estado = :estado";

                $params = [
                    ':id_rol' => $id_rol,
                    ':tipo_documento' => $tipo_documento,
                    ':documento' => $documento,
                    ':nombres' => $nombres,
                    ':apellidos' => $apellidos,
                    ':email' => $email,
                    ':usuario' => $usuario,
                    ':numero_brevete' => $numero_brevete,
                    ':fecha_vencimiento_brevete' => $fecha_vencimiento_brevete,
                    ':estado' => $estado,
                    ':id' => $id
                ];

                // Solo actualizar password si viene nueva
                if (!empty($password)) {
                    $sql .= ", password = :password";
                    $params[':password'] = $password;
                }

                // Solo actualizar imágenes si se subieron
                if ($nombre_img_doc_delantera) {
                    $sql .= ", doc_delantera = :doc_delantera";
                    $params[':doc_delantera'] = $nombre_img_doc_delantera;
                }

                if ($nombre_img_doc_trasera) {
                    $sql .= ", doc_trasera = :doc_trasera";
                    $params[':doc_trasera'] = $nombre_img_doc_trasera;
                }

                if ($nombre_img_brevete_delantera) {
                    $sql .= ", brevete_delantera = :brevete_delantera";
                    $params[':brevete_delantera'] = $nombre_img_brevete_delantera;
                }

                if ($nombre_img_brevete_trasera) {
                    $sql .= ", brevete_trasera = :brevete_trasera";
                    $params[':brevete_trasera'] = $nombre_img_brevete_trasera;
                }

                if ($nombre_img_foto_personal) {
                    $sql .= ", foto_personal = :foto_personal";
                    $params[':foto_personal'] = $nombre_img_foto_personal;
                }

                $sql .= " WHERE {$this->id} = :id";

                $this->query($sql, $params);

                return [
                    "success" => true,
                    "mensaje" => "Registro actualizado correctamente"
                ];
            } else {
                // Insertar nuevo
                $sql = "INSERT INTO {$this->table} (
                        id_rol,
                        tipo_documento,
                        documento,
                        nombres,
                        apellidos,
                        email,
                        usuario,
                        password,
                        numero_brevete,
                        fecha_vencimiento_brevete,
                        doc_delantera,
                        doc_trasera,
                        brevete_delantera,
                        brevete_trasera,
                        foto_personal,
                        estado
                    ) VALUES (
                        :id_rol,
                        :tipo_documento,
                        :documento,
                        :nombres,
                        :apellidos,
                        :email,
                        :usuario,
                        :password,
                        :numero_brevete,
                        :fecha_vencimiento_brevete,
                        :doc_delantera,
                        :doc_trasera,
                        :brevete_delantera,
                        :brevete_trasera,
                        :foto_personal,
                        :estado
                    )";

                $params = [
                    ':id_rol' => $id_rol,
                    ':tipo_documento' => $tipo_documento,
                    ':documento' => $documento,
                    ':nombres' => $nombres,
                    ':apellidos' => $apellidos,
                    ':email' => $email,
                    ':usuario' => $usuario,
                    ':password' => $password,
                    ':numero_brevete' => $numero_brevete,
                    ':fecha_vencimiento_brevete' => $fecha_vencimiento_brevete,
                    ':doc_delantera' => $nombre_img_doc_delantera,
                    ':doc_trasera' => $nombre_img_doc_trasera,
                    ':brevete_delantera' => $nombre_img_brevete_delantera,
                    ':brevete_trasera' => $nombre_img_brevete_trasera,
                    ':foto_personal' => $nombre_img_foto_personal,
                    ':estado' => $estado
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
