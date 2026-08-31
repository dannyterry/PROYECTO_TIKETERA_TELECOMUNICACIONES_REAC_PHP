<?php

class VehicleModel extends Model
{
    protected $table = 'vehiculos';
    protected $id = 'id_vehiculo';

    // Método para obtener todos los registros
    public function listar_()
    {
        $sql = "SELECT 
                v.*,
                ma.nombre as marca,
                mo.nombre as modelo,
                tv.nombre as tipo_vehiculo,
                co.nombre as combustible
                FROM {$this->table} v 
                INNER JOIN marcas ma ON ma.id_marca = v.id_marca
                INNER JOIN modelos mo ON mo.id_modelo = v.id_modelo
                INNER JOIN tipos_vehiculo tv ON tv.id_tipo_vehiculo = v.id_tipo_vehiculo
                INNER JOIN combustibles co ON co.id_combustible = v.id_combustible
                ORDER BY v.{$this->id} DESC";
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
        $id_marca = $_POST['id_marca'];
        $id_modelo = $_POST['id_modelo'];
        $id_tipo_vehiculo = $_POST['id_tipo_vehiculo'];
        $id_combustible = $_POST['id_combustible'];
        $placa = $_POST['placa'];
        $anio = $_POST['anio'];
        $transmision = $_POST['transmision'];
        $color = $_POST['color'];
        $estado_documento = $_POST['estado_documento'];
        $fecha_vencimiento = $_POST['fecha_vencimiento'];
        $observaciones = $_POST['observaciones'];
        $estado = $_POST['estado'];

        $documento_soat = $_POST['documento_soat'];
        $documento_revision = $_POST['documento_revision'];
        $fecha_ven_soat = $_POST['fecha_ven_soat'];
        $fecha_ven_revision = $_POST['fecha_ven_revision'];



        // SUBIR IMG
        $nombre_img_1 = subirImagen('img_1', RUTA_IMG_VEHICULO, 'veh_');
        $nombre_img_2 = subirImagen('img_2', RUTA_IMG_VEHICULO, 'veh_');

        $img_tarjeta_propiedad = subirImagen('img_tarjeta_propiedad', RUTA_IMG_VEHICULO, 'doc_');
        $img_revision = subirImagen('img_revision', RUTA_IMG_VEHICULO, 'doc_');
        $img_soat = subirImagen('img_soat', RUTA_IMG_VEHICULO, 'doc_');
        $img_certificado_gas = subirImagen('img_certificado_gas', RUTA_IMG_VEHICULO, 'doc_');

        try {
            if (!empty($id) && $id != 0) {
                // Actualizar
                $sql = "UPDATE {$this->table} SET 
                    id_marca = :id_marca,
                    id_modelo = :id_modelo,
                    id_tipo_vehiculo = :id_tipo_vehiculo,
                    id_combustible = :id_combustible,
                    placa = :placa,
                    anio = :anio,
                    transmision = :transmision,
                    color = :color,
                    estado_documento = :estado_documento,
                    fecha_vencimiento = :fecha_vencimiento,
                    observaciones = :observaciones,
                    estado = :estado,
                    documento_soat = :documento_soat,
                    documento_revision = :documento_revision,
                    fecha_ven_soat = :fecha_ven_soat,
                    fecha_ven_revision = :fecha_ven_revision
                    ";

                if ($nombre_img_1) {
                    $sql .= ", img_1 = :img_1";
                }

                if ($nombre_img_2) {
                    $sql .= ", img_2 = :img_2";
                }

                if ($img_tarjeta_propiedad) {
                    $sql .= ", img_tarjeta_propiedad = :img_tarjeta_propiedad";
                }

                if ($img_revision) {
                    $sql .= ", img_revision = :img_revision";
                }

                if ($img_soat) {
                    $sql .= ", img_soat = :img_soat";
                }

                if ($img_certificado_gas) {
                    $sql .= ", img_certificado_gas = :img_certificado_gas";
                }


                $sql .= " WHERE {$this->id} = :id";

                $params = [
                    ':id_marca' => $id_marca,
                    ':id_modelo' => $id_modelo,
                    ':id_tipo_vehiculo' => $id_tipo_vehiculo,
                    ':id_combustible' => $id_combustible,
                    ':placa' => $placa,
                    ':anio' => $anio,
                    ':transmision' => $transmision,
                    ':color' => $color,
                    ':estado_documento' => $estado_documento,
                    ':fecha_vencimiento' => $fecha_vencimiento,
                    ':observaciones' => $observaciones,
                    ':estado' => $estado,
                    ':documento_soat' => $documento_soat,
                    ':documento_revision' => $documento_revision,
                    ':fecha_ven_soat' => $fecha_ven_soat,
                    ':fecha_ven_revision' => $fecha_ven_revision,
                    ':id' => $id
                ];

                if ($nombre_img_1) {
                    $params[':img_1'] = $nombre_img_1;
                }

                if ($nombre_img_2) {
                    $params[':img_2'] = $nombre_img_2;
                }

                if ($img_tarjeta_propiedad) {
                    $params[':img_tarjeta_propiedad'] = $img_tarjeta_propiedad;
                }

                if ($img_revision) {
                    $params[':img_revision'] = $img_revision;
                }

                if ($img_soat) {
                    $params[':img_soat'] = $img_soat;
                }

                if ($img_certificado_gas) {
                    $params[':img_certificado_gas'] = $img_certificado_gas;
                }

                $this->query($sql, $params);

                return [
                    "success" => true,
                    "mensaje" => "Registro actualizado correctamente"
                ];
            } else {
                // Insertar nuevo
                $sql = "INSERT INTO {$this->table} (
                    id_marca,
                    id_modelo,
                    id_tipo_vehiculo,
                    id_combustible,
                    placa,
                    anio,
                    transmision,
                    color,
                    estado_documento,
                    fecha_vencimiento,
                    observaciones,
                    estado,
                    img_1,
                    img_2,
                    documento_soat,
                    documento_revision,
                    fecha_ven_soat,
                    fecha_ven_revision,
                    img_tarjeta_propiedad,
                    img_revision,
                    img_soat,
                    img_certificado_gas
                ) VALUES (
                    :id_marca,
                    :id_modelo,
                    :id_tipo_vehiculo,
                    :id_combustible,
                    :placa,
                    :anio,
                    :transmision,
                    :color,
                    :estado_documento,
                    :fecha_vencimiento,
                    :observaciones,
                    :estado,
                    :img_1,
                    :img_2,
                    :documento_soat,
                    :documento_revision,
                    :fecha_ven_soat,
                    :fecha_ven_revision,
                    :img_tarjeta_propiedad,
                    :img_revision,
                    :img_soat,
                    :img_certificado_gas
                )";

                $params = [
                    ':id_marca' => $id_marca,
                    ':id_modelo' => $id_modelo,
                    ':id_tipo_vehiculo' => $id_tipo_vehiculo,
                    ':id_combustible' => $id_combustible,
                    ':placa' => $placa,
                    ':anio' => $anio,
                    ':transmision' => $transmision,
                    ':color' => $color,
                    ':estado_documento' => $estado_documento,
                    ':fecha_vencimiento' => $fecha_vencimiento,
                    ':observaciones' => $observaciones,
                    ':estado' => $estado,
                    ':img_1' => $nombre_img_1,
                    ':img_2' => $nombre_img_2,
                    ':documento_soat' => $documento_soat,
                    ':documento_revision' => $documento_revision,
                    ':fecha_ven_soat' => $fecha_ven_soat,
                    ':fecha_ven_revision' => $fecha_ven_revision,
                    ':img_tarjeta_propiedad' => $img_tarjeta_propiedad,
                    ':img_revision' => $img_revision,
                    ':img_soat' => $img_soat,
                    ':img_certificado_gas' => $img_certificado_gas,
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
