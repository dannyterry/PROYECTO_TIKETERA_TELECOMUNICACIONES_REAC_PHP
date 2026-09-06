<?php
/**
 * Correo - Cliente SMTP en PHP puro (sin dependencias externas).
 * Envía correos con adjuntos (PDF) usando conexión directa al servidor SMTP.
 */
class Correo
{
    private $host = '';
    private $port = 587;
    private $user = '';
    private $pass = '';
    private $secure = 'tls'; // ssl | tls | '' (sin cifrado)
    private $fromName = '';
    private $fromEmail = '';
    private $timeout = 25;
    private $conn = null;
    private $lastError = '';

    public function __construct(array $config = [])
    {
        $this->host = trim((string)($config['EMAIL_HOST'] ?? ''));
        $this->port = (int)($config['EMAIL_PORT'] ?? 587);
        $this->user = trim((string)($config['EMAIL_USER'] ?? ''));
        $this->pass = (string)($config['EMAIL_PASSWORD'] ?? '');
        $this->secure = strtolower(trim((string)($config['EMAIL_SECURE'] ?? 'tls')));
        $this->fromName = trim((string)($config['EMAIL_FROM_NAME'] ?? ''));
        $this->fromEmail = $this->user;
    }

    public function ultimoError(): string
    {
        return $this->lastError;
    }

    public function estaConfigurado(): bool
    {
        return $this->host !== '' && $this->port > 0 && $this->user !== '' && $this->pass !== '';
    }

    public function enviar(string $para, string $asunto, string $cuerpoHtml, array $adjuntos = [], string $paraNombre = ''): bool
    {
        $this->lastError = '';
        if (!$this->estaConfigurado()) {
            $this->lastError = 'Configuración SMTP incompleta (host, usuario y clave son obligatorios).';
            return false;
        }
        if ($para === '' || !filter_var($para, FILTER_VALIDATE_EMAIL)) {
            $this->lastError = 'El correo del destinatario no es válido: ' . $para;
            return false;
        }

        try {
            $this->_conectar();
            $this->_comando('EHLO ' . ($this->host ?: 'localhost'));

            if ($this->secure === 'tls') {
                $this->_comando('STARTTLS', 220);
                $ok = @stream_socket_enable_crypto($this->conn, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
                if (!$ok) {
                    throw new RuntimeException('No se pudo activar el cifrado TLS.');
                }
                $this->_comando('EHLO ' . ($this->host ?: 'localhost'));
            }

            $this->_comando('AUTH LOGIN', 334);
            $this->_comando(base64_encode($this->user), 334);
            $this->_comando(base64_encode($this->pass), 235);

            $this->_comando('MAIL FROM:<' . $this->fromEmail . '>');
            $this->_comando('RCPT TO:<' . $para . '>');
            $this->_comando('DATA', 354);

            $mensaje = $this->_armarMensaje($para, $asunto, $cuerpoHtml, $adjuntos, $paraNombre);
            $this->_escribir($mensaje . "\r\n.\r\n");
            $this->_leer(250);

            $this->_comando('QUIT', 221);
            $this->_cerrar();
            return true;
        } catch (Throwable $e) {
            $this->lastError = $e->getMessage();
            $this->_cerrar();
            return false;
        }
    }

    private function _conectar(): void
    {
        if ($this->secure === 'ssl') {
            $host = 'ssl://' . $this->host;
        } else {
            $host = $this->host;
        }
        $errno = 0;
        $errstr = '';
        $conn = @stream_socket_client(
            $host . ':' . $this->port,
            $errno,
            $errstr,
            $this->timeout,
            STREAM_CLIENT_CONNECT
        );
        if (!$conn) {
            throw new RuntimeException('No se pudo conectar a ' . $this->host . ':' . $this->port . ' (' . $errstr . ').');
        }
        stream_set_timeout($conn, $this->timeout);
        $this->conn = $conn;
        $this->_leer(220);
    }

    private function _leer(int $esperado = null): string
    {
        if (!$this->conn) {
            throw new RuntimeException('Conexión SMTP cerrada.');
        }
        $respuesta = '';
        while (($linea = fgets($this->conn, 515)) !== false) {
            $respuesta .= $linea;
            if (isset($linea[3]) && $linea[3] === ' ') {
                break;
            }
        }
        if ($respuesta === '') {
            $meta = stream_get_meta_data($this->conn);
            if (!empty($meta['timed_out'])) {
                throw new RuntimeException('Tiempo de espera agotado en respuesta SMTP.');
            }
            throw new RuntimeException('Sin respuesta del servidor SMTP.');
        }
        $codigo = (int)substr($respuesta, 0, 3);
        if ($esperado !== null && $codigo !== $esperado) {
            throw new RuntimeException('SMTP respondió ' . $codigo . ': ' . trim($respuesta));
        }
        return $respuesta;
    }

    private function _escribir(string $dato): void
    {
        fwrite($this->conn, $dato);
    }

    private function _comando(string $cmd, int $esperado = null): string
    {
        $this->_escribir($cmd . "\r\n");
        return $this->_leer($esperado);
    }

    private function _cerrar(): void
    {
        if (is_resource($this->conn)) {
            @fclose($this->conn);
        }
        $this->conn = null;
    }

    private function _encabezado(string $valor): string
    {
        if (preg_match('/[\x80-\xFF]/', $valor)) {
            return '=?UTF-8?B?' . base64_encode($valor) . '?=';
        }
        return $valor;
    }

    private function _armarMensaje(string $para, string $asunto, string $cuerpoHtml, array $adjuntos, string $paraNombre = ''): string
    {
        $remitente = $this->fromName !== '' ? $this->_encabezado($this->fromName) . ' <' . $this->fromEmail . '>' : $this->fromEmail;
        $destino = $paraNombre !== '' ? $this->_encabezado($paraNombre) . ' <' . $para . '>' : $para;

        $boundary = 'b_' . md5(uniqid((string)mt_rand(), true));

        $head = 'From: ' . $remitente . "\r\n";
        $head .= 'To: ' . $destino . "\r\n";
        $head .= 'Subject: ' . $this->_encabezado($asunto) . "\r\n";
        $head .= 'Date: ' . date('D, d M Y H:i:s O') . "\r\n";
        $head .= 'Message-ID: <' . time() . '.' . md5($para) . '@' . ($this->host ?: 'localhost') . ">\r\n";
        $head .= 'MIME-Version: 1.0' . "\r\n";

        if (empty($adjuntos)) {
            $head .= "Content-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n";
            return $head . "\r\n" . $this->_base64Chunked($cuerpoHtml);
        }

        $cuerpo = 'This is a multi-part message in MIME format.' . "\r\n\r\n";
        $cuerpo .= '--' . $boundary . "\r\n";
        $cuerpo .= "Content-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n";
        $cuerpo .= $this->_base64Chunked($cuerpoHtml) . "\r\n";

        foreach ($adjuntos as $adj) {
            $nombre = $adj['nombre'] ?? 'adjunto.pdf';
            $contenido = $adj['contenido'] ?? '';
            $mime = $adj['mime'] ?? 'application/octet-stream';
            $nombreCod = str_replace(['(', ')', '<', '>', ','], '_', $nombre);
            $cuerpo .= '--' . $boundary . "\r\n";
            $cuerpo .= 'Content-Type: ' . $mime . '; name="' . $nombreCod . "\"\r\n";
            $cuerpo .= 'Content-Transfer-Encoding: base64' . "\r\n";
            $cuerpo .= 'Content-Disposition: attachment; filename="' . $nombreCod . "\"\r\n\r\n";
            $cuerpo .= $this->_base64Chunked($contenido) . "\r\n";
        }
        $cuerpo .= '--' . $boundary . "--\r\n";

        $head .= 'Content-Type: multipart/mixed; boundary="' . $boundary . "\"\r\n";
        return $head . "\r\n" . $cuerpo;
    }

    private function _base64Chunked(string $contenido): string
    {
        return rtrim(chunk_split(base64_encode($contenido), 76, "\r\n"));
    }
}
