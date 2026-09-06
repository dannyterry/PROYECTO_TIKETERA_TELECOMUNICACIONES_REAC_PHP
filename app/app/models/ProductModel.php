<?php
// app/models/ProductModel.php — REEMPLAZAR COMPLETO
// CAMBIO: listar_() incluye maneja_serie en el resultado (necesario para la tabla)
// El resto idéntico al archivo actual del proyecto.

class ProductModel extends Model
{
    protected $table = 'productos';
    protected $id    = 'id_producto';

    public function generarCodigo_()
    {
        $row = $this->getOne(
            "SELECT MAX(CAST(SUBSTRING(codigo, 6) AS UNSIGNED)) AS ultimo
             FROM productos WHERE codigo REGEXP '^PROD-[0-9]+$'"
        );
        $siguiente = ($row && $row->ultimo) ? (int)$row->ultimo + 1 : 1;
        return 'PROD-' . str_pad($siguiente, 5, '0', STR_PAD_LEFT);
    }

    public function listar_()
    {
        // Para productos CON serie, el stock se calcula SIEMPRE contando las
        // series DISPONIBLES (no depende de la tabla stock, que puede quedar
        // desactualizada). Para productos sin serie se usa la tabla stock.
        $sql = "SELECT
                    p.*,
                    c.nombre AS nombre_categoria,
                    CASE WHEN p.maneja_serie = 1 THEN
                        (SELECT COUNT(*) FROM producto_series ps
                          WHERE ps.id_producto = p.id_producto
                            AND ps.estado = 'DISPONIBLE')
                    ELSE
                        COALESCE(SUM(s.cantidad), 0)
                    END AS stock_total
                FROM {$this->table} p
                LEFT JOIN stock s       ON s.id_producto  = p.id_producto
                INNER JOIN categorias c ON c.id_categoria = p.id_categoria
                GROUP BY p.id_producto
                ORDER BY p.{$this->id} DESC";
        return $this->getAll($sql);
    }

    // Catálogo de EQUIPOS activos para dar de baja por cámara (sin stock,
    // solo id + nombre). Evita exigir permiso de productos al técnico.
    public function listarEquipos_()
    {
        $sql = "SELECT id_producto, nombre
                FROM {$this->table}
                WHERE categoria_liquidar = 'EQUIPO' AND estado = 'Activo'
                ORDER BY nombre ASC";
        return $this->getAll($sql);
    }

    public function existe_serie_($serie)
    {
        $sql = "SELECT id_producto_serie
            FROM producto_series
            WHERE numero_serie = :serie
            LIMIT 1";

        $stmt = $this->query($sql, [
            ':serie' => $serie
        ]);

        return $stmt->rowCount() > 0;
    }


    // Para stockear técnicos y compras: productos activos con series DISPONIBLES
    public function listar_ps_()
    {
        $sql = "SELECT
                    p.id_producto, p.nombre, p.codigo, p.precio_compra,
                    p.precio_venta, p.maneja_serie,
                    ps.id_producto_serie, ps.numero_serie, ps.id_almacen AS almacen_serie
                FROM productos p
                LEFT JOIN producto_series ps
                    ON ps.id_producto = p.id_producto
                   AND ps.estado = 'DISPONIBLE'
                WHERE p.estado = 'Activo'
                ORDER BY p.nombre ASC";

        $rows      = $this->getAll($sql);
        $productos = [];

        foreach ($rows as $row) {
            $id = $row->id_producto;
            if (!isset($productos[$id])) {
                $productos[$id] = [
                    'id_producto'   => $row->id_producto,
                    'nombre'        => $row->nombre,
                    'codigo'        => $row->codigo ?? '',
                    'precio_compra' => $row->precio_compra,
                    'precio_venta'  => $row->precio_venta,
                    'maneja_serie'  => $row->maneja_serie,
                    'series'        => []
                ];
            }
            if ($row->maneja_serie == 1 && $row->id_producto_serie) {
                $productos[$id]['series'][] = [
                    'id_producto_serie' => $row->id_producto_serie,
                    'numero_serie'      => $row->numero_serie,
                    'id_almacen'        => $row->almacen_serie,
                ];
            }
        }
        return array_values($productos);
    }

    public function listarActivos_()
    {
        return $this->getAll(
            "SELECT * FROM {$this->table} WHERE estado='Activo' ORDER BY {$this->id} DESC"
        );
    }

    public function editar_($id)
    {
        try {
            $producto = $this->getOne(
                "SELECT p.*,
                        CASE WHEN p.maneja_serie = 1 THEN
                            (SELECT COUNT(*) FROM producto_series ps
                              WHERE ps.id_producto = p.id_producto
                                AND ps.estado = 'DISPONIBLE')
                        ELSE
                            COALESCE(SUM(s.cantidad), 0)
                        END AS stock
                 FROM {$this->table} p
                 LEFT JOIN stock s ON s.id_producto = p.id_producto
                 WHERE p.{$this->id} = :id GROUP BY p.id_producto",
                [':id' => $id]
            );
            if (!$producto) return ['success' => false, 'mensaje' => 'Registro no encontrado'];

            $producto = (array)$producto;
            $producto['series'] = $this->getAll(
                "SELECT id_producto_serie, numero_serie, estado, id_almacen
                 FROM producto_series WHERE id_producto=:id
                 ORDER BY FIELD(estado,'DISPONIBLE','RESERVADO','VENDIDO','DEFECTUOSO'), id_producto_serie",
                [':id' => $id]
            ) ?: [];

            return ['success' => true, 'data' => $producto];
        } catch (Exception $e) {
            return ['success' => false, 'mensaje' => 'Error: ' . $e->getMessage()];
        }
    }

    public function agregar_()
    {
        $id     = $_POST['id_producto'] ?? null;
        $codigo = $_POST['codigo'];

        if (!empty($id) && $id > 0) {
            $exists = $this->getOne(
                "SELECT COUNT(*) as t FROM productos WHERE codigo=:c AND id_producto!=:id",
                [':c' => $codigo, ':id' => $id]
            );
        } else {
            $exists = $this->getOne(
                "SELECT COUNT(*) as t FROM productos WHERE codigo=:c",
                [':c' => $codigo]
            );
        }
        if ($exists->t > 0) return ['success' => false, 'mensaje' => 'El código ya existe'];

        if (!empty($id) && $id > 0) return $this->actualizar_();

        try {
            $this->beginTransaction();

            $maneja_serie   = isset($_POST['maneja_serie']) ? 1 : 0;
            $maneja_vehiculo   = isset($_POST['maneja_vehiculo']) ? 1 : 0;
            $es_drop        = isset($_POST['es_drop']) ? 1 : 0;
            $id_almacen     = $_POST['id_almacen'];
            $series         = $_POST['serie']         ?? [];
            $series_almacen = $_POST['serie_almacen'] ?? [];
            $img            = subirImagen('img_producto', RUTA_IMG_PRODUCTO, 'pro_');

            $this->query(
                "INSERT INTO productos
                     (codigo,nombre,descripcion,estado,id_categoria, categoria_liquidar, maneja_serie,maneja_vehiculo,es_drop,
                      precio_compra,precio_venta,stock_minimo,img_producto)
                 VALUES (:c,:n,:d,:e,:cat,:catl,:ms,:mv,:ed,:pc,:pv,:sm,:img)",
                [
                    ':c' => $codigo,
                    ':n' => $_POST['nombre'],
                    ':d' => $_POST['descripcion'],
                    ':e' => $_POST['estado'],
                    ':cat' => $_POST['id_categoria'],
                    ':catl' => $_POST['categoria_liquidar'],
                    ':ms' => $maneja_serie,
                    ':mv' => $maneja_vehiculo,
                    ':ed' => $es_drop,
                    ':pc' => $_POST['precio_compra'],
                    ':pv' => $_POST['precio_venta'],
                    ':sm' => $_POST['stock_minimo'],
                    ':img' => $img
                ]
            );
            $idP = $this->lastInsertId();

            if ($maneja_serie == 1) {
                foreach ($series as $i => $s) {
                    $s = trim($s);
                    if (!$s) continue;
                    $alm = !empty($series_almacen[$i]) ? $series_almacen[$i] : $id_almacen;
                    $this->query(
                        "INSERT INTO producto_series (id_producto,id_almacen,numero_serie,estado)
                         VALUES (:p,:a,:ns,'DISPONIBLE')",
                        [':p' => $idP, ':a' => $alm, ':ns' => $s]
                    );
                }
                $this->_recalcularStock($idP);
            } else {
                $stock = (int)($_POST['stock'] ?? 0);
                $this->query(
                    "INSERT INTO stock (id_producto,id_almacen,cantidad) VALUES (:p,:a,:c)",
                    [':p' => $idP, ':a' => $id_almacen, ':c' => $stock]
                );
            }

            $this->commit();
            return ['success' => true, 'mensaje' => "Producto creado (código: $codigo)"];
        } catch (Exception $e) {
            $this->rollBack();
            return ['success' => false, 'mensaje' => 'Error: ' . $e->getMessage()];
        }
    }

    public function actualizar_()
    {
        try {
            $this->beginTransaction();
            $idP          = $_POST['id_producto'];
            $maneja_serie = isset($_POST['maneja_serie']) ? 1 : 0;
            $maneja_vehiculo = isset($_POST['maneja_vehiculo']) ? 1 : 0;
            $es_drop      = isset($_POST['es_drop']) ? 1 : 0;
            $id_almacen   = $_POST['id_almacen'];
            $series       = $_POST['serie']         ?? [];
            $series_alm   = $_POST['serie_almacen'] ?? [];
            $img          = subirImagen('img_producto', RUTA_IMG_PRODUCTO, 'pro_');

            $sql = "UPDATE productos SET
                        codigo=:c,nombre=:n,descripcion=:d,estado=:e,
                        id_categoria=:cat,categoria_liquidar=:catl,maneja_serie=:ms,maneja_vehiculo=:mv,es_drop=:ed,
                        precio_compra=:pc,precio_venta=:pv,stock_minimo=:sm";
            $p = [
                ':c' => $_POST['codigo'],
                ':n' => $_POST['nombre'],
                ':d' => $_POST['descripcion'],
                ':e' => $_POST['estado'],
                ':cat' => $_POST['id_categoria'],
                ':catl' => $_POST['categoria_liquidar'],
                ':ms' => $maneja_serie,
                ':mv' => $maneja_vehiculo,
                ':ed' => $es_drop,
                ':pc' => $_POST['precio_compra'],
                ':pv' => $_POST['precio_venta'],
                ':sm' => $_POST['stock_minimo'],
                ':id' => $idP
            ];
            if ($img) {
                $sql .= ',img_producto=:img';
                $p[':img'] = $img;
            }
            $this->query($sql . ' WHERE id_producto=:id', $p);

            if ($maneja_serie == 1) {
                $existentes = array_map(
                    fn($r) => trim($r->numero_serie),
                    $this->getAll("SELECT numero_serie FROM producto_series WHERE id_producto=:p", [':p' => $idP]) ?: []
                );
                foreach ($series as $i => $s) {
                    $s = trim($s);
                    if (!$s || in_array($s, $existentes)) continue;
                    $alm = !empty($series_alm[$i]) ? $series_alm[$i] : $id_almacen;
                    $this->query(
                        "INSERT INTO producto_series (id_producto,id_almacen,numero_serie,estado)
                         VALUES (:p,:a,:ns,'DISPONIBLE')",
                        [':p' => $idP, ':a' => $alm, ':ns' => $s]
                    );
                }
                $this->_recalcularStock($idP);
            } else {
                $this->query(
                    "UPDATE stock SET cantidad=:c, id_almacen=:a WHERE id_producto=:p",
                    [':c' => $_POST['stock'], ':a' => $id_almacen, ':p' => $idP]
                );
            }

            $this->commit();
            return ['success' => true, 'mensaje' => 'Registro actualizado correctamente'];
        } catch (Exception $e) {
            $this->rollBack();
            return ['success' => false, 'mensaje' => 'Error: ' . $e->getMessage()];
        }
    }

    // Recalcula el stock (tabla `stock`) de un producto CON serie contando
    // sus series DISPONIBLES por almacén. Actualiza las filas existentes
    // (pone 0 si el almacén ya no tiene series disponibles) y crea las
    // filas que falten.
    public function _recalcularStock($id_producto)
    {
        $grupos = $this->getAll(
            "SELECT id_almacen, COUNT(*) AS total
             FROM producto_series WHERE id_producto=:p AND estado='DISPONIBLE' GROUP BY id_almacen",
            [':p' => $id_producto]
        ) ?: [];

        $porAlmacen = [];
        foreach ($grupos as $g) {
            $porAlmacen[(int)$g->id_almacen] = (int)$g->total;
        }

        $filasStock = $this->getAll(
            "SELECT id_stock, id_almacen FROM stock WHERE id_producto=:p",
            [':p' => $id_producto]
        ) ?: [];

        $almacenesConFila = [];
        foreach ($filasStock as $fila) {
            $almacenesConFila[] = (int)$fila->id_almacen;
            $cant = $porAlmacen[(int)$fila->id_almacen] ?? 0;
            $this->query(
                "UPDATE stock SET cantidad=:c WHERE id_stock=:id",
                [':c' => $cant, ':id' => $fila->id_stock]
            );
        }

        foreach ($porAlmacen as $alm => $cant) {
            if (!in_array($alm, $almacenesConFila)) {
                $this->query(
                    "INSERT INTO stock (id_producto,id_almacen,cantidad) VALUES (:p,:a,:c)",
                    [':p' => $id_producto, ':a' => $alm, ':c' => $cant]
                );
            }
        }
    }

    public function eliminar_($id)
    {
        try {
            $this->query("DELETE FROM {$this->table} WHERE {$this->id}=:id", [':id' => $id]);
            return ['success' => true, 'mensaje' => 'Registro Eliminado correctamente.'];
        } catch (Exception $e) {
            return ['success' => false, 'mensaje' => 'Error: ' . $e->getMessage()];
        }
    }
}
