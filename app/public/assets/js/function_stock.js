// cespedes/public/assets/js/function_stock.js — REEMPLAZAR COMPLETO

$(document).ready(function () {
    "use strict";

    const url_listar = "inventario/stock/listar";
    const url_series = "inventario/stock/series";
    const url_tecnicos = "inventario/stock/tecnicos";

    // ─── Filtros combinados por DataTable (respetan paginación y orden) ──
    $.fn.dataTable.ext.search.push(function (settings, searchData, index) {
        const tablaId = settings.nTable.id;

        if (tablaId === 'tabla-stock') {
            const almacen   = ($('#filtro_almacen').val() || '').toLowerCase().trim();
            const categoria = ($('#filtro_categoria').val() || '').toLowerCase();
            const estado    = $('#filtro_estado_stock').val().toLowerCase();
            const tr = $(settings.aoData[index].nTr);
            const rowCat = (tr.data('categoria') || '').toLowerCase();
            const rowEst = (tr.data('estado') || '').toLowerCase();
            // data-almacen puede contener varios almacenes separados por ", "
            if (almacen) {
                const rowAlm = (tr.data('almacen') || '').toLowerCase();
                if (rowAlm.split(',').map(function (x) { return x.trim(); }).indexOf(almacen) < 0) return false;
            }
            if (categoria && rowCat !== categoria) return false;
            if (estado === 'bajo' && rowEst !== 'bajo' && rowEst !== 'agotado') return false;
            if (estado === 'normal' && rowEst !== 'normal') return false;
            return true;
        }

        if (tablaId === 'tabla-stockeo-tecnico') {
            const alm = ($('#rt_filtro_almacen').val() || '').toLowerCase().trim();
            const cat = ($('#rt_filtro_categoria').val() || '').toLowerCase();
            const tr = $(settings.aoData[index].nTr);
            const rowAlm = (tr.data('almacen') || '').toLowerCase();
            const rowCat = (tr.data('categoria') || '').toLowerCase();
            if (alm) {
                if (rowAlm.split(',').map(function (x) { return x.trim(); }).indexOf(alm) < 0) return false;
            }
            if (cat && rowCat !== cat) return false;
            return true;
        }

        return true;
    });

    // ─── Cargar stock de almacén ──────────────────────────────────────────
    function cargarStockAlmacen() {
        $('#tbody_stock').html('<tr><td colspan="12" class="text-center py-4"><span class="spinner-border spinner-border-sm text-primary"></span> Cargando...</td></tr>');

        $.getJSON(base_url + url_listar, function (data) {
            if (!data || data.length === 0) {
                $('#tbody_stock').html('<tr><td colspan="12" class="text-center text-muted py-4">Sin registros de stock</td></tr>');
                return;
            }

            // Destruir DataTable si ya existe
            if ($.fn.DataTable.isDataTable('#tabla-stock')) {
                $('#tabla-stock').DataTable().destroy();
            }

            let html = '';
            data.forEach(function (row) {
                const stockAlm = parseInt(row.cantidad) || 0;
                const minimo = parseInt(row.stock_minimo) || 0;
                const enTec = parseInt(row.stock_tecnicos) || 0;
                const dispSer = parseInt(row.series_disponibles) || 0;
                const reservSer = parseInt(row.series_reservadas) || 0;
                const usadasSer = parseInt(row.series_vendidas) || 0;
                const bajasSer = parseInt(row.series_bajas) || 0;

                // Estado de stock
                let badgeCls = 'bg-success';
                let badgeLabel = 'Normal';
                if (stockAlm <= 0) { badgeCls = 'bg-danger'; badgeLabel = 'Agotado'; }
                else if (stockAlm <= minimo) { badgeCls = 'bg-warning text-dark'; badgeLabel = 'Bajo'; }

                // Columnas de series solo para productos con serie
                let colseries;
                if (row.maneja_serie == 1) {
                    colseries = `
                        <td class="text-center">
                            <button class="btn btn-xs btn-outline-success btn-ver-series"
                                    data-id="${row.id_producto}"
                                    data-nombre="${row.nombre_producto}"
                                    style="font-size:.75rem;padding:2px 8px">
                                ${dispSer}
                            </button>
                        </td>
                        <td class="text-center"><span class="badge bg-warning text-dark">${reservSer}</span></td>
                        <td class="text-center"><span class="badge bg-danger">${usadasSer}</span></td>
                        <td class="text-center"><span class="badge bg-secondary">${bajasSer}</span></td>`;
                } else {
                    colseries = `<td class="text-center text-muted small">—</td>
                        <td class="text-center text-muted small">—</td>
                        <td class="text-center text-muted small">—</td>
                        <td class="text-center text-muted small">—</td>`;
                }

                html += `
                    <tr data-almacen="${row.almacenes || ''}" data-categoria="${row.nombre_categoria || ''}" data-estado="${badgeLabel.toLowerCase()}">
                        <td>${row.almacenes || '—'}</td>
                        <td><code class="small">${row.codigo || '—'}</code></td>
                        <td class="fw-semibold">${row.nombre_producto}</td>
                        <td><span class="badge bg-light text-dark">${row.nombre_categoria || '—'}</span></td>
                        <td class="text-center fw-bold">${row.maneja_serie == 1 ? '—' : stockAlm}</td>
                        <td class="text-center">${enTec > 0 ? `<span class="badge bg-info text-dark">${enTec}</span>` : '<span class="text-muted small">0</span>'}</td>
                        ${colseries}
                        <td class="text-center text-muted small">${minimo}</td>
                        <td class="text-center"><span class="badge ${badgeCls}">${badgeLabel}</span></td>
                    </tr>`;
            });

            $('#tbody_stock').html(html);

            // Reinicializar DataTable
            $('#tabla-stock').DataTable({
                paging: false,
                info: false,
                responsive: true,
                language: { url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json' }
            });

            // Aplicar filtros actuales
            aplicarFiltros();
        }).fail(function () {
            $('#tbody_stock').html('<tr><td colspan="13" class="text-center text-danger py-3">Error al cargar el stock</td></tr>');
        });
    }

    // ─── Filtros ──────────────────────────────────────────────────────────
    function aplicarFiltros() {
        if ($.fn.DataTable.isDataTable('#tabla-stock')) {
            $('#tabla-stock').DataTable().draw();
        }
    }

    $('#filtro_almacen, #filtro_categoria, #filtro_estado_stock').on('change', aplicarFiltros);

    // ─── Cargar stock de técnicos ─────────────────────────────────────────
    function cargarStockTecnicos() {
        $('#tbody_tecnicos').html('<tr><td colspan="4" class="text-center py-3"><span class="spinner-border spinner-border-sm"></span></td></tr>');

        $.getJSON(base_url + url_tecnicos, function (res) {
            if (!res.success || !res.data || res.data.length === 0) {
                $('#tbody_tecnicos').html('<tr><td colspan="4" class="text-center text-muted py-3">Sin stock asignado a técnicos</td></tr>');
                return;
            }

            if ($.fn.DataTable.isDataTable('#tabla-stock-tecnicos')) {
                $('#tabla-stock-tecnicos').DataTable().destroy();
            }

            let html = '';
            res.data.forEach(function (row) {
                const stockNum = parseInt(row.stock) || 0;
                const serAsig = parseInt(row.series_asignadas) || 0;

                html += `
                    <tr>
                        <td class="fw-semibold">${row.nombre_tecnico}</td>
                        <td>${row.nombre_producto}</td>
                        <td class="text-center">
                            ${row.maneja_serie == 1
                        ? `<span class="text-muted small">—</span>`
                        : `<span class="badge bg-primary">${stockNum}</span>`}
                        </td>
                        <td class="text-center">
                            ${row.maneja_serie == 1
                        ? `<span class="badge bg-info text-dark">${serAsig}</span>`
                        : `<span class="text-muted small">—</span>`}
                        </td>
                    </tr>`;
            });

            $('#tbody_tecnicos').html(html);
            $('#tabla-stock-tecnicos').DataTable({
                paging: false,
                info: false,
                responsive: true,
                language: { url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json' }
            });
        });
    }

    // ─── Cargar al cambiar de tab ─────────────────────────────────────────
    cargarStockAlmacen();

    $('a[href="#tab_tecnicos"]').on('shown.bs.tab', function () {
        cargarStockTecnicos();
    });

    // ─── Ver series de un producto ────────────────────────────────────────
    $(document).on('click', '.btn-ver-series', function () {
        const id = $(this).data('id');
        const nombre = $(this).data('nombre');

        $('#modal_nombre_prod_series').text(nombre);
        $('#tbody_series_modal').html('<tr><td colspan="3" class="text-center py-3"><span class="spinner-border spinner-border-sm"></span></td></tr>');
        $('#modalSeries').modal('show');

        $.getJSON(base_url + url_series + '/' + id, function (res) {
            if (!res.success || !res.data || res.data.length === 0) {
                $('#tbody_series_modal').html('<tr><td colspan="3" class="text-center text-muted py-3">Sin series registradas</td></tr>');
                return;
            }

            const BADGE = {
                'DISPONIBLE': 'success',
                'RESERVADO': 'warning text-dark',
                'VENDIDO': 'danger',
                'BAJA': 'dark',
                'DEFECTUOSO': 'secondary'
            };

            let html = '';
            res.data.forEach(function (s) {
                const b = BADGE[s.estado] || 'secondary';
                html += `
                    <tr>
                        <td class="ps-3"><code>${s.numero_serie}</code></td>
                        <td><span class="badge bg-${b}">${s.estado}</span></td>
                        <td>${s.nombre_tecnico !== '—' ? `<i class="mdi mdi-account-hard-hat text-primary me-1"></i>${s.nombre_tecnico}` : '<span class="text-muted">—</span>'}</td>
                    </tr>`;
            });
            $('#tbody_series_modal').html(html);
        });
    });


    // ═════════════════════════════════════════════════════════════════════
    // STOCKEO RÁPIDO A TÉCNICO
    // ═════════════════════════════════════════════════════════════════════
    const url_stock_tecnico    = "inventario/stock/stock_tecnico";
    const url_stockear_tecnico = "inventario/stock/stockear_tecnico";
    const url_devolver_todo_tecnico = "inventario/stock/devolver_todo_tecnico";
    const url_devolver_drop         = "inventario/stock/devolver_drop";
    const rtDeltas = {};   // id_producto -> { id_producto, delta }  (productos SIN serie)
    const rtSeries = {};   // id_producto -> { asignar: [id_serie...], devolver: [id_serie...] }
    let rtData = [];       // filas actuales del técnico seleccionado
    let mstModo = 'entregar';
    let mstIdProducto = 0;

    function cargarStockeoTecnico() {
        const idTec = $('#rt_tecnico').val();
        Object.keys(rtDeltas).forEach(function (k) { delete rtDeltas[k]; });
        Object.keys(rtSeries).forEach(function (k) { delete rtSeries[k]; });
        rtData = [];

        if (!idTec) {
            $('#tbody_stockeo_tecnico').html('<tr><td colspan="8" class="text-center text-muted py-4">Seleccioná un técnico para comenzar.</td></tr>');
            $('#rt_total').text(0);
            $('#btn_guardar_tecnico').prop('disabled', true);
            return;
        }

        $('#tbody_stockeo_tecnico').html('<tr><td colspan="8" class="text-center py-4"><span class="spinner-border spinner-border-sm text-primary"></span> Cargando...</td></tr>');

        $.getJSON(base_url + url_stock_tecnico + '/' + idTec, function (res) {
            if (!res.success) {
                $('#tbody_stockeo_tecnico').html('<tr><td colspan="8" class="text-center text-danger py-3">' + res.mensaje + '</td></tr>');
                return;
            }

            if ($.fn.DataTable.isDataTable('#tabla-stockeo-tecnico')) {
                $('#tabla-stockeo-tecnico').DataTable().destroy();
            }

            const data = res.data || [];
            rtData = data;

            if (data.length === 0) {
                $('#tbody_stockeo_tecnico').html('<tr><td colspan="8" class="text-center text-muted py-4">Sin stock registrado.</td></tr>');
                actualizarTotalesTecnico();
                return;
            }

            let html = '';
            data.forEach(function (row) {
                const conSerie = row.maneja_serie == 1;
                const esDrop = parseInt(row.es_drop) === 1;
                const idP = row.id_producto;

                if (conSerie) {
                    rtSeries[idP] = { asignar: [], devolver: [] };
                } else {
                    rtDeltas[idP] = { id_producto: idP, delta: 0 };
                }

                let ajuste;
                if (conSerie) {
                    ajuste = `
                        <div class="d-flex gap-1 justify-content-center">
                            <button type="button" class="btn btn-outline-success btn-xs btn-entregar-series"
                                    data-producto="${idP}" title="Entregar series al técnico"
                                    style="font-size:.75rem;padding:2px 8px">+ series</button>
                            <button type="button" class="btn btn-outline-danger btn-xs btn-devolver-series"
                                    data-producto="${idP}" title="Devolver series al almacén"
                                    style="font-size:.75rem;padding:2px 8px">− series</button>
                        </div>`;
                } else {
                    ajuste = `
                        <div class="d-inline-flex align-items-center gap-1">
                            <button type="button" class="btn btn-outline-danger btn-xs rt-menos"
                                    data-producto="${idP}" title="Quitar 1"
                                    style="width:26px;padding:0;font-size:1rem;line-height:1.3">−</button>
                            <input type="number" class="form-control form-control-sm text-center rt-delta"
                                    data-producto="${idP}" value="0" min="-99999" style="width:62px">
                            <button type="button" class="btn btn-outline-success btn-xs rt-mas"
                                    data-producto="${idP}" title="Agregar 1"
                                    style="width:26px;padding:0;font-size:1rem;line-height:1.3">+</button>
                        </div>` + (esDrop ? `
                        <div class="text-center mt-1">
                            <button type="button" class="btn btn-outline-danger btn-xs btn-devolver-drop"
                                    data-producto="${idP}" title="Devolver todo el metraje DROP al almacén"
                                    style="font-size:.75rem;padding:2px 8px">
                                <i class="mdi mdi-cable-data me-1"></i>Devolver DROP
                            </button>
                        </div>` : '');
                }

                html += `
                    <tr data-categoria="${row.nombre_categoria || ''}" data-almacen="${row.almacenes || ''}">
                        <td class="fw-semibold">${row.nombre_producto} ${esDrop ? '<span class="badge bg-info text-white ms-1">DROP</span>' : ''}</td>
                        <td><code class="small">${row.codigo || '—'}</code></td>
                        <td class="text-center fw-bold">${conSerie ? '—' : row.stock_almacen}</td>
                        <td class="text-center fw-bold">${conSerie ? '—' : row.asignado}</td>
                        <td class="text-center">
                            ${conSerie ? `<span class="badge bg-success rt-badge-disp">${row.series_disponibles}</span>` : '<span class="text-muted small">—</span>'}
                        </td>
                        <td class="text-center">
                            ${conSerie ? `<span class="badge bg-info text-dark rt-badge-asig">${row.series_asignadas}</span>` : '<span class="text-muted small">—</span>'}
                        </td>
                        <td class="text-center">${ajuste}</td>
                        <td class="text-center fw-bold rt-nuevo" data-producto="${idP}">${conSerie ? row.series_asignadas : row.asignado}</td>
                    </tr>`;
            });

            $('#tbody_stockeo_tecnico').html(html);
            $('#tabla-stockeo-tecnico').DataTable({
                paging: false,
                info: false,
                responsive: true,
                language: { url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json' }
            });

            if ($.fn.DataTable.isDataTable('#tabla-stockeo-tecnico')) {
                $('#tabla-stockeo-tecnico').DataTable().draw();
            }

            actualizarTotalesTecnico();
        }).fail(function () {
            $('#tbody_stockeo_tecnico').html('<tr><td colspan="8" class="text-center text-danger py-3">Error al cargar el stock.</td></tr>');
        });
    }

    function nuevoAsignadoTec(idP) {
        const row = rtData.find(function (r) { return r.id_producto == idP; });
        if (!row) return 0;
        if (row.maneja_serie == 1) {
            const st = rtSeries[idP] || { asignar: [], devolver: [] };
            return (parseInt(row.series_asignadas) || 0) + st.asignar.length - st.devolver.length;
        }
        const ent = rtDeltas[idP];
        return (parseInt(row.asignado) || 0) + (ent ? ent.delta : 0);
    }

    function actualizarTotalesTecnico() {
        let total = 0;
        Object.keys(rtDeltas).forEach(function (k) {
            if (rtDeltas[k].delta !== 0) total++;
        });
        Object.keys(rtSeries).forEach(function (k) {
            const st = rtSeries[k];
            if (st.asignar.length > 0 || st.devolver.length > 0) total++;
        });
        $('#rt_total').text(total);
        $('#btn_guardar_tecnico').prop('disabled', total === 0);
    }

    // Steppers +/− (productos sin serie)
    $(document).on('click', '.rt-mas, .rt-menos', function () {
        const idP = $(this).data('producto');
        const ent = rtDeltas[idP];
        if (!ent) return;
        const fila = $(this).closest('tr');
        const step = $(this).hasClass('rt-mas') ? 1 : -1;
        ent.delta += step;
        fila.find('.rt-delta').val(ent.delta);
        fila.find('.rt-nuevo').text(nuevoAsignadoTec(idP));
        actualizarTotalesTecnico();
    });

    // Entrada directa
    $(document).on('input change', '.rt-delta', function () {
        const idP = $(this).data('producto');
        const fila = $(this).closest('tr');
        const ent = rtDeltas[idP];
        if (!ent) return;
        ent.delta = parseInt($(this).val()) || 0;
        fila.find('.rt-nuevo').text(nuevoAsignadoTec(idP));
        actualizarTotalesTecnico();
    });

    // ── Selector de series (entregar / devolver) ─────────────────────────
    function nombreTecnicoActual() {
        return $('#rt_tecnico option:selected').text().replace(/\s+/g, ' ').trim().toLowerCase();
    }

    function abrirSelectorSeries(idP, modo) {
        const row = rtData.find(function (r) { return r.id_producto == idP; });
        if (!row) return;
        mstModo = modo;
        mstIdProducto = idP;
        $('#mst_titulo').text(modo === 'entregar'
            ? 'Entregar series — ' + row.nombre_producto
            : 'Devolver series — ' + row.nombre_producto);
        $('#mst_contenido').html('<div class="text-center py-3"><span class="spinner-border spinner-border-sm"></span></div>');
        $('#modalSeriesTec').modal('show');

        $.getJSON(base_url + url_series + '/' + idP, function (res) {
            if (!res.success || !res.data || res.data.length === 0) {
                $('#mst_contenido').html('<p class="text-muted text-center mb-0 py-2">Sin series disponibles.</p>');
                return;
            }
            const st = rtSeries[idP] || { asignar: [], devolver: [] };
            const nombreTec = nombreTecnicoActual();

            let html = '<div class="list-group">';
            let visibles = 0;
            res.data.forEach(function (s) {
                const disponible = s.estado === 'DISPONIBLE';
                const esDelTecnico = (s.nombre_tecnico || '').replace(/\s+/g, ' ').trim().toLowerCase() === nombreTec;

                let mostrar = false;
                if (modo === 'entregar' && disponible) {
                    mostrar = st.devolver.indexOf(s.id_producto_serie) < 0;   // ya en cola de devolución
                }
                if (modo === 'devolver' && s.estado === 'RESERVADO' && esDelTecnico) {
                    mostrar = st.asignar.indexOf(s.id_producto_serie) < 0;     // ya en cola de entrega
                }
                if (!mostrar) return;

                visibles++;
                const marcada = modo === 'entregar'
                    ? st.asignar.indexOf(s.id_producto_serie) >= 0
                    : st.devolver.indexOf(s.id_producto_serie) >= 0;
                html += `
                    <label class="list-group-item d-flex align-items-center gap-2 mb-1 py-1">
                        <input type="checkbox" class="form-check-input mst-chk" value="${s.id_producto_serie}" ${marcada ? 'checked' : ''}>
                        <code>${s.numero_serie}</code>
                    </label>`;
            });
            html += '</div>';

            if (visibles === 0) {
                $('#mst_contenido').html('<p class="text-muted text-center mb-0 py-2">Sin series disponibles para esta acción.</p>');
                return;
            }
            $('#mst_contenido').html(html);
        });
    }

    function refrescarSerieBadges(idP) {
        const row = rtData.find(function (r) { return r.id_producto == idP; });
        if (!row || row.maneja_serie != 1) return;
        const st = rtSeries[idP] || { asignar: [], devolver: [] };
        const disp = (parseInt(row.series_disponibles) || 0) - st.asignar.length + st.devolver.length;
        const asig = (parseInt(row.series_asignadas) || 0) + st.asignar.length - st.devolver.length;

        $('#tbody_stockeo_tecnico tr').each(function () {
            const tdNuevo = $(this).find('.rt-nuevo');
            if (tdNuevo.data('producto') == idP) {
                $(this).find('.rt-badge-disp').text(disp);
                $(this).find('.rt-badge-asig').text(asig);
                tdNuevo.text(asig);
            }
        });
    }

    $(document).on('click', '.btn-entregar-series', function () {
        abrirSelectorSeries($(this).data('producto'), 'entregar');
    });
    $(document).on('click', '.btn-devolver-series', function () {
        abrirSelectorSeries($(this).data('producto'), 'devolver');
    });

    $('#mst_aceptar').on('click', function () {
        const ids = [];
        $('#mst_contenido input.mst-chk:checked').each(function () {
            ids.push(parseInt($(this).val()));
        });
        if (!rtSeries[mstIdProducto]) rtSeries[mstIdProducto] = { asignar: [], devolver: [] };
        if (mstModo === 'entregar') {
            rtSeries[mstIdProducto].asignar = ids;
        } else {
            rtSeries[mstIdProducto].devolver = ids;
        }
        $('#modalSeriesTec').modal('hide');
        refrescarSerieBadges(mstIdProducto);
        actualizarTotalesTecnico();
    });

    // Descartar cambios
    $('#btn_limpiar_tecnico').on('click', function () {
        Object.keys(rtDeltas).forEach(function (k) { rtDeltas[k].delta = 0; });
        Object.keys(rtSeries).forEach(function (k) {
            rtSeries[k].asignar = [];
            rtSeries[k].devolver = [];
        });
        $('#rt_motivo').val('');
        $('#tbody_stockeo_tecnico .rt-delta').val(0);
        $('#tbody_stockeo_tecnico .rt-nuevo').each(function () {
            const idP = $(this).data('producto');
            if (idP) $(this).text(nuevoAsignadoTec(idP));
        });
        Object.keys(rtSeries).forEach(function (k) { refrescarSerieBadges(k); });
        actualizarTotalesTecnico();
    });

    // Guardar
    $('#btn_guardar_tecnico').on('click', function () {
        const btn = $(this);
        const idTec = $('#rt_tecnico').val();
        if (!idTec) return;

        const items = [];
        Object.keys(rtDeltas).forEach(function (k) {
            if (rtDeltas[k].delta !== 0) items.push({ id_producto: parseInt(k), delta: rtDeltas[k].delta });
        });
        const series = [];
        Object.keys(rtSeries).forEach(function (k) {
            const st = rtSeries[k];
            if (st.asignar.length > 0 || st.devolver.length > 0) {
                series.push({ id_producto: parseInt(k), asignar: st.asignar, devolver: st.devolver });
            }
        });

        if (items.length === 0 && series.length === 0) return;

        btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-1"></span>Guardando...');

        fetch(base_url + url_stockear_tecnico, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                id_trabajador: idTec,
                items: JSON.stringify(items),
                series: JSON.stringify(series),
                motivo: $('#rt_motivo').val()
            })
        })
            .then(r => r.json())
            .then(function (response) {
                if (response.success) {
                    $('#rt_motivo').val('');
                    Swal.fire({
                        icon: 'success',
                        title: 'Listo',
                        text: response.mensaje,
                        timer: 1500,
                        showConfirmButton: false
                    });
                    cargarStockeoTecnico();
                    cargarStockAlmacen();
                    cargarStockTecnicos();
                } else {
                    Swal.fire({ icon: 'error', title: 'Error', text: response.mensaje });
                    btn.prop('disabled', false).html('<i class="mdi mdi-content-save me-1"></i>Guardar (<span id="rt_total">' + $('#rt_total').text() + '</span>)');
                }
            })
            .catch(function () {
                Swal.fire({ icon: 'error', title: 'Error de red', text: 'No se pudo conectar.' });
                btn.prop('disabled', false).html('<i class="mdi mdi-content-save me-1"></i>Guardar (<span id="rt_total">' + $('#rt_total').text() + '</span>)');
            });
    });

    // Devolver el metraje de un producto DROP al almacén (botón por fila)
    $(document).on('click', '.btn-devolver-drop', function () {
        const idTec = $('#rt_tecnico').val();
        const idP = $(this).data('producto');
        if (!idTec) return;

        Swal.fire({
            title: 'Devolver DROP',
            text: '¿Devolver todo el metraje de este DROP al almacén?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, devolver',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#f06548'
        }).then(function (res) {
            if (!res.isConfirmed) return;

            fetch(base_url + url_devolver_drop, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ id_trabajador: idTec, id_producto: idP })
            })
                .then(r => r.json())
                .then(function (response) {
                    if (response.success) {
                        Swal.fire({ icon: 'success', title: 'Listo', text: response.mensaje, timer: 1500, showConfirmButton: false });
                        cargarStockeoTecnico();
                        cargarStockAlmacen();
                        cargarStockTecnicos();
                    } else {
                        Swal.fire({ icon: 'error', title: 'Error', text: response.mensaje });
                    }
                })
                .catch(function () {
                    Swal.fire({ icon: 'error', title: 'Error de red', text: 'No se pudo conectar.' });
                });
        });
    });

    // Devolver TODO el stock del técnico (metraje + series) al almacén
    $('#btn_devolver_todo_tecnico').on('click', function () {
        const idTec = $('#rt_tecnico').val();
        if (!idTec) {
            Swal.fire({ icon: 'warning', title: 'Sin técnico', text: 'Selecciona un técnico primero.' });
            return;
        }

        Swal.fire({
            title: 'Devolver todo el stock',
            text: '¿Seguro que quieres devolver TODO el stock (metraje y series) de este técnico al almacén?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, devolver todo',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#f06548'
        }).then(function (res) {
            if (!res.isConfirmed) return;

            const btn = $('#btn_devolver_todo_tecnico');
            btn.prop('disabled', true);

            fetch(base_url + url_devolver_todo_tecnico, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ id_trabajador: idTec })
            })
                .then(r => r.json())
                .then(function (response) {
                    btn.prop('disabled', false);
                    if (response.success) {
                        Swal.fire({ icon: 'success', title: 'Listo', text: response.mensaje, timer: 1500, showConfirmButton: false });
                        cargarStockeoTecnico();
                        cargarStockAlmacen();
                        cargarStockTecnicos();
                    } else {
                        Swal.fire({ icon: 'error', title: 'Error', text: response.mensaje });
                    }
                })
                .catch(function () {
                    btn.prop('disabled', false);
                    Swal.fire({ icon: 'error', title: 'Error de red', text: 'No se pudo conectar.' });
                });
        });
    });

    // Cargar al entrar al tab o al cambiar de técnico
    $('#rt_tecnico').on('change', cargarStockeoTecnico);
    $('#rt_filtro_almacen, #rt_filtro_categoria').on('change', function () {
        if ($.fn.DataTable.isDataTable('#tabla-stockeo-tecnico')) {
            $('#tabla-stockeo-tecnico').DataTable().draw();
        }
    });
    $('a[href="#tab_tecnico_rapido"]').on('shown.bs.tab', function () {
        cargarStockeoTecnico();
    });
});
