<?php
// app/models/MotionModel.php — REEMPLAZAR COMPLETO
// CAMBIOS vs original:
//  1. listar_(): incluye serie, almacén destino
//  2. agregar_(): soporta TRASLADO, series, validaciones
//  3. actualizarStock() privado mejorado con soporte serie y traslado

class MotionModel extends Model
{
    protected $table = 'movimientos';
    protected $id    = 'id_movimiento';

    public function listar_()
    {
        $sql = "SELECT
                    m.*,
                    p.nombre    AS nombre_producto,
                    a.nombre    AS nombre_almacen,
                    ad.nombre   AS nombre_almacen_destino,
                    ps.numero_serie
                FROM {$this->table} m
                INNER JOIN almacenes a ON a.id_almacen    = m.id_almacen
                INNER JOIN productos p ON p.id_producto   = m.id_producto
                LEFT JOIN  almacenes ad ON ad.id_almacen  = m.id_almacen_destino
                LEFT JOIN  producto_series ps ON ps.id_producto_serie = m.id_producto_serie
                ORDER BY {$this->id} DESC";
        return $this->getAll($sql);
    }

    public function editar_($id)
    {
        try {
            $row = $this->getOne(
                "SELECT * FROM {$this->table} WHERE {$this->id}=:id",
                [':id' => $id]
            );
            if (!$row) return ['success' => false, 'mensaje' => 'Registro no encontrado'];
            return ['success' => true, 'data' => $row];
        } catch (Exception $e) {
            return ['success' => false, 'mensaje' => 'Error: ' . $e->getMessage()];
        }
    }

    public function agregar_()
    {
        $id                 = $_POST[$this->id]          ?? null;
        $id_producto        = $_POST['id_producto'];
        $id_almacen         = $_POST['id_almacen'];
        $tipo               = $_POST['tipo'];
        $cantidad           = (int)$_POST['cantidad'];
        $referencia         = $_POST['referencia']       ?? '';
        $id_almacen_destino = $_POST['id_almacen_destino'] ?? null;
        $id_producto_serie  = $_POST['id_producto_serie']  ?? null;

        if ($tipo !== 'TRASLADO') $id_almacen_destino = null;
        if (empty($id_almacen_destino)) $id_almacen_destino = null;
        if (empty($id_producto_serie))  $id_producto_serie  = null;

        try {
            $this->beginTransaction();

            // ── Validar serie si aplica ───────────────────────────────────
            if ($id_producto_serie) {
                $serie = $this->getOne(
                    "SELECT estado, id_almacen FROM producto_series WHERE id_producto_serie=:s",
                    [':s' => $id_producto_serie]
                );
                if (!$serie || $serie->estado !== 'DISPONIBLE') {
                    $this->rollBack();
                    return ['success' => false, 'mensaje' => 'La serie seleccionada no está disponible.'];
                }
            }

            if (!empty($id) && $id > 0) {
                // ── Editar: revertir movimiento anterior ──────────────────
                $old = $this->getOne(
                    "SELECT * FROM {$this->table} WHERE {$this->id}=:id",
                    [':id' => $id]
                );
                if ($old) {
                    $err = $this->aplicarMovimiento(
                        $old->id_producto,
                        $old->id_almacen,
                        $old->cantidad,
                        $old->tipo,
                        'revertir',
                        $old->id_almacen_destino,
                        $old->id_producto_serie
                    );
                    if ($err !== true) {
                        $this->rollBack();
                        return ['success' => false, 'mensaje' => $err];
                    }
                }

                $this->query(
                    "UPDATE {$this->table} SET
                         id_producto=:p, id_almacen=:a, tipo=:t, cantidad=:c,
                         referencia=:r, id_almacen_destino=:ad, id_producto_serie=:ps
                     WHERE {$this->id}=:id",
                    [
                        ':p' => $id_producto,
                        ':a' => $id_almacen,
                        ':t' => $tipo,
                        ':c' => $cantidad,
                        ':r' => $referencia,
                        ':ad' => $id_almacen_destino,
                        ':ps' => $id_producto_serie,
                        ':id' => $id
                    ]
                );
            } else {
                // ── Nuevo ─────────────────────────────────────────────────
                $this->query(
                    "INSERT INTO {$this->table}
                         (id_producto, id_almacen, tipo, cantidad, referencia,
                          id_almacen_destino, id_producto_serie)
                     VALUES (:p,:a,:t,:c,:r,:ad,:ps)",
                    [
                        ':p' => $id_producto,
                        ':a' => $id_almacen,
                        ':t' => $tipo,
                        ':c' => $cantidad,
                        ':r' => $referencia,
                        ':ad' => $id_almacen_destino,
                        ':ps' => $id_producto_serie
                    ]
                );
            }

            // ── Aplicar efecto al stock/series ────────────────────────────
            $err = $this->aplicarMovimiento(
                $id_producto,
                $id_almacen,
                $cantidad,
                $tipo,
                'sumar',
                $id_almacen_destino,
                $id_producto_serie
            );
            if ($err !== true) {
                $this->rollBack();
                return ['success' => false, 'mensaje' => $err];
            }

            $this->commit();
            return ['success' => true, 'mensaje' => 'Registro creado correctamente'];
        } catch (Exception $e) {
            $this->rollBack();
            return ['success' => false, 'mensaje' => 'Error al guardar: ' . $e->getMessage()];
        }
    }

    // ── Aplicar o revertir un movimiento ──────────────────────────────────
    private function aplicarMovimiento(
        $id_producto,
        $id_almacen,
        $cantidad,
        $tipo,
        $operacion,
        $id_almacen_destino,
        $id_producto_serie
    ) {
        // ¿El producto maneja serie?
        $prod = $this->getOne(
            "SELECT maneja_serie FROM productos WHERE id_producto=:p",
            [':p' => $id_producto]
        );
        $maneja_serie = $prod ? (int)$prod->maneja_serie : 0;

        if ($maneja_serie == 1 && $id_producto_serie) {
            return $this->aplicarSerie(
                $id_producto_serie,
                $id_producto,
                $id_almacen,
                $tipo,
                $operacion,
                $id_almacen_destino
            );
        } else {
            return $this->aplicarStock(
                $id_producto,
                $id_almacen,
                $cantidad,
                $tipo,
                $operacion,
                $id_almacen_destino
            );
        }
    }

    // ── Mover serie individualmente ───────────────────────────────────────
    private function aplicarSerie(
        $id_serie,
        $id_producto,
        $id_almacen,
        $tipo,
        $operacion,
        $id_destino
    ) {
        if ($operacion === 'sumar') {
            switch ($tipo) {
                case 'SALIDA':
                    $this->query(
                        "UPDATE producto_series SET estado='VENDIDO' WHERE id_producto_serie=:s",
                        [':s' => $id_serie]
                    );
                    $this->restarStock($id_producto, $id_almacen, 1);
                    break;

                case 'TRASLADO':
                    if (!$id_destino) return 'Se requiere almacén destino para el traslado.';
                    $this->query(
                        "UPDATE producto_series SET id_almacen=:a WHERE id_producto_serie=:s",
                        [':a' => $id_destino, ':s' => $id_serie]
                    );
                    $this->restarStock($id_producto, $id_almacen, 1);
                    $this->sumarStock($id_producto, $id_destino, 1);
                    break;

                case 'ENTRADA':
                    // En entradas con serie el stock lo maneja BuyModel
                    // aquí solo marcamos disponible si fue revertido
                    break;
            }
        } else {
            // Revertir
            $this->query(
                "UPDATE producto_series SET estado='DISPONIBLE', id_almacen=:a
                 WHERE id_producto_serie=:s",
                [':a' => $id_almacen, ':s' => $id_serie]
            );
            if ($tipo === 'SALIDA') {
                $this->sumarStock($id_producto, $id_almacen, 1);
            } elseif ($tipo === 'TRASLADO' && $id_destino) {
                $this->sumarStock($id_producto, $id_almacen, 1);
                $this->restarStock($id_producto, $id_destino, 1);
            }
        }
        return true;
    }

    // ── Ajustar stock (sin serie) ─────────────────────────────────────────
    private function aplicarStock(
        $id_producto,
        $id_almacen,
        $cantidad,
        $tipo,
        $operacion,
        $id_destino
    ) {
        $stock = $this->getOne(
            "SELECT id_stock, cantidad FROM stock WHERE id_producto=:p AND id_almacen=:a",
            [':p' => $id_producto, ':a' => $id_almacen]
        );
        $actual = $stock ? (int)$stock->cantidad : 0;

        if ($operacion === 'sumar') {
            if ($tipo === 'ENTRADA') {
                $nueva = $actual + $cantidad;
            } elseif ($tipo === 'SALIDA') {
                if ($actual < $cantidad) return "Stock insuficiente en almacén. Disponible: $actual, solicitado: $cantidad";
                $nueva = $actual - $cantidad;
            } elseif ($tipo === 'TRASLADO') {
                if (!$id_destino) return 'Se requiere almacén destino para el traslado.';
                if ($actual < $cantidad) return "Stock insuficiente para traslado. Disponible: $actual";
                $nueva = $actual - $cantidad;
                $this->sumarStock($id_producto, $id_destino, $cantidad);
            }
        } else {
            // Revertir
            if ($tipo === 'ENTRADA') {
                $nueva = max(0, $actual - $cantidad);
            } else {
                $nueva = $actual + $cantidad;
            }
            if ($tipo === 'TRASLADO' && $id_destino) {
                $this->restarStock($id_producto, $id_destino, $cantidad);
            }
        }

        if ($stock) {
            $this->query(
                "UPDATE stock SET cantidad=:c WHERE id_stock=:id",
                [':c' => $nueva, ':id' => $stock->id_stock]
            );
        } else {
            $this->query(
                "INSERT INTO stock (id_producto,id_almacen,cantidad) VALUES (:p,:a,:c)",
                [':p' => $id_producto, ':a' => $id_almacen, ':c' => max(0, $nueva ?? 0)]
            );
        }
        return true;
    }

    private function sumarStock($id_producto, $id_almacen, $cantidad)
    {
        $existe = $this->getOne(
            "SELECT id_stock FROM stock WHERE id_producto=:p AND id_almacen=:a",
            [':p' => $id_producto, ':a' => $id_almacen]
        );
        if ($existe) {
            $this->query(
                "UPDATE stock SET cantidad=cantidad+:c WHERE id_stock=:id",
                [':c' => $cantidad, ':id' => $existe->id_stock]
            );
        } else {
            $this->query(
                "INSERT INTO stock (id_producto,id_almacen,cantidad) VALUES (:p,:a,:c)",
                [':p' => $id_producto, ':a' => $id_almacen, ':c' => $cantidad]
            );
        }
    }

    private function restarStock($id_producto, $id_almacen, $cantidad)
    {
        $this->query(
            "UPDATE stock SET cantidad=GREATEST(cantidad-:c,0)
             WHERE id_producto=:p AND id_almacen=:a",
            [':c' => $cantidad, ':p' => $id_producto, ':a' => $id_almacen]
        );
    }

    public function eliminar_($id)
    {
        try {
            $this->query("DELETE FROM {$this->table} WHERE {$this->id}=:id", [':id' => $id]);
            return ['success' => true, 'mensaje' => 'Registro Eliminado correctamente.'];
        } catch (Exception $e) {
            return ['success' => false, 'mensaje' => 'Error al eliminar: ' . $e->getMessage()];
        }
    }
}
