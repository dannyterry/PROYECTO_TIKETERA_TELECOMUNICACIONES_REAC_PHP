<?php

class OrderModel extends Model
{
    protected $table = 'ordenes';
    protected $id = 'id_orden';

    // Método para obtener todos los registros
    public function listar_($id_tecnico = null)
    {
        $where  = '';
        $params = [];

        if ($id_tecnico) {
            $where          = 'WHERE o.id_tecnico = :id_tecnico';
            $params[':id_tecnico'] = $id_tecnico;
        }

        $sql = "SELECT
                    o.*,
                    COALESCE(
                        NULLIF(TRIM(o.motivo_finalizacion), ''),
                        NULLIF(TRIM(o.motivo_cancelacion), '')
                    ) AS tipo_averia,
                    COALESCE(CONCAT(u.nombres, ' ', u.apellidos), '')  AS nombre_tecnico,
                    COALESCE(CONCAT(u2.nombres, ' ', u2.apellidos), '') AS nombre_tecnico_reemplazo
                FROM {$this->table} o
                LEFT JOIN trabajadores t  ON t.id_trabajador  = o.id_tecnico
                LEFT JOIN trabajadores t2 ON t2.id_trabajador = o.id_tecnico_reemplazo
                LEFT JOIN usuarios u      ON u.id_usuario     = t.id_usuario
                LEFT JOIN usuarios u2     ON u2.id_usuario    = t2.id_usuario
                {$where}
                ORDER BY o.numero DESC";

        return $this->getAll($sql, $params);
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
            $sql = "SELECT o.id_orden, o.id_tecnico, o.numero,
                           COALESCE(CONCAT(u.nombres,' ',u.apellidos),'—') AS nombre_tecnico
                    FROM ordenes o
                    LEFT JOIN trabajadores t ON t.id_trabajador = o.id_tecnico
                    LEFT JOIN usuarios u     ON u.id_usuario    = t.id_usuario
                    WHERE o.numero = :id";

            $response = $this->getOne($sql, [':id' => $id]);

            if (!$response) {
                return ["success" => false, "mensaje" => "Registro no encontrado"];
            }

            $id_tecnico = $response->id_tecnico;

            // ── Productos del técnico en trabajador_productos ─────────────
            $sqlProductos = "SELECT tp.*, p.nombre as nombre_producto, p.maneja_serie
                             FROM trabajador_productos tp
                             INNER JOIN productos p ON tp.id_producto = p.id_producto
                             WHERE tp.id_trabajador = :id_trabajador
                               AND tp.stock > 0";

            $productos = $this->getAll($sqlProductos, [':id_trabajador' => $id_tecnico]);

            if (!$productos || count($productos) == 0) {
                return ["success" => false, "mensaje" => "El técnico no tiene stock disponible"];
            }

            foreach ($productos as &$producto) {
                if ($producto->maneja_serie == 1) {
                    // FIX CRÍTICO: buscar en trabajador_series (las del técnico)
                    // NO en producto_series globalmente
                    $series = $this->getAll(
                        "SELECT ts.id_producto_serie, ps.numero_serie, ts.estado
                         FROM trabajador_series ts
                         INNER JOIN producto_series ps
                             ON ps.id_producto_serie = ts.id_producto_serie
                         WHERE ts.id_trabajador = :id_tecnico
                           AND ts.id_producto   = :id_producto
                           AND ts.estado        = 'Asignada'",
                        [
                            ':id_tecnico'   => $id_tecnico,
                            ':id_producto'  => $producto->id_producto
                        ]
                    );
                    $producto->series = $series ?: [];
                }
            }

            return [
                "success"   => true,
                "data"      => $response,
                "productos" => $productos
            ];
        } catch (Exception $e) {
            return ["success" => false, "mensaje" => "Error: " . $e->getMessage()];
        }
    }

    // Método para agregar un registro
    public function agregar_()
    {
        $id = $_POST[$this->id];
        $nombre = $_POST['nombre'];
        $estado = $_POST['estado'];

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

    // Método para actualizar llamada
    public function actualizar_llamada_($id, $llamada)
    {

        try {
            // Actualizar
            $sql = "UPDATE {$this->table} SET llamada_inconcert = :llamada_inconcert";

            $params = [
                ':llamada_inconcert' => $llamada,
                ':id' => $id
            ];

            $sql .= " WHERE {$this->id} = :id";
            $this->query($sql, $params);

            return [
                "success" => true,
                "mensaje" => "Registro actualizado correctamente"
            ];
        } catch (Exception $e) {
            return [
                "success" => false,
                "mensaje" => "Error al guardar: " . $e->getMessage()
            ];
        }
    }

    // Método para actualizar tecnico
    public function actualizar_tecnico_($id, $id_tecnico)
    {

        try {
            // Actualizar
            $sql = "UPDATE {$this->table} SET id_tecnico = :id_tecnico";

            $params = [
                ':id_tecnico' => $id_tecnico,
                ':id' => $id
            ];

            $sql .= " WHERE {$this->id} = :id";
            $this->query($sql, $params);

            return [
                "success" => true,
                "mensaje" => "Registro actualizado correctamente"
            ];
        } catch (Exception $e) {
            return [
                "success" => false,
                "mensaje" => "Error al guardar: " . $e->getMessage()
            ];
        }
    }

    // Método para actualizar tecnico reemplazo
    public function actualizar_tecnico_reemplazo_($id, $id_tecnico_reemplazo)
    {

        try {
            // Actualizar
            $sql = "UPDATE {$this->table} SET id_tecnico_reemplazo = :id_tecnico_reemplazo";

            $params = [
                ':id_tecnico_reemplazo' => $id_tecnico_reemplazo,
                ':id' => $id
            ];

            $sql .= " WHERE {$this->id} = :id";
            $this->query($sql, $params);

            return [
                "success" => true,
                "mensaje" => "Registro actualizado correctamente"
            ];
        } catch (Exception $e) {
            return [
                "success" => false,
                "mensaje" => "Error al guardar: " . $e->getMessage()
            ];
        }
    }

    // Método para actualizar tecnico reemplazo
    public function actualizar_motivo_($id, $motivo_tipo_trabajo)
    {

        try {
            // Actualizar
            $sql = "UPDATE {$this->table} SET motivo_tipo_trabajo = :motivo_tipo_trabajo";

            $params = [
                ':motivo_tipo_trabajo' => $motivo_tipo_trabajo,
                ':id' => $id
            ];

            $sql .= " WHERE {$this->id} = :id";
            $this->query($sql, $params);

            return [
                "success" => true,
                "mensaje" => "Registro actualizado correctamente"
            ];
        } catch (Exception $e) {
            return [
                "success" => false,
                "mensaje" => "Error al guardar: " . $e->getMessage()
            ];
        }
    }

    // Método para actualizar masivo
    public function insertar_desde_win_($ordenes)
    {
        $insertados  = 0;
        $actualizados = 0;

        foreach ($ordenes as $orden) {

            $sqlCheck = "SELECT id_orden FROM {$this->table} WHERE numero = :numero";
            $existe   = $this->query($sqlCheck, [':numero' => $orden['numero']])->fetch();

            $columnas = array_keys($orden);

            if ($existe) {
                // UPDATE — traer registro actual
                $sqlActual     = "SELECT * FROM {$this->table} WHERE numero = :numero";
                $registroActual = $this->query($sqlActual, [':numero' => $orden['numero']])
                    ->fetch(PDO::FETCH_ASSOC);

                $hayCambios = false;
                $set        = [];
                $params     = [];

                foreach ($orden as $key => $value) {

                    if ($key === 'numero') continue;

                    // ── FIX: no sobreescribir con NULL si ya hay un valor ──
                    // Columnas de fecha/visita que no deben borrarse si WIN no las manda
                    if (is_null($value) && !is_null($registroActual[$key] ?? null)) {
                        continue;
                    }

                    $valorActual = $registroActual[$key] ?? null;

                    if ((string)$valorActual !== (string)$value) {
                        $hayCambios       = true;
                        $set[]            = "$key = :$key";
                        $params[":$key"]  = $value;
                    }
                }

                if ($hayCambios) {
                    $setSql = implode(", ", $set);
                    $sql    = "UPDATE {$this->table} SET $setSql WHERE numero = :numero";
                    $params[':numero'] = $orden['numero'];
                    $this->query($sql, $params);
                    $actualizados++;
                }
            } else {
                // INSERT
                $campos       = implode(", ", $columnas);
                $placeholders = ":" . implode(", :", $columnas);

                $sql    = "INSERT INTO {$this->table} ($campos) VALUES ($placeholders)";
                $params = [];
                foreach ($orden as $key => $value) {
                    $params[":$key"] = $value;
                }
                $this->query($sql, $params);
                $insertados++;
            }
        }

        return [
            "success"           => true,
            "total_insertados"  => $insertados,
            "total_actualizados" => $actualizados,
            "mensaje"           => "Insertados: {$insertados} | Actualizados: {$actualizados}"
        ];
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

    // ========== Metodo liquidar orden ==========
    public function liquidar_()
    {
        try {
            $id_orden      = $_POST['id_orden']      ?? null;
            $id_trabajador = $_POST['id_trabajador'] ?? null;
            $observaciones = $_POST['observaciones'] ?? '';
            $productos_raw = $_POST['productos']     ?? '[]';

            if (empty($id_orden) || empty($id_trabajador)) {
                return ['success' => false, 'mensaje' => 'Datos incompletos.'];
            }

            $productos = json_decode($productos_raw, true);
            if (!is_array($productos) || count($productos) === 0) {
                return ['success' => false, 'mensaje' => 'Debes agregar al menos un producto.'];
            }

            // Verificar que la orden esté Finalizada
            $orden = $this->getOne(
                "SELECT id_orden, estado, numero, inicio_visita, fin_visita
                 FROM ordenes WHERE id_orden = :id",
                [':id' => $id_orden]
            );
            if (!$orden || $orden->estado !== 'Finalizada') {
                return ['success' => false, 'mensaje' => 'La orden no está en estado Finalizada.'];
            }

            // Insertar cabecera de liquidación
            $this->query(
                "INSERT INTO orden_liquidaciones (id_orden, id_trabajador, observaciones)
                 VALUES (:io, :it, :obs)",
                [':io' => $id_orden, ':it' => $id_trabajador, ':obs' => $observaciones]
            );
            $id_liquidacion = $this->lastInsertId();

            foreach ($productos as $prod) {
                $id_producto       = $prod['id_producto']       ?? null;
                $cantidad          = (int)($prod['cantidad']    ?? 1);
                $id_producto_serie = $prod['id_producto_serie'] ?? null;
                $numero_serie      = $prod['numero_serie']      ?? null;
                $maneja_serie      = (int)($prod['maneja_serie'] ?? 0);

                if (!$id_producto) continue;

                if (!$maneja_serie) {
                    $tp = $this->getOne(
                        "SELECT stock FROM trabajador_productos
                         WHERE id_trabajador = :t AND id_producto = :p",
                        [':t' => $id_trabajador, ':p' => $id_producto]
                    );
                    if (!$tp || $tp->stock < $cantidad) {
                        return ['success' => false, 'mensaje' => "Stock insuficiente para producto ID $id_producto."];
                    }
                }

                $this->query(
                    "INSERT INTO orden_liquidacion_detalle
                         (id_liquidacion, id_producto, id_producto_serie, cantidad, numero_serie)
                     VALUES (:liq,:prod,:serie,:cant,:ns)",
                    [
                        ':liq'   => $id_liquidacion,
                        ':prod'  => $id_producto,
                        ':serie' => $id_producto_serie,
                        ':cant' => $cantidad,
                        ':ns'    => $numero_serie
                    ]
                );

                $this->query(
                    "UPDATE trabajador_productos
                     SET stock = stock - :cant
                     WHERE id_trabajador = :t AND id_producto = :p AND stock >= :cant",
                    [':cant' => $cantidad, ':t' => $id_trabajador, ':p' => $id_producto]
                );

                if ($id_producto_serie) {
                    $this->query(
                        "UPDATE producto_series SET estado='VENDIDO' WHERE id_producto_serie=:s",
                        [':s' => $id_producto_serie]
                    );
                    // Liberar de trabajador_series
                    $this->query(
                        "UPDATE trabajador_series SET estado='Usada'
                         WHERE id_trabajador=:t AND id_producto_serie=:s",
                        [':t' => $id_trabajador, ':s' => $id_producto_serie]
                    );
                }
            }

            // ── NUEVO: registrar asistencia automática al liquidar ────────
            // Usamos inicio_visita y fin_visita de la orden (ya guardados por WIN)
            $this->registrarAsistenciaDesdeOrden_(
                $id_orden,
                $id_trabajador,
                $orden->inicio_visita,
                $orden->fin_visita
            );

            return ['success' => true, 'mensaje' => 'Liquidación registrada correctamente.'];
        } catch (Exception $e) {
            return ['success' => false, 'mensaje' => 'Error: ' . $e->getMessage()];
        }
    }

    private function registrarAsistenciaDesdeOrden_($id_orden, $id_trabajador, $inicio, $fin)
    {
        try {
            if (!$inicio) return; // sin inicio no hay asistencia

            require_once __DIR__ . '/AssistanceModel.php';
            $assistanceModel = new AssistanceModel();
            $assistanceModel->registrar_desde_orden_($id_orden, $inicio, $fin);
        } catch (Exception $e) {
            error_log("[Asistencia auto] Error: " . $e->getMessage());
        }
    }

    public function listar_liquidaciones_($id_orden)
    {
        $sql = "SELECT ol.*,
                       o.numero,
                       CONCAT(u.nombres,' ',u.apellidos) AS nombre_tecnico,
                       (SELECT COUNT(*) FROM orden_liquidacion_detalle d
                        WHERE d.id_liquidacion = ol.id_liquidacion) AS total_materiales
                FROM orden_liquidaciones ol
                INNER JOIN ordenes o      ON o.id_orden      = ol.id_orden
                INNER JOIN trabajadores t ON t.id_trabajador = ol.id_trabajador
                INNER JOIN usuarios u     ON u.id_usuario    = t.id_usuario
                WHERE ol.id_orden = :id
                ORDER BY ol.fecha_liquidacion DESC";
        return $this->getAll($sql, [':id' => $id_orden]);
    }

    public function lastInsertId()
    {
        return $this->db->lastInsertId();
    }

    public function buscar_por_numero_($numero)
    {
        return $this->getOne(
            "SELECT id_orden, id_tecnico, numero,
                    inicio_visita, fin_visita
             FROM {$this->table}
             WHERE numero = :numero
             LIMIT 1",
            [':numero' => $numero]
        );
    }
}
