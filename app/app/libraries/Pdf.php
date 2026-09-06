<?php
/**
 * Pdf - Generador de PDF en PHP puro (sin dependencias externas).
 * Basado en el modelo de FPDF, limitado a lo necesario para reportes:
 * celdas, multi-celdas, líneas, rectángulos y las 4 fuentes Helvetica.
 */
class Pdf
{
    private $k;                 // puntos por mm
    private $wPt, $hPt;         // tamaño de página en puntos
    private $w, $h;             // tamaño de página en mm
    private $lMargin = 15;
    private $tMargin = 15;
    private $rMargin = 15;
    private $bMargin = 20;
    private $x = 0, $y = 0;     // cursor en mm
    private $pages = [];        // contenido de cada página
    private $page = 0;
    private $fontFamily = 'helvetica';
    private $fontStyle = '';
    private $fontSize = 10;     // en pt
    private $lineHeight = 5;    // mm por defecto para multiCell
    private $textColor = '0.000 0.000 0.000';
    private $fillColor = false;
    private $drawColor = '0.000 0.000 0.000';
    private $lineWidth = 0.2;   // mm
    private $cMargin = 1;       // margen interno de celda en mm

    private const CORE_FONTS = [
        1 => 'Helvetica',
        2 => 'Helvetica-Bold',
        3 => 'Helvetica-Oblique',
        4 => 'Helvetica-BoldOblique',
    ];

    private const CW_HELVETICA = [
        ' '=>278,'!'=>278,'"'=>355,'#'=>556,'$'=>556,'%'=>889,'&'=>667,"'"=>191,
        '('=>333,')'=>333,'*'=>389,'+'=>584,','=>278,'-'=>333,'.'=>278,'/'=>278,
        '0'=>556,'1'=>556,'2'=>556,'3'=>556,'4'=>556,'5'=>556,'6'=>556,'7'=>556,
        '8'=>556,'9'=>556,':'=>278,';'=>278,'<'=>584,'='=>584,'>'=>584,'?'=>556,
        '@'=>1015,'A'=>667,'B'=>667,'C'=>722,'D'=>722,'E'=>667,'F'=>611,'G'=>778,
        'H'=>722,'I'=>278,'J'=>500,'K'=>667,'L'=>556,'M'=>833,'N'=>722,'O'=>778,
        'P'=>667,'Q'=>778,'R'=>667,'S'=>667,'T'=>611,'U'=>722,'V'=>667,'W'=>944,
        'X'=>667,'Y'=>667,'Z'=>611,'['=>278,'\\'=>278,']'=>278,'^'=>469,'_'=>556,
        '`'=>333,'a'=>556,'b'=>556,'c'=>500,'d'=>556,'e'=>556,'f'=>278,'g'=>556,
        'h'=>556,'i'=>222,'j'=>222,'k'=>500,'l'=>222,'m'=>833,'n'=>556,'o'=>556,
        'p'=>556,'q'=>556,'r'=>333,'s'=>500,'t'=>278,'u'=>556,'v'=>500,'w'=>722,
        'x'=>500,'y'=>500,'z'=>500,'{'=>334,'|'=>260,'}'=>334,'~'=>584,
        '¡'=>333,'¢'=>556,'£'=>556,'¤'=>556,'¥'=>556,'¦'=>260,'§'=>556,'¨'=>333,
        '©'=>737,'ª'=>370,'«'=>556,'¬'=>584,'®'=>737,'¯'=>333,'°'=>400,'±'=>584,
        '²'=>333,'³'=>333,'´'=>333,'µ'=>556,'¶'=>537,'·'=>278,'¸'=>333,'¹'=>333,
        'º'=>370,'»'=>556,'¼'=>834,'½'=>834,'¾'=>834,'¿'=>611,'À'=>667,'Á'=>667,
        'Â'=>667,'Ã'=>667,'Ä'=>667,'Å'=>667,'Æ'=>1000,'Ç'=>722,'È'=>667,'É'=>667,
        'Ê'=>667,'Ë'=>667,'Ì'=>278,'Í'=>278,'Î'=>278,'Ï'=>278,'Ð'=>722,'Ñ'=>722,
        'Ò'=>778,'Ó'=>778,'Ô'=>778,'Õ'=>778,'Ö'=>778,'×'=>584,'Ø'=>778,'Ù'=>722,
        'Ú'=>722,'Û'=>722,'Ü'=>722,'Ý'=>667,'Þ'=>667,'ß'=>611,'à'=>556,'á'=>556,
        'â'=>556,'ã'=>556,'ä'=>556,'å'=>556,'æ'=>889,'ç'=>500,'è'=>556,'é'=>556,
        'ê'=>556,'ë'=>556,'ì'=>278,'í'=>278,'î'=>278,'ï'=>278,'ð'=>556,'ñ'=>556,
        'ò'=>556,'ó'=>556,'ô'=>556,'õ'=>556,'ö'=>556,'÷'=>584,'ø'=>611,'ù'=>556,
        'ú'=>556,'û'=>556,'ü'=>556,'ý'=>500,'þ'=>556,'ÿ'=>500,
    ];

    public function __construct(string $orientacion = 'P')
    {
        $this->k = 72 / 25.4; // 2.8346456693 puntos por mm
        $this->wPt = 595.28;
        $this->hPt = 841.89;
        if (strtoupper($orientacion) === 'L') {
            $tmp = $this->wPt;
            $this->wPt = $this->hPt;
            $this->hPt = $tmp;
        }
        $this->w = $this->wPt / $this->k;
        $this->h = $this->hPt / $this->k;
        $this->setMargins(15, 15, 15);
    }

    public function setMargins(float $izquierdo, float $superior, float $derecho): void
    {
        $this->lMargin = $izquierdo;
        $this->tMargin = $superior;
        $this->rMargin = $derecho;
        $this->x = $izquierdo;
        $this->y = $superior;
    }

    public function addPage(): void
    {
        $this->pages[] = '';
        $this->page = count($this->pages) - 1;
        $this->x = $this->lMargin;
        $this->y = $this->tMargin;
    }

    public function setFont(string $familia = 'helvetica', string $estilo = '', float $tamano = 10): void
    {
        $familia = strtolower($familia);
        if ($familia !== 'helvetica' && $familia !== 'arial') {
            $familia = 'helvetica';
        }
        $estilo = strtoupper($estilo);
        if ($estilo !== 'B' && $estilo !== 'I' && $estilo !== 'BI') {
            $estilo = '';
        }
        $this->fontFamily = $familia;
        $this->fontStyle = $estilo;
        $this->fontSize = $tamano;
        $this->lineHeight = $tamano / $this->k * 0.5;
    }

    public function setTextColor(int $r, int $g, int $b): void
    {
        $this->textColor = sprintf('%.3f %.3f %.3f', $r / 255, $g / 255, $b / 255);
    }

    public function setFillColor(int $r, int $g, int $b): void
    {
        $this->fillColor = sprintf('%.3f %.3f %.3f', $r / 255, $g / 255, $b / 255);
    }

    public function setDrawColor(int $r, int $g, int $b): void
    {
        $this->drawColor = sprintf('%.3f %.3f %.3f', $r / 255, $g / 255, $b / 255);
    }

    public function setLineWidth(float $mm): void
    {
        $this->lineWidth = $mm;
    }

    public function getX(): float
    {
        return $this->x;
    }

    public function getY(): float
    {
        return $this->y;
    }

    public function setXY(float $x, float $y): void
    {
        $this->x = $x;
        $this->y = $y;
    }

    public function setY(float $y): void
    {
        $this->y = $y;
    }

    public function ln(float $h = 5): void
    {
        $this->y += $h;
        $this->x = $this->lMargin;
    }

    public function pageBottom(): float
    {
        return $this->h - $this->bMargin;
    }

    private function _fontIndex(): int
    {
        $estilo = $this->fontStyle;
        if ($estilo === 'BI') {
            return 4;
        }
        if ($estilo === 'B') {
            return 2;
        }
        if ($estilo === 'I') {
            return 3;
        }
        return 1;
    }

    private function _out(string $s): void
    {
        $this->pages[$this->page] .= $s . "\n";
    }

    private function _latin(string $txt): string
    {
        $latin = @mb_convert_encoding((string)$txt, 'ISO-8859-1', 'UTF-8');
        return $latin === false ? (string)$txt : $latin;
    }

    private function _escape(string $txt): string
    {
        return str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $this->_latin($txt));
    }

    public function getStringWidth(string $txt): float
    {
        $cw = self::CW_HELVETICA;
        $latin = $this->_latin($txt);
        $w = 0;
        $n = strlen($latin);
        for ($i = 0; $i < $n; $i++) {
            $w += ($cw[$latin[$i]] ?? 556);
        }
        return $w * $this->fontSize / 1000; // en puntos
    }

    public function getStringWidthMm(string $txt): float
    {
        return $this->getStringWidth($txt) / $this->k;
    }

    public function cell(float $w, float $h, string $txt = '', int $borde = 0, int $ln = 0, string $alinear = 'L', bool $rellenar = false): void
    {
        $k = $this->k;
        $x = $this->x;
        $y = $this->y;
        if ($rellenar || $borde) {
            $this->_fillRect($x, $y, $w, $h, $borde, $rellenar);
        }
        if ($txt !== '') {
            $s = $this->getStringWidth($txt) / $k;
            $m = $this->cMargin;
            $dx = $alinear === 'R' ? ($w - $s - $m) : ($alinear === 'C' ? (($w - $s) / 2) : $m);
            $baseline = $y + $h / 2 + $this->fontSize / $k / 10;
            $this->_out(sprintf(
                'BT %s rg %.3F %.3F Td /F%d %.2F Tf (%s) Tj ET',
                $this->textColor, ($x + $dx) * $k, ($this->h - $baseline) * $k, $this->_fontIndex(), $this->fontSize, $this->_escape($txt)
            ));
        }
        if ($ln > 0) {
            $this->x = $this->lMargin;
            $this->y = $y + $h;
        } else {
            $this->x = $x + $w;
        }
    }

    public function multiCell(float $w, float $h, string $txt = '', int $borde = 0, string $alinear = 'L', bool $rellenar = false): void
    {
        $cw = self::CW_HELVETICA;
        $k = $this->k;
        $wMax = ($w - 2 * $this->cMargin) * $k; // ancho útil en puntos
        $txt = str_replace(["\r", "\t"], ['', ' '], $txt);
        if (trim($txt) === '') {
            if ($borde) {
                $this->_fillRect($this->x, $this->y, $w, $h, $borde, $rellenar);
            }
            $this->y += $h;
            return;
        }
        $lineas = preg_split('/\n/', $txt) ?: [$txt];
        foreach ($lineas as $linea) {
            $words = preg_split('/\s+/', trim($linea)) ?: [];
            $current = '';
            foreach ($words as $word) {
                $test = $current === '' ? $word : $current . ' ' . $word;
                $latin = $this->_latin($test);
                $wStr = 0;
                $n = strlen($latin);
                for ($i = 0; $i < $n; $i++) {
                    $wStr += ($cw[$latin[$i]] ?? 556);
                }
                $wStr = $wStr * $this->fontSize / 1000;
                if ($wStr > $wMax && $current !== '') {
                    $this->_cellLine($w, $h, $current, $borde, $alinear, $rellenar);
                    $current = $word;
                    if ($this->y + $h > $this->pageBottom()) {
                        $this->addPage();
                    }
                } else {
                    $current = $test;
                }
            }
            if ($current !== '') {
                $this->_cellLine($w, $h, $current, $borde, $alinear, $rellenar);
            } else {
                $this->y += $h;
            }
        }
    }

    private function _cellLine(float $w, float $h, string $txt, int $borde, string $alinear, bool $rellenar): void
    {
        $k = $this->k;
        $x = $this->x;
        $y = $this->y;
        if ($rellenar || $borde) {
            $this->_fillRect($x, $y, $w, $h, $borde, $rellenar);
        }
        $s = $this->getStringWidth($txt) / $k;
        $m = $this->cMargin;
        $dx = $alinear === 'R' ? ($w - $s - $m) : ($alinear === 'C' ? (($w - $s) / 2) : $m);
        $baseline = $y + $h / 2 + $this->fontSize / $k / 10;
        $this->_out(sprintf(
            'BT %s rg %.3F %.3F Td /F%d %.2F Tf (%s) Tj ET',
            $this->textColor, ($x + $dx) * $k, ($this->h - $baseline) * $k, $this->_fontIndex(), $this->fontSize, $this->_escape($txt)
        ));
        $this->y = $y + $h;
        $this->x = $x;
    }

    public function line(float $x1, float $y1, float $x2, float $y2): void
    {
        $k = $this->k;
        $this->_out(sprintf(
            '%.3F w %.3F %.3F m %.3F %.3F l S',
            $this->lineWidth, $x1 * $k, ($this->h - $y1) * $k, $x2 * $k, ($this->h - $y2) * $k
        ));
    }

    private function _fillRect(float $x, float $y, float $w, float $h, int $borde, bool $rellenar): void
    {
        $k = $this->k;
        $xx = $x * $k;
        $yy = ($this->h - $y) * $k;
        $ww = $w * $k;
        $hh = $h * $k;
        $ops = [];
        if ($rellenar && $this->fillColor !== false) {
            $ops[] = $this->fillColor . ' rg';
            $ops[] = sprintf('%.3F %.3F %.3F %.3F re f', $xx, $yy - $hh, $ww, $hh);
        }
        if ($borde === 1 || $borde === 2 || $borde === 'B') {
            $ops[] = sprintf('%.3F w', $this->lineWidth);
            $ops[] = $this->drawColor . ' RG';
            $ops[] = sprintf('%.3F %.3F %.3F %.3F re S', $xx, $yy - $hh, $ww, $hh);
        }
        if ($ops) {
            $this->_out(implode("\n", $ops));
        }
    }

    private function _n(int $i): string
    {
        return $i . ' 0 obj';
    }

    public function output(): string
    {
        $buffer = "%PDF-1.4\n";
        $offsets = [];
        $offsets[1] = strlen($buffer);

        // 1: Catalog
        $buffer .= $this->_n(1) . "\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";

        // 2: Pages
        $offsets[2] = strlen($buffer);
        $pageObjStart = 3 + count(self::CORE_FONTS); // 3..6 fuentes, páginas desde 7
        $kids = [];
        $numPages = count($this->pages);
        for ($i = 0; $i < $numPages; $i++) {
            $kids[] = ($pageObjStart + $i * 2) . ' 0 R';
        }
        $buffer .= $this->_n(2) . "\n<< /Type /Pages /Kids [ " . implode(' ', $kids) . " ] /Count $numPages >>\nendobj\n";

        // 3..6: fuentes base (objeto = 2 + índice de recurso F1..F4)
        foreach (self::CORE_FONTS as $idx => $name) {
            $obj = 2 + $idx;
            $offsets[$obj] = strlen($buffer);
            $buffer .= $this->_n($obj) . "\n<< /Type /Font /Subtype /Type1 /BaseFont /$name /Encoding /WinAnsiEncoding >>\nendobj\n";
        }

        // Páginas + streams de contenido
        $idObjeto = $pageObjStart;
        foreach ($this->pages as $contenido) {
            $offsets[$idObjeto] = strlen($buffer);
            $buffer .= $this->_n($idObjeto) . "\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " .
                $this->wPt . ' ' . $this->hPt . "] /Contents " . ($idObjeto + 1) . " 0 R " .
                "/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R /F4 6 0 R >> >> >>\nendobj\n";

            $comp = gzcompress($contenido);
            $offsets[$idObjeto + 1] = strlen($buffer);
            $buffer .= $this->_n($idObjeto + 1) . "\n<< /Length " . strlen($comp) . " /Filter /FlateDecode >>\nstream\n";
            $buffer .= $comp . "\nendstream\nendobj\n";
            $idObjeto += 2;
        }

        // XRef
        $totalObjetos = $idObjeto - 1;
        $xrefOffset = strlen($buffer);
        $buffer .= "xref\n0 " . ($totalObjetos + 1) . "\n0000000000 65535 f \n";
        for ($i = 1; $i <= $totalObjetos; $i++) {
            $buffer .= sprintf('%010d 00000 n ' . "\n", $offsets[$i]);
        }
        $buffer .= "trailer\n<< /Size " . ($totalObjetos + 1) . " /Root 1 0 R >>\nstartxref\n$xrefOffset\n%%EOF";
        return $buffer;
    }
}
