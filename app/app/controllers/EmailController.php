<?php
// app/controllers/EmailController.php — MÓDULO DE CORREOS
//
// Envía a cada técnico un correo con un PDF de sus órdenes finalizadas:
//   - Reporte DIARIO   → órdenes de la fecha actual
//   - Reporte MENSUAL  → órdenes del mes actual (o el indicado)
// El detalle por orden incluye pago por orden, descuento por material, etc.

require_once __DIR__ . '/../libraries/Pdf.php';
require_once __DIR__ . '/../libraries/Correo.php';

class EmailController extends Controller
{
    private $emailModel;
    private $configModel;

    public function __construct()
    {
        parent::__construct();
        $this->emailModel  = $this->model('EmailModel');
        $this->configModel = $this->model('ConfigModel');
    }

    public function index()
    {
        $this->requierePermisoVista('correos.ver');

        $data = [
            'titulo'    => "Envío de Correos",
            'js'        => "correos",
            'config'    => $this->emailModel->config_correo_(),
            'tecnicos'  => $this->emailModel->tecnicos_con_correo_(),
            'permiso_enviar' => $this->tienePermiso('correos.enviar'),
            'permiso_editar' => $this->tienePermiso('correos.editar')
        ];

        $this->view('email/index', $data);
    }

    public function guardar_config()
    {
        $this->requierePermiso('correos.editar');
        echo json_encode($this->configModel->guardar_(), JSON_UNESCAPED_UNICODE);
    }

    public function enviar_prueba()
    {
        $this->requierePermiso('correos.enviar');

        $config = $this->emailModel->config_correo_();
        $para   = trim($_POST['email'] ?? $config['EMAIL_PRUEBA'] ?? '');

        $correo = new Correo($config);
        if (!$correo->estaConfigurado()) {
            echo json_encode(['success' => false, 'mensaje' => $correo->ultimoError()], JSON_UNESCAPED_UNICODE);
            return;
        }
        if ($para === '') {
            echo json_encode(['success' => false, 'mensaje' => 'Ingresa un correo para la prueba.'], JSON_UNESCAPED_UNICODE);
            return;
        }

        $cuerpo = '<p>Este es un correo de prueba del módulo de envío del sistema.</p>
                   <p>Si lo recibes, la configuración SMTP es correcta.</p>';

        $ok = $correo->enviar($para, 'Correo de prueba - ' . $this->_nombreEmpresa(), $cuerpo);
        echo json_encode([
            'success' => $ok,
            'mensaje' => $ok ? 'Correo de prueba enviado a ' . $para : $correo->ultimoError()
        ], JSON_UNESCAPED_UNICODE);
    }

    public function enviar_diario()
    {
        $this->requierePermiso('correos.enviar');

        // El envío masivo puede tardar (1 email por técnico). Quitamos el límite
        // de tiempo y liberamos el lock de sesión para que el frontend pueda
        // consultar "correos/progreso_envio" (polling) mientras seguimos enviando.
        set_time_limit(0);
        ignore_user_abort(true);
        session_write_close();

        @unlink($this->progresoPath());
        $this->guardarProgreso(0, 1, 'Preparando envío diario...');

        $hoy = date('Y-m-d');
        $respuesta = $this->_enviarReportes($hoy, $hoy, 'Diario', '', function ($actual, $total, $mensaje) {
            $this->guardarProgreso($actual, $total, $mensaje);
        });

        @unlink($this->progresoPath());
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }

    public function enviar_mensual()
    {
        $this->requierePermiso('correos.enviar');

        $mes = trim($_POST['mes'] ?? '');
        if (!preg_match('/^\d{4}-\d{2}$/', $mes)) {
            $mes = date('Y-m');
        }
        $desde = $mes . '-01';
        $hasta = date('Y-m-t', strtotime($desde));

        set_time_limit(0);
        ignore_user_abort(true);
        session_write_close();

        @unlink($this->progresoPath());
        $this->guardarProgreso(0, 1, 'Preparando envío mensual...');

        $respuesta = $this->_enviarReportes($desde, $hasta, 'Mensual', $mes, function ($actual, $total, $mensaje) {
            $this->guardarProgreso($actual, $total, $mensaje);
        });

        @unlink($this->progresoPath());
        echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    }

    // Consulta de progreso: el frontend hace polling a este endpoint mientras
    // "enviar_diario"/"enviar_mensual" siguen corriendo (igual patrón que la
    // sincronización de órdenes). Solo lee un archivo temporal, por eso
    // liberamos la sesión de inmediato.
    public function progreso_envio()
    {
        session_write_close();

        $path = $this->progresoPath();
        if (!file_exists($path)) {
            echo json_encode(['actual' => 0, 'total' => 0, 'mensaje' => 'Iniciando...'], JSON_UNESCAPED_UNICODE);
            return;
        }

        $contenido = file_get_contents($path);
        echo $contenido ?: json_encode(['actual' => 0, 'total' => 0, 'mensaje' => 'Iniciando...'], JSON_UNESCAPED_UNICODE);
    }

    // Ruta del archivo temporal de progreso del envío, único por sesión
    private function progresoPath()
    {
        return sys_get_temp_dir() . '/cespedes_correos_progreso_' . session_id() . '.json';
    }

    // Guarda el avance del envío en el archivo temporal (no usamos $_SESSION
    // porque el request principal mantiene el lock de sesión durante el envío)
    private function guardarProgreso($actual, $total, $mensaje = null)
    {
        @file_put_contents($this->progresoPath(), json_encode([
            'actual'  => $actual,
            'total'   => $total,
            'mensaje' => $mensaje
        ], JSON_UNESCAPED_UNICODE));
    }

    public function previsualizar()
    {
        $this->requierePermiso('correos.ver');

        $id   = (int)($_GET['id'] ?? 0);
        $tipo = ($_GET['tipo'] ?? 'd') === 'm' ? 'm' : 'd';
        $mes  = trim($_GET['mes'] ?? '');

        if ($id <= 0) {
            die('Técnico no válido.');
        }

        if ($tipo === 'm') {
            if (!preg_match('/^\d{4}-\d{2}$/', $mes)) {
                $mes = date('Y-m');
            }
            $desde = $mes . '-01';
            $hasta = date('Y-m-t', strtotime($desde));
            $label = 'Reporte mensual de órdenes - ' . $this->_mesNombre($mes);
        } else {
            $desde = $hasta = date('Y-m-d');
            $label = 'Reporte diario de órdenes - ' . date('d/m/Y');
        }

        $reporte = $this->emailModel->reporte_tecnico_($id, $desde, $hasta);
        $pdf     = $this->_generarPdfReporte($reporte, $label);

        $nombre = 'reporte_' . $tipo . '_' . $id . '.pdf';
        header('Content-Type: application/pdf');
        header('Content-Disposition: inline; filename="' . $nombre . '"');
        echo $pdf;
    }

    // ─────────────────────────── PRIVADOS ───────────────────────────

    private function _nombreEmpresa()
    {
        return defined('NAME_EMPRESA') ? NAME_EMPRESA : 'Cespedes';
    }

    private function _moneda()
    {
        return defined('MONEDA') ? MONEDA : 'S/';
    }

    private function _mesNombre($mes)
    {
        $meses = [
            '01' => 'Enero', '02' => 'Febrero', '03' => 'Marzo', '04' => 'Abril',
            '05' => 'Mayo', '06' => 'Junio', '07' => 'Julio', '08' => 'Agosto',
            '09' => 'Septiembre', '10' => 'Octubre', '11' => 'Noviembre', '12' => 'Diciembre'
        ];
        $p = explode('-', $mes);
        $anio = $p[0] ?? date('Y');
        $num  = $p[1] ?? date('m');
        return ($meses[$num] ?? $num) . ' ' . $anio;
    }

    private function _enviarReportes($desde, $hasta, $tipo, $mes = '', $onProgreso = null)
    {
        $config = $this->emailModel->config_correo_();
        $correo = new Correo($config);

        if (!$correo->estaConfigurado()) {
            return ['success' => false, 'mensaje' => $correo->ultimoError()];
        }

        $ids = array_map('intval', (array)($_POST['tecnicos'] ?? []));
        if (empty($ids)) {
            return ['success' => false, 'mensaje' => 'Selecciona al menos un técnico.'];
        }

        $lista = $this->emailModel->tecnicos_con_correo_();
        $elegidos = array_filter($lista, fn($t) => in_array((int)$t->id_trabajador, $ids));
        if (empty($elegidos)) {
            return ['success' => false, 'mensaje' => 'Ninguno de los técnicos seleccionados tiene correo registrado.'];
        }

        if ($tipo === 'Mensual') {
            if (!preg_match('/^\d{4}-\d{2}$/', $mes)) {
                $mes = date('Y-m', strtotime($desde));
            }
            $etiqueta = 'Reporte mensual de órdenes - ' . $this->_mesNombre($mes);
            $asunto   = $etiqueta;
            $periodo  = 'del ' . date('d/m/Y', strtotime($desde)) . ' al ' . date('d/m/Y', strtotime($hasta));
            $prefijo  = 'reporte_mensual_' . $mes;
        } else {
            $etiqueta = 'Reporte diario de órdenes - ' . date('d/m/Y', strtotime($desde));
            $asunto   = $etiqueta;
            $periodo  = date('d/m/Y', strtotime($desde));
            $prefijo  = 'reporte_diario_' . date('Ymd', strtotime($desde));
        }

        $enviados = 0;
        $fallidos = 0;
        $resultado = [];

        $totalElegidos = count($elegidos);
        if ($onProgreso) {
            $onProgreso(0, $totalElegidos, 'Iniciando envío a ' . $totalElegidos . ' técnico(s)...');
        }

        $n = 0;
        foreach ($elegidos as $t) {
            $n++;
            $reporte = $this->emailModel->reporte_tecnico_((int)$t->id_trabajador, $desde, $hasta);

            $item = [
                'tecnico' => $t->tecnico,
                'email'   => $t->email,
                'ordenes' => $reporte['totales']['num_ordenes'],
                'estado'  => 'error',
                'mensaje' => ''
            ];

            if ($reporte['totales']['num_ordenes'] === 0) {
                $pdfBin = $this->_generarPdfReporte($reporte, $etiqueta);
                $nombre = $prefijo . '_' . $t->id_trabajador . '.pdf';
                $cuerpo = $this->_cuerpoHtml($t->tecnico, $periodo, $reporte['totales'], true);
                $ok = $correo->enviar(
                    $t->email,
                    $asunto,
                    $cuerpo,
                    [['nombre' => $nombre, 'contenido' => $pdfBin, 'mime' => 'application/pdf']],
                    $t->tecnico
                );
                $item['mensaje'] = $ok ? 'Sin órdenes en el período (notificado)' : $correo->ultimoError();
                $item['estado']  = $ok ? 'ok' : 'error';
                if ($ok) { $enviados++; } else { $fallidos++; }
                $resultado[] = $item;
                if ($onProgreso) {
                    $onProgreso($n, $totalElegidos, 'Enviado a ' . $t->tecnico . ' (' . $n . '/' . $totalElegidos . ')');
                }
                continue;
            }

            $pdfBin = $this->_generarPdfReporte($reporte, $etiqueta);
            $nombre = $prefijo . '_' . $t->id_trabajador . '.pdf';

            $cuerpo = $this->_cuerpoHtml($t->tecnico, $periodo, $reporte['totales']);
            $ok = $correo->enviar(
                $t->email,
                $asunto,
                $cuerpo,
                [['nombre' => $nombre, 'contenido' => $pdfBin, 'mime' => 'application/pdf']],
                $t->tecnico
            );

            if ($ok) {
                $item['estado']  = 'ok';
                $item['mensaje'] = 'Enviado';
                $enviados++;
            } else {
                $item['mensaje'] = $correo->ultimoError();
                $fallidos++;
            }
            $resultado[] = $item;
            if ($onProgreso) {
                $onProgreso($n, $totalElegidos, 'Enviado a ' . $t->tecnico . ' (' . $n . '/' . $totalElegidos . ')');
            }
        }

        return [
            'success'   => $fallidos === 0 && $enviados > 0,
            'enviados'  => $enviados,
            'fallidos'  => $fallidos,
            'periodo'   => $periodo,
            'resultado' => $resultado
        ];
    }

    private function _cuerpoHtml($tecnico, $periodo, $totales, $sinOrdenes = false)
    {
        $m = $this->_moneda();
        if ($sinOrdenes) {
            return "<p>Hola <b>{$tecnico}</b>,</p>
                    <p>En el período <b>{$periodo}</b> <b>no tienes órdenes finalizadas</b>, por lo que no se generó reporte de pagos.</p>
                    <p>Si crees que esto es un error, contacta a administración.</p>
                    <p>Saludos.</p>";
        }
        return "<p>Hola <b>{$tecnico}</b>,</p>
                <p>Te enviamos el reporte de tus órdenes del período: <b>{$periodo}</b>.</p>
                <ul>
                    <li>Órdenes finalizadas: <b>{$totales['num_ordenes']}</b></li>
                    <li>Pago técnico: <b>{$m} " . number_format($totales['pago_tecnicos'], 2) . "</b></li>
                    <li>Descuento por material: <b>{$m} " . number_format($totales['costo_material'], 2) . "</b></li>
                    <li>Total neto a pagar: <b>{$m} " . number_format($totales['neto'], 2) . "</b></li>
                </ul>
                <p>Adjuntamos el detalle completo en PDF.</p>
                <p>Saludos.</p>";
    }

    private function _cortar($txt, $ancho, $pdf)
    {
        $txt = (string)$txt;
        if ($pdf->getStringWidthMm($txt) <= $ancho - 3) {
            return $txt;
        }
        while (strlen($txt) > 0 && $pdf->getStringWidthMm($txt . '...') > $ancho - 3) {
            $txt = mb_substr($txt, 0, -1, 'UTF-8');
        }
        return $txt . '...';
    }

    private function _generarPdfReporte($reporte, $etiqueta)
    {
        $empresa = $this->_nombreEmpresa();
        $moneda  = $this->_moneda();
        $totales = $reporte['totales'];
        $ordenes = $reporte['ordenes'];

        $pdf = new Pdf('P');
        $pdf->addPage();
        $pdf->setDrawColor(203, 213, 225);
        $pdf->setLineWidth(0.15);
        $w = 180;

        // ── Cabecera del documento ──
        $pdf->setFont('helvetica', 'B', 15);
        $pdf->setTextColor(30, 41, 59);
        $pdf->cell($w, 9, $empresa, 0, 1, 'L');
        $pdf->setFont('helvetica', '', 10);
        $pdf->setTextColor(71, 85, 105);
        $pdf->cell($w, 6, $etiqueta, 0, 1, 'L');
        $pdf->cell($w, 6, 'Técnico: ' . $reporte['tecnico'], 0, 1, 'L');
        $pdf->cell($w, 6, 'Órdenes finalizadas: ' . $totales['num_ordenes']
            . ($totales['sin_precio'] ? '  (sin precio: ' . $totales['sin_precio'] . ')' : ''), 0, 1, 'L');
        $pdf->ln(4);

        // ── Resumen (solo lo que le corresponde al técnico) ──
        $col = 60;
        $pdf->setFillColor(241, 245, 249);
        $pdf->setFont('helvetica', '', 7.5);
        $pdf->setTextColor(100, 116, 139);
        foreach (['Pago técnico', 'Descuento material', 'Neto a pagar'] as $lab) {
            $pdf->cell($col, 5.5, $lab, 0, 0, 'C', true);
        }
        $pdf->ln();
        $pdf->setFont('helvetica', 'B', 11);
        $pdf->setTextColor(30, 41, 59);
        foreach ([$totales['pago_tecnicos'], $totales['costo_material'], $totales['neto']] as $val) {
            $pdf->cell($col, 8, $moneda . ' ' . number_format($val, 2), 0, 0, 'C');
        }
        $pdf->ln(12);

        // ── Tabla de órdenes ──
        $cols = [8, 16, 44, 27, 20, 17, 17, 17];
        $head = ['N°', 'Orden', 'Cliente', 'Tipo Trabajo', 'Fecha', 'Pago técnico', 'Material', 'Neto'];

        if (empty($ordenes)) {
            $pdf->setFont('helvetica', '', 10);
            $pdf->setTextColor(71, 85, 105);
            $pdf->cell($w, 10, 'No tienes órdenes finalizadas en el período.', 0, 1, 'C');
        } else {
            $this->_cabeceraTabla($pdf, $cols, $head, $w);
            $alt = false;
            $i = 0;
            foreach ($ordenes as $o) {
                if ($pdf->getY() + 7 > $pdf->pageBottom()) {
                    $pdf->addPage();
                    $this->_cabeceraTabla($pdf, $cols, $head, $w);
                }
                $pdf->setFont('helvetica', '', 7.5);
                $pdf->setTextColor(30, 41, 59);
                if ($alt) {
                    $pdf->setFillColor(248, 250, 252);
                } else {
                    $pdf->setFillColor(255, 255, 255);
                }
                $alt = !$alt;

                $cliente = $this->_cortar($o['cliente'], $cols[2], $pdf);
                $tipo    = $this->_cortar($o['tipo_trabajo'], $cols[3], $pdf);
                $fecha   = $o['fecha_visita'] ? date('d/m/Y', strtotime($o['fecha_visita'])) : '-';

                $pdf->cell($cols[0], 7, (string)(++$i), 1, 0, 'C', true);
                $pdf->cell($cols[1], 7, $o['numero'] ?: '-', 1, 0, 'C', true);
                $pdf->cell($cols[2], 7, $cliente, 1, 0, 'L', true);
                $pdf->cell($cols[3], 7, $tipo, 1, 0, 'L', true);
                $pdf->cell($cols[4], 7, $fecha, 1, 0, 'C', true);
                $pdf->cell($cols[5], 7, $moneda . ' ' . number_format($o['pago_tecnico'], 2), 1, 0, 'R', true);
                $pdf->cell($cols[6], 7, $moneda . ' ' . number_format($o['costo_material'], 2), 1, 0, 'R', true);
                $pdf->cell($cols[7], 7, $moneda . ' ' . number_format($o['neto'], 2), 1, 0, 'R', true);
                $pdf->ln(7);
            }

            // ── Fila de totales ──
            $pdf->setFont('helvetica', 'B', 7.5);
            $pdf->setFillColor(226, 232, 240);
            $pdf->cell($cols[0] + $cols[1] + $cols[2] + $cols[3] + $cols[4], 7, 'TOTALES', 1, 0, 'R', true);
            $pdf->cell($cols[5], 7, $moneda . ' ' . number_format($totales['pago_tecnicos'], 2), 1, 0, 'R', true);
            $pdf->cell($cols[6], 7, $moneda . ' ' . number_format($totales['costo_material'], 2), 1, 0, 'R', true);
            $pdf->cell($cols[7], 7, $moneda . ' ' . number_format($totales['neto'], 2), 1, 0, 'R', true);
            $pdf->ln(7);
        }

        // ── Pie ──
        $pdf->ln(6);
        $pdf->setFont('helvetica', '', 7.5);
        $pdf->setTextColor(148, 163, 184);
        $pdf->cell($w, 5, 'Generado el ' . date('d/m/Y H:i') . ' por ' . $empresa . '.', 0, 1, 'L');

        return $pdf->output();
    }

    private function _cabeceraTabla($pdf, $cols, $head, $w)
    {
        $pdf->setFont('helvetica', 'B', 7.5);
        $pdf->setTextColor(255, 255, 255);
        $pdf->setFillColor(30, 41, 59);
        foreach ($head as $i => $lab) {
            $pdf->cell($cols[$i], 7, $lab, 1, 0, $i === 2 || $i === 3 ? 'L' : 'C', true);
        }
        $pdf->ln(7);
        $pdf->setTextColor(30, 41, 59);
    }
}
