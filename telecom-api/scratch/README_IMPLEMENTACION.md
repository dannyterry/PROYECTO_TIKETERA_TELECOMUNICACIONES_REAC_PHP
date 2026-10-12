# GUÍA DE IMPLEMENTACIÓN - SCRAPER Y OCR DE FOTOS FÉNIX (WIN)

Este paquete contiene todo lo necesario para scrapear tareas, descargar fotografías en HD y extraer textos/números de serie (SN).

---

## 📁 ARCHIVOS PRINCIPALES

1. **`scraper_tareas_fotos.py`**
   - **Función**: Se conecta a Fénix (WIN), busca la visita (`OrdeVisiId`), lista todas las tareas con su estado (Pendiente / Finalizada), y descarga todas las fotos en alta resolución (HD).
   - **Uso**:
     ```bash
     python scraper_tareas_fotos.py <NUMERO_ORDEN>
     # Ejemplo:
     python scraper_tareas_fotos.py 3506648
     ```
   - **Resultado**: Crea la carpeta `descargas_fotos/orden_<NUMERO_ORDEN>/` con cada foto nombrada con el índice y título de la tarea (ej. `t12__SERIES_DE_EQUIPOS_foto1_...jpg`).

2. **`ocr_extraer_texto.py`**
   - **Función**: Procesa todas las fotos de una orden usando el motor `RapidOCR (ONNX)` y extrae todo el texto visible (actas, bot de WhatsApp, marcas de agua, geolocalización, etc.) a un Bloc de Notas.
   - **Uso**:
     ```bash
     python ocr_extraer_texto.py "D:\scraper\descargas_fotos\orden_3506648"
     ```
   - **Resultado**: Genera el archivo `informacion_fotos_extraida.txt` dentro de la carpeta de la orden.

3. **`extraer_series_ont.py`**
   - **Función**: Especializado en buscar y extraer los números de serie (`SN: 4857...`) de las fotos de:
     - Tarea 7: *FOTO DEL ONT ENCONTRADA* (ONT Retirada).
     - Tarea 12: *SERIES DE EQUIPOS* (Foto 1: Retirada / Foto 2: Instalada).
   - **Uso**:
     ```bash
     python extraer_series_ont.py 3506648
     ```
   - **Resultado**: Genera `series_detectadas_ont.txt` con los valores listos para autocompletar la liquidación.

4. **`requirements.txt`**
   - Librerías de Python requeridas:
     ```bash
     pip install -r requirements.txt
     ```
     Contiene: `requests`, `beautifulsoup4`, `pillow`, `rapidocr-onnxruntime`.

---

## 🚀 INTEGRACIÓN CON LA TICKETERA / EXPRESS EL LUNES

Para integrarlo con `telecom-api` (Express / Node.js) hay dos caminos sencillos:
1. **Llamada directa desde Node.js (Child Process)**:
   ```javascript
   const { execFile } = require('child_process');
   execFile('python', ['extraer_series_ont.py', numeroOrden], (err, stdout) => {
     // Recibir las series en JSON y autocompletar los campos de la orden
   });
   ```
2. **Microservicio local FastApi / Flask**:
   Un endpoint ligero en Python `GET /api/orden/:numero/series` que devuelva:
   ```json
   {
     "sn_retirado": "485754431026D8AC",
     "sn_instalado": "48575443DF9350B8"
   }
   ```
