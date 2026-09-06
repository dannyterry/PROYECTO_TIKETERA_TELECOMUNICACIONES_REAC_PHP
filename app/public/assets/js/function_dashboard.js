$(document).ready(function () {

    // ── 1. Órdenes por estado ──────────────────────────────────────
    $.getJSON('dashboard/ordenes_estado', function (res) {
        if (!res.success || !res.data || res.data.length === 0) return;

        const labels = res.data.map(d => d.estado || 'Sin estado');
        const values = res.data.map(d => parseInt(d.total));
        const total = values.reduce((a, b) => a + b, 0);

        $('#badge_total_estados').text(total + ' órdenes');

        const colors = {
            'Finalizada': '#0acf97',
            'Iniciada': '#3d7fee',
            'Agendada': '#6c757d',
            'En camino': '#ffbc00',
            'Cancelada': '#fa5c7c',
            'Anulada': '#343a40',
            'Regestión': '#727cf5',
            'default': '#adb5bd'
        };

        const chartColors = labels.map(l => colors[l] || colors['default']);

        const options = {
            series: values,
            labels: labels,
            colors: chartColors,
            chart: {
                type: 'donut',
                height: 280
            },
            legend: {
                position: 'bottom',
                fontSize: '13px'
            },
            dataLabels: {
                enabled: true,
                formatter: (val) => val.toFixed(1) + '%'
            },
            plotOptions: {
                pie: {
                    donut: {
                        size: '55%'
                    }
                }
            },
            tooltip: {
                y: {
                    formatter: (val) => val + ' órdenes'
                }
            }
        };

        new ApexCharts(document.querySelector("#chart_estados"), options).render();
    });

    // ── 2. Liquidaciones recientes ────────────────────────────────
    $.getJSON('dashboard/liquidaciones_recientes', function (res) {
        let html = '';
        if (!res.success || !res.data || res.data.length === 0) {
            html = '<tr><td colspan="6" class="text-muted text-center">Sin liquidaciones aún</td></tr>';
        } else {
            $('#badge_total_liq').text(res.data.length);
            res.data.forEach((row, i) => {
                const badge = {
                    'Pendiente': 'warning',
                    'Aprobada': 'success',
                    'Rechazada': 'danger'
                }[row.estado] || 'secondary';

                html += `<tr>
                    <td>${i + 1}</td>
                    <td><strong>${row.numero || '—'}</strong></td>
                    <td>${row.nombre_tecnico}</td>
                    <td><span class="badge bg-secondary">${row.total_materiales ?? 0}</span></td>
                    <td>${row.fecha_liquidacion ? row.fecha_liquidacion.substring(0, 16) : '—'}</td>
                    <td>
                        <span class="badge bg-${badge}">${row.estado}</span>
                        ${row.estado === 'Rechazada' && row.motivo_rechazo ? `
                            <div class="small text-danger mt-1" style="max-width:200px;">
                                <i class="mdi mdi-alert-circle-outline"></i> ${row.motivo_rechazo}
                            </div>
                        ` : ''}
                    </td>
                </tr>`;
            });
        }
        $('#tbody_liq').html(html);
    }).fail(function () {
        $('#tbody_liq').html('<tr><td colspan="6" class="text-muted text-center">No disponible</td></tr>');
    });

    // ── 3. Top materiales ─────────────────────────────────────────
    $.getJSON('dashboard/top_materiales', function (res) {
        let html = '';
        if (!res.success || !res.data || res.data.length === 0) {
            html = '<tr><td colspan="4" class="text-muted text-center">Sin datos</td></tr>';
        } else {
            res.data.forEach((row, i) => {
                html += `<tr>
                    <td>${i + 1}</td>
                    <td>${row.nombre_producto}</td>
                    <td class="text-end">${row.veces_usado}</td>
                    <td class="text-end"><strong>${row.total_cantidad}</strong></td>
                </tr>`;
            });
        }
        $('#tbody_top_materiales').html(html);
    }).fail(function () {
        $('#tbody_top_materiales').html('<tr><td colspan="4" class="text-muted text-center">No disponible</td></tr>');
    });

    // ── 4. Top técnicos ───────────────────────────────────────────
    $.getJSON('dashboard/top_tecnicos', function (res) {
        let html = '';
        if (!res.success || !res.data || res.data.length === 0) {
            html = '<p class="text-muted text-center">Sin datos</p>';
        } else {
            const max = parseInt(res.data[0].total_finalizadas) || 1;
            res.data.forEach(row => {
                const pct = Math.round((row.total_finalizadas / max) * 100);
                html += `
                    <div class="mb-3">
                        <div class="d-flex justify-content-between mb-1">
                            <span class="fw-semibold">${row.nombre_tecnico}</span>
                            <span class="text-muted">${row.total_finalizadas} órds.</span>
                        </div>
                        <div class="progress progress-sm">
                            <div class="progress-bar bg-success" style="width:${pct}%" role="progressbar"
                                aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"></div>
                        </div>
                    </div>`;
            });
        }
        $('#tbody_top_tecnicos_wrap').html(html);
    }).fail(function () {
        $('#tbody_top_tecnicos_wrap').html('<p class="text-muted text-center">No disponible</p>');
    });

});