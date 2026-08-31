<?php
// app/models/DashboardModel.php — REEMPLAZAR COMPLETO
// Solo cambian los métodos que necesitan filtro por técnico.
// obtenerTotal_ queda igual (el filtro llega ya en el string de tabla).

class DashboardModel extends Model
{
    protected $table = 'dashboard';
    protected $id    = 'id_dashboard';

    public function listar_()
    {
        $sql      = "SELECT * FROM {$this->table} ORDER BY {$this->id} DESC";
        $response = $this->getOne($sql);
        if ($response) return ['success' => true, 'data' => $response];
        return ['success' => false, 'mensaje' => 'Registro no encontrado'];
    }

    public function obtenerTotal_($tabla)
    {
        // Acepta "ordenes WHERE id_tecnico = 5" como string completo
        $sql      = "SELECT COUNT(*) AS total_registros FROM {$tabla};";
        $response = $this->getOne($sql);
        if ($response) return ['success' => true, 'data' => $response];
        return ['success' => false, 'mensaje' => 'Registro no encontrado'];
    }

    public function editar_($id)
    {
        try {
            $sql      = "SELECT * FROM {$this->table} WHERE {$this->id} = :id";
            $response = $this->getOne($sql, [':id' => $id]);
            if ($response) return ['success' => true, 'data' => $response];
            return ['success' => false, 'mensaje' => 'Registro no encontrado'];
        } catch (Exception $e) {
            return ['success' => false, 'mensaje' => 'Error: ' . $e->getMessage()];
        }
    }

    public function agregar_()
    {
        $id     = $_POST[$this->id];
        $nombre = $_POST['nombre'];
        $estado = $_POST['estado'];
        try {
            if (!empty($id) && $id != 0) {
                $this->query(
                    "UPDATE {$this->table} SET nombre=:nombre, estado=:estado WHERE {$this->id}=:id",
                    [':nombre' => $nombre, ':estado' => $estado, ':id' => $id]
                );
            } else {
                $this->query(
                    "INSERT INTO {$this->table} (nombre,estado) VALUES (:nombre,:estado)",
                    [':nombre' => $nombre, ':estado' => $estado]
                );
            }
            return ['success' => true, 'mensaje' => 'Registro guardado correctamente'];
        } catch (Exception $e) {
            return ['success' => false, 'mensaje' => 'Error: ' . $e->getMessage()];
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

    // ── Órdenes por estado (con filtro opcional por técnico) ──────────────
    public function obtenerOrdenesPorEstado_($id_tecnico = null)
    {
        $where  = $id_tecnico ? "WHERE id_tecnico = :t" : "";
        $params = $id_tecnico ? [':t' => $id_tecnico] : [];
        $sql    = "SELECT estado, COUNT(*) AS total
                   FROM ordenes {$where}
                   GROUP BY estado ORDER BY total DESC";
        return $this->getAll($sql, $params);
    }

    // ── Liquidaciones recientes (filtradas por técnico si aplica) ─────────
    public function obtenerLiquidacionesRecientes_($id_tecnico = null)
    {
        $where  = $id_tecnico ? "AND ol.id_trabajador = :t" : "";
        $params = $id_tecnico ? [':t' => $id_tecnico] : [];
        $sql    = "SELECT ol.id_liquidacion,
                          ol.estado,
                          ol.motivo_rechazo,
                          ol.fecha_liquidacion,
                          o.numero,
                          CONCAT(u.nombres,' ',u.apellidos) AS nombre_tecnico,
                          (SELECT COUNT(*) FROM orden_liquidacion_detalle d
                           WHERE d.id_liquidacion = ol.id_liquidacion) AS total_materiales
                   FROM orden_liquidaciones ol
                   INNER JOIN ordenes o      ON o.id_orden      = ol.id_orden
                   INNER JOIN trabajadores t ON t.id_trabajador = ol.id_trabajador
                   INNER JOIN usuarios u     ON u.id_usuario    = t.id_usuario
                   WHERE 1=1 {$where}
                   ORDER BY ol.fecha_liquidacion DESC
                   LIMIT 15";
        return $this->getAll($sql, $params);
    }

    // ── Top materiales (filtrados por técnico si aplica) ──────────────────
    public function obtenerTopMateriales_($id_tecnico = null)
    {
        $join   = $id_tecnico
            ? "INNER JOIN orden_liquidaciones ol2 ON ol2.id_liquidacion = d.id_liquidacion
                   AND ol2.id_trabajador = :t"
            : "";
        $params = $id_tecnico ? [':t' => $id_tecnico] : [];
        $sql    = "SELECT p.nombre AS nombre_producto,
                          COUNT(d.id_detalle_liq) AS veces_usado,
                          SUM(d.cantidad)         AS total_cantidad
                   FROM orden_liquidacion_detalle d
                   INNER JOIN productos p ON p.id_producto = d.id_producto
                   {$join}
                   GROUP BY d.id_producto
                   ORDER BY total_cantidad DESC
                   LIMIT 10";
        return $this->getAll($sql, $params);
    }

    // ── Top técnicos (siempre global — para admin) ────────────────────────
    public function obtenerTopTecnicos_()
    {
        $sql = "SELECT CONCAT(u.nombres,' ',u.apellidos) AS nombre_tecnico,
                       COUNT(o.id_orden) AS total_finalizadas
                FROM ordenes o
                INNER JOIN trabajadores t ON t.id_trabajador = o.id_tecnico
                INNER JOIN usuarios u     ON u.id_usuario    = t.id_usuario
                WHERE o.estado = 'Finalizada'
                GROUP BY o.id_tecnico
                ORDER BY total_finalizadas DESC
                LIMIT 10";
        return $this->getAll($sql);
    }
}
