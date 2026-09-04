# 📋 PROPUESTA DE IMPLEMENTACIÓN: MÓDULO DE ASISTENCIA Y DESCANSOS (RRHH)

**Proyecto:** Telecomunicaciones Céspedes  
**Módulo:** Recursos Humanos (Personal)  
**Fecha:** Septiembre 2026  
**Estado:** Planificado para Desarrollo  

---

## 🎯 1. Objetivo General
Implementar un sistema ágil e interactivo de **Control de Asistencia y Programación de Descansos** dentro del módulo de **Personal (RRHH)**, permitiendo al encargado de Recursos Humanos registrar de forma rápida y manual las asistencias y horas de entrada que los técnicos reportan diariamente vía WhatsApp, visualizar el historial en una matriz semanal/mensual y gestionar los descansos programados con impacto directo en el Portal del Técnico.

---

## 🧭 2. Ubicación en la Plataforma

En la barra lateral izquierda del módulo de **Personal (`#personal`)**, se habilitará una tercera sección:

- 👥 **Directorio**
- 📄 **Ficha de Personal**
- ⏱️ **Control de Asistencia** *(Nueva Pestaña Exclusiva)*

---

## 🖥️ 3. Pestañas y Componentes del Módulo

### 📋 Pestaña 1: Pase de Asistencia Diario (Check Rápido)
Diseñado para la operación del día a día del encargado de RRHH (revisión de WhatsApp en paralelo):

1. **Filtros de Cabecera:**
   - **Selector de Fecha:** Por defecto carga **"Hoy"**, con opción de cambiar a días pasados si se olvidó marcar algún registro.
   - **Filtro por Rol:** Viene preseleccionado en **"Técnicos"**, pero permite alternar a otros roles (Supervisores, Choferes, Almaceneros, Administración).
   - **Buscador rápido:** Por nombre o cuadrilla.
   - **Resumen del Día:** Tarjetas con conteo en tiempo real:
     - `Presentes: X` | `Tardanzas: X` | `Faltas: X` | `Descansos: X` | `Permisos: X`.

2. **Tabla Interactiva de Técnicos:**
   - **Avatar / Nombre completo del Técnico.**
   - **Cuadrilla y Placa asignada.**
   - **Botones rápidos de Estado (1-Clic):**
     - 🟢 **Asistió** (Marca asistencia normal).
     - 🟡 **Tardanza** (Calcula minutos de tardanza contra la hora pactada).
     - 🔴 **Falta** (Inasistencia sin justificar).
     - 🔵 **Descanso** (Se auto-selecciona en azul si tiene descanso programado para ese día).
     - 🟣 **Permiso / Justificado** (Salud, citas o trámites autorizados).
   - **Hora de Entrada:**
     - Campo editable rápido (ej: `07:30`, `07:45`, etc.).
     - Al presionar "Asistió", autollena por defecto con la hora de ingreso pactada (ej. `07:30 AM`), y el encargado puede modificarla con un clic o teclado para reflejar la hora exacta del WhatsApp.
   - **Observación rápida:** Input de texto corto (ej: *"Avisó por WhatsApp tráfico en Javier Prado"*).
   - **Guardado:** Guardado automático por fila (auto-save al cambiar estado/hora) con feedback visual (icono de check verde).

---

### 📅 Pestaña 2: Calendario / Matriz Semanal y Mensual (Auditoría Visual)
Para supervisión, reportes y revisión histórica:

1. **Selector de Rango:**
   - Selector por **Semana** (Lunes a Domingo) o por **Mes completo**.
2. **Matriz Gráfica:**
   - **Filas:** Lista de todos los técnicos.
   - **Columnas:** Cada uno de los días del periodo (ej. Lun 01, Mar 02, ..., Dom 07).
   - **Celdas con Código de Colores:**
     - 🟢 **Presente** (Muestra hora de entrada en pequeño o tooltip al pasar el cursor).
     - 🔵 **Descanso Programado**.
     - 🟡 **Tardanza** (Muestra minutos tarde ej: `+15m`).
     - 🔴 **Falta**.
     - 🟣 **Permiso**.
3. **Edición Directa:**
   - Si RRHH necesita corregir la asistencia de un día anterior, puede hacer clic directamente en la celda y cambiar el estado o la hora sin salir de la vista.
4. **Exportación:**
   - Botón **"Exportar Asistencia a Excel (.xlsx)"** con formato para planillas y cálculo de horas/días laborados.

---

### 🛠️ Pestaña 3: Mantenimiento y Programación de Descansos
Gestión de los roles y descansos de cada colaborador:

1. **Configuración de Descanso Semanal:**
   - Selector para cada técnico de su día de descanso fijo o rotativo:
     - Domingo (estándar), Lunes, Martes, Miércoles, Jueves, Viernes o Sábado.
   - Posibilidad de programar descansos especiales por fechas específicas.
2. **Regla de Negocio e Impacto en el Portal Técnico:**
   - Cuando el técnico inicia sesión en el **Portal Técnico (`#portal-tecnico`)**:
     - El sistema valida si la fecha actual coincide con su **Día de Descanso Programado**.
     - **Si está de descanso:**
       - Muestra un banner amigable: *"📅 Hoy es tu día de descanso programado. Que tengas un buen descanso."*
       - Se restringen las acciones de tomar órdenes activas o despachos en ese día para evitar cruces operativos o accidentes no cubiertos.
       - En el panel de órdenes se informa al despachador que el técnico está en día libre.

---

## 🗄️ 4. Estructura de Base de Datos (MySQL)

### A. Tabla Existente: `asistencias`
Aprovechamos la tabla ya creada en la base de datos `corporacioncespe_cespedes`:

```sql
-- Estructura actual existente:
-- id_asistencia (INT PK AUTO_INCREMENT)
-- id_trabajador (INT NOT NULL)
-- fecha (DATE NOT NULL)
-- hora_entrada (TIME NOT NULL)
-- hora_salida (TIME)
-- estado (ENUM)
-- minutos_tarde (INT)
-- tipo (ENUM 'Manual', 'Automatico')
-- observacion (VARCHAR 250)
-- UNIQUE KEY (id_trabajador, fecha)
```

**Ajuste requerido en `asistencias`:**
Ampliar los valores del ENUM `estado` para incluir los nuevos estados:
```sql
ALTER TABLE asistencias 
MODIFY COLUMN estado ENUM('Asistio', 'Tardanza', 'Falta', 'Descanso', 'Permiso') NOT NULL DEFAULT 'Asistio';
```

### B. Tabla de Programación de Descansos: `trabajador_descansos`
```sql
CREATE TABLE IF NOT EXISTS `trabajador_descansos` (
  `id_descanso` INT AUTO_INCREMENT PRIMARY KEY,
  `id_trabajador` INT NOT NULL,
  `dia_semana` ENUM('Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo') NOT NULL DEFAULT 'Domingo',
  `tipo_descanso` ENUM('Fijo', 'Rotativo') NOT NULL DEFAULT 'Fijo',
  `fecha_especifica` DATE DEFAULT NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `actualizado_en` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`id_trabajador`) REFERENCES `trabajadores`(`id_trabajador`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 🔌 5. Endpoints Backend a Implementar (`server.js`)

1. `GET /api/rrhh/asistencias/diaria?fecha=YYYY-MM-DD&rol=Tecnico`  
   *(Obtiene la lista completa de técnicos con su estado de asistencia de esa fecha).*

2. `POST /api/rrhh/asistencias/guardar`  
   *(Inserta o actualiza con `ON DUPLICATE KEY UPDATE` la asistencia, hora de entrada y observación de un técnico).*

3. `GET /api/rrhh/asistencias/matriz?desde=YYYY-MM-DD&hasta=YYYY-MM-DD`  
   *(Obtiene todos los registros en el rango de fechas para armar la matriz semanal/mensual).*

4. `GET /api/rrhh/descansos` & `POST /api/rrhh/descansos/guardar`  
   *(Consulta y guarda la configuración de días de descanso semanal).*

---

## 🚀 6. Siguientes Pasos (Para Mañana)
1. Revisar y confirmar si deseas agregar algún campo adicional (ej. hora de salida o cálculo de refrigerio).
2. Ejecutar la pequeña ampliación del ENUM en la tabla `asistencias` y crear `trabajador_descansos`.
3. Desarrollar los endpoints en `server.js`.
4. Crear el componente React `AttendanceManagementTab.tsx` e integrarlo en la navegación de Personal en `App.tsx`.
5. Validar la restricción amigable en el Portal Técnico en día de descanso.
