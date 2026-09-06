<?php
// app/models/ReportModel.php — REEMPLAZAR COMPLETO
// CAMBIO: todos los métodos de órdenes y liquidaciones aceptan
//         $desde y $hasta (YYYY-MM-DD) para filtrar por período

class ReportModel extends Model
{
    // ── Helper: construir WHERE de fecha ─────────────────────────────────
    private function _whereRango($desde, $hasta, $campo = 'fecha_visita', &$params = [])
    {
        $conds = [];
        if ($desde) {
            $conds[] = "{$campo} >= :desde";
            $params[':desde'] = $desde . ' 00:00:00';
        }
        if ($hasta) {
            $conds[] = "{$campo} <= :hasta";
            $params[':hasta'] = $hasta . ' 23:59:59';
        }
        return $conds ? ('WHERE ' . implode(' AND ', $conds)) : '';
    }

    private function _andRango($desde, $hasta, $campo = 'fecha_visita', &$params = [])
    {
        $conds = [];
        if ($desde) {
            $conds[] = "{$campo} >= :desde";
            $params[':desde'] = $desde . ' 00:00:00';
        }
        if ($hasta) {
            $conds[] = "{$campo} <= :hasta";
            $params[':hasta'] = $hasta . ' 23:59:59';
        }
        return $conds ? (' AND ' . implode(' AND ', $conds)) : '';
    }

    // ── KPIs ─────────────────────────────────────────────────────────────
    public function kpis_($desde = null, $hasta = null)
    {
        $params  = [];
        $params2  = [];
        $params3  = [];
        $where   = $this->_whereRango($desde, $hasta, 'o.fecha_visita', $params);
        $whereOl = $this->_whereRango($desde, $hasta, 'ol.fecha_liquidacion', $params2);
        $whereC  = $this->_whereRango($desde, $hasta, 'c.fecha', $params3);

        $ordenes    = $this->getOne("SELECT COUNT(*) AS total FROM ordenes o {$where}", $params);
        $finalizadas = $this->getOne("SELECT COUNT(*) AS total FROM ordenes o WHERE o.estado='Finalizada'"
            . ($where ? str_replace('WHERE', 'AND', $where) : ''), $params);

        // Simplificación: si hay filtro de fecha, usar fecha_liquidacion
        $p4  = [];
        $liqWhere  = $this->_whereRango($desde, $hasta, 'fecha_liquidacion', $p4);
        $liquidaciones = $this->getOne("SELECT COUNT(*) AS total FROM orden_liquidaciones " . $liqWhere, $p4);

        $productos  = $this->getOne("SELECT COUNT(*) AS total FROM productos WHERE estado='Activo'");
        $tecnicos   = $this->getOne(
            "SELECT COUNT(*) AS total FROM trabajadores t
             INNER JOIN usuarios u ON u.id_usuario=t.id_usuario
             INNER JOIN roles r ON r.id_rol=u.id_rol WHERE r.nombre='Tecnico'"
        );
        $comprasP   = [];
        $comprasWhere = $this->_whereRango($desde, $hasta, 'fecha', $comprasP);
        $compras_mes = $this->getOne(
            "SELECT COALESCE(SUM(total),0) AS total FROM compras WHERE estado='COMPLETADA' " .
                ($comprasWhere ? str_replace('WHERE', 'AND', $comprasWhere) : ''),
            $comprasP
        );

        return [
            'total_ordenes'      => (int)($ordenes->total       ?? 0),
            'ordenes_finalizadas' => (int)($finalizadas->total   ?? 0),
            'total_liquidaciones' => (int)($liquidaciones->total ?? 0),
            'total_productos'    => (int)($productos->total      ?? 0),
            'total_tecnicos'     => (int)($tecnicos->total       ?? 0),
            'compras_mes'        => (float)($compras_mes->total  ?? 0),
        ];
    }

    // ── Órdenes por estado ────────────────────────────────────────────────
    public function ordenes_por_estado_($desde = null, $hasta = null)
    {
        $params = [];
        $where  = $this->_whereRango($desde, $hasta, 'fecha_visita', $params);
        $sql    = "SELECT estado, COUNT(*) AS total FROM ordenes {$where} GROUP BY estado ORDER BY total DESC";
        return $this->getAll($sql, $params);
    }

    // ── Órdenes por técnico ───────────────────────────────────────────────
    public function ordenes_por_tecnico_($desde = null, $hasta = null)
    {
        $params = [];
        $and    = $this->_andRango($desde, $hasta, 'o.fecha_visita', $params);
        $sql    = "SELECT
                    CONCAT(u.nombres,' ',u.apellidos) AS tecnico,
                    COUNT(*)                          AS total,
                    SUM(o.estado='Finalizada')        AS finalizadas,
                    SUM(o.estado='Cancelada')         AS canceladas,
                    SUM(o.estado='Iniciada')          AS en_proceso
                FROM ordenes o
                INNER JOIN trabajadores t ON t.id_trabajador = o.id_tecnico
                INNER JOIN usuarios u     ON u.id_usuario    = t.id_usuario
                WHERE 1=1 {$and}
                GROUP BY o.id_tecnico ORDER BY total DESC";
        return $this->getAll($sql, $params);
    }

    // ── Órdenes por mes ───────────────────────────────────────────────────
    public function ordenes_por_mes_($anio = null, $desde = null, $hasta = null)
    {
        $anio   = $anio ?? date('Y');
        $params = [':anio' => $anio];
        $and    = $this->_andRango($desde, $hasta, 'fecha_visita', $params);
        $sql    = "SELECT MONTH(fecha_visita) AS mes,
                          MONTHNAME(fecha_visita) AS nombre_mes,
                          COUNT(*) AS total,
                          SUM(estado='Finalizada') AS finalizadas
                   FROM ordenes
                   WHERE YEAR(fecha_visita)=:anio {$and}
                   GROUP BY MONTH(fecha_visita) ORDER BY mes ASC";
        return $this->getAll($sql, $params);
    }

    // ── Liquidaciones por técnico ─────────────────────────────────────────
    public function liquidaciones_por_tecnico_($desde = null, $hasta = null)
    {
        $params = [];
        $and    = $this->_andRango($desde, $hasta, 'ol.fecha_liquidacion', $params);
        $sql    = "SELECT
                    CONCAT(u.nombres,' ',u.apellidos) AS tecnico,
                    COUNT(DISTINCT ol.id_liquidacion) AS total_liquidaciones,
                    SUM(d.cantidad)                   AS total_materiales,
                    COUNT(DISTINCT d.id_producto)     AS tipos_producto
                FROM orden_liquidaciones ol
                INNER JOIN trabajadores t  ON t.id_trabajador = ol.id_trabajador
                INNER JOIN usuarios u      ON u.id_usuario    = t.id_usuario
                LEFT JOIN  orden_liquidacion_detalle d ON d.id_liquidacion = ol.id_liquidacion
                WHERE 1=1 {$and}
                GROUP BY ol.id_trabajador ORDER BY total_materiales DESC";
        return $this->getAll($sql, $params);
    }

    // ── Top materiales más usados ─────────────────────────────────────────
    public function materiales_mas_usados_($desde = null, $hasta = null)
    {
        $params = [];
        $and    = $this->_andRango($desde, $hasta, 'ol.fecha_liquidacion', $params);
        $sql    = "SELECT p.codigo, p.nombre AS nombre_producto,
                          c.nombre AS categoria,
                          COUNT(d.id_detalle_liq) AS veces_usadas,
                          SUM(d.cantidad) AS cantidad_total
                   FROM orden_liquidacion_detalle d
                   INNER JOIN productos  p  ON p.id_producto  = d.id_producto
                   INNER JOIN categorias c  ON c.id_categoria = p.id_categoria
                   INNER JOIN orden_liquidaciones ol ON ol.id_liquidacion = d.id_liquidacion
                   WHERE 1=1 {$and}
                   GROUP BY d.id_producto ORDER BY cantidad_total DESC LIMIT 20";
        return $this->getAll($sql, $params);
    }

    // ── Stock por almacén (sin filtro de fecha) ───────────────────────────
    public function stock_por_almacen_()
    {
        $sql = "SELECT
                    a.nombre AS almacen, p.codigo, p.nombre AS producto,
                    c.nombre AS categoria, p.maneja_serie,
                    CASE WHEN p.maneja_serie=1
                         THEN (SELECT COUNT(*) FROM producto_series ps
                               WHERE ps.id_producto=p.id_producto AND ps.id_almacen=s.id_almacen
                                 AND ps.estado='DISPONIBLE')
                         ELSE s.cantidad
                    END AS stock_disponible,
                    p.stock_minimo,
                    CASE
                        WHEN (CASE WHEN p.maneja_serie=1
                                   THEN (SELECT COUNT(*) FROM producto_series ps
                                         WHERE ps.id_producto=p.id_producto AND ps.id_almacen=s.id_almacen
                                           AND ps.estado='DISPONIBLE')
                                   ELSE s.cantidad END) = 0 THEN 'Sin stock'
                        WHEN (CASE WHEN p.maneja_serie=1
                                   THEN (SELECT COUNT(*) FROM producto_series ps
                                         WHERE ps.id_producto=p.id_producto AND ps.id_almacen=s.id_almacen
                                           AND ps.estado='DISPONIBLE')
                                   ELSE s.cantidad END) <= p.stock_minimo THEN 'Stock bajo'
                        ELSE 'OK'
                    END AS estado_stock
                FROM stock s
                INNER JOIN almacenes  a ON a.id_almacen   = s.id_almacen
                INNER JOIN productos  p ON p.id_producto  = s.id_producto
                INNER JOIN categorias c ON c.id_categoria = p.id_categoria
                ORDER BY a.nombre, p.nombre";
        return $this->getAll($sql);
    }

    // ── Compras por proveedor ─────────────────────────────────────────────
    public function compras_por_proveedor_($anio = null, $desde = null, $hasta = null)
    {
        $anio   = $anio ?? date('Y');
        $params = [':anio' => $anio];
        $and    = $this->_andRango($desde, $hasta, 'c.fecha', $params);
        $sql    = "SELECT p.nombre_comercial AS proveedor,
                          COUNT(c.id_compra) AS total_compras,
                          SUM(c.total)       AS monto_total,
                          MIN(c.fecha)       AS primera_compra,
                          MAX(c.fecha)       AS ultima_compra
                   FROM compras c
                   INNER JOIN proveedores p ON p.id_proveedor = c.id_proveedor
                   WHERE c.estado='COMPLETADA' AND YEAR(c.fecha)=:anio {$and}
                   GROUP BY c.id_proveedor ORDER BY monto_total DESC";
        return $this->getAll($sql, $params);
    }

    // ── Series por estado (sin filtro) ────────────────────────────────────
    public function series_por_estado_()
    {
        $sql = "SELECT ps.id_producto_serie, ps.numero_serie, ps.estado,
                       p.nombre AS producto, p.codigo,
                       a.nombre AS nombre_almacen,
                       CASE WHEN ps.estado='RESERVADO' THEN CONCAT(u.nombres,' ',u.apellidos) ELSE NULL END AS nombre_tecnico
                FROM producto_series ps
                INNER JOIN productos p ON p.id_producto = ps.id_producto
                LEFT JOIN  almacenes a ON a.id_almacen  = ps.id_almacen
                LEFT JOIN  trabajador_series ts ON ts.id_producto_serie=ps.id_producto_serie AND ts.estado='Asignada'
                LEFT JOIN  trabajadores tr ON tr.id_trabajador = ts.id_trabajador
                LEFT JOIN  usuarios u  ON u.id_usuario = tr.id_usuario
                ORDER BY p.nombre, ps.estado, ps.numero_serie";
        return $this->getAll($sql);
    }

    // ── Movimientos recientes ─────────────────────────────────────────────
    public function movimientos_recientes_($limit = 50)
    {
        return [];
    }

    // ── Años disponibles ─────────────────────────────────────────────────
    public function anios_disponibles_()
    {
        $rows = $this->getAll(
            "SELECT DISTINCT YEAR(fecha) AS anio FROM compras WHERE fecha IS NOT NULL ORDER BY anio DESC"
        );
        return array_map(fn($r) => $r->anio, $rows ?: []);
    }
}
