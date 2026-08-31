<?php

class AlertasModel extends Model
{
    /**
     * Alertas activas calculadas en vivo (mismo criterio que antes).
     */
    public function obtenerAlertas()
    {
        $alertas = [];

        // =========================================
        // STOCK BAJO
        // =========================================

        $sql = "SELECT 
                    s.*,
                    p.nombre,
                    p.stock_minimo
                FROM stock s
                INNER JOIN productos p
                    ON p.id_producto = s.id_producto
                WHERE s.cantidad <= p.stock_minimo";

        $alertas['stock'] =
            $this->query($sql)->fetchAll(PDO::FETCH_OBJ);

        // =========================================
        // SOAT POR VENCER
        // =========================================

        $sql = "SELECT *
                FROM vehiculos
                WHERE fecha_ven_soat <=
                DATE_ADD(CURDATE(), INTERVAL 7 DAY)
                AND fecha_ven_soat >= CURDATE()";

        $alertas['soat_por_vencer'] =
            $this->query($sql)->fetchAll(PDO::FETCH_OBJ);

        // =========================================
        // SOAT VENCIDO
        // =========================================

        $sql = "SELECT *
                FROM vehiculos
                WHERE fecha_ven_soat < CURDATE()";

        $alertas['soat_vencido'] =
            $this->query($sql)->fetchAll(PDO::FETCH_OBJ);

        // =========================================
        // REVISION POR VENCER
        // =========================================

        $sql = "SELECT *
                FROM vehiculos
                WHERE fecha_ven_revision <=
                DATE_ADD(CURDATE(), INTERVAL 7 DAY)
                AND fecha_ven_revision >= CURDATE()";

        $alertas['revision_por_vencer'] =
            $this->query($sql)->fetchAll(PDO::FETCH_OBJ);

        // =========================================
        // REVISION VENCIDA
        // =========================================

        $sql = "SELECT *
                FROM vehiculos
                WHERE fecha_ven_revision < CURDATE()";

        $alertas['revision_vencida'] =
            $this->query($sql)->fetchAll(PDO::FETCH_OBJ);

        // =========================================
        // VEHICULOS INACTIVOS
        // =========================================

        $sql = "SELECT *
                FROM vehiculos
                WHERE estado = 'Inactivo'";

        $alertas['vehiculos_inactivos'] =
            $this->query($sql)->fetchAll(PDO::FETCH_OBJ);

        // =========================================
        // VEHICULOS EN MANTENIMIENTO
        // =========================================

        $sql = "SELECT *
                FROM vehiculos
                WHERE estado = 'En mantenimiento'";

        $alertas['mantenimiento'] =
            $this->query($sql)->fetchAll(PDO::FETCH_OBJ);

        return $alertas;
    }

    /**
     * Convierte las alertas vivas en notificaciones persistidas
     * (titulo, mensaje y ruta a la que lleva cada una).
     */
    private function construirItems($alertas)
    {
        $items = [];

        $fecha = function ($valor) {
            if (empty($valor)) return '';
            if ($valor === '0000-00-00' || $valor === '0000-00-00 00:00:00') return '';
            return $valor;
        };

        foreach (($alertas['stock'] ?? []) as $r) {
            $items[] = [
                'tipo'    => 'stock',
                'ref_id'  => (string)$r->id_stock,
                'titulo'  => 'Stock bajo',
                'mensaje' => ($r->nombre ?? 'Producto') . ' · Stock ' . $r->cantidad . ' / Mín ' . $r->stock_minimo,
                'url'     => 'inventario/stock',
            ];
        }

        foreach (($alertas['soat_por_vencer'] ?? []) as $r) {
            $d = $fecha($r->fecha_ven_soat ?? '');
            $items[] = [
                'tipo'    => 'soat_por_vencer',
                'ref_id'  => (string)$r->id_vehiculo,
                'titulo'  => 'SOAT próximo a vencer',
                'mensaje' => 'Vehículo ' . ($r->placa ?? '') . ($d ? ' · Vence el ' . $d : ''),
                'url'     => 'movilidad/vehiculos',
            ];
        }

        foreach (($alertas['soat_vencido'] ?? []) as $r) {
            $d = $fecha($r->fecha_ven_soat ?? '');
            $items[] = [
                'tipo'    => 'soat_vencido',
                'ref_id'  => (string)$r->id_vehiculo,
                'titulo'  => 'SOAT vencido',
                'mensaje' => 'Vehículo ' . ($r->placa ?? '') . ($d ? ' · Venció el ' . $d : ''),
                'url'     => 'movilidad/vehiculos',
            ];
        }

        foreach (($alertas['revision_por_vencer'] ?? []) as $r) {
            $d = $fecha($r->fecha_ven_revision ?? '');
            $items[] = [
                'tipo'    => 'revision_por_vencer',
                'ref_id'  => (string)$r->id_vehiculo,
                'titulo'  => 'Revisión técnica próxima',
                'mensaje' => 'Vehículo ' . ($r->placa ?? '') . ($d ? ' · Vence el ' . $d : ''),
                'url'     => 'movilidad/vehiculos',
            ];
        }

        foreach (($alertas['revision_vencida'] ?? []) as $r) {
            $d = $fecha($r->fecha_ven_revision ?? '');
            $items[] = [
                'tipo'    => 'revision_vencida',
                'ref_id'  => (string)$r->id_vehiculo,
                'titulo'  => 'Revisión técnica vencida',
                'mensaje' => 'Vehículo ' . ($r->placa ?? '') . ($d ? ' · Venció el ' . $d : ''),
                'url'     => 'movilidad/vehiculos',
            ];
        }

        foreach (($alertas['mantenimiento'] ?? []) as $r) {
            $items[] = [
                'tipo'    => 'mantenimiento',
                'ref_id'  => (string)$r->id_vehiculo,
                'titulo'  => 'Vehículo en mantenimiento',
                'mensaje' => 'Vehículo ' . ($r->placa ?? ''),
                'url'     => 'movilidad/vehiculos',
            ];
        }

        return $items;
    }

    /**
     * Refresca las notificaciones del usuario:
     * - Inserta/actualiza las activas (ON DUPLICATE no toca `leida`,
     *   así se conserva el estado leído mientras la alerta persista).
     * - Elimina las que ya se resolvieron (dejan de cumplir la condición).
     */
    public function sincronizar($id_usuario)
    {
        $id_usuario = (int)$id_usuario;
        if ($id_usuario <= 0) return;

        $alertas = $this->obtenerAlertas();
        $items   = $this->construirItems($alertas);

        $activos = [];
        foreach ($items as $it) {
            $activos[$it['tipo'] . '|' . $it['ref_id']] = true;
        }

        $stmt = $this->db->prepare(
            "INSERT INTO notificaciones (id_usuario, tipo, ref_id, titulo, mensaje, url)
             VALUES (:id_usuario, :tipo, :ref_id, :titulo, :mensaje, :url)
             ON DUPLICATE KEY UPDATE
                 titulo = VALUES(titulo),
                 mensaje = VALUES(mensaje),
                 url = VALUES(url)"
        );

        foreach ($items as $it) {
            $stmt->execute([
                ':id_usuario' => $id_usuario,
                ':tipo'       => $it['tipo'],
                ':ref_id'     => $it['ref_id'],
                ':titulo'     => $it['titulo'],
                ':mensaje'    => $it['mensaje'],
                ':url'        => $it['url'],
            ]);
        }

        // Eliminar las notificaciones ya resueltas
        if (empty($activos)) {
            $this->query("DELETE FROM notificaciones WHERE id_usuario = ?", [$id_usuario]);
        } else {
            $claves = array_keys($activos);
            $placeholders = [];
            $params = [$id_usuario];
            foreach ($claves as $clave) {
                $placeholders[] = '?';
                $params[] = $clave;
            }
            $sql = "DELETE FROM notificaciones
                    WHERE id_usuario = ?
                      AND CONCAT(tipo, '|', ref_id) NOT IN (" . implode(',', $placeholders) . ")";
            $this->query($sql, $params);
        }
    }

    public function listar($id_usuario, $limite = 50)
    {
        $id_usuario = (int)$id_usuario;
        $limite = (int)$limite;
        $sql = "SELECT * FROM notificaciones
                WHERE id_usuario = ?
                ORDER BY leida ASC, fecha_creacion DESC
                LIMIT " . $limite;
        return $this->query($sql, [$id_usuario])->fetchAll(PDO::FETCH_OBJ);
    }

    public function contarNoLeidas($id_usuario)
    {
        $id_usuario = (int)$id_usuario;
        $fila = $this->getOne(
            "SELECT COUNT(*) AS total FROM notificaciones WHERE id_usuario = ? AND leida = 0",
            [$id_usuario]
        );
        return $fila ? (int)$fila->total : 0;
    }

    public function marcarLeida($id, $id_usuario)
    {
        $id = (int)$id;
        $id_usuario = (int)$id_usuario;

        $noti = $this->getOne(
            "SELECT * FROM notificaciones WHERE id = ? AND id_usuario = ?",
            [$id, $id_usuario]
        );
        if (!$noti) return false;

        $this->query(
            "UPDATE notificaciones SET leida = 1, fecha_leida = NOW() WHERE id = ?",
            [$id]
        );
        return $noti;
    }

    public function marcarTodasLeidas($id_usuario)
    {
        $id_usuario = (int)$id_usuario;
        $this->query(
            "UPDATE notificaciones SET leida = 1, fecha_leida = NOW()
             WHERE id_usuario = ? AND leida = 0",
            [$id_usuario]
        );
    }
}
