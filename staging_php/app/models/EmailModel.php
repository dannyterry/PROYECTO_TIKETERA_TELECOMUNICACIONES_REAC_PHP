<?php
// app/models/EmailModel.php — MÓDULO DE CORREOS
//
// Provee: config SMTP (claves EMAIL_*), lista de técnicos con correo
// y el reporte de órdenes de un técnico (mismo cálculo que PaymentModel).

class EmailModel extends Model
{
    protected $table = 'configuracion';

    private function _validarFecha($fecha)
    {
        if ($fecha && preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha)) {
            return $fecha;
        }
        return date('Y-m-d');
    }

    // Configuración SMTP guardada en la tabla configuracion
    public function config_correo_()
    {
        $claves = [
            'EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASSWORD',
            'EMAIL_SECURE', 'EMAIL_FROM_NAME', 'EMAIL_PRUEBA'
        ];
        $config = [
            'EMAIL_HOST' => '', 'EMAIL_PORT' => '587', 'EMAIL_USER' => '',
            'EMAIL_PASSWORD' => '', 'EMAIL_SECURE' => 'tls',
            'EMAIL_FROM_NAME' => '', 'EMAIL_PRUEBA' => ''
        ];
        $in = implode(',', array_fill(0, count($claves), '?'));
        $rows = $this->getAll(
            "SELECT clave, valor FROM {$this->table} WHERE clave IN ($in)",
            $claves
        );
        foreach ($rows as $row) {
            if (array_key_exists($row->clave, $config)) {
                $config[$row->clave] = $row->valor !== null ? $row->valor : '';
            }
        }
        return $config;
    }

    // Técnicos activos que tienen correo registrado
    public function tecnicos_con_correo_()
    {
        return $this->getAll(
            "SELECT
                t.id_trabajador,
                CONCAT_WS(' ', u.nombres, u.apellidos) AS tecnico,
                u.email
             FROM trabajadores t
             INNER JOIN usuarios u ON u.id_usuario = t.id_usuario
             INNER JOIN roles r    ON r.id_rol     = u.id_rol
             WHERE r.nombre = 'Tecnico'
               AND u.email IS NOT NULL
               AND TRIM(u.email) <> ''
               AND TRIM(u.email) <> '-'
             ORDER BY tecnico ASC"
        );
    }

    // Reporte de órdenes FINALIZADAS de un técnico en el rango (igual que PaymentModel)
    public function reporte_tecnico_($id_trabajador, $desde, $hasta)
    {
        $desde = $this->_validarFecha($desde);
        $hasta = $this->_validarFecha($hasta);

        $sql = "SELECT
                    o.id_orden,
                    o.numero,
                    o.fecha_visita,
                    o.cliente,
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
                WHERE o.estado = 'Finalizada'
                  AND o.id_tecnico = :tecnico
                  AND DATE(o.fecha_visita) BETWEEN :desde AND :hasta
                ORDER BY o.numero ASC";

        $filas = $this->getAll($sql, [
            ':tecnico' => (int)$id_trabajador,
            ':desde'   => $desde,
            ':hasta'   => $hasta
        ]);

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
            if (!$nombreTecnico) {
                $nombreTecnico = $f->tecnico ?: "Técnico #{$id_trabajador}";
            }

            $ingreso  = round((float)$f->precio_win, 2);
            $pago     = round((float)$f->precio_tecnico, 2);
            $material = round((float)$f->costo_material, 2);

            $ordenes[] = [
                'id_orden'      => (int)$f->id_orden,
                'numero'        => $f->numero,
                'fecha_visita'  => $f->fecha_visita,
                'cliente'       => $f->cliente ?: '-',
                'tipo_trabajo'  => $f->tipo_trabajo ?: '-',
                'motivo'        => $f->motivo_nombre ?: null,
                'precio_win'    => $ingreso,
                'pago_tecnico'  => $pago,
                'costo_material'=> $material,
                'neto'          => round($pago - $material, 2),
                'ganancia'      => round($ingreso - $pago - $material, 2)
            ];

            $totales['num_ordenes']++;
            if (!$f->id_motivo) $totales['sin_precio']++;
            $totales['ingreso_win']    = round($totales['ingreso_win']    + $ingreso, 2);
            $totales['costo_material'] = round($totales['costo_material'] + $material, 2);
            $totales['pago_tecnicos']  = round($totales['pago_tecnicos']  + $pago, 2);
            $totales['ganancia']       = round($totales['ganancia'] + ($ingreso - $pago - $material), 2);
        }
        $totales['neto'] = round($totales['pago_tecnicos'] - $totales['costo_material'], 2);

        return [
            'success'      => true,
            'tecnico'      => $nombreTecnico,
            'id_trabajador'=> (int)$id_trabajador,
            'desde'        => $desde,
            'hasta'        => $hasta,
            'totales'      => $totales,
            'ordenes'      => $ordenes
        ];
    }
}
