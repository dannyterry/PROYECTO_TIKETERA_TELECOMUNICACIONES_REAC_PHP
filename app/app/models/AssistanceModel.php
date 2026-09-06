<?php
// app/models/AssistanceModel.php — REEMPLAZAR COMPLETO
// CAMBIO: listar_() y listar_por_tecnico_() incluyen hora_programada
//         del horario asignado al técnico

class AssistanceModel extends Model
{
    protected $table = 'asistencias';
    protected $id    = 'id_asistencia';

    private function _sqlBase()
    {
        return "SELECT
                    a.*,
                    u.nombres   AS nombre_trabajador,
                    u.apellidos AS apellido_trabajador,
                    r.nombre    AS rol_trabajador,
                    o.numero    AS numero_orden,
                    h.hora_entrada AS hora_programada
                FROM {$this->table} a
                INNER JOIN trabajadores t ON t.id_trabajador = a.id_trabajador
                INNER JOIN usuarios u     ON u.id_usuario    = t.id_usuario
                INNER JOIN roles r        ON r.id_rol        = u.id_rol
                LEFT JOIN  ordenes o      ON o.id_orden      = a.id_orden
                LEFT JOIN  horarios h     ON h.id_horario    = t.id_horario";
    }

    public function listar_por_fecha_($fecha)
    {
        return $this->getAll(
            $this->_sqlBase() .
                " WHERE a.fecha = :f ORDER BY nombre_trabajador ASC, apellido_trabajador ASC",
            [':f' => $fecha]
        );
    }

    public function listar_por_tecnico_($id_trabajador, $fecha = null)
    {
        if ($fecha) {
            return $this->getAll(
                $this->_sqlBase() .
                    " WHERE a.id_trabajador = :id AND a.fecha = :f ORDER BY a.fecha DESC",
                [':id' => $id_trabajador, ':f' => $fecha]
            );
        }
        return $this->getAll(
            $this->_sqlBase() .
                " WHERE a.id_trabajador = :id ORDER BY a.fecha DESC, a.hora_entrada DESC",
            [':id' => $id_trabajador]
        );
    }

    public function buscar_trabajador_por_usuario_($id_usuario)
    {
        return $this->getOne(
            "SELECT id_trabajador, id_horario FROM trabajadores WHERE id_usuario = :id",
            [':id' => $id_usuario]
        );
    }

    // ── Registro automático desde orden ──────────────────────────────────
    // La asistencia es DIARIA: una sola por técnico por día.
    // La hora de entrada se toma de la PRIMERA orden del día (foto domicilio
    // más temprana); la hora de salida de la última.
    public function registrar_desde_orden_($id_orden, $inicio, $fin = null)
    {
        try {
            if (!$id_orden || !$inicio) {
                return ['success' => false, 'mensaje' => 'Datos insuficientes'];
            }

            $orden = $this->getOne(
                "SELECT id_tecnico, numero, fecha_visita FROM ordenes WHERE id_orden = :id",
                [':id' => $id_orden]
            );
            if (!$orden || !$orden->id_tecnico) {
                return ['success' => false, 'mensaje' => 'Sin técnico asignado'];
            }

            $id_trabajador = $orden->id_tecnico;

            // Normalizar con formatearFecha: WIN envía "Inicio/Fin de Visita"
            // en formato americano (8/11/2026 7:39:52 AM = 11/08/2026).
            // strtotime() solo no basta para esos valores.
            $inicio_norm  = formatearFecha($inicio);
            $fin_norm     = $fin ? formatearFecha($fin) : null;

            // Fecha de asistencia: usar la fecha de visita de la orden
            // (autoritativa, siempre en DD/MM/YYYY por WIN) en vez de derivarla
            // del inicio de visita, que puede venir en formato americano.
            // OJO: strtotime() interpreta DD/MM/YYYY como MM/DD/YYYY (p. ej.
            // 11/08/2026 = 8 nov), por eso se normaliza con formatearFecha().
            $fecha_norm   = $orden->fecha_visita ? formatearFecha($orden->fecha_visita) : null;
            $fecha        = $fecha_norm
                ? substr($fecha_norm, 0, 10)
                : substr($inicio_norm, 0, 10);
            $hora_nueva   = date('H:i:s', strtotime($inicio_norm));
            $salida_nueva = $fin_norm ? date('H:i:s', strtotime($fin_norm)) : null;

            $existing = $this->getOne(
                "SELECT * FROM {$this->table} WHERE id_trabajador=:t AND fecha=:f",
                [':t' => $id_trabajador, ':f' => $fecha]
            );

            if ($existing) {
                // Mantener la ENTRADA más temprana (primera orden del día)
                $hora_entrada = $hora_nueva;
                if (!empty($existing->hora_entrada) && $existing->hora_entrada != '00:00:00') {
                    if (strtotime($hora_nueva) > strtotime($existing->hora_entrada)) {
                        $hora_entrada = $existing->hora_entrada;
                    }
                }

                // Mantener la SALIDA más tardía (última orden del día)
                $hora_salida = $salida_nueva;
                if ($hora_salida && !empty($existing->hora_salida) && $existing->hora_salida != '00:00:00') {
                    if (strtotime($hora_salida) < strtotime($existing->hora_salida)) {
                        $hora_salida = $existing->hora_salida;
                    }
                }

                // Guardamos como referencia la orden de la entrada más temprana
                $id_orden_asis = $existing->id_orden;
                if (strtotime($hora_nueva) < strtotime($existing->hora_entrada) || !$id_orden_asis) {
                    $id_orden_asis = $id_orden;
                }

                [$estado, $minutos] = $this->_calcularEstado($id_trabajador, $fecha, $hora_entrada);

                $this->query(
                    "UPDATE {$this->table} SET hora_entrada=:he,hora_salida=:hs,id_orden=:o,
                         estado=:e,minutos_tarde=:mt,tipo='Automatico'
                     WHERE id_asistencia=:id",
                    [
                        ':he' => $hora_entrada,
                        ':hs' => $hora_salida ?: '00:00:00',
                        ':o'  => $id_orden_asis,
                        ':e'  => $estado,
                        ':mt' => $minutos,
                        ':id' => $existing->id_asistencia
                    ]
                );
            } else {
                [$estado, $minutos] = $this->_calcularEstado($id_trabajador, $fecha, $hora_nueva);

                $this->query(
                    "INSERT INTO {$this->table}
                         (id_trabajador,id_orden,fecha,hora_entrada,hora_salida,estado,minutos_tarde,tipo,observacion)
                     VALUES (:t,:o,:f,:he,:hs,:e,:mt,'Automatico',:obs)",
                    [
                        ':t' => $id_trabajador,
                        ':o' => $id_orden,
                        ':f' => $fecha,
                        ':he' => $hora_nueva,
                        ':hs' => $salida_nueva ?: '00:00:00',
                        ':e' => $estado,
                        ':mt' => $minutos,
                        ':obs' => "Auto desde orden #{$orden->numero}"
                    ]
                );
            }

            return [
                'success' => true,
                'estado' => $estado,
                'mensaje' => "Asistencia: {$estado}" . ($minutos > 0 ? " ({$minutos} min tarde)" : '')
            ];
        } catch (Exception $e) {
            return ['success' => false, 'mensaje' => 'Error: ' . $e->getMessage()];
        }
    }

    private function _calcularEstado($id_trabajador, $fecha, $hora_llegada)
    {
        $trab = $this->getOne(
            "SELECT id_horario FROM trabajadores WHERE id_trabajador=:t",
            [':t' => $id_trabajador]
        );
        if (!$trab || !$trab->id_horario) return ['Asistio', 0];

        $h = $this->getOne(
            "SELECT hora_entrada, tolerancia_min FROM horarios WHERE id_horario=:h AND estado='Activo'",
            [':h' => $trab->id_horario]
        );
        if (!$h) return ['Asistio', 0];

        $diff = (int)((strtotime($fecha . ' ' . $hora_llegada) - strtotime($fecha . ' ' . $h->hora_entrada)) / 60);
        $tol  = (int)($h->tolerancia_min ?? 10);

        return ($diff <= $tol) ? ['Asistio', max(0, $diff)] : ['Tardanza', $diff];
    }
}
