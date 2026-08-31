<?php

class StaffModel extends Model
{
    protected $table = 'trabajadores';
    protected $id = 'id_trabajador';

    // Método para obtener todos los registros
    public function worker_listar_()
    {
        $sql = "SELECT 
                t.*, u.nombres, u.apellidos, u.email, u.usuario, h.nombre as turno
                FROM trabajadores t
                INNER JOIN usuarios u ON u.id_usuario = t.id_usuario
                INNER JOIN horarios h ON h.id_horario = t.id_horario
                INNER JOIN roles r ON r.id_rol = u.id_rol WHERE r.nombre = 'Tecnico'";
        return $this->getAll($sql);
    }

    public function obtener_stock_($id_trabajador)
    {
        $sql = "SELECT
                    tr.id_trabajador,
                    CONCAT(u.nombres,' ',u.apellidos) AS nombre_completo,
                    tp.id_producto,
                    tp.stock,
                    p.nombre,
                    p.codigo,
                    p.descripcion,
                    p.precio_venta,
                    p.maneja_serie
                FROM trabajadores tr
                INNER JOIN usuarios u ON u.id_usuario = tr.id_usuario
                LEFT JOIN trabajador_productos tp ON tp.id_trabajador = tr.id_trabajador
                LEFT JOIN productos p ON p.id_producto = tp.id_producto
                WHERE tr.id_trabajador = :id_trabajador";

        $result = $this->getAll($sql, [':id_trabajador' => $id_trabajador]);

        if (!$result) {
            return ['success' => false, 'mensaje' => 'Trabajador no encontrado'];
        }

        $nombre   = $result[0]->nombre_completo;
        $productos = [];

        foreach ($result as $row) {
            if ($row->id_producto === null) continue;

            $item = (array) $row;

            // Si maneja serie, traer las series actualmente asignadas al técnico
            if ($row->maneja_serie == 1) {
                $series_asignadas = $this->getAll(
                    "SELECT ts.id_producto_serie, ps.numero_serie
                     FROM trabajador_series ts
                     INNER JOIN producto_series ps ON ps.id_producto_serie = ts.id_producto_serie
                     WHERE ts.id_trabajador = :t AND ts.id_producto = :p AND ts.estado = 'Asignada'",
                    [':t' => $id_trabajador, ':p' => $row->id_producto]
                );
                $item['series_asignadas'] = $series_asignadas ?: [];
            } else {
                $item['series_asignadas'] = [];
            }

            $productos[] = $item;
        }

        return [
            'success' => true,
            'data'    => [
                'id_trabajador_stock' => $id_trabajador,
                'nombre'              => $nombre,
                'productos'           => $productos
            ]
        ];
    }

    // ── agregar_stock_: agrega soporte de series, descuenta almacén ────────
    public function agregar_stock_()
    {
        try {
            $this->beginTransaction();

            $id_trabajador = $_POST['id_trabajador_stock'];
            $productos     = $_POST['producto']   ?? [];
            $cantidades    = $_POST['cantidad']   ?? [];
            // series[i] = id_producto_serie seleccionado (puede ser vacío para sin serie)
            $series_post   = $_POST['serie']      ?? [];

            // Liberar series previamente asignadas al técnico
            $seriesAntiguas = $this->getAll(
                "SELECT id_producto_serie, id_producto
                 FROM trabajador_series
                 WHERE id_trabajador=:t AND estado='Asignada'",
                [':t' => $id_trabajador]
            );
            foreach ($seriesAntiguas as $sa) {
                $this->query(
                    "UPDATE producto_series SET estado='DISPONIBLE' WHERE id_producto_serie=:s",
                    [':s' => $sa->id_producto_serie]
                );
                // Devolver al stock del almacén
                $this->query(
                    "UPDATE stock SET cantidad=cantidad+1 WHERE id_producto=:p",
                    [':p' => $sa->id_producto]
                );
            }

            // Limpiar tabla de asignaciones
            $this->query("DELETE FROM trabajador_series WHERE id_trabajador=:t",   [':t' => $id_trabajador]);
            $this->query("DELETE FROM trabajador_productos WHERE id_trabajador=:t", [':t' => $id_trabajador]);

            for ($i = 0; $i < count($productos); $i++) {
                $id_producto = $productos[$i];
                $cantidad    = (int)($cantidades[$i] ?? 0);
                $id_serie    = $series_post[$i] ?? '';

                if (!$id_producto) continue;

                $prod = $this->getOne(
                    "SELECT maneja_serie FROM productos WHERE id_producto=:p",
                    [':p' => $id_producto]
                );
                if (!$prod) continue;

                if ($prod->maneja_serie == 1) {
                    // Para serie: id_serie viene del select del form
                    if (empty($id_serie)) continue;

                    // Verificar que esté DISPONIBLE
                    $serie = $this->getOne(
                        "SELECT id_producto_serie FROM producto_series
                         WHERE id_producto_serie=:s AND estado='DISPONIBLE'",
                        [':s' => $id_serie]
                    );
                    if (!$serie) continue;

                    // Marcar como RESERVADO
                    $this->query(
                        "UPDATE producto_series SET estado='RESERVADO' WHERE id_producto_serie=:s",
                        [':s' => $id_serie]
                    );

                    // Registrar en trabajador_series
                    $this->query(
                        "INSERT INTO trabajador_series (id_trabajador,id_producto,id_producto_serie,estado)
                         VALUES (:t,:p,:s,'Asignada')",
                        [':t' => $id_trabajador, ':p' => $id_producto, ':s' => $id_serie]
                    );

                    // Descontar stock del almacén
                    $this->query(
                        "UPDATE stock SET cantidad=GREATEST(cantidad-1,0) WHERE id_producto=:p",
                        [':p' => $id_producto]
                    );

                    // Insertar o actualizar en trabajador_productos (cuenta series)
                    $existing = $this->getOne(
                        "SELECT id_trabajador_producto FROM trabajador_productos WHERE id_trabajador=:t AND id_producto=:p",
                        [':t' => $id_trabajador, ':p' => $id_producto]
                    );
                    if ($existing) {
                        $this->query(
                            "UPDATE trabajador_productos SET stock=stock+1 WHERE id_trabajador=:t AND id_producto=:p",
                            [':t' => $id_trabajador, ':p' => $id_producto]
                        );
                    } else {
                        $this->query(
                            "INSERT INTO trabajador_productos (id_trabajador,id_producto,stock) VALUES (:t,:p,1)",
                            [':t' => $id_trabajador, ':p' => $id_producto]
                        );
                    }
                } else {
                    // Sin serie: validar stock del almacén
                    if ($cantidad <= 0) continue;

                    $stockAlm = $this->getOne(
                        "SELECT COALESCE(SUM(cantidad),0) AS qty FROM stock WHERE id_producto=:p",
                        [':p' => $id_producto]
                    );
                    $disponible = (int)($stockAlm->qty ?? 0);

                    if ($cantidad > $disponible) {
                        $this->rollBack();
                        $prod_info = $this->getOne("SELECT nombre FROM productos WHERE id_producto=:p", [':p' => $id_producto]);
                        return [
                            'success' => false,
                            'mensaje' => "Stock insuficiente para \"{$prod_info->nombre}\". Disponible: {$disponible}, solicitado: {$cantidad}"
                        ];
                    }

                    // Descontar del almacén
                    $this->query(
                        "UPDATE stock SET cantidad=GREATEST(cantidad-:c,0) WHERE id_producto=:p",
                        [':c' => $cantidad, ':p' => $id_producto]
                    );

                    $this->query(
                        "INSERT INTO trabajador_productos (id_trabajador,id_producto,stock)
                         VALUES (:t,:p,:s)",
                        [':t' => $id_trabajador, ':p' => $id_producto, ':s' => $cantidad]
                    );
                }
            }

            $this->commit();
            return ['success' => true, 'mensaje' => 'Stock actualizado correctamente'];
        } catch (Exception $e) {
            $this->rollBack();
            return ['success' => false, 'mensaje' => 'Error al guardar: ' . $e->getMessage()];
        }
    }

    // ── Helpers privados de stock ─────────────────────────────────────────
    private function _decrementarStockAlmacen($id_producto, $cantidad)
    {
        $this->query(
            "UPDATE stock SET cantidad = GREATEST(cantidad - :c, 0)
             WHERE id_producto = :p",
            [':c' => $cantidad, ':p' => $id_producto]
        );
    }

    private function _incrementarStockAlmacen($id_producto, $cantidad)
    {
        $this->query(
            "UPDATE stock SET cantidad = cantidad + :c
             WHERE id_producto = :p",
            [':c' => $cantidad, ':p' => $id_producto]
        );
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
        $id_vehiculo = $_POST['id_vehiculo'];
        $id_usuario = $_POST['id_usuario'];
        $id_horario = $_POST['id_horario'];
        $fecha_ingreso = $_POST['fecha_ingreso'];
        $estado = 'Activo';

        try {
            if (!empty($id) && $id != 0) {
                // Actualizar
                $sql = "UPDATE {$this->table} SET id_vehiculo = :id_vehiculo, id_usuario = :id_usuario, id_horario = :id_horario, fecha_ingreso = :fecha_ingreso, estado = :estado";

                $params = [
                    ':id_vehiculo' => $id_vehiculo,
                    ':id_usuario' => $id_usuario,
                    ':id_horario' => $id_horario,
                    ':fecha_ingreso' => $fecha_ingreso,
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
                $sql = "INSERT INTO {$this->table} (id_vehiculo, id_usuario, id_horario, fecha_ingreso, estado)
                    VALUES (:id_vehiculo, :id_usuario, :id_horario, :fecha_ingreso, :estado)";
                $params = [
                    ':id_vehiculo' => $id_vehiculo,
                    ':id_usuario' => $id_usuario,
                    ':id_horario' => $id_horario,
                    ':fecha_ingreso' => $fecha_ingreso,
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

    public function buscar_trabajador_por_usuario_($id_usuario)
    {
        return $this->getOne(
            "SELECT id_trabajador, id_horario
             FROM trabajadores
             WHERE id_usuario = :id
             LIMIT 1",
            [':id' => $id_usuario]
        );
    }
}
