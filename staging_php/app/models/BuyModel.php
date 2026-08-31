<?php
// app/models/BuyModel.php — REEMPLAZAR COMPLETO
// CAMBIOS vs original:
//  1. editar_(): retorna series_ingresadas por línea
//  2. agregar_(): al COMPLETADA, si maneja_serie inserta en producto_series
//                 con el almacén seleccionado y recalcula stock
//  3. actualizar_(): revierte/aplica correctamente según maneja_serie

class BuyModel extends Model
{
    protected $table = 'compras';
    protected $id    = 'id_compra';

    public function listar_()
    {
        $sql = "SELECT c.*, p.nombre_comercial AS nombre_proveedor, a.nombre AS nombre_almacen
                FROM {$this->table} c
                INNER JOIN proveedores p ON p.id_proveedor = c.id_proveedor
                INNER JOIN almacenes   a ON a.id_almacen   = c.id_almacen
                ORDER BY {$this->id} DESC";
        return $this->getAll($sql);
    }

    public function editar_($id)
    {
        try {
            $compra = $this->getOne(
                "SELECT * FROM {$this->table} WHERE {$this->id}=:id",
                [':id' => $id]
            );
            if (!$compra) return ['success' => false, 'mensaje' => 'Registro no encontrado'];

            $compra = (array) $compra;
            $compra['productos'] = $this->getAll(
                "SELECT dc.id_producto, dc.precio, dc.cantidad, dc.subtotal,
                        dc.series_ingresadas, p.nombre, p.maneja_serie
                 FROM detalle_compras dc
                 INNER JOIN productos p ON p.id_producto = dc.id_producto
                 WHERE dc.id_compra=:id",
                [':id' => $id]
            );
            return ['success' => true, 'data' => $compra];
        } catch (Exception $e) {
            return ['success' => false, 'mensaje' => 'Error: ' . $e->getMessage()];
        }
    }

    public function agregar_()
    {
        $id_compra = $_POST['id_compra'] ?? null;
        if (!empty($id_compra) && $id_compra > 0) return $this->actualizar_();

        try {
            $this->beginTransaction();

            $estado       = $_POST['estado'];
            $id_proveedor = $_POST['id_proveedor'];
            $id_almacen   = $_POST['id_almacen'];   // almacén global de la compra
            $fecha        = $_POST['fecha'];
            $total        = $_POST['total'];

            $productos      = $_POST['producto']      ?? [];
            $precios        = $_POST['precio']         ?? [];
            $cantidades     = $_POST['cantidad']       ?? [];
            $subtotales     = $_POST['subtotal']       ?? [];
            // series_texto[i] = texto con una serie por línea
            // series_almacen[i] = almacén elegido para esas series (opcional)
            $series_texto   = $_POST['series_texto']   ?? [];
            $series_almacen = $_POST['series_almacen'] ?? [];

            $this->query(
                "INSERT INTO compras (id_proveedor,id_almacen,fecha,total,estado)
                 VALUES (:p,:a,:f,:t,:e)",
                [':p' => $id_proveedor, ':a' => $id_almacen, ':f' => $fecha, ':t' => $total, ':e' => $estado]
            );
            $idCompra = $this->lastInsertId();

            for ($i = 0; $i < count($productos); $i++) {
                $id_producto    = $productos[$i];
                $precio         = $precios[$i];
                $cantidad       = (int)$cantidades[$i];
                $subtotal       = $subtotales[$i];
                $texto_series   = $series_texto[$i]   ?? '';
                $alm_series     = !empty($series_almacen[$i]) ? $series_almacen[$i] : $id_almacen;

                // Convertir texto multilínea a array limpio
                $arr_series = array_filter(
                    array_map('trim', explode("\n", $texto_series)),
                    fn($s) => $s !== ''
                );
                $series_json = json_encode(array_values($arr_series));

                $this->query(
                    "INSERT INTO detalle_compras
                         (id_compra,id_producto,precio,cantidad,subtotal,series_ingresadas)
                     VALUES (:c,:p,:pr,:cant,:sub,:ser)",
                    [
                        ':c' => $idCompra,
                        ':p' => $id_producto,
                        ':pr' => $precio,
                        ':cant' => $cantidad,
                        ':sub' => $subtotal,
                        ':ser' => $series_json
                    ]
                );

                if ($estado === 'COMPLETADA') {
                    $prod = $this->getOne(
                        "SELECT maneja_serie FROM productos WHERE id_producto=:p",
                        [':p' => $id_producto]
                    );

                    if ($prod && $prod->maneja_serie == 1) {
                        // Insertar cada serie con el almacén correcto
                        foreach ($arr_series as $ns) {
                            // Evitar duplicados
                            $dup = $this->getOne(
                                "SELECT id_producto_serie FROM producto_series WHERE numero_serie=:ns",
                                [':ns' => $ns]
                            );
                            if ($dup) continue;
                            $this->query(
                                "INSERT INTO producto_series (id_producto,id_almacen,numero_serie,estado)
                                 VALUES (:p,:a,:ns,'DISPONIBLE')",
                                [':p' => $id_producto, ':a' => $alm_series, ':ns' => $ns]
                            );
                        }
                        // Recalcular stock desde series DISPONIBLES
                        $this->_recalcularStock($id_producto);
                    } else {
                        // Sin serie: incrementar stock en el almacén de la compra
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
                    $this->query(
                        "UPDATE productos SET precio_compra=:p WHERE id_producto=:id",
                        [':p' => $precio, ':id' => $id_producto]
                    );
                }
            }

            $this->commit();
            return ['success' => true, 'mensaje' => 'Compra registrada correctamente'];
        } catch (Exception $e) {
            $this->rollBack();
            return ['success' => false, 'mensaje' => 'Error al guardar: ' . $e->getMessage()];
        }
    }

    private function actualizar_()
    {
        try {
            $this->beginTransaction();

            $id_compra    = $_POST['id_compra'];
            $estado       = $_POST['estado'];
            $id_proveedor = $_POST['id_proveedor'];
            $id_almacen   = $_POST['id_almacen'];
            $fecha        = $_POST['fecha'];
            $total        = $_POST['total'];
            $productos    = $_POST['producto']  ?? [];
            $precios      = $_POST['precio']    ?? [];
            $cantidades   = $_POST['cantidad']  ?? [];
            $subtotales   = $_POST['subtotal']  ?? [];

            $anterior = $this->getOne(
                "SELECT estado FROM compras WHERE id_compra=:id",
                [':id' => $id_compra]
            );

            // Si estaba COMPLETADA → revertir stock solo para sin-serie
            if ($anterior && $anterior->estado === 'COMPLETADA') {
                $detalles = $this->getAll(
                    "SELECT dc.id_producto, dc.cantidad, p.maneja_serie
                     FROM detalle_compras dc
                     INNER JOIN productos p ON p.id_producto=dc.id_producto
                     WHERE dc.id_compra=:id",
                    [':id' => $id_compra]
                );
                foreach ($detalles as $d) {
                    if ($d->maneja_serie != 1) {
                        $this->query(
                            "UPDATE stock SET cantidad=GREATEST(cantidad-:c,0)
                             WHERE id_producto=:p AND id_almacen=:a",
                            [':c' => $d->cantidad, ':p' => $d->id_producto, ':a' => $id_almacen]
                        );
                    }
                }
            }

            $this->query(
                "UPDATE compras SET id_proveedor=:p,id_almacen=:a,fecha=:f,total=:t,estado=:e
                 WHERE id_compra=:id",
                [
                    ':p' => $id_proveedor,
                    ':a' => $id_almacen,
                    ':f' => $fecha,
                    ':t' => $total,
                    ':e' => $estado,
                    ':id' => $id_compra
                ]
            );
            $this->query("DELETE FROM detalle_compras WHERE id_compra=:id", [':id' => $id_compra]);

            for ($i = 0; $i < count($productos); $i++) {
                $this->query(
                    "INSERT INTO detalle_compras (id_compra,id_producto,precio,cantidad,subtotal)
                     VALUES (:c,:p,:pr,:cant,:sub)",
                    [
                        ':c' => $id_compra,
                        ':p' => $productos[$i],
                        ':pr' => $precios[$i],
                        ':cant' => $cantidades[$i],
                        ':sub' => $subtotales[$i]
                    ]
                );
                if ($estado === 'COMPLETADA') {
                    $prod = $this->getOne(
                        "SELECT maneja_serie FROM productos WHERE id_producto=:p",
                        [':p' => $productos[$i]]
                    );
                    if (!$prod || $prod->maneja_serie != 1) {
                        $this->query(
                            "UPDATE stock SET cantidad=cantidad+:c WHERE id_producto=:p AND id_almacen=:a",
                            [':c' => $cantidades[$i], ':p' => $productos[$i], ':a' => $id_almacen]
                        );
                    }
                }
            }

            $this->commit();
            return ['success' => true, 'mensaje' => 'Compra actualizada correctamente'];
        } catch (Exception $e) {
            $this->rollBack();
            return ['success' => false, 'mensaje' => $e->getMessage()];
        }
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

    private function _recalcularStock($id_producto)
    {
        $grupos = $this->getAll(
            "SELECT id_almacen, COUNT(*) AS total
             FROM producto_series
             WHERE id_producto=:p AND estado='DISPONIBLE'
             GROUP BY id_almacen",
            [':p' => $id_producto]
        );
        foreach ($grupos as $g) {
            $existe = $this->getOne(
                "SELECT id_stock FROM stock WHERE id_producto=:p AND id_almacen=:a",
                [':p' => $id_producto, ':a' => $g->id_almacen]
            );
            if ($existe) {
                $this->query(
                    "UPDATE stock SET cantidad=:c WHERE id_stock=:id",
                    [':c' => $g->total, ':id' => $existe->id_stock]
                );
            } else {
                $this->query(
                    "INSERT INTO stock (id_producto,id_almacen,cantidad) VALUES (:p,:a,:c)",
                    [':p' => $id_producto, ':a' => $g->id_almacen, ':c' => $g->total]
                );
            }
        }
    }
}
