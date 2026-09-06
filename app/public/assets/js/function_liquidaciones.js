$(document).ready(function () {
    "use strict";

    let tecnicoSeleccionado = null;

    function fmtMoneda(valor) {
        const n = parseFloat(valor) || 0;
        return 'S/ ' + n.toFixed(2);
    }

    function fmtFecha(fechaStr) {
        if (!fechaStr) return '—';
        const soloFecha = fechaStr.split(' ')[0];
        const partes = soloFecha.split('-');
        if (partes.length !== 3) return fechaStr;
        const [anio, mes, dia] = partes;
        return `${parseInt(dia, 10)}/${parseInt(mes, 10)}/${anio}`;
    }

    function badgeEstadoLiq(estado) {
        const map = {
            'Pendiente': 'bg-warning text-dark',
            'Aprobada': 'bg-success',
            'Rechazada': 'bg-danger'
        };
        const clase = map[estado] || 'bg-secondary';
        return `<span class="badge ${clase}">${estado || '—'}</span>`;
    }

    function paramsFecha() {
        let desde = $('#liqFechaDesde').val();
        let hasta = $('#liqFechaHasta').val();

        // Sin filtro manual → solo hoy. Para ver anteriores, usar el filtro.
        if (!desde && !hasta) {
            const hoy = new Date();
            const hoyStr = hoy.getFullYear() + '-' +
                String(hoy.getMonth() + 1).padStart(2, '0') + '-' +
                String(hoy.getDate()).padStart(2, '0');
            desde = hoyStr;
            hasta = hoyStr;
        }

        let qs = [];
        if (desde) qs.push('desde=' + encodeURIComponent(desde));
        if (hasta) qs.push('hasta=' + encodeURIComponent(hasta));
        return qs.length ? ('?' + qs.join('&')) : '';
    }

    // ─── Cargar resumen de técnicos ───────────────────────────────────────
    function cargarTecnicos() {

        $('#tbodyTecnicosLiq').html(`
            <tr>
                <td colspan="6" class="text-center text-muted py-4">
                    <span class="spinner-border spinner-border-sm text-primary"></span> Cargando…
                </td>
            </tr>
        `);

        $.ajax({
            url: 'liquidaciones/resumen_tecnicos' + paramsFecha(),
            type: 'GET',
            dataType: 'json',
            success: function (response) {

                const data = response.data || [];

                if (data.length === 0) {
                    $('#tbodyTecnicosLiq').html(`
                        <tr><td colspan="6" class="text-center text-muted py-4">Sin liquidaciones registradas</td></tr>
                    `);
                    return;
                }

                let html = '';
                data.forEach(function (t) {
                    const pendClase = t.total_pendientes > 0 ? 'text-warning fw-semibold' : 'text-muted';
                    const rechClase = t.total_rechazadas > 0 ? 'text-danger fw-semibold' : 'text-muted';
                    html += `
                        <tr class="fila-tecnico-liq" style="cursor:pointer" data-id="${t.id_trabajador}" data-nombre="${t.tecnico}">
                            <td class="ps-3">${t.tecnico}</td>
                            <td class="text-center">${t.total_liquidaciones}</td>
                            <td class="text-center">${t.total_ordenes}</td>
                            <td class="text-center ${pendClase}">${t.total_pendientes}</td>
                            <td class="text-center ${rechClase}">${t.total_rechazadas}</td>
                            <td class="text-end pe-3 fw-semibold">${fmtMoneda(t.total_costo)}</td>
                        </tr>
                    `;
                });
                $('#tbodyTecnicosLiq').html(html);

                // Si había un técnico seleccionado, resaltarlo de nuevo
                if (tecnicoSeleccionado) {
                    $(`.fila-tecnico-liq[data-id="${tecnicoSeleccionado}"]`).addClass('table-primary');
                }
            },
            error: function () {
                $('#tbodyTecnicosLiq').html(`
                    <tr><td colspan="6" class="text-center text-danger py-4">Error al cargar técnicos</td></tr>
                `);
            }
        });
    }

    // ─── Click en un técnico → cargar sus liquidaciones ──────────────────
    $(document).on('click', '.fila-tecnico-liq', function () {

        const id = $(this).data('id');
        const nombre = $(this).data('nombre');

        tecnicoSeleccionado = id;

        $('.fila-tecnico-liq').removeClass('table-primary');
        $(this).addClass('table-primary');

        $('#tituloTecnicoSeleccionado').text(`Liquidaciones de ${nombre}`);

        $('#tbodyLiqTecnico').html(`
            <tr>
                <td colspan="6" class="text-center text-muted py-4">
                    <span class="spinner-border spinner-border-sm text-primary"></span> Cargando…
                </td>
            </tr>
        `);

        $.ajax({
            url: `liquidaciones/por_tecnico/${id}${paramsFecha()}`,
            type: 'GET',
            dataType: 'json',
            success: function (response) {

                const data = response.data || [];

                if (data.length === 0) {
                    $('#tbodyLiqTecnico').html(`
                        <tr><td colspan="6" class="text-center text-muted py-4">Sin liquidaciones en este rango</td></tr>
                    `);
                    return;
                }

                let html = '';
                data.forEach(function (l) {
                    html += `
                        <tr class="fila-detalle-liq" style="cursor:pointer" data-id="${l.id_liquidacion}">
                            <td class="ps-3">${fmtFecha(l.fecha_liquidacion)}</td>
                            <td>#${l.numero_orden}</td>
                            <td>${l.cliente || '—'}</td>
                            <td>${l.numero_acta || '—'}</td>
                            <td class="text-center">${badgeEstadoLiq(l.estado_liquidacion)}</td>
                            <td class="text-end pe-3 fw-semibold">${fmtMoneda(l.total_costo)}</td>
                        </tr>
                    `;
                });
                $('#tbodyLiqTecnico').html(html);
            },
            error: function () {
                $('#tbodyLiqTecnico').html(`
                    <tr><td colspan="6" class="text-center text-danger py-4">Error al cargar liquidaciones</td></tr>
                `);
            }
        });
    });

    // ─── Click en una liquidación → abrir modal de detalle ───────────────
    $(document).on('click', '.fila-detalle-liq', function () {

        const id = $(this).data('id');

        $('#cuerpoDetalleLiq').html(`
            <div class="text-center text-muted py-4">
                <span class="spinner-border spinner-border-sm text-primary"></span> Cargando…
            </div>
        `);

        $('#modalDetalleLiq').modal('show');

        $.ajax({
            url: `liquidaciones/detalle/${id}`,
            type: 'GET',
            dataType: 'json',
            success: function (response) {

                if (!response.success) {
                    $('#cuerpoDetalleLiq').html(`
                        <div class="text-center text-danger py-4">${response.mensaje || 'No se pudo cargar el detalle'}</div>
                    `);
                    return;
                }

                const c = response.data.cabecera;
                const materiales = response.data.materiales || [];
                const totalCosto = response.data.total_costo;

                function filaMaterial(m) {
                    const esBaja = m.estado_serie === 'BAJA';
                    const esDrop = (m.drop_inicio !== null && m.drop_inicio !== undefined && m.drop_inicio !== '') ||
                                  (m.drop_fin !== null && m.drop_fin !== undefined && m.drop_fin !== '');
                    const celdaCantidad = esDrop ? `
                        <span class="badge bg-info text-white" title="Metraje inicial del cable">${m.drop_inicio || '—'}</span>
                        <span class="text-muted mx-1 small">→</span>
                        <span class="badge bg-success text-white" title="Metraje final del cable">${m.drop_fin || '—'}</span>
                        <div class="small text-muted mt-1">Total: ${m.cantidad}</div>` : m.cantidad;
                    return `
                        <tr>
                            <td class="ps-3">
                                ${m.nombre_producto || '—'}
                                ${esDrop ? '<span class="badge bg-info text-white ms-1">DROP</span>' : ''}
                                ${esBaja ? '<span class="badge badge-outline-danger ms-1">Baja</span>' : ''}
                            </td>
                            <td>${m.numero_serie ? `<code class="small">${m.numero_serie}</code>` : '<span class="text-muted">—</span>'}</td>
                            <td class="text-center">${celdaCantidad}</td>
                            <td class="text-end pe-3">${esBaja ? '<span class="text-muted">—</span>' : fmtMoneda(m.costo)}</td>
                        </tr>
                    `;
                }

                function tablaGrupo(titulo, icono, items) {
                    const filas = items.length
                        ? items.map(filaMaterial).join('')
                        : `<tr><td colspan="4" class="text-center text-muted py-2 small">Sin registros</td></tr>`;

                    return `
                        <div class="mb-3">
                            <div class="fw-semibold small text-uppercase mb-1">
                                <i class="mdi ${icono} me-1"></i>${titulo}
                            </div>
                            <div class="table-responsive border rounded">
                                <table class="table table-sm mb-0">
                                    <thead class="table-light">
                                        <tr>
                                            <th class="ps-3">Producto</th>
                                            <th>Serie</th>
                                            <th class="text-center">Cant.</th>
                                            <th class="text-end pe-3">Costo</th>
                                        </tr>
                                    </thead>
                                    <tbody>${filas}</tbody>
                                </table>
                            </div>
                        </div>
                    `;
                }

                const equipos = materiales.filter(m => m.categoria_liquidar === 'EQUIPO');
                const soloMateriales = materiales.filter(m => m.categoria_liquidar !== 'EQUIPO');

                $('#cuerpoDetalleLiq').html(`
                    <div class="alert alert-info py-2 mb-3 small">
                        <strong>Orden #${c.numero_orden}</strong> · Técnico: <strong>${c.tecnico}</strong><br>
                        Cliente: ${c.cliente || '—'} &nbsp;·&nbsp; Dirección: ${c.direccion || '—'}<br>
                        Tipo de trabajo: ${c.tipo_trabajo || '—'} &nbsp;·&nbsp; Tipo de avería: ${c.tipo_averia || '—'}<br>
                        Fecha visita: ${fmtFecha(c.fecha_visita)} &nbsp;·&nbsp; Fecha liquidación: ${fmtFecha(c.fecha_liquidacion)}<br>
                        N° Acta: <strong>${c.numero_acta || '—'}</strong> &nbsp;·&nbsp; Estado: ${badgeEstadoLiq(c.estado_liquidacion)}
                    </div>

                    ${c.estado_liquidacion === 'Rechazada' && c.motivo_rechazo ? `
                        <div class="alert alert-danger py-2 mb-3 small">
                            <i class="mdi mdi-alert-circle-outline me-1"></i><strong>Motivo del rechazo:</strong><br>
                            ${c.motivo_rechazo}
                        </div>
                    ` : ''}

                    ${tablaGrupo('Equipos', 'mdi-laptop text-primary', equipos)}
                    ${tablaGrupo('Materiales o ferretería', 'mdi-hammer-screwdriver text-warning', soloMateriales)}

                    <div class="text-end fw-bold pe-2">
                        Total: ${fmtMoneda(totalCosto)}
                    </div>

                    ${c.observaciones ? `
                        <div class="mt-2">
                            <div class="text-muted small fw-semibold">Observaciones</div>
                            <div class="small">${c.observaciones}</div>
                        </div>
                    ` : ''}
                `);

                // Botones Aprobar/Rechazar: solo si el usuario tiene permiso
                // y la liquidación sigue Pendiente (una ya Aprobada/Rechazada
                // no se puede volver a tocar desde aquí).
                if (puedeAprobar && c.estado_liquidacion === 'Pendiente') {
                    $('#footerDetalleLiq').html(`
                        <button type="button" class="btn btn-outline-danger btn-sm" id="btnRechazarLiq" data-id="${c.id_liquidacion}">
                            <i class="mdi mdi-close-circle-outline me-1"></i>Rechazar
                        </button>
                        <button type="button" class="btn btn-success btn-sm" id="btnAprobarLiq" data-id="${c.id_liquidacion}">
                            <i class="mdi mdi-check-circle-outline me-1"></i>Aprobar
                        </button>
                    `);
                } else {
                    $('#footerDetalleLiq').html('');
                }
            },
            error: function () {
                $('#cuerpoDetalleLiq').html(`
                    <div class="text-center text-danger py-4">Error al cargar el detalle</div>
                `);
            }
        });
    });

    // ─── Aprobar / Rechazar ────────────────────────────────────────────────
    function enviarEstadoLiq(id, estado, motivo) {
        const data = { estado: estado };
        if (motivo !== null) {
            data.motivo_rechazo = motivo;
        }

        $.ajax({
            url: `liquidaciones/cambiar_estado/${id}`,
            type: 'POST',
            dataType: 'json',
            data: data,
            success: function (response) {

                if (!response.success) {
                    alertError(response.mensaje || 'No se pudo actualizar el estado.');
                    return;
                }

                alertCorrecto(response.mensaje);

                $('#modalDetalleLiq').modal('hide');

                // Refrescar ambos paneles para reflejar el nuevo estado
                cargarTecnicos();
                if (tecnicoSeleccionado) {
                    $(`.fila-tecnico-liq[data-id="${tecnicoSeleccionado}"]`).trigger('click');
                }
            },
            error: function () {
                alertError('Error al actualizar el estado.');
            }
        });
    }

    $(document).on('click', '#btnAprobarLiq, #btnRechazarLiq', function () {

        const id = $(this).data('id');

        // Rechazo: pedir el motivo (obligatorio) antes de continuar.
        // Se cierra el modal de Bootstrap antes de abrir SweetAlert, porque
        // el focus trap del modal abierto impide escribir en el textarea.
        if (this.id === 'btnRechazarLiq') {

            const abrirSwalRechazo = function () {
                Swal.fire({
                    title: 'Rechazar liquidación',
                    html: '<span class="small">El stock y las bajas de esta liquidación <strong>se revertirán</strong> automáticamente.</span>',
                    input: 'textarea',
                    inputLabel: 'Motivo del rechazo (visible para el técnico)',
                    inputPlaceholder: 'Ej.: acta incompleta, faltan materiales, serie incorrecta…',
                    inputAttributes: { maxlength: 500 },
                    showCancelButton: true,
                    confirmButtonText: 'Sí, rechazar',
                    cancelButtonText: 'Cancelar',
                    confirmButtonColor: '#d9534f',
                    inputValidator: function (value) {
                        if (!value || !value.trim()) {
                            return 'Debes indicar el motivo del rechazo.';
                        }
                        return null;
                    }
                }).then(function (result) {
                    if (!result.isConfirmed) {
                        // Volver a abrir el detalle si el usuario cancela
                        $(`.fila-detalle-liq[data-id="${id}"]`).trigger('click');
                        return;
                    }
                    enviarEstadoLiq(id, 'Rechazada', result.value.trim());
                });
            };

            const modalDetalle = $('#modalDetalleLiq');
            if (modalDetalle.hasClass('show')) {
                modalDetalle.one('hidden.bs.modal', abrirSwalRechazo);
                modalDetalle.modal('hide');
            } else {
                abrirSwalRechazo();
            }
            return;
        }

        // Aprobación directa
        enviarEstadoLiq(id, 'Aprobada', null);
    });

    // ─── Filtros de fecha ─────────────────────────────────────────────────
    $('#liqFiltrar').on('click', function () {
        cargarTecnicos();
        if (tecnicoSeleccionado) {
            $(`.fila-tecnico-liq[data-id="${tecnicoSeleccionado}"]`).trigger('click');
        }
    });

    $('#liqLimpiar').on('click', function () {
        $('#liqFechaDesde').val('');
        $('#liqFechaHasta').val('');
        cargarTecnicos();
        $('#tituloTecnicoSeleccionado').text('Selecciona un técnico para ver sus liquidaciones');
        $('#tbodyLiqTecnico').html(`
            <tr><td colspan="6" class="text-center text-muted fst-italic py-4">Sin técnico seleccionado</td></tr>
        `);
        tecnicoSeleccionado = null;
    });

    // ─── Carga inicial ──────────────────────────────────────────────────
    cargarTecnicos();
});