<?php
// cespedes/app/models/StockModel.php — REEMPLAZAR COMPLETO

class StockModel extends Model
{
    protected $table = 'stock';
    protected $id    = 'id_stock';

    // ── Vista principal: stock de almacén AGRUPADO por producto ───────────
    //    Un solo registro por producto, con totales globales (series) y la
    //    lista de almacenes donde tiene stock.
    public function listar_()
    {
        $sql = "SELECT
                    p.id_producto,
                    p.codigo,
                    p.id_categoria,
                    p.nombre        AS nombre_producto,
                    p.maneja_serie,
                    p.stock_minimo,
                    p.precio_compra,
                    p.precio_venta,
                    c.nombre        AS nombre_categoria,
                    -- Stock total en almacenes (suma de todas las filas del producto)
                    COALESCE(SUM(s.cantidad), 0) AS cantidad,
                    -- Stock asignado a técnicos (suma de trabajador_productos)
                    COALESCE(
                        (SELECT SUM(tp.stock)
                         FROM trabajador_productos tp
                         WHERE tp.id_producto = p.id_producto), 0
                    ) AS stock_tecnicos,
                    -- Series por estado (globales, independiente del almacén)
                    (SELECT COUNT(*) FROM producto_series ps
                     WHERE ps.id_producto = p.id_producto
                       AND ps.estado = 'DISPONIBLE') AS series_disponibles,
                    (SELECT COUNT(*) FROM producto_series ps2
                     WHERE ps2.id_producto = p.id_producto
                       AND ps2.estado = 'RESERVADO') AS series_reservadas,
                    (SELECT COUNT(*) FROM producto_series ps3
                     WHERE ps3.id_producto = p.id_producto
                       AND ps3.estado = 'VENDIDO') AS series_vendidas,
                    (SELECT COUNT(*) FROM producto_series ps4
                     WHERE ps4.id_producto = p.id_producto
                       AND ps4.estado = 'BAJA') AS series_bajas,
                    -- Almacenes donde tiene stock
                    COUNT(DISTINCT s.id_almacen) AS num_almacenes,
                    GROUP_CONCAT(DISTINCT a.nombre ORDER BY s.id_almacen SEPARATOR ', ') AS almacenes,
                    GROUP_CONCAT(DISTINCT s.id_almacen ORDER BY s.id_almacen SEPARATOR ',') AS id_almacenes
                FROM {$this->table} s
                INNER JOIN productos p ON p.id_producto = s.id_producto
                INNER JOIN almacenes a ON a.id_almacen  = s.id_almacen
                INNER JOIN categorias c ON c.id_categoria = p.id_categoria
                GROUP BY p.id_producto, p.codigo, p.id_categoria, p.nombre,
                         p.maneja_serie, p.stock_minimo, p.precio_compra,
                         p.precio_venta, c.nombre
                ORDER BY p.nombre ASC";
        return $this->getAll($sql);
    }

    // ── Detalle de series de un producto ─────────────────────────────────
    public function series_producto_($id_producto)
    {
        $sql = "SELECT
                    ps.id_producto_serie,
                    ps.numero_serie,
                    ps.estado,
                    a.nombre AS nombre_almacen,
                    -- Si está RESERVADO: ver a qué técnico
                    COALESCE(
                        CONCAT(u.nombres,' ',u.apellidos),
                        '—'
                    ) AS nombre_tecnico
                FROM producto_series ps
                LEFT JOIN almacenes a ON a.id_almacen = ps.id_almacen
                LEFT JOIN trabajador_series ts ON ts.id_producto_serie = ps.id_producto_serie
                                               AND ts.estado = 'Asignada'
                LEFT JOIN trabajadores t ON t.id_trabajador = ts.id_trabajador
                LEFT JOIN usuarios u     ON u.id_usuario    = t.id_usuario
                WHERE ps.id_producto = :id
                ORDER BY ps.estado ASC, ps.id_producto_serie ASC";
        return $this->getAll($sql, [':id' => $id_producto]);
    }

    // ── Stock por técnico (para vista de resumen) ─────────────────────────
    public function stock_tecnicos_()
    {
        $sql = "SELECT
                    tr.id_trabajador,
                    CONCAT(u.nombres,' ',u.apellidos) AS nombre_tecnico,
                    p.id_producto,
                    p.nombre AS nombre_producto,
                    p.maneja_serie,
                    tp.stock,
                    -- Series asignadas a este técnico
                    (SELECT COUNT(*) FROM trabajador_series ts2
                     WHERE ts2.id_trabajador = tr.id_trabajador
                       AND ts2.id_producto   = p.id_producto
                       AND ts2.estado = 'Asignada') AS series_asignadas
                FROM trabajador_productos tp
                INNER JOIN trabajadores tr ON tr.id_trabajador = tp.id_trabajador
                INNER JOIN usuarios u      ON u.id_usuario     = tr.id_usuario
                INNER JOIN productos p     ON p.id_producto    = tp.id_producto
                ORDER BY nombre_tecnico ASC, p.nombre ASC";
        return $this->getAll($sql);
    }

    // ── Stock por producto PARA UN TÉCNICO (vista stockeo rápido) ─────────
    public function stock_tecnico_($id_trabajador)
    {
        $sql = "SELECT
                    p.id_producto,
                    p.codigo,
                    p.nombre AS nombre_producto,
                    p.maneja_serie,
                    p.es_drop,
                    c.nombre AS nombre_categoria,
                    COALESCE(SUM(s.cantidad), 0) AS stock_almacen,
                    COALESCE(
                        (SELECT tp.stock FROM trabajador_productos tp
                         WHERE tp.id_producto = p.id_producto
                           AND tp.id_trabajador = :t1), 0
                    ) AS asignado,
                    (SELECT COUNT(*) FROM producto_series ps
                     WHERE ps.id_producto = p.id_producto
                       AND ps.estado = 'DISPONIBLE') AS series_disponibles,
                    COALESCE(
                        (SELECT COUNT(*) FROM trabajador_series ts
                         WHERE ts.id_trabajador = :t2
                           AND ts.id_producto   = p.id_producto
                           AND ts.estado = 'Asignada'), 0
                    ) AS series_asignadas,
                    COALESCE(GROUP_CONCAT(DISTINCT a.nombre ORDER BY a.nombre SEPARATOR ','), '') AS almacenes
                FROM productos p
                INNER JOIN stock s ON s.id_producto = p.id_producto
                INNER JOIN almacenes a ON a.id_almacen = s.id_almacen
                INNER JOIN categorias c ON c.id_categoria = p.id_categoria
                GROUP BY p.id_producto, p.codigo, p.nombre, p.maneja_serie, c.nombre
                ORDER BY p.nombre ASC";
        return $this->getAll($sql, [':t1' => $id_trabajador, ':t2' => $id_trabajador]);
    }

    // ── Stockeo RÁPIDO a un técnico (entregar/devolver en lote) ────────────
    //  items  = [{ id_producto, delta }] para productos SIN serie
    //  series = [{ id_producto, asignar: [id_serie...], devolver: [id_serie...] }]
    public function stockear_tecnico_()
    {
        try {
            $id_trabajador = (int)($_POST['id_trabajador'] ?? 0);
            $items  = json_decode($_POST['items'] ?? '[]', true);
            $series = json_decode($_POST['series'] ?? '[]', true);

            if ($id_trabajador <= 0) {
                return ['success' => false, 'mensaje' => 'Selecciona un técnico.'];
            }

            $this->beginTransaction();

            $aplicados = 0;

            // ── 1) Productos sin serie ─────────────────────────────────────
            foreach ((array) $items as $it) {
                $id_producto = (int)($it['id_producto'] ?? 0);
                $delta       = (int)($it['delta'] ?? 0);
                if ($id_producto <= 0 || $delta == 0) continue;

                if ($delta > 0) {
                    // Entregar: validar stock de almacén
                    $disp = (int)$this->getOne(
                        "SELECT COALESCE(SUM(cantidad),0) AS q FROM stock WHERE id_producto=:p",
                        [':p' => $id_producto]
                    )->q;
                    if ($delta > $disp) {
                        $this->rollBack();
                        $n = $this->getOne("SELECT nombre FROM productos WHERE id_producto=:p", [':p' => $id_producto]);
                        return [
                            'success' => false,
                            'mensaje' => "Stock insuficiente para \"{$n->nombre}\". Disponible: {$disp}, solicitado: {$delta}"
                        ];
                    }
                    $this->_descontarStock($id_producto, $delta);
                    $this->_ajustarTrabajadorProducto($id_trabajador, $id_producto, $delta);
                } else {
                    // Devolver: validar lo que tiene el técnico
                    $devol = abs($delta);
                    $asig  = (int)$this->getOne(
                        "SELECT COALESCE(tp.stock,0) AS q FROM trabajador_productos tp
                         WHERE tp.id_trabajador=:t AND tp.id_producto=:p",
                        [':t' => $id_trabajador, ':p' => $id_producto]
                    )->q;
                    if ($devol > $asig) {
                        $this->rollBack();
                        return [
                            'success' => false,
                            'mensaje' => "El técnico solo tiene {$asig} de ese producto, no se puede devolver {$devol}."
                        ];
                    }
                    $this->_ajustarTrabajadorProducto($id_trabajador, $id_producto, -$devol);
                    $this->_sumarStock($id_producto, $devol);
                }
                $aplicados++;
            }

            // ── 2) Productos con serie ────────────────────────────────────
            foreach ((array) $series as $s) {
                $id_producto = (int)($s['id_producto'] ?? 0);
                if ($id_producto <= 0) continue;

                // Entregar series
                foreach ((array)($s['asignar'] ?? []) as $id_serie) {
                    $serie = $this->getOne(
                        "SELECT ps.id_producto_serie, ps.id_producto
                         FROM producto_series ps
                         WHERE ps.id_producto_serie=:s AND ps.estado='DISPONIBLE'",
                        [':s' => (int)$id_serie]
                    );
                    if (!$serie || $serie->id_producto != $id_producto) continue;

                    $this->query("UPDATE producto_series SET estado='RESERVADO' WHERE id_producto_serie=:s", [':s' => $serie->id_producto_serie]);
                    $this->query(
                        "INSERT INTO trabajador_series (id_trabajador,id_producto,id_producto_serie,estado)
                         VALUES (:t,:p,:s,'Asignada')",
                        [':t' => $id_trabajador, ':p' => $id_producto, ':s' => $serie->id_producto_serie]
                    );
                    $this->_descontarStock($id_producto, 1);
                    $this->_ajustarTrabajadorProducto($id_trabajador, $id_producto, 1);
                    $aplicados++;
                }

                // Devolver series
                foreach ((array)($s['devolver'] ?? []) as $id_serie) {
                    $ts = $this->getOne(
                        "SELECT id_trabajador_serie FROM trabajador_series
                         WHERE id_trabajador=:t AND id_producto_serie=:s AND estado='Asignada'",
                        [':t' => $id_trabajador, ':s' => (int)$id_serie]
                    );
                    if (!$ts) continue;

                    $this->query("UPDATE producto_series SET estado='DISPONIBLE' WHERE id_producto_serie=:s", [':s' => (int)$id_serie]);
                    $this->query("DELETE FROM trabajador_series WHERE id_trabajador_serie=:id", [':id' => $ts->id_trabajador_serie]);
                    $this->_sumarStock($id_producto, 1);
                    $this->_ajustarTrabajadorProducto($id_trabajador, $id_producto, -1);
                    $aplicados++;
                }
            }

            if ($aplicados === 0) {
                $this->rollBack();
                return ['success' => false, 'mensaje' => 'No hay movimientos por aplicar.'];
            }

            $this->commit();
            return ['success' => true, 'mensaje' => $aplicados . ' movimiento(s) aplicado(s) al técnico.'];
        } catch (Exception $e) {
            $this->rollBack();
            return ['success' => false, 'mensaje' => 'Error: ' . $e->getMessage()];
        }
    }

    // ── Devolver TODO el stock de un técnico al almacén ───────────────────
    // Metraje (productos sin serie): vuelve a stock. Series: se liberan
    // (producto_series -> DISPONIBLE) y se elimina la asignación.
    public function devolver_todo_tecnico_()
    {
        try {
            $id_trabajador = (int)($_POST['id_trabajador'] ?? 0);
            if ($id_trabajador <= 0) {
                return ['success' => false, 'mensaje' => 'Selecciona un técnico.'];
            }

            $this->beginTransaction();

            $filas = $this->getAll(
                "SELECT tp.id_trabajador_producto, tp.id_producto, tp.stock, p.maneja_serie
                 FROM trabajador_productos tp
                 INNER JOIN productos p ON p.id_producto = tp.id_producto
                 WHERE tp.id_trabajador = :t AND tp.stock > 0",
                [':t' => $id_trabajador]
            );

            if (!$filas) {
                $this->rollBack();
                return ['success' => false, 'mensaje' => 'El técnico no tiene stock por devolver.'];
            }

            $series_devueltas = 0;
            $metraje_devuelto = 0;
            $productos         = 0;

            foreach ($filas as $f) {
                if ($f->maneja_serie == 1) {
                    $series = $this->getAll(
                        "SELECT id_trabajador_serie, id_producto_serie
                         FROM trabajador_series
                         WHERE id_trabajador = :t AND id_producto = :p AND estado = 'Asignada'",
                        [':t' => $id_trabajador, ':p' => $f->id_producto]
                    );
                    foreach ($series as $s) {
                        $this->query(
                            "UPDATE producto_series SET estado='DISPONIBLE' WHERE id_producto_serie=:s",
                            [':s' => $s->id_producto_serie]
                        );
                        $this->query(
                            "DELETE FROM trabajador_series WHERE id_trabajador_serie=:id",
                            [':id' => $s->id_trabajador_serie]
                        );
                        $this->_sumarStock($f->id_producto, 1);
                        $series_devueltas++;
                    }
                } else {
                    $this->_sumarStock($f->id_producto, (int)$f->stock);
                    $metraje_devuelto += (int)$f->stock;
                }

                $this->query(
                    "DELETE FROM trabajador_productos WHERE id_trabajador_producto=:id",
                    [':id' => $f->id_trabajador_producto]
                );
                $productos++;
            }

            $this->commit();

            return [
                'success' => true,
                'mensaje' => "Stock devuelto de {$productos} producto(s): {$metraje_devuelto} de metraje y {$series_devueltas} serie(s)."
            ];
        } catch (Exception $e) {
            $this->rollBack();
            return ['success' => false, 'mensaje' => 'Error: ' . $e->getMessage()];
        }
    }

    // ── Devolver un producto DROP (solo metraje, sin series) ───────────────
    // Solo aplica a productos marcados como es_drop = 1. Devuelve el metraje
    // que el técnico tiene asignado en trabajador_productos al almacén.
    public function devolver_drop_()
    {
        try {
            $id_trabajador = (int)($_POST['id_trabajador'] ?? 0);
            $id_producto   = (int)($_POST['id_producto'] ?? 0);

            if ($id_trabajador <= 0 || $id_producto <= 0) {
                return ['success' => false, 'mensaje' => 'Datos incompletos.'];
            }

            $prod = $this->getOne(
                "SELECT nombre, es_drop FROM productos WHERE id_producto = :p",
                [':p' => $id_producto]
            );
            if (!$prod) {
                return ['success' => false, 'mensaje' => 'Producto no encontrado.'];
            }
            if ((int)$prod->es_drop !== 1) {
                return ['success' => false, 'mensaje' => 'Este producto no es DROP.'];
            }

            $tp = $this->getOne(
                "SELECT id_trabajador_producto, stock FROM trabajador_productos
                 WHERE id_trabajador = :t AND id_producto = :p",
                [':t' => $id_trabajador, ':p' => $id_producto]
            );

            if (!$tp || (int)$tp->stock <= 0) {
                return ['success' => false, 'mensaje' => 'El técnico no tiene metraje de este DROP por devolver.'];
            }

            $this->beginTransaction();
            $this->_sumarStock($id_producto, (int)$tp->stock);
            $this->query(
                "DELETE FROM trabajador_productos WHERE id_trabajador_producto=:id",
                [':id' => $tp->id_trabajador_producto]
            );
            $this->commit();

            return [
                'success' => true,
                'mensaje' => "Metraje devuelto: {$tp->stock} de \"{$prod->nombre}\"."
            ];
        } catch (Exception $e) {
            $this->rollBack();
            return ['success' => false, 'mensaje' => 'Error: ' . $e->getMessage()];
        }
    }

    // ── Helpers privados del stockeo a técnico ────────────────────────────
    private function _descontarStock($id_producto, $cantidad)
    {
        if ($cantidad <= 0) return;
        $filas = $this->getAll(
            "SELECT id_stock, cantidad FROM stock
             WHERE id_producto = :p AND cantidad > 0
             ORDER BY cantidad DESC",
            [':p' => $id_producto]
        );
        $restante = $cantidad;
        foreach ($filas as $f) {
            if ($restante <= 0) break;
            $quitar = min((int)$f->cantidad, $restante);
            $this->query(
                "UPDATE stock SET cantidad = cantidad - :q WHERE id_stock = :i",
                [':q' => $quitar, ':i' => $f->id_stock]
            );
            $restante -= $quitar;
        }
    }

    private function _sumarStock($id_producto, $cantidad)
    {
        if ($cantidad <= 0) return;
        $fila = $this->getOne(
            "SELECT id_stock FROM stock WHERE id_producto = :p ORDER BY id_almacen ASC LIMIT 1",
            [':p' => $id_producto]
        );
        if ($fila) {
            $this->query(
                "UPDATE stock SET cantidad = cantidad + :c WHERE id_stock = :i",
                [':c' => $cantidad, ':i' => $fila->id_stock]
            );
        }
    }

    private function _ajustarTrabajadorProducto($id_trabajador, $id_producto, $delta)
    {
        $existing = $this->getOne(
            "SELECT id_trabajador_producto, stock FROM trabajador_productos
             WHERE id_trabajador=:t AND id_producto=:p",
            [':t' => $id_trabajador, ':p' => $id_producto]
        );
        if ($existing) {
            $nuevo = max((int)$existing->stock + $delta, 0);
            $this->query(
                "UPDATE trabajador_productos SET stock=:s WHERE id_trabajador_producto=:i",
                [':s' => $nuevo, ':i' => $existing->id_trabajador_producto]
            );
        } else {
            $this->query(
                "INSERT INTO trabajador_productos (id_trabajador,id_producto,stock) VALUES (:t,:p,:s)",
                [':t' => $id_trabajador, ':p' => $id_producto, ':s' => max($delta, 0)]
            );
        }
    }

    // ── Editar (para abrir modal de ajuste) ───────────────────────────────
    public function editar_($id)
    {
        try {
            $sql = "SELECT s.*, p.nombre AS nombre_producto, p.maneja_serie,
                           a.nombre AS nombre_almacen
                    FROM {$this->table} s
                    INNER JOIN productos p ON p.id_producto = s.id_producto
                    INNER JOIN almacenes a ON a.id_almacen  = s.id_almacen
                    WHERE s.{$this->id} = :id";
            $row = $this->getOne($sql, [':id' => $id]);
            if ($row) return ['success' => true, 'data' => $row];
            return ['success' => false, 'mensaje' => 'Registro no encontrado'];
        } catch (Exception $e) {
            return ['success' => false, 'mensaje' => $e->getMessage()];
        }
    }

    public function eliminar_($id)
    {
        try {
            $this->query("DELETE FROM {$this->table} WHERE {$this->id}=:id", [':id' => $id]);
            return ['success' => true, 'mensaje' => 'Registro eliminado.'];
        } catch (Exception $e) {
            return ['success' => false, 'mensaje' => $e->getMessage()];
        }
    }
}
