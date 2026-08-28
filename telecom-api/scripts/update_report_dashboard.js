const fs = require('fs');

const reportViewPath = 'C:\\xampp\\htdocs\\corporacionescepe\\app\\views\\report\\index.php';
const reportJsPath = 'C:\\xampp\\htdocs\\corporacionescepe\\public\\assets\\js\\function_reportes.js';

// 1. Actualizar Vista PHP del Reporte / Dashboard
let reportViewContent = fs.readFileSync(reportViewPath, 'utf8');

const auditSectionsHtml = `
<!-- 🛡️ NUEVO: Monitor de Usuarios en Línea y Rendimiento de Gestores 🛡️ -->
<div class="row g-3 mb-4">
    <!-- 1. Gestores y Personal Conectado en Vivo -->
    <div class="col-xl-5">
        <div class="card shadow-sm h-100 border-0">
            <div class="card-header bg-white py-2 d-flex justify-content-between align-items-center border-bottom">
                <span class="fw-bold text-dark"><i class="mdi mdi-account-circle-outline text-success me-1"></i> Personal y Gestores en Línea</span>
                <span class="badge bg-success-subtle text-success border border-success-subtle px-2 py-1" id="badge_total_online">🟢 0 en línea</span>
            </div>
            <div class="card-body p-0">
                <div class="table-responsive" style="max-height: 280px; overflow-y: auto;">
                    <table class="table table-sm table-hover align-middle mb-0">
                        <thead class="table-light">
                            <tr>
                                <th class="ps-3">Usuario / Gestor</th>
                                <th>Área / Rol</th>
                                <th class="text-center">Estado</th>
                                <th>Última Acción</th>
                            </tr>
                        </thead>
                        <tbody id="tbody_usuarios_online">
                            <tr><td colspan="4" class="text-center py-3 text-muted small"><i class="mdi mdi-loading mdi-spin me-1"></i> Cargando usuarios...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

    <!-- 2. Productividad Diaria por Gestor -->
    <div class="col-xl-7">
        <div class="card shadow-sm h-100 border-0">
            <div class="card-header bg-white py-2 d-flex justify-content-between align-items-center border-bottom">
                <span class="fw-bold text-dark"><i class="mdi mdi-chart-timeline-variant text-primary me-1"></i> Productividad de Gestores (Hoy)</span>
                <span class="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1">Llamadas y Asignaciones</span>
            </div>
            <div class="card-body p-0">
                <div class="table-responsive" style="max-height: 280px; overflow-y: auto;">
                    <table class="table table-sm table-hover align-middle mb-0">
                        <thead class="table-light">
                            <tr>
                                <th class="ps-3">Gestor</th>
                                <th class="text-center">Llamadas Inconcert</th>
                                <th class="text-center">Técnicos Asignados</th>
                                <th class="text-center">Total Acciones</th>
                                <th>Última Actividad</th>
                            </tr>
                        </thead>
                        <tbody id="tbody_metricas_gestores">
                            <tr><td colspan="5" class="text-center py-3 text-muted small"><i class="mdi mdi-loading mdi-spin me-1"></i> Cargando métricas...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- 🛡️ NUEVO: Registro de Auditoría y Trazabilidad en Tiempo Real (24/7) 🛡️ -->
<div class="row g-3 mb-4">
    <div class="col-12">
        <div class="card shadow-sm border-0">
            <div class="card-header bg-white py-2 d-flex justify-content-between align-items-center border-bottom">
                <span class="fw-bold text-dark"><i class="mdi mdi-shield-check-outline text-primary me-1"></i> Historial de Auditoría y Modificaciones en Vivo (Trazabilidad 24/7)</span>
                <div class="d-flex align-items-center gap-2">
                    <select id="sel_filtro_modulo_audit" class="form-select form-select-sm" style="width: 150px;">
                        <option value="Todos">📁 Todos los Módulos</option>
                        <option value="ORDENES">📋 Órdenes</option>
                        <option value="ALMACEN">📦 Almacén</option>
                        <option value="RRHH">👥 RR.HH.</option>
                    </select>
                    <button class="btn btn-sm btn-outline-secondary" id="btn_recargar_audit" title="Refrescar auditoría">
                        <i class="mdi mdi-refresh"></i>
                    </button>
                </div>
            </div>
            <div class="card-body p-0">
                <div class="table-responsive" style="max-height: 320px; overflow-y: auto;">
                    <table class="table table-sm table-hover align-middle mb-0">
                        <thead class="table-dark sticky-top">
                            <tr>
                                <th class="ps-3" style="width: 140px;">Hora / Fecha</th>
                                <th>Usuario / Gestor</th>
                                <th>Área</th>
                                <th>Módulo</th>
                                <th>Acción</th>
                                <th>Detalle del Cambio</th>
                            </tr>
                        </thead>
                        <tbody id="tbody_auditoria_logs">
                            <tr><td colspan="6" class="text-center py-3 text-muted small"><i class="mdi mdi-loading mdi-spin me-1"></i> Cargando historial de auditoría...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
</div>
`;

if (!reportViewContent.includes('tbody_usuarios_online')) {
  const targetIdx = reportViewContent.indexOf('<div class="row g-3 mb-4">');
  const secondRowIdx = reportViewContent.indexOf('<div class="row g-3 mb-4">', targetIdx + 30);
  if (secondRowIdx !== -1) {
    reportViewContent = reportViewContent.slice(0, secondRowIdx) + auditSectionsHtml + '\n' + reportViewContent.slice(secondRowIdx);
  }
  fs.writeFileSync(reportViewPath, reportViewContent, 'utf8');
  console.log('✅ Vista PHP de Reportes/Dashboard actualizada.');
}

// 2. Actualizar function_reportes.js
let reportJsContent = fs.readFileSync(reportJsPath, 'utf8');

if (!reportJsContent.includes('cargarUsuariosOnline')) {
  reportJsContent = reportJsContent.replace('function cargarTodo() {', 'function cargarTodo() {\n        cargarUsuariosOnline();\n        cargarMetricasGestores();\n        cargarAuditoriaLogs();');
  
  const jsToAppend = `
    // 🛡️ MÓDULO DE AUDITORÍA, USUARIOS EN LÍNEA Y PRODUCTIVIDAD
    const AUDIT_API = "http://localhost:3000/api/auditoria/";

    function cargarUsuariosOnline() {
        fetch(AUDIT_API + "usuarios-online")
            .then(function(r) { return r.json(); })
            .then(function(users) {
                var onlineCount = 0;
                var html = '';

                (users || []).forEach(function(u) {
                    var isOnline = u.esta_online === 1;
                    if (isOnline) onlineCount++;

                    var badgeOnline = isOnline 
                        ? '<span class="badge bg-success-subtle text-success border border-success-subtle px-2 py-0.5"><span class="spinner-grow spinner-grow-sm text-success me-1" style="width: 7px; height: 7px;"></span>Online</span>'
                        : '<span class="badge bg-light text-muted border px-2 py-0.5">⚪ Offline</span>';

                    var roleBadge = '<span class="badge bg-primary-subtle text-primary border border-primary-subtle px-1.5 py-0.5">' + (u.rol_nombre || u.area || 'Personal') + '</span>';

                    html += '<tr>' +
                        '<td class="ps-3 fw-bold text-dark">' + (u.nombre_completo || 'Usuario') + '</td>' +
                        '<td>' + roleBadge + '</td>' +
                        '<td class="text-center">' + badgeOnline + '</td>' +
                        '<td class="small text-muted text-truncate" style="max-width: 180px;" title="' + (u.ultima_accion || '') + '">' + (u.ultima_accion || 'Sin actividad reciente') + '</td>' +
                    '</tr>';
                });

                var tbody = document.getElementById("tbody_usuarios_online");
                if (tbody) tbody.innerHTML = html || '<tr><td colspan="4" class="text-center py-3 text-muted small">No hay personal registrado</td></tr>';

                var badgeTotal = document.getElementById("badge_total_online");
                if (badgeTotal) badgeTotal.innerHTML = '🟢 ' + onlineCount + ' en línea';
            })
            .catch(function(e) { console.warn("Aviso al cargar usuarios online:", e); });
    }

    function cargarMetricasGestores() {
        var fechaHoy = new Date().toISOString().split('T')[0];
        fetch(AUDIT_API + "metricas-gestores?fecha=" + fechaHoy)
            .then(function(r) { return r.json(); })
            .then(function(rows) {
                var html = '';
                (rows || []).forEach(function(m) {
                    html += '<tr>' +
                        '<td class="ps-3 fw-bold text-dark">' + m.usuario_nombre + '</td>' +
                        '<td class="text-center"><span class="badge bg-info-subtle text-info border px-2 py-1">' + (m.llamadas_gestionadas || 0) + '</span></td>' +
                        '<td class="text-center"><span class="badge bg-success-subtle text-success border px-2 py-1">' + (m.ordenes_asignadas || 0) + '</span></td>' +
                        '<td class="text-center fw-bold text-primary">' + (m.total_acciones || 0) + '</td>' +
                        '<td class="small text-muted">' + (m.ultima_actividad ? m.ultima_actividad.split('T')[1]?.substring(0,5) || m.ultima_actividad : '-') + '</td>' +
                    '</tr>';
                });

                var tbody = document.getElementById("tbody_metricas_gestores");
                if (tbody) tbody.innerHTML = html || '<tr><td colspan="5" class="text-center py-3 text-muted small">Sin actividad de gestores registrada hoy</td></tr>';
            })
            .catch(function(e) { console.warn("Aviso al cargar métricas de gestores:", e); });
    }

    function cargarAuditoriaLogs() {
        var modulo = document.getElementById("sel_filtro_modulo_audit")?.value || 'Todos';
        fetch(AUDIT_API + "logs?limite=40&modulo=" + modulo)
            .then(function(r) { return r.json(); })
            .then(function(logs) {
                var html = '';
                (logs || []).forEach(function(l) {
                    var horaStr = l.fecha_creacion ? (l.fecha_creacion.split('T')[1]?.substring(0,8) || l.fecha_creacion.split(' ')[1] || l.fecha_creacion) : '-';
                    var modBadge = '<span class="badge bg-dark-subtle text-dark border px-1.5 py-0.5">' + l.modulo + '</span>';
                    html += '<tr>' +
                        '<td class="ps-3 font-monospace small text-muted">' + horaStr + '</td>' +
                        '<td class="fw-bold text-dark small">' + (l.usuario_nombre || 'Sistema') + '</td>' +
                        '<td class="small text-muted">' + (l.area || '-') + '</td>' +
                        '<td>' + modBadge + '</td>' +
                        '<td><span class="badge bg-secondary-subtle text-secondary px-1.5 py-0.5">' + l.accion + '</span></td>' +
                        '<td class="small text-dark">' + l.descripcion + '</td>' +
                    '</tr>';
                });

                var tbody = document.getElementById("tbody_auditoria_logs");
                if (tbody) tbody.innerHTML = html || '<tr><td colspan="6" class="text-center py-3 text-muted small">Sin registros de auditoría</td></tr>';
            })
            .catch(function(e) { console.warn("Aviso al cargar auditoría logs:", e); });
    }

    document.getElementById("btn_recargar_audit")?.addEventListener("click", cargarAuditoriaLogs);
    document.getElementById("sel_filtro_modulo_audit")?.addEventListener("change", cargarAuditoriaLogs);

    // Polling en vivo cada 15 segundos para monitor online y logs
    setInterval(cargarUsuariosOnline, 15000);
    setInterval(cargarMetricasGestores, 30000);
`;

  reportJsContent = reportJsContent.replace(/\}\);\s*$/, jsToAppend + '\n});');
  fs.writeFileSync(reportJsPath, reportJsContent, 'utf8');
  console.log('✅ function_reportes.js actualizado con funciones de auditoría.');
}
