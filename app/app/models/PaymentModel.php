<?php
// app/models/PaymentModel.php — REPORTE DE PAGOS A TÉCNICOS
//
// Cálculo por orden FINALIZADA:
//   - Ingreso WIN     = motivos.precio_compra  (lo que paga WIN por el tipo de trabajo)
//   - Pago técnico    = motivos.precio_venta   (lo que se le paga al técnico)
//   - Costo material  = suma de orden_liquidacion_detalle.cantidad * productos.precio_compra
//   - Ganancia        = Ingreso WIN - Pago técnico - Costo material
//
// El enlace motivos -> órdenes se hace por texto: motivos.tipo_trabajo
// debe coincidir con ordenes.motivo_tipo_trabajo (el "Tipo Trabajo" de la grilla).

class PaymentModel extends Model
{
    private function _validarFecha($fecha)
    {
        if ($fecha && preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha)) {
            return $fecha;
        }
        return '';
    }

    // Filtro por estado de liquidación de la orden.
    //   ''            -> todas
    //   'liquidada'   -> con liquidación aprobada
    //   'pendiente'   -> con liquidación pendiente
    //   'rechazada'   -> con liquidación rechazada
    //   'sin_liquidar'=> sin ninguna liquidación
    private function _andEstadoLiquidacion($estado)
    {
        $filtro = trim((string)$estado);
        $map = [
            'liquidada'    => "EXISTS (SELECT 1 FROM orden_liquidaciones eli
                                   WHERE eli.id_orden = o.id_orden
                                     AND eli.estado = 'Aprobada')",
            'pendiente'    => "EXISTS (SELECT 1 FROM orden_liquidaciones eli
                                   WHERE eli.id_orden = o.id_orden
                                     AND eli.estado = 'Pendiente')",
            'rechazada'    => "EXISTS (SELECT 1 FROM orden_liquidaciones eli
                                   WHERE eli.id_orden = o.id_orden
                                     AND eli.estado = 'Rechazada')",
            'sin_liquidar' => "NOT EXISTS (SELECT 1 FROM orden_liquidaciones eli
                                   WHERE eli.id_orden = o.id_orden)"
        ];
        return isset($map[$filtro]) ? (' AND ' . $map[$filtro]) : '';
    }

    // Todos los montos para una orden finalizada dentro del rango.
    // Solo se consideran órdenes con técnico asignado (son las que generan
    // un pago al técnico); así los totales coinciden con la tabla por técnico.
    private function _filas_ordenes_($desde, $hasta, $estado = '')
    {
        $where  = "o.estado = 'Finalizada'
                   AND o.id_tecnico IS NOT NULL";
        $params = [];

        if ($desde && $hasta) {
            $where .= " AND DATE(o.fecha_visita) BETWEEN :desde AND :hasta";
            $params[':desde'] = $desde;
            $params[':hasta'] = $hasta;
        } elseif ($desde) {
            $where .= " AND DATE(o.fecha_visita) >= :desde";
            $params[':desde'] = $desde;
        } elseif ($hasta) {
            $where .= " AND DATE(o.fecha_visita) <= :hasta";
            $params[':hasta'] = $hasta;
        }

        $sql = "SELECT
                    o.id_orden,
                    o.numero,
                    o.fecha_visita,
                    TRIM(UPPER(o.tipo_trabajo)) AS tipo_trabajo,
                    o.id_tecnico,
                    CONCAT_WS(' ', u.nombres, u.apellidos) AS tecnico,
                    m.id_motivo,
                    m.nombre AS motivo_nombre,
                    COALESCE(m.precio_compra, 0) AS precio_win,
                    COALESCE(m.precio_venta, 0)  AS precio_tecnico,
                    (SELECT COALESCE(SUM(
                        CASE WHEN ps.estado = 'BAJA' THEN 0
                             ELSE d.cantidad * p.precio_compra END), 0)
                     FROM orden_liquidaciones ol
                     INNER JOIN orden_liquidacion_detalle d ON d.id_liquidacion = ol.id_liquidacion
                     INNER JOIN productos p ON p.id_producto = d.id_producto
                     LEFT JOIN producto_series ps ON ps.id_producto_serie = d.id_producto_serie
                     WHERE ol.id_orden = o.id_orden
                       AND ol.estado IN ('Pendiente','Aprobada')) AS costo_material
                FROM ordenes o
                LEFT JOIN motivos m
                    ON m.estado = 'Activo'
                   AND m.tipo_trabajo IS NOT NULL
                   AND TRIM(UPPER(m.tipo_trabajo)) = TRIM(UPPER(o.tipo_trabajo))
                LEFT JOIN trabajadores t ON t.id_trabajador = o.id_tecnico
                LEFT JOIN usuarios u     ON u.id_usuario    = t.id_usuario
                WHERE {$where}
                  {$this->_andEstadoLiquidacion($estado)}
                ORDER BY o.numero ASC";

        return $this->getAll($sql, $params);
    }

    private function _totales_($filas)
    {
        $totales = [
            'num_ordenes'   => 0,
            'sin_precio'    => 0,
            'ingreso_win'   => 0,
            'costo_material'=> 0,
            'pago_tecnicos' => 0,
            'ganancia'      => 0
        ];

        foreach ($filas as $f) {
            $ingreso = round((float)$f->precio_win, 2);
            $pago    = round((float)$f->precio_tecnico, 2);
            $material= round((float)$f->costo_material, 2);

            $totales['num_ordenes']++;
            if (!$f->id_motivo) $totales['sin_precio']++;
            $totales['ingreso_win']    += $ingreso;
            $totales['pago_tecnicos']  += $pago;
            $totales['costo_material'] += $material;
            $totales['ganancia']       += round($ingreso - $pago - $material, 2);
        }

        foreach ($totales as $k => $v) {
            if (in_array($k, ['ingreso_win', 'costo_material', 'pago_tecnicos', 'ganancia'])) {
                $totales[$k] = round($v, 2);
            }
        }

        return $totales;
    }

    public function resumen_($desde, $hasta, $estado = '')
    {
        $desde = $this->_validarFecha($desde);
        $hasta = $this->_validarFecha($hasta);

        $filas    = $this->_filas_ordenes_($desde, $hasta, $estado);
        $totales  = $this->_totales_($filas);

        $tecnicos = [];
        foreach ($filas as $f) {
            if (!$f->id_tecnico) continue;

            $id = (int)$f->id_tecnico;
            if (!isset($tecnicos[$id])) {
                $tecnicos[$id] = [
                    'id_trabajador'  => $id,
                    'tecnico'        => $f->tecnico ?: "Técnico #{$id}",
                    'num_ordenes'    => 0,
                    'sin_precio'     => 0,
                    'ingreso_win'    => 0,
                    'costo_material' => 0,
                    'pago_tecnico'   => 0,
                    'ganancia'       => 0
                ];
            }

            $ingreso = round((float)$f->precio_win, 2);
            $pago    = round((float)$f->precio_tecnico, 2);
            $material= round((float)$f->costo_material, 2);

            $tecnicos[$id]['num_ordenes']++;
            if (!$f->id_motivo) $tecnicos[$id]['sin_precio']++;
            $tecnicos[$id]['ingreso_win']    = round($tecnicos[$id]['ingreso_win']    + $ingreso, 2);
            $tecnicos[$id]['costo_material'] = round($tecnicos[$id]['costo_material'] + $material, 2);
            $tecnicos[$id]['pago_tecnico']   = round($tecnicos[$id]['pago_tecnico']   + $pago, 2);
            $tecnicos[$id]['ganancia']       = round($tecnicos[$id]['ganancia'] + ($ingreso - $pago - $material), 2);
        }

        usort($tecnicos, fn($a, $b) => $b['pago_tecnico'] <=> $a['pago_tecnico']);

        return [
            'success'      => true,
            'fecha_desde'  => $desde,
            'fecha_hasta'  => $hasta,
            'estado'       => $estado,
            'totales'      => $totales,
            'tecnicos'     => array_values($tecnicos)
        ];
    }

    public function por_tecnico_($id_trabajador, $desde, $hasta, $estado = '')
    {
        $desde = $this->_validarFecha($desde);
        $hasta = $this->_validarFecha($hasta);

        $filas = $this->_filas_ordenes_($desde, $hasta, $estado);

        $nombreTecnico = '';
        $ordenes       = [];
        $totales       = [
            'num_ordenes'   => 0,
            'sin_precio'    => 0,
            'ingreso_win'   => 0,
            'costo_material'=> 0,
            'pago_tecnicos' => 0,
            'ganancia'      => 0
        ];

        foreach ($filas as $f) {
            if ((int)$f->id_tecnico !== (int)$id_trabajador) continue;

            if (!$nombreTecnico) {
                $nombreTecnico = $f->tecnico ?: "Técnico #{$id_trabajador}";
            }

            $ingreso = round((float)$f->precio_win, 2);
            $pago    = round((float)$f->precio_tecnico, 2);
            $material= round((float)$f->costo_material, 2);

            $ordenes[] = [
                'id_orden'      => (int)$f->id_orden,
                'numero'        => $f->numero,
                'fecha_visita'  => $f->fecha_visita,
                'tipo_trabajo'  => $f->tipo_trabajo ?: null,
                'motivo'        => $f->motivo_nombre ?: null,
                'precio_win'    => $ingreso,
                'pago_tecnico'  => $pago,
                'costo_material'=> $material,
                'ganancia'      => round($ingreso - $pago - $material, 2)
            ];

            $totales['num_ordenes']++;
            if (!$f->id_motivo) $totales['sin_precio']++;
            $totales['ingreso_win']    = round($totales['ingreso_win']    + $ingreso, 2);
            $totales['costo_material'] = round($totales['costo_material'] + $material, 2);
            $totales['pago_tecnicos']  = round($totales['pago_tecnicos']  + $pago, 2);
            $totales['ganancia']       = round($totales['ganancia'] + ($ingreso - $pago - $material), 2);
        }

        return [
            'success'     => true,
            'tecnico'     => $nombreTecnico,
            'id_trabajador'=> (int)$id_trabajador,
            'totales'     => $totales,
            'ordenes'     => $ordenes
        ];
    }
}
