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
                    o.hora_en_camino,
                    COALESCE(
                        NULLIF(TRIM(o.motivo_finalizacion), ''),
                        NULLIF(TRIM(o.motivo_cancelacion), '')
                    ) AS tipo_averia,
                    COALESCE(CONCAT(u.nombres, ' ', u.apellidos), '')  AS nombre_tecnico,
                    COALESCE(CONCAT(u2.nombres, ' ', u2.apellidos), '') AS nombre_tecnico_reemplazo,
                    olact.id_liquidacion AS id_liquidacion_activa,
                    olact.estado         AS estado_liquidacion_activa,
                    (SELECT olr.id_liquidacion
                     FROM orden_liquidaciones olr
                     WHERE olr.id_orden = o.id_orden
                       AND olr.estado = 'Rechazada'
                     ORDER BY olr.fecha_liquidacion DESC
                     LIMIT 1) AS id_liquidacion_rechazada
                FROM {$this->table} o
                LEFT JOIN trabajadores t  ON t.id_trabajador  = o.id_tecnico
                LEFT JOIN trabajadores t2 ON t2.id_trabajador = o.id_tecnico_reemplazo
                LEFT JOIN usuarios u      ON u.id_usuario     = t.id_usuario
                LEFT JOIN usuarios u2     ON u2.id_usuario    = t2.id_usuario
                LEFT JOIN orden_liquidaciones olact
                    ON olact.id_orden = o.id_orden
                   AND olact.estado IN ('Pendiente','Aprobada')
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
            $sql = "SELECT o.id_orden, o.id_tecnico, o.numero, o.cliente, o.tipo_trabajo,
                           COALESCE(CONCAT(u.nombres,' ',u.apellidos),'—') AS nombre_tecnico
                    FROM ordenes o
                    LEFT JOIN trabajadores t ON t.id_trabajador = o.id_tecnico
                    LEFT JOIN usuarios u     ON u.id_usuario    = t.id_usuario
                    WHERE o.numero = :id";

            $response = $this->getOne($sql, [':id' => $id]);

            if (!$response) {
                return ["success" => false, "mensaje" => "Registro no encontrado"];
            }

            $productos = $this->obtenerStockTrabajador_($response->id_tecnico);

            if (!$productos || count($productos) == 0) {
                return ["success" => false, "mensaje" => "El técnico no tiene stock disponible"];
            }

            return [
                "success"   => true,
                "data"      => $response,
                "productos" => $productos,
                "limites"   => $this->limites_para_tipo_($response->tipo_trabajo)
            ];
        } catch (Exception $e) {
            return ["success" => false, "mensaje" => "Error: " . $e->getMessage()];
        }
    }

    // Límites máximos por producto para un tipo de trabajo, según los motivos
    // activos que lo usan. Devuelve [{id_producto, cantidad}] o [] si no hay.
    // Si varios motivos definen límites para el mismo tipo, se toma el mayor
    // por producto.
    private function limites_para_tipo_($tipo_trabajo)
    {
        if (empty($tipo_trabajo)) return [];

        $motivos = $this->getAll(
            "SELECT limites_materiales FROM motivos
             WHERE estado = 'Activo' AND tipo_trabajo = :tt
               AND limites_materiales IS NOT NULL AND limites_materiales <> ''",
            [':tt' => $tipo_trabajo]
        );

        $mapa = [];
        foreach ($motivos as $motivo) {
            $arr = json_decode($motivo->limites_materiales, true);
            if (!is_array($arr)) continue;
            foreach ($arr as $item) {
                $id   = (int)($item['id_producto'] ?? 0);
                $cant = (float)($item['cantidad'] ?? 0);
                if ($id > 0 && $cant > 0) {
                    $mapa[$id] = isset($mapa[$id]) ? max($mapa[$id], $cant) : $cant;
                }
            }
        }

        $lista = [];
        if ($mapa) {
            $ids = implode(',', array_map('intval', array_keys($mapa)));
            $productos = $this->getAll(
                "SELECT id_producto, nombre FROM productos WHERE id_producto IN ($ids)"
            );
            $nombres = [];
            foreach ($productos as $prod) {
                $nombres[(int)$prod->id_producto] = $prod->nombre;
            }
            foreach ($mapa as $pid => $cant) {
                $lista[] = [
                    'id_producto' => $pid,
                    'cantidad'    => $cant,
                    'nombre'      => $nombres[$pid] ?? 'Producto ' . $pid
                ];
            }
        }
        return $lista;
    }

    // Trae el stock disponible (con series si aplica) de un trabajador.
    // Compartido por editar_() (stock del técnico de una orden puntual)
    // y por mi_stock_() (stock del propio técnico logueado).
    // $incluirVehiculo: false = como antes, excluye productos de vehículo
    // (para Liquidar, donde no deben poder liquidarse). true = los incluye
    // (para "Mi stock", donde el técnico debe poder verlos aunque no
    // pueda liquidarlos).
    private function obtenerStockTrabajador_($id_tecnico, $incluirVehiculo = false)
    {
        $filtroVehiculo = $incluirVehiculo ? '' : ' AND p.maneja_vehiculo = 0';

        $sqlProductos = "SELECT tp.*, p.nombre as nombre_producto, p.maneja_serie,
                                 p.categoria_liquidar, p.maneja_vehiculo, p.es_drop
                         FROM trabajador_productos tp
                         INNER JOIN productos p ON tp.id_producto = p.id_producto
                         WHERE tp.id_trabajador = :id_trabajador
                           AND tp.stock > 0 {$filtroVehiculo}";

        $productos = $this->getAll($sqlProductos, [':id_trabajador' => $id_tecnico]);

        if (!$productos) {
            return [];
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

        return $productos;
    }

    // Stock del técnico logueado, para el botón "Mi stock" (no depende de
    // ninguna orden puntual, solo de quién inició sesión).
    public function mi_stock_($id_usuario)
    {
        try {
            $trabajador = $this->getOne(
                "SELECT id_trabajador FROM trabajadores WHERE id_usuario = :iu",
                [':iu' => $id_usuario]
            );

            if (!$trabajador) {
                return ["success" => false, "mensaje" => "No se encontró el registro de trabajador para este usuario."];
            }

            $productos = $this->obtenerStockTrabajador_($trabajador->id_trabajador);

            return [
                "success"   => true,
                "productos" => $productos
            ];
        } catch (Exception $e) {
            return ["success" => false, "mensaje" => "Error: " . $e->getMessage()];
        }
    }

    // ── Dar de baja un equipo desde el stock del técnico (un clic) ───────
    // El técnico selecciona una serie de su stock y el sistema la marca
    // como BAJA, la saca de su asignación y le descuenta la unidad, sin
    // tener que digitar el número de serie.
    public function dar_baja_($id_usuario, $id_producto_serie)
    {
        try {
            if (!$id_producto_serie) {
                return ["success" => false, "mensaje" => "Selecciona el equipo a dar de baja."];
            }

            $trabajador = $this->getOne(
                "SELECT id_trabajador FROM trabajadores WHERE id_usuario = :iu",
                [':iu' => $id_usuario]
            );
            if (!$trabajador) {
                return ["success" => false, "mensaje" => "No se encontró el registro de trabajador para este usuario."];
            }
            $id_trabajador = (int)$trabajador->id_trabajador;

            $asignada = $this->getOne(
                "SELECT ts.id_trabajador_serie, ps.id_producto, ps.numero_serie
                 FROM trabajador_series ts
                 INNER JOIN producto_series ps ON ps.id_producto_serie = ts.id_producto_serie
                 WHERE ts.id_trabajador = :t
                   AND ts.id_producto_serie = :s
                   AND ts.estado = 'Asignada'",
                [':t' => $id_trabajador, ':s' => $id_producto_serie]
            );

            if (!$asignada) {
                return ["success" => false, "mensaje" => "El equipo no está asignado a tu stock."];
            }

            $this->beginTransaction();

            try {
                // Marcar la serie como BAJA en el inventario
                $this->query(
                    "UPDATE producto_series SET estado = 'BAJA' WHERE id_producto_serie = :s",
                    [':s' => $id_producto_serie]
                );

                // Liberar la asignación del técnico
                $this->query(
                    "UPDATE trabajador_series SET estado = 'Baja' WHERE id_trabajador_serie = :ts",
                    [':ts' => $asignada->id_trabajador_serie]
                );

                // Descontar la unidad del stock del técnico
                $this->query(
                    "UPDATE trabajador_productos
                     SET stock = GREATEST(stock - 1, 0)
                     WHERE id_trabajador = :t AND id_producto = :p AND stock >= 1",
                    [':t' => $id_trabajador, ':p' => $asignada->id_producto]
                );

                $this->commit();

                return ["success" => true, "mensaje" => "Serie {$asignada->numero_serie} dada de baja correctamente."];
            } catch (Exception $e) {
                $this->rollBack();
                return ["success" => false, "mensaje" => "Error: " . $e->getMessage()];
            }
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

    // Método para actualizar el tipo de trabajo de una orden
    public function actualizar_motivo_($id, $tipo_trabajo)
    {

        try {
            // Actualizar
            $sql = "UPDATE {$this->table} SET tipo_trabajo = :tipo_trabajo";

            $params = [
                ':tipo_trabajo' => $tipo_trabajo,
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
    // Devuelve, para un lote de números de orden, cuáles ya existen en BD y
    // cuál es su hora_asignacion actual (o null si no existen / no la tienen).
    // Se usa para decidir a qué órdenes vale la pena pedirle el detalle a WIN
    // y a cuáles no (porque ya la tenemos y no cambia una vez asignada).
    public function obtener_horas_asignacion_(array $numeros)
    {
        if (empty($numeros)) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($numeros), '?'));
        $sql = "SELECT numero, hora_asignacion FROM {$this->table} WHERE numero IN ($placeholders)";

        $stmt = $this->query($sql, array_values($numeros));

        $mapa = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $fila) {
            $mapa[$fila['numero']] = $fila['hora_asignacion'];
        }

        return $mapa;
    }

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
            $numero_acta = $_POST['numero_acta'] ?? '';
            $productos_raw = $_POST['productos']     ?? '[]';

            if (empty($id_orden) || empty($id_trabajador)) {
                return ['success' => false, 'mensaje' => 'Datos incompletos.'];
            }

            $productos = json_decode($productos_raw, true);
            if (!is_array($productos) || count($productos) === 0) {
                return ['success' => false, 'mensaje' => 'Debes agregar al menos un producto.'];
            }

            // No permitir liquidar dos veces la misma orden mientras tenga una
            // liquidación activa (Pendiente o Aprobada). Si la anterior fue
            // Rechazada, sí se puede volver a liquidar.
            $yaLiquidada = $this->getOne(
                "SELECT id_liquidacion FROM orden_liquidaciones
                 WHERE id_orden = :io AND estado IN ('Pendiente','Aprobada')",
                [':io' => $id_orden]
            );

            if ($yaLiquidada) {
                return ['success' => false, 'mensaje' => 'Esta orden ya fue liquidada.'];
            }

            // ── Límites de materiales por motivo ─────────────────────────
            // Si el tipo de trabajo de la orden tiene límites configurados,
            // verificar que los materiales liquidados no superen el máximo.
            $ordenInfo = $this->getOne(
                "SELECT tipo_trabajo FROM ordenes WHERE id_orden = :io",
                [':io' => $id_orden]
            );
            $tipo_trabajo = $ordenInfo ? $ordenInfo->tipo_trabajo : null;

            if ($tipo_trabajo) {
                $limites = $this->limites_para_tipo_($tipo_trabajo);
                if ($limites) {
                    $mapaLimites = [];
                    foreach ($limites as $l) {
                        $mapaLimites[(int)$l['id_producto']] = (float)$l['cantidad'];
                    }

                    $usado = [];
                    foreach ($productos as $prod) {
                        if (!empty($prod['es_baja'])) continue;
                        $id = (int)($prod['id_producto'] ?? 0);
                        if (!$id) continue;
                        $cant = (int)($prod['cantidad'] ?? 1);
                        $usado[$id] = ($usado[$id] ?? 0) + $cant;
                    }

                    foreach ($usado as $id => $cant) {
                        if (isset($mapaLimites[$id]) && $cant > $mapaLimites[$id]) {
                            $nombreP = $this->getOne(
                                "SELECT nombre FROM productos WHERE id_producto = :p",
                                [':p' => $id]
                            );
                            $nombre = $nombreP ? $nombreP->nombre : "ID {$id}";
                            return [
                                'success' => false,
                                'mensaje' => "Se excede el límite de materiales para \"{$nombre}\": usado {$cant}, máximo permitido " . $mapaLimites[$id] . "."
                            ];
                        }
                    }
                }
            }

            // Verificar que la orden esté Finalizada


            // Insertar cabecera de liquidación
            $this->query(
                "INSERT INTO orden_liquidaciones (id_orden, id_trabajador, numero_acta, observaciones)
                 VALUES (:io, :it, :na, :obs)",
                [':io' => $id_orden, ':it' => $id_trabajador, ':na' => $numero_acta, ':obs' => $observaciones]
            );
            $id_liquidacion = $this->lastInsertId();

            foreach ($productos as $prod) {

                $es_baja = !empty($prod['es_baja']);

                // ── EQUIPOS DE BAJA ────────────────────────────────────
                // Son equipos que se retiran de servicio: no se venden, pero
                // tampoco se consumen del stock del técnico que los devolvía.
                // Si la serie estaba asignada al técnico, se le libera (sale
                // de su stock). Si la serie ya existe en el inventario, se
                // actualiza su estado; si no existe (equipo de campo nunca
                // registrado, de antes del sistema), se crea en ese momento
                // directamente como BAJA — así queda en el inventario desde
                // ahora en adelante, diferenciada por su estado.
                if ($es_baja) {

                    $id_producto  = $prod['id_producto']  ?? null;
                    $numero_serie = trim($prod['numero_serie'] ?? '');

                    if (!$id_producto || $numero_serie === '') continue;

                    $existente = $this->getOne(
                        "SELECT id_producto_serie, id_producto, id_almacen, estado
                         FROM producto_series
                         WHERE numero_serie = :ns AND id_producto = :p",
                        [':ns' => $numero_serie, ':p' => $id_producto]
                    );

                    if ($existente) {
                        $id_producto_serie = $existente->id_producto_serie;
                        // Mantener el almacén original de la serie.
                        $id_almacen_baja   = (int)$existente->id_almacen;
                        // Guardar el estado previo para revertir si se rechaza.
                        $estado_anterior   = $existente->estado;
                        $serie_creada      = 0;

                        $this->query(
                            "UPDATE producto_series SET estado = 'BAJA' WHERE id_producto_serie = :s",
                            [':s' => $id_producto_serie]
                        );
                    } else {
                        // Almacén destino para equipos de baja recién registrados:
                        // el almacén donde el producto tiene más stock, así el
                        // equipo de baja queda donde está el resto del producto.
                        $almacen_def = $this->getOne(
                            "SELECT id_almacen FROM stock WHERE id_producto = :p
                             ORDER BY cantidad DESC, id_almacen ASC LIMIT 1",
                            [':p' => $id_producto]
                        );
                        $id_almacen_baja = $almacen_def ? (int)$almacen_def->id_almacen : 1;

                        $this->query(
                            "INSERT INTO producto_series (id_producto, id_almacen, numero_serie, estado)
                             VALUES (:p, :alm, :ns, 'BAJA')",
                            [':p' => $id_producto, ':alm' => $id_almacen_baja, ':ns' => $numero_serie]
                        );
                        $id_producto_serie = $this->lastInsertId();
                        // Serie creada por esta liquidación → al rechazar se elimina.
                        $estado_anterior   = null;
                        $serie_creada      = 1;
                    }

                    // Si la serie estaba asignada al técnico, liberarla: la baja
                    // devuelve el equipo, por lo que sale de su stock.
                    $asignada = $this->getOne(
                        "SELECT id_trabajador_serie, id_trabajador
                         FROM trabajador_series
                         WHERE id_producto_serie = :s AND estado = 'Asignada'",
                        [':s' => $id_producto_serie]
                    );
                    $id_trabajador_serie = null;
                    if ($asignada) {
                        $id_trabajador_serie = $asignada->id_trabajador_serie;
                        $this->query(
                            "UPDATE trabajador_series SET estado = 'Baja'
                             WHERE id_trabajador_serie = :ts",
                            [':ts' => $asignada->id_trabajador_serie]
                        );
                        $this->query(
                            "UPDATE trabajador_productos
                             SET stock = GREATEST(stock - 1, 0)
                             WHERE id_trabajador = :t AND id_producto = :p AND stock >= 1",
                            [':t' => $asignada->id_trabajador, ':p' => $id_producto]
                        );
                    }

                    $this->query(
                        "INSERT INTO orden_liquidacion_detalle
                             (id_liquidacion, id_producto, id_producto_serie, cantidad, numero_serie,
                              es_baja, serie_creada, estado_anterior, id_trabajador_serie)
                         VALUES (:liq,:prod,:serie,:cant,:ns, 1, :creada, :eant, :its)",
                        [
                            ':liq'    => $id_liquidacion,
                            ':prod'   => $id_producto,
                            ':serie'  => $id_producto_serie,
                            ':cant'   => 1,
                            ':ns'     => $numero_serie,
                            ':creada' => $serie_creada,
                            ':eant'   => $estado_anterior,
                            ':its'    => $id_trabajador_serie
                        ]
                    );

                    continue;
                }

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

                // Guardar el estado previo de la serie (y su asignación) para
                // poder revertir el movimiento si la liquidación es rechazada.
                $estado_anterior      = null;
                $id_trabajador_serie  = null;
                if ($id_producto_serie) {
                    $serieInfo = $this->getOne(
                        "SELECT estado FROM producto_series WHERE id_producto_serie = :s",
                        [':s' => $id_producto_serie]
                    );
                    $estado_anterior = $serieInfo ? $serieInfo->estado : null;

                    $ts = $this->getOne(
                        "SELECT id_trabajador_serie FROM trabajador_series
                         WHERE id_trabajador = :t AND id_producto_serie = :s AND estado = 'Asignada'",
                        [':t' => $id_trabajador, ':s' => $id_producto_serie]
                    );
                    $id_trabajador_serie = $ts ? $ts->id_trabajador_serie : null;
                }

                $this->query(
                    "INSERT INTO orden_liquidacion_detalle
                         (id_liquidacion, id_producto, id_producto_serie, cantidad, numero_serie,
                          drop_inicio, drop_fin, es_baja, serie_creada, estado_anterior, id_trabajador_serie)
                     VALUES (:liq,:prod,:serie,:cant,:ns, :di, :df, 0, 0, :eant, :its)",
                    [
                        ':liq'   => $id_liquidacion,
                        ':prod'  => $id_producto,
                        ':serie' => $id_producto_serie,
                        ':cant'  => $cantidad,
                        ':ns'    => $numero_serie,
                        ':di'    => $prod['drop_inicio'] ?? null,
                        ':df'    => $prod['drop_fin'] ?? null,
                        ':eant'  => $estado_anterior,
                        ':its'   => $id_trabajador_serie
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

            return ['success' => true, 'mensaje' => 'Liquidación registrada correctamente.'];
        } catch (Exception $e) {
            return ['success' => false, 'mensaje' => 'Error: ' . $e->getMessage()];
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
