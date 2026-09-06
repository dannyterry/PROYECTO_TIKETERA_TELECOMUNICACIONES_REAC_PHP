<?php

class LiquidationModel extends Model
{
    // Filtro opcional de rango de fechas. El sufijo evita que un mismo
    // placeholder (:desde/:hasta) se repita en el SQL (con EMULATE_PREPARES
    // desactivado, PDO no permite reutilizar nombres de parámetros).
    private function _andRango($desde, $hasta, $campo, &$params, $sufijo = '')
    {
        $conds = [];
        if ($desde) {
            $conds[] = "{$campo} >= :desde{$sufijo}";
            $params[":desde{$sufijo}"] = $desde . ' 00:00:00';
        }
        if ($hasta) {
            $conds[] = "{$campo} <= :hasta{$sufijo}";
            $params[":hasta{$sufijo}"] = $hasta . ' 23:59:59';
        }
        return $conds ? (' AND ' . implode(' AND ', $conds)) : '';
    }

    // ── Resumen por técnico: cuántas órdenes tiene asignadas en total,
    //    cuántas ha liquidado, cuántas liquidaciones quedan pendientes de
    //    aprobar, cuántas fueron rechazadas, y el costo total de materiales/
    //    equipos liquidados. Las liquidaciones rechazadas NO se cuentan como
    //    liquidadas (total_liquidaciones) ni suman costo (total_costo),
    //    porque su stock fue devuelto al técnico. Los equipos marcados como
    //    BAJA (producto_series.estado = 'BAJA') tampoco se cuentan como
    //    costo, porque no son un material consumido. Parte de `trabajadores`
    //    (no de `orden_liquidaciones`) para que también aparezcan técnicos
    //    que todavía no han liquidado nada.
    public function resumen_tecnicos_($desde = null, $hasta = null)
    {
        $params = [];
        $andLiq = $this->_andRango($desde, $hasta, 'ol.fecha_liquidacion', $params, '_liq');
        $andOrd = $this->_andRango($desde, $hasta, 'o2.fecha_visita', $params, '_ord');

        $sql = "SELECT
                    t.id_trabajador,
                    CONCAT(u.nombres,' ',u.apellidos) AS tecnico,
                    u.foto_personal,
                    (SELECT COUNT(*) FROM ordenes o2
                     WHERE o2.id_tecnico = t.id_trabajador {$andOrd}) AS total_ordenes,
                    COUNT(DISTINCT CASE WHEN ol.estado <> 'Rechazada' THEN ol.id_liquidacion END) AS total_liquidaciones,
                    COUNT(DISTINCT CASE WHEN ol.estado = 'Pendiente' THEN ol.id_liquidacion END) AS total_pendientes,
                    COUNT(DISTINCT CASE WHEN ol.estado = 'Rechazada' THEN ol.id_liquidacion END) AS total_rechazadas,
                    COALESCE(SUM(
                        CASE WHEN ol.estado = 'Rechazada' THEN 0
                             WHEN ps.estado = 'BAJA' THEN 0
                             ELSE d.cantidad * COALESCE(p.precio_compra, 0)
                        END
                    ), 0) AS total_costo,
                    MAX(ol.fecha_liquidacion) AS ultima_liquidacion
                FROM trabajadores t
                INNER JOIN usuarios u ON u.id_usuario = t.id_usuario
                LEFT JOIN orden_liquidaciones ol ON ol.id_trabajador = t.id_trabajador {$andLiq}
                LEFT JOIN orden_liquidacion_detalle d ON d.id_liquidacion = ol.id_liquidacion
                LEFT JOIN productos p       ON p.id_producto = d.id_producto
                LEFT JOIN producto_series ps ON ps.id_producto_serie = d.id_producto_serie
                GROUP BY t.id_trabajador
                HAVING total_ordenes > 0 OR total_liquidaciones > 0
                ORDER BY tecnico ASC";

        return $this->getAll($sql, $params);
    }

    // ── Liquidaciones de un técnico puntual (para el drill-down) ──────────
    public function por_tecnico_($id_trabajador, $desde = null, $hasta = null)
    {
        $params = [':id' => $id_trabajador];
        $and = $this->_andRango($desde, $hasta, 'ol.fecha_liquidacion', $params);

        $sql = "SELECT
                    ol.id_liquidacion,
                    ol.numero_acta,
                    ol.fecha_liquidacion,
                    ol.observaciones,
                    ol.estado AS estado_liquidacion,
                    o.numero      AS numero_orden,
                    o.cliente,
                    o.direccion,
                    o.tipo_trabajo,
                    COALESCE(
                        NULLIF(TRIM(o.motivo_finalizacion), ''),
                        NULLIF(TRIM(o.motivo_cancelacion), '')
                    ) AS tipo_averia,
                    o.fecha_visita,
                    COUNT(d.id_detalle_liq) AS total_items,
                    COALESCE(SUM(
                        CASE WHEN ol.estado = 'Rechazada' THEN 0
                             WHEN ps.estado = 'BAJA' THEN 0
                             ELSE d.cantidad * COALESCE(p.precio_compra, 0)
                        END
                    ), 0) AS total_costo
                FROM orden_liquidaciones ol
                INNER JOIN ordenes o ON o.id_orden = ol.id_orden
                LEFT JOIN orden_liquidacion_detalle d ON d.id_liquidacion = ol.id_liquidacion
                LEFT JOIN productos p       ON p.id_producto = d.id_producto
                LEFT JOIN producto_series ps ON ps.id_producto_serie = d.id_producto_serie
                WHERE ol.id_trabajador = :id {$and}
                GROUP BY ol.id_liquidacion
                ORDER BY ol.fecha_liquidacion DESC";

        return $this->getAll($sql, $params);
    }

    // ── ¿Esta liquidación pertenece a este usuario? (para que un técnico
    //    solo pueda ver sus propias liquidaciones, no las de otros) ───────
    public function esDuenio_($id_liquidacion, $id_usuario)
    {
        $row = $this->getOne(
            "SELECT ol.id_liquidacion
             FROM orden_liquidaciones ol
             INNER JOIN trabajadores t ON t.id_trabajador = ol.id_trabajador
             WHERE ol.id_liquidacion = :id AND t.id_usuario = :iu",
            [':id' => $id_liquidacion, ':iu' => $id_usuario]
        );
        return (bool)$row;
    }

    // ── Detalle completo de una liquidación puntual ────────────────────────
    public function detalle_($id_liquidacion)
    {
        $cabecera = $this->getOne(
            "SELECT ol.id_liquidacion, ol.numero_acta, ol.fecha_liquidacion, ol.observaciones,
                    ol.estado AS estado_liquidacion, ol.motivo_rechazo,
                    o.numero AS numero_orden, o.cliente, o.direccion, o.tipo_trabajo,
                    COALESCE(
                        NULLIF(TRIM(o.motivo_finalizacion), ''),
                        NULLIF(TRIM(o.motivo_cancelacion), '')
                    ) AS tipo_averia,
                    o.fecha_visita,
                    CONCAT(u.nombres,' ',u.apellidos) AS tecnico
             FROM orden_liquidaciones ol
             INNER JOIN ordenes o      ON o.id_orden      = ol.id_orden
             INNER JOIN trabajadores t ON t.id_trabajador = ol.id_trabajador
             INNER JOIN usuarios u     ON u.id_usuario    = t.id_usuario
             WHERE ol.id_liquidacion = :id",
            [':id' => $id_liquidacion]
        );

        if (!$cabecera) {
            return null;
        }

        $materiales = $this->getAll(
            "SELECT d.id_detalle_liq, d.id_producto, d.numero_serie, d.cantidad,
                    d.drop_inicio, d.drop_fin,
                    p.nombre AS nombre_producto, p.categoria_liquidar, p.precio_compra,
                    ps.estado AS estado_serie,
                    (CASE WHEN ps.estado = 'BAJA' THEN 0
                          ELSE d.cantidad * COALESCE(p.precio_compra, 0)
                     END) AS costo
             FROM orden_liquidacion_detalle d
             LEFT JOIN productos p        ON p.id_producto = d.id_producto
             LEFT JOIN producto_series ps ON ps.id_producto_serie = d.id_producto_serie
             WHERE d.id_liquidacion = :id
             ORDER BY p.categoria_liquidar DESC, p.nombre ASC",
            [':id' => $id_liquidacion]
        );

        $total_costo = 0;
        if ($cabecera->estado_liquidacion !== 'Rechazada') {
            foreach ($materiales as $m) {
                $total_costo += (float)$m->costo;
            }
        }

        return [
            'cabecera'    => $cabecera,
            'materiales'  => $materiales,
            'total_costo' => $total_costo
        ];
    }

    // ── Aprobar / Rechazar una liquidación ─────────────────────────────
    // Al rechazar se revierte TODO el movimiento de stock que generó la
    // liquidación: se devuelve el material al técnico, se restauran las
    // series a su estado anterior y se deshacen las bajas de equipos.
    public function cambiar_estado_($id_liquidacion, $nuevo_estado, $motivo_rechazo = null)
    {
        if (!in_array($nuevo_estado, ['Pendiente', 'Aprobada', 'Rechazada'], true)) {
            return ['success' => false, 'mensaje' => 'Estado inválido.'];
        }

        $liq = $this->getOne(
            "SELECT id_liquidacion, id_trabajador, estado
             FROM orden_liquidaciones WHERE id_liquidacion = :id",
            [':id' => $id_liquidacion]
        );

        if (!$liq) {
            return ['success' => false, 'mensaje' => 'Liquidación no encontrada.'];
        }

        // ── Rechazo: solo desde Pendiente y con reversión completa ─────
        if ($nuevo_estado === 'Rechazada') {
            if ($liq->estado !== 'Pendiente') {
                return ['success' => false, 'mensaje' => 'Solo se pueden rechazar liquidaciones pendientes.'];
            }

            $motivo = trim($motivo_rechazo ?? '');
            if ($motivo === '') {
                return ['success' => false, 'mensaje' => 'Debes indicar el motivo del rechazo.'];
            }
            if (strlen($motivo) > 500) {
                return ['success' => false, 'mensaje' => 'El motivo no puede superar los 500 caracteres.'];
            }

            return $this->rechazarConReversion_($id_liquidacion, (int)$liq->id_trabajador, $motivo);
        }

        // ── Aprobación (o volver a Pendiente): solo cambia el estado ────
        $this->query(
            "UPDATE orden_liquidaciones SET estado = :e, motivo_rechazo = NULL WHERE id_liquidacion = :id",
            [':e' => $nuevo_estado, ':id' => $id_liquidacion]
        );

        return ['success' => true, 'mensaje' => "Liquidación marcada como {$nuevo_estado}."];
    }

    // ── Rechazar revirtiendo todo el movimiento de stock ────────────────
    private function rechazarConReversion_($id_liquidacion, $id_trabajador, $motivo)
    {
        $detalle = $this->getAll(
            "SELECT id_detalle_liq, id_producto, id_producto_serie, cantidad,
                    es_baja, serie_creada, estado_anterior, id_trabajador_serie
             FROM orden_liquidacion_detalle
             WHERE id_liquidacion = :id",
            [':id' => $id_liquidacion]
        );

        $this->beginTransaction();

        try {
            foreach ($detalle as $d) {
                if ((int)$d->es_baja === 1) {
                    $this->revertirBaja_($id_trabajador, $d);
                } else {
                    $this->revertirMaterial_($id_trabajador, $d);
                }
            }

            $this->query(
                "UPDATE orden_liquidaciones
                 SET estado = 'Rechazada', motivo_rechazo = :motivo
                 WHERE id_liquidacion = :id",
                [':motivo' => $motivo, ':id' => $id_liquidacion]
            );

            $this->commit();

            return ['success' => true, 'mensaje' => 'Liquidación rechazada. El stock fue devuelto al técnico.'];
        } catch (Exception $e) {
            $this->rollBack();
            return ['success' => false, 'mensaje' => 'Error al rechazar: ' . $e->getMessage()];
        }
    }

    // ── Material consumido: devolver stock al técnico y restaurar serie ─
    private function revertirMaterial_($id_trabajador, $d)
    {
        // Devolver la cantidad consumida al stock del técnico
        $this->query(
            "INSERT INTO trabajador_productos (id_trabajador, id_producto, stock)
             VALUES (:t, :p, :cant)
             ON DUPLICATE KEY UPDATE stock = stock + :cant2",
            [':t' => $id_trabajador, ':p' => $d->id_producto, ':cant' => (int)$d->cantidad, ':cant2' => (int)$d->cantidad]
        );

        if ($d->id_producto_serie) {
            // Restaurar la serie a su estado previo a la liquidación
            $estado = $d->estado_anterior ?: 'RESERVADO';
            $this->query(
                "UPDATE producto_series SET estado = :e WHERE id_producto_serie = :s",
                [':e' => $estado, ':s' => $d->id_producto_serie]
            );

            // Devolverle la serie asignada al técnico (crear el registro si no
            // existe, p.ej. asignaciones viejas sin registrar o series creadas
            // por la propia liquidación).
            if ($d->id_trabajador_serie) {
                $this->query(
                    "UPDATE trabajador_series SET estado = 'Asignada' WHERE id_trabajador_serie = :ts",
                    [':ts' => $d->id_trabajador_serie]
                );
            } else {
                $asignacion = $this->getOne(
                    "SELECT id_trabajador_serie FROM trabajador_series
                     WHERE id_trabajador = :t AND id_producto_serie = :s",
                    [':t' => $id_trabajador, ':s' => $d->id_producto_serie]
                );

                if ($asignacion) {
                    $this->query(
                        "UPDATE trabajador_series SET estado = 'Asignada' WHERE id_trabajador_serie = :ts",
                        [':ts' => $asignacion->id_trabajador_serie]
                    );
                } else {
                    $this->query(
                        "INSERT INTO trabajador_series (id_trabajador, id_producto, id_producto_serie, estado)
                         VALUES (:t, :p, :s, 'Asignada')",
                        [':t' => $id_trabajador, ':p' => $d->id_producto, ':s' => $d->id_producto_serie]
                    );
                }
            }
        }
    }

    // ── Equipo de baja: deshacer la baja ────────────────────────────────
    // Al rechazar la liquidación, el equipo dado de baja se devuelve al
    // técnico: queda asignado a él y vuelve a aparecer en su stock (con su
    // serie), para que pueda darlo de baja de nuevo manualmente cuando
    // corresponda. Antes quedaba como 'RESERVADO' sin aparecerle al técnico.
    private function revertirBaja_($id_trabajador, $d)
    {
        if (!$d->id_producto_serie) return;

        // 1) Asegurar que la serie esté asignada al técnico (crear el
        //    registro si no existe, p.ej. series creadas por la propia
        //    liquidación o asignaciones viejas sin registrar).
        $asignacion = $this->getOne(
            "SELECT id_trabajador_serie FROM trabajador_series
             WHERE id_trabajador = :t AND id_producto_serie = :s",
            [':t' => $id_trabajador, ':s' => $d->id_producto_serie]
        );

        if ($asignacion) {
            $this->query(
                "UPDATE trabajador_series SET estado = 'Asignada' WHERE id_trabajador_serie = :ts",
                [':ts' => $asignacion->id_trabajador_serie]
            );
        } else {
            $this->query(
                "INSERT INTO trabajador_series (id_trabajador, id_producto, id_producto_serie, estado)
                 VALUES (:t, :p, :s, 'Asignada')",
                [':t' => $id_trabajador, ':p' => $d->id_producto, ':s' => $d->id_producto_serie]
            );
        }

        // 2) La serie queda como RESERVADO (asignada al técnico), nunca BAJA.
        $this->query(
            "UPDATE producto_series SET estado = 'RESERVADO' WHERE id_producto_serie = :s",
            [':s' => $d->id_producto_serie]
        );

        // 3) Devolver la unidad al stock del técnico.
        $this->query(
            "INSERT INTO trabajador_productos (id_trabajador, id_producto, stock)
             VALUES (:t, :p, 1)
             ON DUPLICATE KEY UPDATE stock = stock + 1",
            [':t' => $id_trabajador, ':p' => $d->id_producto]
        );
    }
}
