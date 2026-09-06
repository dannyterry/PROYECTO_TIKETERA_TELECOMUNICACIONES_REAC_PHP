// app/public/assets/js/function_reportes.js — REEMPLAZAR COMPLETO

$(document).ready(function () {
    "use strict";

    const BASE = base_url + "reportes/";

    // ── Estado global del filtro ──────────────────────────────────────────
    let anio = document.getElementById("sel_anio")?.value || new Date().getFullYear();
    let desde = null;
    let hasta = null;

    // ── Calcular rango según período seleccionado ─────────────────────────
    function calcularRango(periodo) {
        const hoy = new Date();
        const fmt = d => d.toISOString().split('T')[0];

        switch (periodo) {
            case 'hoy':
                return { desde: fmt(hoy), hasta: fmt(hoy) };

            case 'semana': {
                const lunes = new Date(hoy);
                lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
                const domingo = new Date(lunes);
                domingo.setDate(lunes.getDate() + 6);
                return { desde: fmt(lunes), hasta: fmt(domingo) };
            }

            case 'mes': {
                const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
                const ultimo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
                return { desde: fmt(primero), hasta: fmt(ultimo) };
            }

            case 'anio': {
                const ini = new Date(hoy.getFullYear(), 0, 1);
                const fin = new Date(hoy.getFullYear(), 11, 31);
                return { desde: fmt(ini), hasta: fmt(fin) };
            }

            case 'personalizado': {
                const d = document.getElementById('inp_desde').value;
                const h = document.getElementById('inp_hasta').value;
                return { desde: d || null, hasta: h || null };
            }

            default:
                return { desde: null, hasta: null };
        }
    }

    // ── Texto descriptivo del rango activo ────────────────────────────────
    function textoRango(periodo, d, h) {
        const labels = { hoy: 'Hoy', semana: 'Esta semana', mes: 'Este mes', anio: 'Este año' };
        if (periodo === 'personalizado') {
            return (d && h) ? `${d} → ${h}` : (d ? `Desde ${d}` : (h ? `Hasta ${h}` : ''));
        }
        const base = labels[periodo] || '';
        return d && h ? `${base}: ${d} → ${h}` : base;
    }

    // ── Construir query string con filtros ────────────────────────────────
    function qs(extras = '') {
        let params = `anio=${anio}`;
        if (desde) params += `&desde=${desde}`;
        if (hasta) params += `&hasta=${hasta}`;
        if (extras) params += `&${extras}`;
        return '?' + params;
    }

    // ── Aplicar período al hacer clic en botones rápidos ─────────────────
    let periodoActual = 'mes';

    document.querySelectorAll('.periodo-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.periodo-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            periodoActual = this.dataset.periodo;

            const wrap = document.getElementById('wrap_personalizado');
            if (periodoActual === 'personalizado') {
                wrap.style.display = 'flex';
            } else {
                wrap.style.display = 'none';
                aplicarYCargar();
            }
        });
    });

    // Aplicar rango y actualizar labels
    function aplicarYCargar() {
        const rango = calcularRango(periodoActual);
        desde = rango.desde;
        hasta = rango.hasta;
        anio = document.getElementById("sel_anio")?.value || new Date().getFullYear();

        document.getElementById("lbl_anio_mes").textContent = `(${anio})`;
        document.getElementById("lbl_anio_compras").textContent = `(${anio})`;
        document.getElementById("lbl_rango_activo").textContent =
            textoRango(periodoActual, desde, hasta);

        cargarTodo();
    }

    // ── Botón actualizar ──────────────────────────────────────────────────
    document.getElementById("btn_actualizar")?.addEventListener("click", aplicarYCargar);

    // Al cambiar año, recargar
    document.getElementById("sel_anio")?.addEventListener("change", aplicarYCargar);

    // Carga inicial
    aplicarYCargar();

    // ════════════════════════════════════════════════════════════════════
    // FUNCIONES DE CARGA
    // ════════════════════════════════════════════════════════════════════

    function cargarTodo() {
        cargarUsuariosOnline();
        cargarMetricasGestores();
        cargarAuditoriaLogs();
        cargarKPIs();
        cargarEstados();
        cargarMeses();
        cargarTecnicos();
        cargarLiquidaciones();
        cargarMateriales();
        cargarCompras();
        cargarStock();
        cargarSeries();
    }

    // ── KPIs ──────────────────────────────────────────────────────────────
    function cargarKPIs() {
        fetch(BASE + "kpis" + qs())
            .then(r => r.json())
            .then(res => {
                if (!res.success) return;
                const d = res.data;
                setText("kpi_ordenes", d.total_ordenes);
                setText("kpi_finalizadas", d.ordenes_finalizadas);
                setText("kpi_liquidaciones", d.total_liquidaciones);
                setText("kpi_productos", d.total_productos);
                setText("kpi_tecnicos", d.total_tecnicos);
                setText("kpi_compras_mes", "S/ " + parseFloat(d.compras_mes || 0).toFixed(2));
            });
    }

    // ── Gráfico donut — estados ───────────────────────────────────────────
    let chartEstados = null;
    function cargarEstados() {
        fetch(BASE + "ordenes_estado" + qs())
            .then(r => r.json())
            .then(res => {
                if (!res.success || !res.data.length) return;
                const labels = res.data.map(d => d.estado);
                const values = res.data.map(d => parseInt(d.total));
                const colors = {
                    'Finalizada': '#0acf97', 'Iniciada': '#3d7fee', 'Agendada': '#6c757d',
                    'En camino': '#ffbc00', 'Cancelada': '#fa5c7c', 'Anulada': '#343a40',
                };
                const colArr = labels.map(l => colors[l] || '#adb5bd');

                if (chartEstados) chartEstados.destroy();
                chartEstados = new ApexCharts(document.querySelector("#chart_estados"), {
                    series: values, labels: labels, colors: colArr,
                    chart: { type: 'donut', height: 280 },
                    legend: { position: 'bottom' },
                    dataLabels: { enabled: true, formatter: v => v.toFixed(1) + '%' },
                    plotOptions: { pie: { donut: { size: '55%' } } },
                    tooltip: { y: { formatter: v => v + ' órdenes' } }
                });
                chartEstados.render();
            });
    }

    // ── Gráfico barras — órdenes por mes ─────────────────────────────────
    const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    let chartMeses = null;
    function cargarMeses() {
        fetch(BASE + "ordenes_mes" + qs())
            .then(r => r.json())
            .then(res => {
                if (!res.success) return;
                const totales = Array(12).fill(0);
                const finalizadas = Array(12).fill(0);
                (res.data || []).forEach(d => {
                    const idx = parseInt(d.mes) - 1;
                    totales[idx] = parseInt(d.total);
                    finalizadas[idx] = parseInt(d.finalizadas);
                });

                if (chartMeses) chartMeses.destroy();
                chartMeses = new ApexCharts(document.querySelector("#chart_meses"), {
                    series: [
                        { name: 'Total', data: totales },
                        { name: 'Finalizadas', data: finalizadas }
                    ],
                    colors: ['#3d7fee', '#0acf97'],
                    chart: { type: 'bar', height: 280, toolbar: { show: false } },
                    plotOptions: { bar: { borderRadius: 4, columnWidth: '55%' } },
                    dataLabels: { enabled: false },
                    xaxis: { categories: MESES },
                    yaxis: { labels: { formatter: v => Math.round(v) } },
                    tooltip: { y: { formatter: v => v + ' órdenes' } }
                });
                chartMeses.render();
            });
    }

    // ── Tabla: técnicos ───────────────────────────────────────────────────
    function cargarTecnicos() {
        fetch(BASE + "ordenes_tecnico" + qs())
            .then(r => r.json())
            .then(res => {
                let html = '';
                (res.data || []).forEach(row => {
                    html += `<tr>
                        <td class="ps-3 fw-semibold">${row.tecnico}</td>
                        <td class="text-center"><span class="badge bg-primary">${row.total}</span></td>
                        <td class="text-center"><span class="badge bg-success">${row.finalizadas}</span></td>
                        <td class="text-center"><span class="badge bg-warning text-dark">${row.en_proceso}</span></td>
                        <td class="text-center"><span class="badge bg-danger">${row.canceladas}</span></td>
                    </tr>`;
                });
                document.getElementById("tbody_tecnicos").innerHTML = html ||
                    '<tr><td colspan="5" class="text-muted text-center py-3">Sin datos</td></tr>';
            });
    }

    // ── Tabla: liquidaciones por técnico ──────────────────────────────────
    function cargarLiquidaciones() {
        fetch(BASE + "liquidaciones_tecnico" + qs())
            .then(r => r.json())
            .then(res => {
                let html = '';
                (res.data || []).forEach(row => {
                    html += `<tr>
                        <td class="ps-3 fw-semibold">${row.tecnico}</td>
                        <td class="text-center">${row.total_liquidaciones}</td>
                        <td class="text-center"><strong>${row.total_materiales}</strong></td>
                        <td class="text-center">${row.tipos_producto}</td>
                    </tr>`;
                });
                document.getElementById("tbody_liquidaciones").innerHTML = html ||
                    '<tr><td colspan="4" class="text-muted text-center py-3">Sin datos</td></tr>';
            });
    }

    // ── Tabla: materiales más usados ──────────────────────────────────────
    function cargarMateriales() {
        fetch(BASE + "materiales_usados" + qs())
            .then(r => r.json())
            .then(res => {
                let html = '';
                (res.data || []).forEach((row, i) => {
                    html += `<tr>
                        <td class="ps-3"><small class="text-muted me-1">#${i + 1}</small><strong>${row.nombre_producto}</strong></td>
                        <td class="text-muted small">${row.categoria}</td>
                        <td class="text-center">${row.veces_usadas}</td>
                        <td class="text-center"><strong>${row.cantidad_total}</strong></td>
                    </tr>`;
                });
                document.getElementById("tbody_materiales").innerHTML = html ||
                    '<tr><td colspan="4" class="text-muted text-center py-3">Sin datos</td></tr>';
            });
    }

    // ── Tabla: compras por proveedor ──────────────────────────────────────
    function cargarCompras() {
        fetch(BASE + "compras_proveedor" + qs())
            .then(r => r.json())
            .then(res => {
                let html = '';
                (res.data || []).forEach(row => {
                    html += `<tr>
                        <td class="ps-3 fw-semibold">${row.proveedor}</td>
                        <td class="text-center">${row.total_compras}</td>
                        <td class="text-center">S/ ${parseFloat(row.monto_total).toFixed(2)}</td>
                        <td class="small text-muted">${row.ultima_compra || '—'}</td>
                    </tr>`;
                });
                document.getElementById("tbody_compras").innerHTML = html ||
                    '<tr><td colspan="4" class="text-muted text-center py-3">Sin compras</td></tr>';
            });
    }

    // ── Tabla: stock (sin filtro de fecha) ────────────────────────────────
    function cargarStock() {
        fetch(BASE + "stock_almacen")
            .then(r => r.json())
            .then(res => {
                let html = '';
                const badgeMap = {
                    'OK': 'bg-success', 'Stock bajo': 'bg-warning text-dark', 'Sin stock': 'bg-danger'
                };
                (res.data || []).forEach(row => {
                    const bc = badgeMap[row.estado_stock] || 'bg-secondary';
                    html += `<tr>
                        <td class="ps-3 small">${row.almacen}</td>
                        <td class="small">${row.producto}</td>
                        <td class="text-center fw-bold">${row.stock_disponible}</td>
                        <td class="text-center text-muted small">${row.stock_minimo ?? '—'}</td>
                        <td class="text-center"><span class="badge ${bc}">${row.estado_stock}</span></td>
                    </tr>`;
                });
                document.getElementById("tbody_stock").innerHTML = html ||
                    '<tr><td colspan="5" class="text-muted text-center py-3">Sin datos</td></tr>';
            });
    }

    // ── Tabla: series por estado (sin filtro de fecha) ────────────────────
    function cargarSeries() {
        fetch(BASE + "series_estado")
            .then(r => r.json())
            .then(res => {
                let html = '';
                let cnt = { DISPONIBLE: 0, RESERVADO: 0, VENDIDO: 0, DEFECTUOSO: 0 };
                const bMap = {
                    'DISPONIBLE': 'bg-success', 'RESERVADO': 'bg-warning text-dark',
                    'VENDIDO': 'bg-danger', 'DEFECTUOSO': 'bg-secondary'
                };
                (res.data || []).forEach(row => {
                    cnt[row.estado] = (cnt[row.estado] || 0) + 1;
                    const bc = bMap[row.estado] || 'bg-secondary';
                    html += `<tr>
                        <td class="ps-3 small">${row.producto}</td>
                        <td><code class="small">${row.numero_serie}</code></td>
                        <td class="text-center"><span class="badge ${bc}">${row.estado}</span></td>
                        <td class="small text-muted">${row.nombre_tecnico || '—'}</td>
                    </tr>`;
                });
                document.getElementById("tbody_series").innerHTML = html ||
                    '<tr><td colspan="4" class="text-muted text-center py-3">Sin series</td></tr>';

                setText("cnt_disponible", cnt.DISPONIBLE + " disp.");
                setText("cnt_reservado", cnt.RESERVADO + " res.");
                setText("cnt_vendido", cnt.VENDIDO + " vend.");
            });
    }

    // ── Exportar Excel ────────────────────────────────────────────────────
    document.getElementById("btn_exportar_excel")?.addEventListener("click", function () {
        if (typeof XLSX === 'undefined') {
            alert("Librería XLSX no cargada. Agrega SheetJS al footer.");
            return;
        }
        const tablas = [
            { id: "tbody_tecnicos", nombre: "Técnicos" },
            { id: "tbody_liquidaciones", nombre: "Liquidaciones" },
            { id: "tbody_materiales", nombre: "Materiales" },
            { id: "tbody_compras", nombre: "Compras" },
            { id: "tbody_stock", nombre: "Stock" },
        ];
        const wb = XLSX.utils.book_new();
        tablas.forEach(t => {
            const el = document.getElementById(t.id);
            if (!el) return;
            const table = el.closest('table');
            if (!table) return;
            const ws = XLSX.utils.table_to_sheet(table);
            XLSX.utils.book_append_sheet(wb, ws, t.nombre);
        });
        const rangoLabel = desde && hasta ? `_${desde}_${hasta}` : `_${anio}`;
        XLSX.writeFile(wb, `reporte_cespedes${rangoLabel}.xlsx`);
    });

    // ── Helper ────────────────────────────────────────────────────────────
    function setText(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    }

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

});