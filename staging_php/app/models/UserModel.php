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
            $sql = "SELECT u.*, r.nombre AS nombre_rol
                    FROM {$this->table} u
                    INNER JOIN roles r ON r.id_rol = u.id_rol
                    WHERE u.{$this->id} = :id";
            $params = [':id' => $id];
            $response = $this->getOne($sql, $params);

            if ($response) {
                $hijos = $this->getAll(
                    "SELECT * FROM usuario_hijos WHERE id_usuario = :id ORDER BY id_hijo ASC",
                    [':id' => $id]
                );

                return [
                    "success" => true,
                    "data" => $response,
                    "hijos" => $hijos ?: []
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
        $id = $_POST[$this->id] ?? null;

        // Campos obligatorios
        $id_rol        = $_POST['id_rol'] ?? null;
        $tipo_documento = $_POST['tipo_documento'] ?? null;
        $documento     = $_POST['documento'] ?? null;
        $nombres       = $_POST['nombres'] ?? null;
        $apellidos     = $_POST['apellidos'] ?? null;
        $usuario       = $_POST['usuario'] ?? null;
        $password      = $_POST['password'] ?? null;
        $estado        = $_POST['estado'] ?? 'Activo';

        // Campos opcionales de texto/fecha: mismo nombre en el POST, la
        // vista y la columna de BD, así que se procesan en un solo lugar
        // en vez de repetir cada uno a mano.
        $camposOpcionales = [
            'email',
            'telefono',
            'fecha_ingreso',
            'fecha_salida',
            'opcion_personal',
            'cuadrilla',
            'fecha_nacimiento',
            'direccion',
            'distrito',
            'numero_emergencia',
            'banco',
            'cuenta_bancaria',
            'cci',
            'numero_brevete',
            'fecha_vencimiento_brevete',
            'ruc',
            'sunat_estado',
            'sunat_condicion',
            'sunat_actividad',
            'conyuge_nombres',
            'conyuge_apellido1',
            'conyuge_apellido2',
            'conyuge_fecha_nacimiento',
            'cargo',
            'area',
            'regimen_pensionario',
            'tipo_comision_afp',
            'cuspp',
            'vencimiento_sctr',
            'vencimiento_emo',
            'categoria_licencia',
            'emision_brevete',
            'talla_polo',
            'talla_pantalon',
            'talla_calzado',
            'ultimo_empleo_1',
            'ultimo_empleo_2',
            'ultimo_empleo_3',
            'emergencia_nombre',
            'emergencia_parentesco',
            'emergencia_telefono_2',
            'emergencia_direccion',
        ];

        $datos = [];
        foreach ($camposOpcionales as $campo) {
            $valor = $_POST[$campo] ?? '';
            $datos[$campo] = ($valor === '') ? null : trim($valor);
        }

        // Archivos: imágenes existentes (jpg/png) + PDFs nuevos
        $archivos = [
            'doc_delantera'       => subirImagen('doc_delantera', RUTA_IMG_USUARIO, 'usu_'),
            'doc_trasera'         => subirImagen('doc_trasera', RUTA_IMG_USUARIO, 'usu_'),
            'brevete_delantera'   => subirImagen('brevete_delantera', RUTA_IMG_USUARIO, 'usu_'),
            'brevete_trasera'     => subirImagen('brevete_trasera', RUTA_IMG_USUARIO, 'usu_'),
            'foto_personal'       => subirImagen('foto_personal', RUTA_IMG_USUARIO, 'usu_'),
            'licencia_pdf'        => subirArchivo('licencia_pdf', RUTA_IMG_USUARIO, 'lic_'),
            'cv_pdf'              => subirArchivo('cv_pdf', RUTA_IMG_USUARIO, 'cv_'),
            'dni_pdf'             => subirArchivo('dni_pdf', RUTA_IMG_USUARIO, 'dni_'),
            'recibo_servicio_pdf' => subirArchivo('recibo_servicio_pdf', RUTA_IMG_USUARIO, 'rec_'),
            'certificado_pdf'     => subirArchivo('certificado_pdf', RUTA_IMG_USUARIO, 'cert_'),
        ];

        try {
            $esNuevo = empty($id) || $id == 0;

            if (!$esNuevo) {
                // ── Actualizar ──
                $set = [
                    'id_rol = :id_rol',
                    'tipo_documento = :tipo_documento',
                    'documento = :documento',
                    'nombres = :nombres',
                    'apellidos = :apellidos',
                    'usuario = :usuario',
                    'estado = :estado'
                ];
                $params = [
                    ':id_rol' => $id_rol,
                    ':tipo_documento' => $tipo_documento,
                    ':documento' => $documento,
                    ':nombres' => $nombres,
                    ':apellidos' => $apellidos,
                    ':usuario' => $usuario,
                    ':estado' => $estado,
                    ':id' => $id
                ];

                foreach ($datos as $campo => $valor) {
                    $set[] = "{$campo} = :{$campo}";
                    $params[":{$campo}"] = $valor;
                }

                if (!empty($password)) {
                    $set[] = "password = :password";
                    $params[':password'] = $password;
                }

                foreach ($archivos as $campo => $valor) {
                    if ($valor) {
                        $set[] = "{$campo} = :{$campo}";
                        $params[":{$campo}"] = $valor;
                    }
                }

                $sql = "UPDATE {$this->table} SET " . implode(', ', $set) . " WHERE {$this->id} = :id";
                $this->query($sql, $params);

                $id_usuario = $id;
            } else {
                // ── Insertar ──
                $columnas = ['id_rol', 'tipo_documento', 'documento', 'nombres', 'apellidos', 'usuario', 'password', 'estado'];
                $params = [
                    ':id_rol' => $id_rol,
                    ':tipo_documento' => $tipo_documento,
                    ':documento' => $documento,
                    ':nombres' => $nombres,
                    ':apellidos' => $apellidos,
                    ':usuario' => $usuario,
                    ':password' => $password,
                    ':estado' => $estado
                ];

                foreach ($datos as $campo => $valor) {
                    $columnas[] = $campo;
                    $params[":{$campo}"] = $valor;
                }
                foreach ($archivos as $campo => $valor) {
                    $columnas[] = $campo;
                    $params[":{$campo}"] = $valor;
                }

                $placeholders = array_map(function ($c) {
                    return ":{$c}";
                }, $columnas);

                $sql = "INSERT INTO {$this->table} (" . implode(',', $columnas) . ")
                        VALUES (" . implode(',', $placeholders) . ")";
                $this->query($sql, $params);

                $id_usuario = $this->lastInsertId();
            }

            // ── Hijos: se reemplazan todos en cada guardado (borrar + volver
            // a insertar). Más simple y confiable que hacer un diff fila por
            // fila, y el volumen de datos es mínimo. ──
            $hijos = json_decode($_POST['hijos_json'] ?? '[]', true);

            $this->query("DELETE FROM usuario_hijos WHERE id_usuario = :id", [':id' => $id_usuario]);

            if (is_array($hijos)) {
                foreach ($hijos as $hijo) {
                    $nombresHijo = trim($hijo['nombres'] ?? '');
                    if ($nombresHijo === '') {
                        continue;
                    }

                    $this->query(
                        "INSERT INTO usuario_hijos (id_usuario, nombres, apellido1, apellido2, fecha_nacimiento)
                         VALUES (:iu, :n, :a1, :a2, :fn)",
                        [
                            ':iu' => $id_usuario,
                            ':n'  => $nombresHijo,
                            ':a1' => $hijo['apellido1'] ?? null,
                            ':a2' => $hijo['apellido2'] ?? null,
                            ':fn' => !empty($hijo['fecha_nacimiento']) ? $hijo['fecha_nacimiento'] : null,
                        ]
                    );
                }
            }

            return [
                "success" => true,
                "mensaje" => $esNuevo ? "Empleado registrado correctamente" : "Registro actualizado correctamente"
            ];
        } catch (Exception $e) {
            return [
                "success" => false,
                "mensaje" => "Error al guardar: " . $e->getMessage()
            ];
        }
    }

    // ── Activar / Inactivar rápido desde el listado (sin abrir el formulario) ──
    public function cambiar_estado_($id, $estado)
    {
        if (!in_array($estado, ['Activo', 'Inactivo'], true)) {
            return ["success" => false, "mensaje" => "Estado inválido."];
        }

        $existe = $this->getOne(
            "SELECT {$this->id} FROM {$this->table} WHERE {$this->id} = :id",
            [':id' => $id]
        );

        if (!$existe) {
            return ["success" => false, "mensaje" => "Registro no encontrado."];
        }

        $this->query(
            "UPDATE {$this->table} SET estado = :e WHERE {$this->id} = :id",
            [':e' => $estado, ':id' => $id]
        );

        return ["success" => true, "mensaje" => "Estado actualizado a {$estado}."];
    }

    // ── Consulta DNI vía apiperu.dev (proxy backend: el token nunca viaja al navegador) ──
    public function consultar_dni_($dni)
    {
        if (!preg_match('/^\d{8}$/', $dni)) {
            return ["success" => false, "mensaje" => "El DNI debe tener 8 dígitos."];
        }

        $respuesta = $this->_consultarApiPeru(API_DNI_URL . '/' . $dni);

        if (!$respuesta || empty($respuesta['success'])) {
            return ["success" => false, "mensaje" => $respuesta['message'] ?? "No se pudo consultar el DNI."];
        }

        $d = $respuesta['data'] ?? [];


        return [
            "success" => true,
            "data" => [
                "nombres"     => $d['nombres'] ?? '',
                "apellidos"   => trim(($d['apellido_paterno'] ?? '') . ' ' . ($d['apellido_materno'] ?? '')),
                "codVerifica" => $d['codigo_verificacion'] ?? null,
            ]
        ];
    }

    // ── Consulta RUC vía apiperu.dev ──
    public function consultar_ruc_($ruc)
    {
        if (!preg_match('/^\d{11}$/', $ruc)) {
            return ["success" => false, "mensaje" => "El RUC debe tener 11 dígitos."];
        }

        $respuesta = $this->_consultarApiPeru(API_RUC_URL . '/' . $ruc);

        if (!$respuesta || empty($respuesta['success'])) {
            return ["success" => false, "mensaje" => $respuesta['message'] ?? "No se pudo consultar el RUC."];
        }

        $d = $respuesta['data'] ?? [];

        return [
            "success" => true,
            "data" => [
                "estado"     => $d['estado'] ?? '',
                "condicion"  => $d['condicion'] ?? '',
                "actividad"  => $d['actividad_economica'] ?? ($d['nombre_comercial'] ?? ''),
            ]
        ];
    }

    // Helper compartido: llama a apiperu.dev con el token configurado en
    // constants.php (API_CONSULTA_TOKEN). Reemplaza ahí tu token real.
    private function _consultarApiPeru($url)
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_HTTPHEADER => [
                'Authorization: ' . API_CONSULTA_TOKEN,
                'Accept: application/json',
            ],
        ]);

        $respuesta = curl_exec($ch);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error || !$respuesta) {
            return null;
        }

        return json_decode($respuesta, true);
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
