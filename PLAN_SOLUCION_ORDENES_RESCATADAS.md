# 📋 PLAN DE ACCIÓN Y SOLUCIÓN DEFINITIVA: ÓRDENES RESCATADAS / REGESTIONADAS (FÉNIX)

**Fecha:** 14/10/2026  
**Objetivo:** Evitar que una orden que fue cancelada en la mañana y rescatada/finalizada con éxito en la tarde quede bloqueada en estado "Cancelada" o "Observada".

---

## 🔍 1. DIAGNÓSTICO DEL PROBLEMA

### ¿Por qué ocurrió hoy con la orden #3519587?
1. **Fénix (WIN) no borra el texto de cancelación de la mañana:**
   Cuando una orden es cancelada (ej. `CLIENTE AUSENTE EN CAMPO`) y horas más tarde es rescatada por coordinación mediante una `Regestión` y completada por el técnico, Fénix actualiza el estado a `Finalizada` y agrega el `motivo_finalizacion`, pero **mantiene el texto anterior en la columna de cancelación**.

2. **La regla de seguridad en `fenixScraper.js`:**
   En las líneas 770-788 de `fenixScraper.js`, existe una validación para evitar pagar órdenes falsas:
   ```javascript
   if (esFinLiq) {
     if (/CANCELAD|NO REALIZAD|OBSERVAD/i.test(motivoFinUpper) || /CANCELAD/i.test(motivoCancUpper)) {
       autoEstado = 'Observada'; // Bloquea el pase a Finalizada si ve texto de cancelación
     }
   }
   ```
   Al ver que `motivo_cancelacion` contenía `"CLIENTE NO RESPONDE - 1ER AUSENTE"`, el sistema priorizó el texto antiguo de cancelación sobre el estado final real de la orden.

---

## 🛠️ 2. LO QUE VAMOS A HACER MAÑANA (PASO A PASO)

### PASO 1: Ajustar la regla en `telecom-api/services/fenixScraper.js`

Ubicación del archivo:
📂 `telecom-api/services/fenixScraper.js` (alrededor de la línea **770**)

#### Modificación requerida:
Si la orden viene en Fénix con estado **Finalizada/Liquidada** y además cuenta con un **motivo de finalización válido** (o un motivo de regestión/rescate posterior), el motivo de cancelación obsoleto debe limpiarse y no debe bloquear la orden.

```javascript
// =========================================================================
// AUTO-CLASIFICACIÓN INTELIGENTE DE ESTADOS (CON SOPORTE A RESCATES)
// =========================================================================
let autoEstado = o.estado || 'Agendada';
const motivoFinUpper = String(o.motivo_finalizacion || '').toUpperCase();
const motivoCancUpper = String(o.motivo_cancelacion || '').toUpperCase();
const motivoAnulUpper = String(o.motivo_anulacion || '').toUpperCase();
const esRescateValido = Boolean(
  o.motivo_regestion && 
  /RESCATE|REASIGNA/i.test(String(o.motivo_regestion)) && 
  o.motivo_finalizacion
);

if (esFinLiq) {
  // Si fue un rescate exitoso con motivo de finalización real, limpiamos el residuo de cancelación anterior
  if (esRescateValido || (motivoFinUpper && !/CANCELAD|NO REALIZAD|OBSERVAD/i.test(motivoFinUpper) && !/CLIENTE NO RESPONDE|REPROGRAMACION/i.test(motivoFinUpper))) {
    autoEstado = o.estado;
    o.motivo_cancelacion = null; // Limpiar cancelación obsoleta de la mañana
  } else if (/CANCELAD|NO REALIZAD|OBSERVAD/i.test(motivoFinUpper) || /CANCELAD/i.test(motivoCancUpper)) {
    autoEstado = 'Observada';
  } else if (/ANULAD/i.test(motivoFinUpper) || /ANULAD/i.test(motivoAnulUpper)) {
    autoEstado = 'Anulada';
  } else if (techInfo?.isExternal || (o.usuario_ejecutor_fenix && !autoIdTecnico)) {
    autoEstado = 'Finalizada Externa';
  } else {
    autoEstado = o.estado;
  }
}
```

---

### PASO 2: Ajustar la ventana de fechas por defecto del Scraper

Ubicación del archivo:
📂 `telecom-api/services/fenixScraper.js` (en la función `cargarGrillaWin`, línea **314**)

#### Modificación requerida:
Para que órdenes agendadas en la tarde/noche para la siguiente franja o con rescate no se queden sin descargar:
* Si la sincronización se lanza después de las **17:00 (5:00 PM)**, consultar automáticamente la jornada de **Hoy** y la del **Día siguiente** si no se especificaron fechas manuales.

---

### PASO 3: Probar la solución en Local

Antes de subir nada a producción:
1. Ejecutar el script de prueba con la orden #3519587 en local:
   ```bash
   node telecom-api/scratch/check_fenix_live.js
   ```
2. Validar que la orden se sincronice directamente como **`Finalizada`** o **`Liquidada`** sin caer en `Cancelada`.

---

### PASO 4: Empaquetar y Desplegar a Producción (cPanel)

Una vez probado y aprobado en local:
1. Ejecutar en la terminal el empaquetador automático:
   ```bash
   node package_production.js
   ```
2. Esto generará el archivo:
   📦 `d:\proyectofinal\SOLO_CAMBIOS_BACKEND.zip` (que contiene únicamente `server.js` y `fenixScraper.js` actualizados).
3. Entrar a cPanel -> Administrador de Archivos -> Carpeta de la API.
4. Subir el ZIP y darle **Extraer**.
5. Reiniciar la aplicación Node.js en cPanel.

---

## 📌 RESUMEN DE BENEFICIOS TRAS EL CAMBIO
* ✅ **Cero intervención manual:** Si una orden es cancelada y luego rescatada por coordinación, el sistema la finalizará y liquidará automáticamente al terminar las tareas.
* ✅ **Mantiene la seguridad de auditoría:** Si una orden fue cancelada y NUNCA fue rescatada ni finalizada, seguirá marcándose como cancelada para no pagarle indebidamente al técnico.
* ✅ **Sincronización robusta:** No habrá órdenes "invisibles" por cambios de horario en Fénix.
