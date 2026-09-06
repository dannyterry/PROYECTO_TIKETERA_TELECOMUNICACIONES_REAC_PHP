$(document).ready(function () {
    "use strict";

    $('<style>').prop('type', 'text/css').html(`

    /* ── Tabla de órdenes ─────────────────────────── */
    #tabla-ordenes {
        white-space: nowrap !important;
        font-size: 0.73rem !important;
        margin-top: 0 !important;
        margin-bottom: 0 !important;
    }
    #tabla-ordenes td,
    #tabla-ordenes th {
        padding-top: 6px !important;
        padding-bottom: 6px !important;
        vertical-align: middle !important;
    }
    #tabla-ordenes .badge       { font-size: 0.65rem !important; }
    #tabla-ordenes .form-select {
        font-size: 0.70rem !important;
        padding: 1px 4px !important;
        height: auto !important;
        min-width: 120px;
    }
    #tabla-ordenes .btn,
    #tabla-ordenes .btn-sm {
        font-size: 0.68rem !important;
        padding: 2px 6px !important;
        line-height: 1.3 !important;
    }

    /* Ocultar el selector de filas propio de DataTables */
    #tabla-ordenes_length { display: none !important; }

    /* ── QUITAR ESPACIOS EN BLANCO SUPERIOR E INFERIOR ── */
    #tabla-ordenes_wrapper {
        padding-top: 0 !important;
        padding-bottom: 0 !important;
    }

    /* Quitar el margen/padding del contenedor superior (Barra de botones y buscador) */
    #tabla-ordenes_wrapper .row:first-child {
        margin: 0 !important;
        padding: 4px 0 !important; /* Reducido al mínimo */
        align-items: center !important;
    }

    /* Quitar el margen/padding de la fila inferior (Información de registros) */
    #tabla-ordenes_wrapper .row:last-child {
        margin: 0 !important;
        padding: 4px 0 0 0 !important;
    }

    /* Quitar espacios sobrantes de los contenedores con scroll interno */
    .dataTables_scrollHead, .dataTables_scrollBody {
        margin: 0 !important;
    }

    /* ── BOTONES DE EXPORTAR ESTÉTICOS Y COMPACTOS ── */
    #tabla-ordenes_wrapper .dt-buttons {
        display: inline-flex !important;
        gap: 6px !important;
        margin-bottom: 0 !important;
        float: left !important;
    }

    /* Estilo delgado y limpio para los botones de exportar */
    #tabla-ordenes_wrapper .dt-buttons .btn {
        font-size: 0.70rem !important;
        padding: 3px 8px !important;
        line-height: 1.2 !important;
        border-radius: 4px !important;
        box-shadow: none !important;
    }

    /* Buscador compacto ajustado a la misma altura de los botones */
    #tabla-ordenes_filter {
        float: right !important;
        margin-bottom: 0 !important;
    }
    #tabla-ordenes_filter input {
        font-size: 0.72rem !important;
        padding: 3px 8px !important;
        height: auto !important;
        margin-left: 5px !important;
    }

    /* Barra de herramientas. Sin position sticky: la tabla usa scrollY
       interno (encabezado fijo de DataTables) y así nada tapa los botones
       ni el buscador al desplazarse. */
    #toolbar-ordenes {
        background-color: #fff !important;
    }

    /* Popover */
    .popover-cliente-info {
        max-width: 360px !important;
    }

    #liq_bloque_productos.liq-bloqueado {
        opacity: .45;
        pointer-events: none;
        user-select: none;
    }

    /* Elimina el espacio que agrega DataTables abajo de la tabla */
#tabla-ordenes_wrapper {
    margin-bottom: 0 !important;
    padding-bottom: 0 !important;
}

/* Ajusta los contenedores de Bootstrap para que no estiren la página */
.card {
    margin-bottom: 0 !important;
}

/* Alineación compacta para paginación/info en la parte inferior */
#tabla-ordenes_wrapper .row:last-child {
    margin-top: 5px !important;
    margin-bottom: 0 !important;
    padding: 4px 12px !important;
    background-color: #f8f9fa;
}

`).appendTo('head');

    // Configuración
    let _idOrdenActual = null;
    const tabla = "#tabla-ordenes";

    const url_listar = "ordenes/listar";
    const url_agregar = "ordenes/agregar";
    const url_editar = "ordenes/editar";
    const url_ver = "ordenes/ver";
    const url_estado = "ordenes/obtener_estado";
    const url_consulta = "ordenes/consulta"
    const url_eliminar = "ordenes/eliminar";

    const btn_agregar = $("#btn_agregar");
    const btn_actualizar = $("#btn_actualizar");
    const btn_modal = $("#btn_modal");
    const btn_modal_2 = $("#btn_modal_2");


    const modal = $("#modal");
    const form = $("#form");
    const id_titulo_modal = $("#titulo_modal");

    const modal_2 = $("#modal_2");
    const form_2 = $("#form_2");
    const id_titulo_modal_2 = $("#titulo_modal_2");

    const titulo_modal = "Nuevo Marca";
    const titulo_modal_actualizar = "Orden de trabajo";
    const titulo_modal_liquidar = "Liquidar trabajo";

    const esTecnico = rol === "TECNICO";


    // Inicializar tabla
    const columnas = [
        {
            data: "fecha_visita"
        },
        {
            data: "llamada_inconcert",
            visible: !esTecnico,
            render: function (data, type, row) {

                if (type === "display") {

                    const checked = data === "Si" ? "checked" : "";
                    const switchId = "switch_" + row.id_orden;

                    return `
                        <div class="form-check form-switch p-0">
                            <input type="checkbox"
                                class="editar-llamada"
                                id="${switchId}"
                                data-id="${row.id_orden}"
                                data-switch="bool"
                                ${esTecnico ? "disabled" : ""}
                                ${checked}/>
                            <label for="${switchId}"
                                data-on-label="Si"
                                data-off-label="No"></label>
                        </div>
                    `;
                }

                return data;
            },

        },
        { data: "codigo_seguimiento" },
        {
            data: "cliente",
            render: function (data, type, row) {
                if (type !== "display") {
                    return data;
                }

                const tecnico = trabajadores.find(t => t.id_trabajador == row.id_tecnico);
                const nombreTecnico = tecnico ? `${tecnico.nombres} ${tecnico.apellidos}` : '';

                return ` 
                <span 
                    class="cliente-info text-primary" 
                    style="cursor:pointer;" 
                    data-bs-toggle="popover" 
                    data-bs-html="true" 
                    data-bs-trigger="click" 
                    title="Información cliente" 
                    data-fecha="${row.fecha_visita || ''}" 
                    data-celular="${row.movil || ''}" 
                    data-tipo-trabajo="${row.tipo_trabajo || ''}" 
                    data-tipo-documento="${row.tipo_documento || ''}" 
                    data-num-documento="${row.numero_documento || ''}" 
                    data-ticket="${row.codigo_seguimiento || ''}" 
                    data-direccion="${row.direccion || ''}" 
                    data-georef="${row.georeferencia || ''}" 
                    data-num-orden="${row.numero || ''}" 
                    data-tecnico="${nombreTecnico}" 
                    data-observacion="${row.observaciones || ''}" 
                > 
                    ${data} 
                </span> `;
            }
        },
        {
            data: "id_tecnico",
            visible: !esTecnico,
            render: function (data, type, row) {

                // Para exportación/orden/filtro: nombre del técnico
                if (type !== "display") {
                    const tecnico = trabajadores.find(t => t.id_trabajador == data);
                    return tecnico ? `${tecnico.nombres} ${tecnico.apellidos}` : '';
                }

                let options = '<option value="" disabled selected>Seleccione</option>';

                trabajadores.forEach(t => {
                    const selected = t.id_trabajador == data ? "selected" : "";
                    options += `
                    <option value="${t.id_trabajador}" ${selected}>
                        ${t.nombres} ${t.apellidos}
                    </option>
                `;
                });

                return `
                <select 
                    class="form-select editar-tecnico"
                    ${esTecnico ? "disabled" : ""}
                    data-id="${row.id_orden}">
                    ${options}
                </select>
            `;
            }
        },
        {
            data: "hora_asignacion", // 1. Asig.
            visible: !esTecnico,
            render: function (data, type) {
                if (!data) return "";
                return data.split(" ")[1]?.substring(0, 5);
            }
        },
        {
            data: "inicio_visita", // 2. Inicio
            visible: !esTecnico,
            render: function (data, type) {
                if (!data) return "";
                return data.split(" ")[1]?.substring(0, 5);
            }
        },
        {
            data: "fin_visita", // 3. Fin
            visible: !esTecnico,
            render: function (data, type) {
                if (!data) return "";
                return data.split(" ")[1]?.substring(0, 5);
            }
        },
        {
            data: "fecha_solicitud", // 4. Fin Bloque (aquí se pintarán los 08:00, 12:00, etc.)
            visible: !esTecnico,
            render: function (data, type) {
                if (!data) return "";
                return data.split(" ")[1]?.substring(0, 5);
            }
        },
        {
            data: "estado",
            visible: !esTecnico,
            render: function (data, type) {
                return type === "display" ? renderEstadoOrden(data) : data;
            }
        },
        { data: "cuadrilla", visible: !esTecnico },
        { data: "tipo_averia" },
        {
            data: "tipo_trabajo",
            visible: !esTecnico,
            render: function (data, type, row) {

                if (type !== "display") {
                    return data;
                }

                const texto = data ? data : "Sin especificar";

                return `
                <span class="badge bg-light text-dark editar-motivo "
                    data-id="${row.id_orden}"
                    data-value="${data || ''}"
                    style="cursor:pointer;">
                    ${texto}
                    <i class="mdi mdi-pencil ms-1"></i>
                </span>
            `;
            }
        },
        {
            data: "numero", render: function (data, type, row) {

                let liquidar = row.estado === "Finalizada" && !row.id_liquidacion_activa;

                let html = renderAcciones(data, {
                    mostrarVer: !esTecnico,
                    mostrarLiq: liquidar,
                    ocultarEditar: true,
                    ocultarEliminar: true
                });

                if (row.id_liquidacion_activa) {
                    html += `
                        <button type="button"
                            class="btn btn-sm btn-outline-success ver-liquidacion"
                            data-id="${row.id_liquidacion_activa}">
                            <i class="mdi mdi-clipboard-check-outline"></i> Liquidación
                        </button>
                    `;
                }

                // Si la última liquidación fue rechazada, mostrar botón para
                // que el técnico vea el motivo y los productos devueltos.
                if (row.id_liquidacion_rechazada) {
                    html += `
                        <button type="button"
                            class="btn btn-sm btn-outline-danger ver-liquidacion ms-1"
                            data-id="${row.id_liquidacion_rechazada}">
                            <i class="mdi mdi-close-octagon-outline"></i> Liquidación rechazada
                        </button>
                    `;
                }

                return html;
            }
        }
    ];

    // Altura del área de scroll vertical: llena la ventana dejando espacio
    function alturaBodyTabla() {
        const el = document.getElementById('tabla-ordenes');
        if (!el) return 400;
        const top = el.getBoundingClientRect().top + window.scrollY;
        // Cambiado de 170 a 90 para que la tabla llegue hasta la parte inferior sin dejar hueco
        return Math.max(280, Math.round(window.innerHeight - top - 90));
    }

    function fechaHoyLocal() {
        const d = new Date();
        const mes = String(d.getMonth() + 1).padStart(2, '0');
        const dia = String(d.getDate()).padStart(2, '0');
        return d.getFullYear() + '-' + mes + '-' + dia;
    }

    // Exporta las órdenes visibles (respetando filtros y columnas visibles)
    // a Excel (XLSX) o PDF (pdfMake). La columna Acción se omite.
    function exportarOrdenes(tabla, formato) {

        const colsIndice = [];
        const nombreCols = [];

        tabla.columns().eq(0).each(function (colIdx) {
            const col = tabla.column(colIdx);
            if (!col.visible()) return;
            const titulo = $(col.header()).text().trim();
            if (titulo === '' || /^acci[oó]n$/i.test(titulo)) return;
            colsIndice.push(colIdx);
            nombreCols.push(titulo);
        });

        if (!nombreCols.length) {
            Swal.fire({ icon: 'warning', title: 'Nada que exportar', text: 'No hay columnas visibles.' });
            return;
        }

        const filas = [];
        tabla.rows({ filter: 'applied' }).every(function () {
            const fila = [];
            const rowIdx = this.index();
            colsIndice.forEach(function (colIdx) {
                let v = tabla.cell(rowIdx, colIdx).render('export');
                if (v === null || v === undefined) v = '';
                v = String(v).trim();
                // Fecha visita: dejar solo la fecha (YYYY-MM-DD)
                if (colIdx === 0 && v) v = v.split(' ')[0];
                fila.push(v);
            });
            filas.push(fila);
        });

        const base = 'Ordenes_' + fechaHoyLocal();

        if (formato === 'excel') {
            if (typeof XLSX === 'undefined') {
                Swal.fire({ icon: 'error', title: 'Error', text: 'El módulo XLSX no está cargado.' });
                return;
            }
            const ws = XLSX.utils.aoa_to_sheet([nombreCols, ...filas]);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Ordenes');
            XLSX.writeFile(wb, base + '.xlsx');
            return;
        }

        if (formato === 'pdf') {
            if (typeof pdfMake === 'undefined') {
                Swal.fire({ icon: 'error', title: 'Error', text: 'El módulo pdfMake no está cargado.' });
                return;
            }
            const docDefinition = {
                pageSize: 'A4',
                pageOrientation: 'landscape',
                pageMargins: [24, 30, 24, 30],
                content: [
                    { text: 'Órdenes de Trabajo', style: 'titulo' },
                    { text: 'Generado el ' + new Date().toLocaleDateString('es-PE'), style: 'subtitulo' },
                    {
                        table: {
                            headerRows: 1,
                            widths: Array(nombreCols.length).fill('*'),
                            body: [nombreCols, ...filas]
                        },
                        layout: 'lightHorizontalLines'
                    }
                ],
                styles: {
                    titulo: { fontSize: 14, bold: true, margin: [0, 0, 0, 2] },
                    subtitulo: { fontSize: 9, margin: [0, 0, 0, 8], color: '#666' }
                },
                defaultStyle: { fontSize: 7 }
            };
            pdfMake.createPdf(docDefinition).download(base + '.pdf');
        }
    }

    const tablaAjax = inicializarTabla(tabla, url_listar, columnas, {
        scrollX: true,
        scrollY: alturaBodyTabla(),
        scrollCollapse: true,
        autoWidth: false,
        responsive: false,
        pageLength: -1,           // mostrar siempre todas las órdenes (sin paginación)
        lengthChange: false,      // ya no hay selector de filas por página
        dom: 'Bfti',              // B=botones exportar, f=buscar, t=tabla, i=info
        buttons: [
            {
                extend: 'copyHtml5',
                text: '<i class="mdi mdi-content-copy me-1"></i>Copiar',
                className: 'btn btn-outline-secondary btn-sm',
                titleAttr: 'Copiar al portapapeles',
                exportOptions: { columns: ':not(:last-child)' }
            },
            {
                text: '<i class="mdi mdi-file-excel-outline me-1"></i>Excel',
                className: 'btn btn-outline-success btn-sm',
                action: function (e, dt) { exportarOrdenes(dt, 'excel'); }
            },
            {
                text: '<i class="mdi mdi-file-pdf-outline me-1"></i>PDF',
                className: 'btn btn-outline-danger btn-sm',
                action: function (e, dt) { exportarOrdenes(dt, 'pdf'); }
            }
        ]
    });

    // Con scrollX activo, DataTables clona el header en una tabla aparte y
    // sincroniza sus anchos por JS. Si no se le pide reajustar tras cada
    // draw (o al cambiar el tamaño de la ventana), el header queda
    // desalineado del cuerpo de la tabla. Esto lo soluciona.
    tablaAjax.on('draw', function () {
        tablaAjax.columns.adjust();
    });

    // Mantener el alto del área de scroll llenando la ventana y el header
    // alineado cuando cambia el tamaño (los botones de exportar hacen que
    // el alto disponible sea distinto antes y después del primer draw).
    function ajustarScrollTabla() {
        tablaAjax.columns.adjust();
        const scrollBody = tablaAjax.table().container().querySelector('.dataTables_scrollBody');
        if (scrollBody) {
            scrollBody.style.maxHeight = alturaBodyTabla() + 'px';
            scrollBody.style.height = alturaBodyTabla() + 'px';
        }
    }

    tablaAjax.on('draw', ajustarScrollTabla);

    $(window).on('resize', function () {
        ajustarScrollTabla();
    });

    // ─── Botón "Mi stock" (solo técnicos) ─────────────────────────────
    $(document).on('click', '#btn_mi_stock', function () {

        const placeholderCarga = (col) => `<tr><td colspan="${col}" class="text-center py-3"><span class="spinner-border spinner-border-sm text-primary"></span> Cargando…</td></tr>`;
        $('#tablaMiStockEquipos').html(placeholderCarga(4));
        $('#tablaMiStockMateriales').html(placeholderCarga(3));

        $('#modalMiStock').modal('show');

        $.ajax({
            url: 'ordenes/mi_stock',
            type: 'GET',
            dataType: 'json',
            success: function (response) {

                if (!response.success) {
                    const sinStock = `<tr><td colspan="3" class="text-center text-muted py-3">${response.mensaje || 'Sin stock disponible'}</td></tr>`;
                    $('#tablaMiStockEquipos').html(sinStock);
                    $('#tablaMiStockMateriales').html(sinStock);
                    return;
                }

                const equipos = response.productos.filter(function (p) {
                    return p.categoria_liquidar === 'EQUIPO';
                });

                const materiales = response.productos.filter(function (p) {
                    return p.categoria_liquidar !== 'EQUIPO';
                });

                renderMiStockTabla('tablaMiStockEquipos', equipos);
                renderMiStockTabla('tablaMiStockMateriales', materiales);
            },
            error: function () {
                const error = '<tr><td colspan="3" class="text-center text-danger py-3">Error al cargar el stock.</td></tr>';
                $('#tablaMiStockEquipos').html(error);
                $('#tablaMiStockMateriales').html(error);
            }
        });
    });

    // Pinta el stock del técnico en modo solo-lectura (sin botón "+", es
    // solo para que puedan verificar qué tienen antes de liquidar).
    function renderMiStockTabla(idTbody, productos) {

        const tbody = document.getElementById(idTbody);
        const esEquipos = idTbody === 'tablaMiStockEquipos';
        const colSpan = esEquipos ? 4 : 3;
        tbody.innerHTML = '';

        if (!productos || productos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="${colSpan}" class="text-center text-muted py-3">
                        Sin stock disponible
                    </td>
                </tr>
            `;
            return;
        }

        productos.forEach(function (prod) {

            const esVehiculo = parseInt(prod.maneja_vehiculo) === 1;
            const badgeVehiculo = esVehiculo
                ? ' <span class="badge badge-outline-secondary" title="Pertenece al vehículo, no se puede liquidar">Vehículo</span>'
                : '';

            // Botón de un clic para dar de baja sin digitar la serie: solo en
            // la tabla de equipos y para productos no pertenecientes al vehículo.
            function botonBaja(serieNumero, idSerie) {
                if (!esEquipos || esVehiculo || !serieNumero || !idSerie) return '';
                return `
                    <button type="button"
                        class="btn btn-sm btn-outline-danger rounded-pill btn-mi-stock-baja"
                        data-id-serie="${idSerie}"
                        data-serie="${serieNumero}"
                        data-nombre="${prod.nombre_producto}"
                        title="Dar de baja este equipo"
                        style="font-size:11px;">
                        <i class="mdi mdi-close-octagon-outline"></i> Baja
                    </button>`;
            }

            if (parseInt(prod.maneja_serie) === 1) {

                if (!prod.series || prod.series.length === 0) {
                    tbody.innerHTML += `
                        <tr>
                            <td class="ps-3">${prod.nombre_producto}${badgeVehiculo}</td>
                            <td colspan="${colSpan - 1}" class="text-muted small">Sin series disponibles</td>
                        </tr>
                    `;
                    return;
                }

                prod.series.forEach(function (serie) {
                    tbody.innerHTML += `
                        <tr>
                            <td class="ps-3">${prod.nombre_producto}${badgeVehiculo}</td>
                            <td><code class="small">${serie.numero_serie}</code></td>
                            <td class="text-center">1</td>
                            ${esEquipos ? `<td class="text-center">${botonBaja(serie.numero_serie, serie.id_producto_serie)}</td>` : ''}
                        </tr>
                    `;
                });

            } else {
                tbody.innerHTML += `
                    <tr>
                        <td class="ps-3">${prod.nombre_producto}${badgeVehiculo}</td>
                        <td class="text-muted small">—</td>
                        <td class="text-center fw-semibold">${prod.stock}</td>
                        ${esEquipos ? `<td class="text-center">${botonBaja()}</td>` : ''}
                    </tr>
                `;
            }
        });
    }

    // ─── Dar de baja un equipo desde "Mi stock" (un clic, sin digitar serie) ──
    $(document).on('click', '.btn-mi-stock-baja', function () {

        const idSerie = $(this).data('id-serie');
        const serie = $(this).data('serie');
        const nombre = $(this).data('nombre');

        Swal.fire({
            title: '¿Dar de baja este equipo?',
            html: `La serie <code>${serie}</code> (<strong>${nombre}</strong>) se dará de baja y <strong>saldrá de tu stock</strong>.`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, dar de baja',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#f06548'
        }).then(function (result) {
            if (!result.isConfirmed) return;

            $.ajax({
                url: base_url + 'ordenes/dar_baja',
                type: 'POST',
                dataType: 'json',
                data: { id_producto_serie: idSerie },
                beforeSend: function () {
                    $(`.btn-mi-stock-baja[data-id-serie="${idSerie}"]`).prop('disabled', true);
                },
                success: function (response) {
                    if (response.success) {
                        alertCorrecto(response.mensaje);
                        // Recargar el stock del modal para quitar la serie
                        $('#btn_mi_stock').trigger('click');
                    } else {
                        Swal.fire({ icon: 'error', title: 'Error', text: response.mensaje });
                        $(`.btn-mi-stock-baja[data-id-serie="${idSerie}"]`).prop('disabled', false);
                    }
                },
                error: function () {
                    Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo conectar con el servidor.' });
                    $(`.btn-mi-stock-baja[data-id-serie="${idSerie}"]`).prop('disabled', false);
                }
            });
        });
    });

    // tablaAjax.DataTable({
    //     scrollX: true,
    //     autoWidth: false
    // });

    // botón abrir modal
    btn_agregar.on('click', function () {
        form[0].reset();
        form.find('input[type="hidden"]').val('');

        modal.modal("show");
        id_titulo_modal.text(titulo_modal);
    });


    const btnActualizar = document.getElementById("btn_actualizar");
    const textoSync = document.getElementById("textoSync");

    const btnToggle = document.getElementById("btn_toggle_sync");
    const iconToggle = document.getElementById("iconToggle");


    let tiempoRestante = 60;
    let contadorInterval = null;
    let sincronizando = false;
    let autoSyncActivo = true;

    // botón actualizar
    async function cargarOrdenesAuto() {

        mostrarProgresoSincronizacion();

        const intervaloProgreso = setInterval(consultarProgresoSincronizacion, 1200);

        return new Promise((resolve, reject) => {

            $.ajax({
                url: "ordenes/actualizar_masivo",
                type: "POST",
                dataType: "json",

                success: function (response) {

                    clearInterval(intervaloProgreso);
                    Swal.close();

                    if (!response.success) {

                        alertError("Ocurrió un error al procesar la información.");

                        reject();

                        return;
                    }

                    if (response.total_insertados > 0 && response.total_actualizados > 0) {

                        alertCorrecto(
                            `Se insertaron ${response.total_insertados} y se actualizaron ${response.total_actualizados} órdenes.`
                        );

                    } else if (response.total_insertados > 0) {

                        alertCorrecto(
                            `Se insertaron ${response.total_insertados} órdenes nuevas.`
                        );

                    } else if (response.total_actualizados > 0) {

                        alertCorrecto(
                            `Se actualizaron ${response.total_actualizados} órdenes existentes.`
                        );

                    } else {

                        alertWarning(
                            "No se encontraron órdenes nuevas ni cambios para actualizar."
                        );
                    }

                    // Esperar reload de DataTable
                    tablaAjax.ajax.reload(() => {

                        resolve();

                    }, false);
                },

                error: function (xhr) {

                    clearInterval(intervaloProgreso);
                    Swal.close();

                    alertError("Error al actualizar órdenes.");

                    reject(xhr);
                }
            });

        });
    }

    // Modal de progreso con barra real (en vez de un spinner indefinido)
    function mostrarProgresoSincronizacion() {
        Swal.fire({
            title: "Sincronizando órdenes...",
            html: `
                <div class="text-start">
                    <p id="sync_mensaje" class="mb-2 text-muted small">Conectando con WIN...</p>
                    <div class="progress" style="height: 18px;">
                        <div id="sync_barra"
                            class="progress-bar progress-bar-striped progress-bar-animated"
                            role="progressbar"
                            style="width: 0%">0%</div>
                    </div>
                </div>
            `,
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false,
            heightAuto: false
        });
    }

    // Consulta el avance real en el backend y actualiza la barra
    function consultarProgresoSincronizacion() {
        $.ajax({
            url: "ordenes/progreso_sincronizacion",
            type: "GET",
            dataType: "json",
            success: function (progreso) {

                const barra = document.getElementById("sync_barra");
                const mensaje = document.getElementById("sync_mensaje");

                if (!barra || !mensaje) return;

                const total = progreso.total || 0;
                const actual = progreso.actual || 0;
                const porcentaje = total > 0 ? Math.min(100, Math.round((actual / total) * 100)) : 0;

                barra.style.width = porcentaje + "%";
                barra.textContent = porcentaje + "%";

                if (progreso.mensaje) {
                    mensaje.textContent = progreso.mensaje;
                } else if (total > 0) {
                    mensaje.textContent = `Procesando ${actual} de ${total} órdenes...`;
                }
            }
            // Si falla el polling no pasa nada grave: la sincronización sigue en curso,
            // simplemente no se actualiza la barra en ese intento.
        });
    }


    // FUNCIÓN DE SINCRONIZACIÓN
    async function sincronizarAutomatico() {

        if (sincronizando || !autoSyncActivo) return;

        sincronizando = true;


        btnActualizar.disabled = true;

        textoSync.innerHTML = 'Sincronizando...';

        try {

            await cargarOrdenesAuto();

        } catch (error) {

            console.error(error);

        } finally {

            sincronizando = false;

            // IMPORTANTE
            btnActualizar.disabled = false;

            iniciarContador();
        }
    }

    // CONTADOR
    function iniciarContador() {

        clearInterval(contadorInterval);

        if (!autoSyncActivo) {

            textoSync.innerHTML = 'Sincronizar';
            return;
        }

        tiempoRestante = 60;

        textoSync.innerHTML = `Sincronizar (${tiempoRestante}s)`;

        contadorInterval = setInterval(() => {

            if (!autoSyncActivo) {

                clearInterval(contadorInterval);

                textoSync.innerHTML = 'Sincronizar';

                return;
            }

            tiempoRestante--;

            textoSync.innerHTML = `Sincronizar (${tiempoRestante}s)`;

            if (tiempoRestante <= 0) {

                clearInterval(contadorInterval);

                sincronizarAutomatico();
            }

        }, 1000);
    }

    // CLICK MANUAL
    btnActualizar.addEventListener("click", () => {

        clearInterval(contadorInterval);

        sincronizarAutomatico();
    });

    // PAUSAR / ACTIVAR
    btnToggle.addEventListener("click", () => {

        autoSyncActivo = !autoSyncActivo;

        if (autoSyncActivo) {

            btnToggle.classList.remove("btn-outline-success");
            btnToggle.classList.add("btn-outline-danger");

            iconToggle.className = "mdi mdi-pause-circle";

            iniciarContador();

        } else {

            clearInterval(contadorInterval);

            textoSync.innerHTML = "Sincronizar";

            btnToggle.classList.remove("btn-outline-danger");
            btnToggle.classList.add("btn-outline-success");

            iconToggle.className = "mdi mdi-play-circle";
        }
    });

    // INICIAR AL CARGAR
    if (puedeSincronizar) {
        iniciarContador();
    }

    // boton agregar
    // btn_modal.on('click', function () {
    //     enviarFormulario(
    //         url_agregar,
    //         form,
    //         function (response) {
    //             modal.modal("hide");
    //             form[0].reset();
    //             alertCorrecto(response.mensaje)
    //             tablaAjax.ajax.reload();
    //         },
    //         function (response) {
    //             alertError(response.mensaje);
    //         }
    //     );
    // })

    // botón editar
    $(tabla).on('click', '.editar', function () {
        const id = $(this).data('id');

        obtenerDatos(
            url_editar,
            id,
            function (response) {
                form[0].reset();
                modal.modal("show");
                id_titulo_modal.text(titulo_modal_actualizar);
                rellenarFormulario(response.data);

            },
            function (response) {
                alertError(response.mensaje);
            }
        )
    });

    // botón ver
    $(tabla).on('click', '.ver', function () {
        const id = $(this).data('id');
        alertActualizar("Obteniendo orden...", "Por favor espere un momento");
        obtenerDatos(
            url_ver,
            id,
            function (response) {
                Swal.close();
                modal.modal("show");
                id_titulo_modal.text(titulo_modal_actualizar);

                // Guardar id_orden para el registro de asistencia
                _idOrdenActual = response.id_orden || null;

                renderCards(response.data);
            },
            function (response) {
                alertError(response.mensaje);
            }
        );
    });

    // botón ver
    $(tabla).on('click', '.estado', function () {
        const id = $(this).data('id');
        alertActualizar("Obteniendo estado...", "Por favor espere un momento");
        obtenerDatos(
            url_estado,
            id,
            function (response) {

                Swal.close();
                modal.modal("show");
                id_titulo_modal.text(titulo_modal_actualizar);

                // Guardar id_orden para el registro de asistencia
                _idOrdenActual = response.id_orden || null;

                renderCards(response.data);
            },
            function (response) {
                alertError(response.mensaje);
            }
        );
    });

    // Convierte "2026-05-20 00:00:00" -> "20/5/2026" (mismo formato de la ficha de referencia)
    function formatearFechaCorta(fechaStr) {
        if (!fechaStr) return '';
        const soloFecha = fechaStr.split(' ')[0];
        const partes = soloFecha.split('-');
        if (partes.length !== 3) return fechaStr;
        const [anio, mes, dia] = partes;
        return `${parseInt(dia, 10)}/${parseInt(mes, 10)}/${anio}`;
    }

    // boton info
    $(document).on('click', '.cliente-info', function (e) {

        e.stopPropagation();

        // Cerrar TODOS los popovers anteriores
        $('.cliente-info').each(function () {

            const instance = bootstrap.Popover.getInstance(this);

            if (instance) {
                instance.dispose();
            }

        });

        // Eliminar popovers huérfanos del DOM
        $('.popover').remove();

        const el = $(this);

        const campo = (label, valor) => `
            <div>
                <div class="text-muted" style="font-size:11px; text-transform:uppercase; letter-spacing:.02em;">${label}</div>
                <div style="font-weight:600;">${valor && valor !== '' ? valor : '—'}</div>
            </div>
        `;

        const contenido = `
        <div style="width:320px; font-size:12.5px;">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px 12px;">
                ${campo('Fecha', formatearFechaCorta(el.data('fecha')))}
                ${campo('N° Celular', el.data('celular'))}
                ${campo('Tipo de Trabajo', el.data('tipoTrabajo'))}
                ${campo('N° Documento', el.data('tipoDocumento') ? el.data('tipoDocumento') + ' - ' + (el.data('numDocumento') || '') : el.data('numDocumento'))}
                ${campo('Ticket', el.data('ticket'))}
                ${campo('N° Orden', el.data('numOrden'))}
                ${campo('Técnico', el.data('tecnico'))}
                ${campo('Coordenadas', el.data('georef'))}
            </div>
            <hr style="margin:8px 0;">
            ${campo('Dirección', el.data('direccion'))}
            <div style="margin-top:8px;">
                ${campo('Observaciones', el.data('observacion'))}
            </div>
        </div>
    `;

        const pop = new bootstrap.Popover(this, {
            html: true,
            trigger: 'manual',
            customClass: 'popover-cliente-info',
            content: contenido
        });

        pop.show();

    });


    // Cerrar popover al hacer click fuera
    $(document).on('click', function (e) {

        $('.cliente-info').each(function () {

            const popover = bootstrap.Popover.getInstance(this);

            // Si no existe popover, continuar
            if (!popover) return;

            // Elemento popover visible
            const tip = $('.popover');

            // Si el click NO fue sobre el botón NI sobre el popover
            if (
                !$(this).is(e.target) &&
                $(this).has(e.target).length === 0 &&
                tip.has(e.target).length === 0
            ) {
                popover.hide();
            }

        });

    });




    // botón liquidar
    // $(tabla).on('click', '.liquidar', function () {

    //     const id = $(this).data('id');

    //     productosUsados = [];
    //     renderTablaUsados();
    //     $('#liq_observaciones').val('');

    //     obtenerDatos(
    //         url_editar,
    //         id,
    //         function (response) {
    //             Swal.close();
    //             modal_2.modal('show');
    //             id_titulo_modal_2.text(titulo_modal_liquidar);

    //             // Cargar datos en el form
    //             $('#liq_id_orden').val(response.data.id_orden);
    //             $('#liq_id_trabajador').val(response.data.id_tecnico);
    //             $('#liq_numero').text(response.data.numero);
    //             $('#liq_tecnico').text(response.data.nombre_tecnico || '—');

    //             // También rellenar campos ocultos heredados
    //             rellenarFormulario(response.data);
    //             cargarProductos(response);
    //         },
    //         function (response) {
    //             alertError(response.mensaje);
    //         }
    //     );
    // });

    // botón eliminar
    $(tabla).on('click', '.eliminar', function () {
        const id = $(this).data('id');

        alertConfirmacion({
            titulo: "¿Eliminar registro?",
            onConfirm: function () {
                obtenerDatos(
                    url_eliminar,
                    id,
                    function (response) {
                        alertCorrecto(response.mensaje)
                        tablaAjax.ajax.reload();
                    },
                    function (response) {
                        alert("Error: " + response.mensaje);
                    }
                )
            }
        });

    });

    // TABLA EDITABLE
    $(tabla).on('change', '.editar-llamada', function () {

        const id = $(this).data('id');
        const estado = $(this).is(':checked') ? "Si" : "No";
        const checkbox = $(this);

        $.ajax({
            url: "ordenes/actualizar_llamada",
            type: "POST",
            data: {
                id: id,
                llamada_inconcert: estado
            },
            beforeSend: function () {
                checkbox.prop('disabled', true);
            },
            success: function (response) {
                alertCorrecto("Actualizado correctamente");
            },
            error: function () {
                alertError("Error al actualizar");
                checkbox.prop('checked', !checkbox.is(':checked'));
            },
            complete: function () {
                checkbox.prop('disabled', false);
            }
        });

    });

    $(tabla).on('change', '.editar-tecnico', function () {

        const idOrden = $(this).data('id');
        const idTecnico = $(this).val();
        const select = $(this);

        $.ajax({
            url: "ordenes/actualizar_tecnico",
            type: "POST",
            data: {
                id: idOrden,
                id_tecnico: idTecnico
            },
            beforeSend: function () {
                select.prop("disabled", true);
            },
            success: function () {
                alertCorrecto("Técnico actualizado");
            },
            error: function () {
                alertError("Error al actualizar");
            },
            complete: function () {
                select.prop("disabled", false);
            }
        });

    });

    $(tabla).on('change', '.editar-tecnico-reemplazo', function () {

        const idOrden = $(this).data('id');
        const idTecnicoReemplazo = $(this).val();
        const select = $(this);

        $.ajax({
            url: "ordenes/actualizar_tecnico_reemplazo",
            type: "POST",
            data: {
                id: idOrden,
                id_tecnico_reemplazo: idTecnicoReemplazo
            },
            beforeSend: function () {
                select.prop("disabled", true);
            },
            success: function () {
                alertCorrecto("Técnico reemplazo actualizado");
            },
            error: function () {
                alertError("Error al actualizar");
            },
            complete: function () {
                select.prop("disabled", false);
            }
        });

    });

    $(tabla).on('click', '.editar-motivo', function () {

        const span = $(this);

        // Evitar abrir múltiples selects
        if (span.hasClass("editando")) {
            return;
        }

        span.addClass("editando");

        const idOrden = span.data('id');
        const valorActual = span.attr('data-value') || "";

        // Lista de tipos de trabajo: usa los que ya existen en las órdenes
        const opciones = (typeof tipo_trabajos !== 'undefined' && tipo_trabajos.length)
            ? tipo_trabajos
            : [
                "VISITA EXTERNA",
                "RECABLEADO",
                "RECABLEADO EN CONDOMINIO",
                "TRASLADO",
                "TRASLADO EN CONDOMINIO",
                "REUBICACION CON RESERVA",
                "REUBICACION SIN RESERVA",
                "GARANTIA NO REALIZADA",
                "GARANTIA",
                "PEX",
                "ADICIONAL"
            ];

        let optionsHtml = `<option value= ""> Seleccionar</option> `;

        opciones.forEach(opcion => {

            const selected = opcion === valorActual ? "selected" : "";

            optionsHtml += `
            <option value="${opcion}" ${selected}>
                ${opcion}
            </option >
        `;
        });

        const select = $(`
        <select class="form-select form-select-sm editar-motivo-temp" ${esTecnico ? "disabled" : ""}>
            ${optionsHtml}
        </select>
        `);

        span.replaceWith(select);

        select.focus();

        select.on('change', function () {

            const nuevoValor = $(this).val();

            $.ajax({
                url: "ordenes/actualizar_motivo",
                type: "POST",
                data: {
                    id: idOrden,
                    tipo_trabajo: nuevoValor
                },
                beforeSend: function () {
                    select.prop("disabled", true);
                },
                success: function () {

                    const textoFinal = nuevoValor || "Sin especificar";

                    const nuevoSpan = `
                        <span class="badge bg-light text-dark editar-motivo"
                        data-id="${idOrden}"
                        data-value="${nuevoValor}"
                        style="cursor:pointer;">
                            ${textoFinal}
                            <i class="mdi mdi-pencil ms-1"></i>
                        </span>
                        `;

                    select.replaceWith(nuevoSpan);

                    alertCorrecto("Tipo trabajo actualizado");
                },
                error: function () {

                    alertError("Error al actualizar");

                    select.prop("disabled", false);
                }
            });

        });

    });




    $(document).on("shown.bs.collapse", ".collapse_detalle", function () {

        $(".collapse.show").not(this).collapse("hide");

        const id = $(this).data("id");
        const index = $(this).data("index");
        const titulo = ($(this).data("titulo") || "").toUpperCase();

        cargarDetalle(id, index, titulo);
    });


    function colorEstado(estado) {
        switch (estado) {
            case "Finalizada":
                return "bg-primary";
            case "Pendiente":
                return "bg-success";
            case "Cancelada":
                return "bg-danger";
            default:
                return "bg-secondary";
        }
    }

    function renderCards(data) {

        let html = "";

        data.forEach(item => {

            let badgeClass = colorEstado(item.estado);
            let collapseId = "collapse_" + item.index;
            html += `
        <div class="card shadow-sm border-secondary border mb-3" >
            <div class="list-group list-group-flush">
                <div class="list-group-item p-1 px-3">

                    <!-- FILA PRINCIPAL -->
                    <div class="d-flex align-items-center justify-content-between item-toggle"
                        data-bs-toggle="collapse"
                        data-bs-target="#${collapseId}"
                        style="cursor:pointer;">

                        <div class="d-flex align-items-center gap-3">
                            <img src="${item.imagen_base64}"
                                class="rounded"
                                width="40"
                                height="40"
                                style="object-fit:cover;">

                                <div>
                                    <h6 class="mb-1 fw-semibold">${item.titulo}</h6>
                                    <span class="badge ${badgeClass} rounded-pill px-2">
                                        ${item.estado}
                                    </span>
                                </div>
                        </div>

                        <i class="mdi mdi-chevron-down fs-4 text-muted transition-icon"></i>
                    </div>

                    <!-- DETALLE -->
                    <div class="collapse collapse_detalle"
                        id="${collapseId}"
                        data-id="${item.id}"
                        data-index="${item.index}"
                        data-titulo="${item.titulo}">
                        <div class="card card-body p-3" id="contenidoDetalle${item.index}">

                        </div>
                    </div>

                </div>
            </div>
                </div >
        `;
        });

        $("#contenedorCards").html(html);

        activarRotacionFlechas();
    }

    function activarRotacionFlechas() {
        document.querySelectorAll('.item-toggle').forEach(item => {
            item.addEventListener('click', function () {
                const icon = this.querySelector('.transition-icon');
                icon.classList.toggle('rotate');
            });
        });
    }

    function renderDetalle(data, index) {

        let badgeObligatorio = data.obligatorio
            ? `<span class="badge bg-danger" > SI</span > `
            : `<span class="badge bg-secondary" > NO</span > `;

        let fotosHTML = '';

        if (data.fotografias.length > 0) {
            data.fotografias.forEach(foto => {
                fotosHTML += `
        <div class="col-md-3 mb-3" >
            <div class="card shadow-sm h-100">
                <img src="${foto.imagen}" class="card-img-top" style="height:150px; object-fit:cover;">
                    <div class="card-body p-2 text-center">
                        <small class="fw-bold">${foto.titulo}</small>
                    </div>
            </div>
                </div >
        `;
            });
        }

        let html = `
        <div class="table-responsive mb-3" >
            <table class="table table-bordered table-sm align-middle">
                <thead class="table-light text-center">
                    <tr>
                        <th>Coordenadas de Inicio</th>
                        <th>Coordenadas de Fin</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>
                            <strong>GD:</strong> ${data.coordenadas_inicio.gd}<br>
                                <strong>GMS:</strong> ${data.coordenadas_inicio.gms}
                        </td>
                        <td>
                            <strong>GD:</strong> ${data.coordenadas_fin.gd}<br>
                                <strong>GMS:</strong> ${data.coordenadas_fin.gms}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div >

        <div class="mb-3">
            <p class="fw-semibold">${data.descripcion}</p>
        </div>

        <div class="row text-sm mb-3">
            <div class="col-md-2">
                <strong>Obligatorio</strong><br>
                ${badgeObligatorio}
            </div>
            <div class="col-md-2">
                <strong>Estimado:</strong><br>
                ${data.estimado || '-'}
            </div>
            <div class="col-md-2">
                <strong>Inicio:</strong><br>
                ${data.inicio || '-'}
            </div>
            <div class="col-md-2">
                <strong>Fin:</strong><br>
                ${data.fin || '-'}
            </div>
            <div class="col-md-2">
                <strong>Duración:</strong><br>
                ${data.duracion || '-'}
            </div>
            <div class="col-md-2">
                <strong>Motivo:</strong><br>
                ${data.motivo || '-'}
            </div>
        </div>

        <div class="mb-3">
            <strong>Observaciones</strong>
            <div class="border rounded p-2 bg-light">
                ${data.observaciones || 'Sin observaciones'}
            </div>
        </div>

        <div>
            <strong>Fotografías</strong>
            <div class="row mt-2">
                ${fotosHTML || '<p class="text-muted">Sin fotografías</p>'}
            </div>
        </div>
    `;

        document.getElementById("contenidoDetalle" + index).innerHTML = html;
    }

    function cargarDetalle(id, index, titulo) {

        alertActualizar("Obteniendo orden...", "Por favor espere un momento");

        obtenerDatos(
            url_consulta,
            id + "/" + index,
            function (response) {
                Swal.close();
                renderDetalle(response.data, index);

                // ── Registrar asistencia SOLO si es FOTO DOMICILIO ────────
                // Solo ese card trae data.inicio y data.fin (hora en que se
                // tomó la foto de llegada / salida del domicilio)
                const esFotoDomicilio = titulo && titulo.includes("FOTO DOMICILIO");
                const inicio = response.data && response.data.inicio
                    ? response.data.inicio : null;
                const fin = response.data && response.data.fin
                    ? response.data.fin : null;

                if (esFotoDomicilio && inicio && _idOrdenActual) {
                    fetch(base_url + 'recursos_humanos/asistencias/registrar_auto', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: new URLSearchParams({
                            id_orden: _idOrdenActual,
                            inicio: inicio,
                            fin: fin || ''
                        })
                    })
                        .then(function (r) { return r.json(); })
                        .then(function (res) {
                            if (res.success && res.estado === 'Tardanza') {
                                console.info('[Asistencia auto - Tardanza]', res.mensaje);
                            }
                        })
                        .catch(function (err) {
                            console.warn('[Asistencia auto]', err);
                        });
                }
                // ─────────────────────────────────────────────────────────
            },
            function (response) {
                alertError(response.mensaje);
            }
        );
    }



    // FILTROS ==============================

    $.fn.dataTable.ext.search.push(function (settings, data, dataIndex) {

        if (settings.nTable.id !== 'tabla-ordenes') {
            return true;
        }

        let fechaDesde = $('#fechaDesde').val();
        let fechaHasta = $('#fechaHasta').val();

        let fechaTabla = data[0]; // Columna Fecha Visita

        if (!fechaTabla) return true;

        // 🔥 Quitar la hora
        fechaTabla = fechaTabla.split(' ')[0]; // 2026-03-03

        // Si no se aplicó ningún filtro manual, mostrar solo las órdenes de HOY
        if (!fechaDesde && !fechaHasta) {
            const hoy = new Date();
            const hoyStr = hoy.getFullYear() + '-' +
                String(hoy.getMonth() + 1).padStart(2, '0') + '-' +
                String(hoy.getDate()).padStart(2, '0');
            return fechaTabla === hoyStr;
        }

        let fechaRegistro = new Date(fechaTabla);

        if (fechaDesde) {
            let desde = new Date(fechaDesde);
            if (fechaRegistro < desde) return false;
        }

        if (fechaHasta) {
            let hasta = new Date(fechaHasta);
            if (fechaRegistro > hasta) return false;
        }

        return true;
    });

    $('#filtrarFecha').on('click', function () {
        tablaAjax.draw();
        alertCorrecto("Filtrado correctamente");
    });

    $('#limpiarFiltro').on('click', function () {
        $('#fechaDesde').val('');
        $('#fechaHasta').val('');
        tablaAjax.draw();
        alertCorrecto("Limpio");
    });


    // LIQUIDAR ==============================


    // ─── Estado interno del modal ────────────────────────────────────────
    let productosUsados = [];   // items ya agregados a liquidar
    let stockDisponible = {};   // { id_producto: cantidad_restante }
    let limitesMateriales = {}; // { id_producto: cantidad_maxima } del motivo de la orden

    // ─── Límites de materiales del motivo ────────────────────────────────
    function limiteDe(id) {
        return parseFloat(limitesMateriales[id]) || 0;
    }

    // Cuánto de un producto ya está agregado al carrito (excluye bajas y,
    // opcionalmente, el ítem con índice excluirIdx).
    function usadoDe(id, excluirIdx) {
        let usado = 0;
        productosUsados.forEach(function (p, i) {
            if (p.es_baja) return;
            if (excluirIdx !== undefined && i === excluirIdx) return;
            if (p.id_producto == id) usado += (parseFloat(p.cantidad) || 0);
        });
        return usado;
    }

    // Carga los límites que vienen del backend (según el tipo de trabajo del
    // motivo) y pinta el aviso en el modal de liquidar.
    function pintarLimitesMateriales(limites) {
        limitesMateriales = {};
        $('#liq_limites_aviso').addClass('d-none');
        $('#liq_limites_texto').empty();

        const lista = Array.isArray(limites) ? limites : [];
        if (!lista.length) return;

        lista.forEach(function (l) {
            const id = parseInt(l.id_producto);
            const cant = parseFloat(l.cantidad);
            if (id > 0 && cant > 0) limitesMateriales[id] = cant;
        });

        const lineas = lista
            .filter(function (l) { return limiteDe(l.id_producto) > 0; })
            .map(function (l) {
                return `<div><strong>${l.nombre || 'Producto'}:</strong> máximo ${l.cantidad} unidad(es)</div>`;
            });

        if (lineas.length) {
            $('#liq_limites_texto').html(
                '<div class="fw-semibold mb-1">Este trabajo tiene límite de materiales:</div>' + lineas.join('')
            );
            $('#liq_limites_aviso').removeClass('d-none');
        }
    }

    // ─── Ocultar btn_modal_2 del footer cuando es modal de liquidar ──────
    $('#modal_2').on('show.bs.modal', function () {
        // Dar tiempo a que se escriba el título
        setTimeout(function () {
            if ($('#titulo_modal_2').text().toLowerCase().includes('liquidar')) {
                $('#btn_modal_2').hide();
            }
        }, 80);
    });
    $('#modal_2').on('hidden.bs.modal', function () {
        $('#btn_modal_2').show();
        productosUsados = [];
        stockDisponible = {};
        limitesMateriales = {};
        $('#liq_limites_aviso').addClass('d-none');
        $('#liq_limites_texto').empty();
    });

    // ─── Render tabla de stock disponible ────────────────────────────────
    // function cargarProductos(response) {
    //     let tbody = document.getElementById('tablaProductos');
    //     tbody.innerHTML = '';

    //     if (!response.productos || response.productos.length === 0) {
    //         tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">Sin stock disponible</td></tr>';
    //         return;
    //     }

    //     // Inicializar stock disponible
    //     stockDisponible = {};

    //     response.productos.forEach(function (prod) {

    //         if (parseInt(prod.maneja_serie) === 1) {

    //             if (!prod.series || prod.series.length === 0) {
    //                 tbody.innerHTML += `
    //                     <tr>
    //                         <td class="ps-3">${prod.nombre_producto}</td>
    //                         <td colspan="3" class="text-muted small">Sin series disponibles</td>
    //                     </tr> `;
    //                 return;
    //             }

    //             prod.series.forEach(function (serie) {
    //                 tbody.innerHTML += `
    //                 <tr id="row_serie_${serie.id_producto_serie}">
    //                         <td class="ps-3">${prod.nombre_producto}</td>
    //                         <td class="serie_producto"><code class="small">${serie.numero_serie}</code></td>
    //                         <td class="text-center">1</td>
    //                         <td class="text-center">
    //                             <button type="button"
    //                                 class="btn btn-sm btn-outline-success rounded-pill btn-agregar-producto agregarProducto"
    //                                 data-id="${prod.id_producto}"
    //                                 data-nombre="${prod.nombre_producto}"
    //                                 data-serie="${serie.numero_serie}"
    //                                 data-id-serie="${serie.id_producto_serie}"
    //                                 data-maneja-serie="1">
    //                                 <i class="mdi mdi-plus"></i>
    //                             </button>
    //                         </td>
    //                     </tr> `;
    //             });

    //         } else {
    //             // Sin serie — guardar stock disponible para validación
    //             let stockActual = parseInt(prod.stock) || 0;
    //             stockDisponible[prod.id_producto] = stockActual;

    //             tbody.innerHTML += `
    //     <tr id="row_prod_${prod.id_producto}" >
    //                     <td class="ps-3">${prod.nombre_producto}</td>
    //                     <td class="text-muted small">—</td>
    //                     <td class="text-center fw-semibold disp_prod_${prod.id_producto}">${stockActual}</td>
    //                     <td class="text-center">
    //                         <button type="button"
    //                             class="btn btn-sm btn-outline-success rounded-pill agregarProducto"
    //                             data-id="${prod.id_producto}"
    //                             data-nombre="${prod.nombre_producto}"
    //                             data-stock="${stockActual}"
    //                             data-maneja-serie="0">
    //                             <i class="mdi mdi-plus"></i>
    //                         </button>
    //                     </td>
    //                 </tr> `;
    //         }
    //     });
    // }
    function renderStockTabla(idTbody, productos) {

        let tbody = document.getElementById(idTbody);
        tbody.innerHTML = '';

        if (!productos || productos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center text-muted py-3">
                        Sin stock disponible
                    </td>
                </tr>
            `;
            return;
        }

        productos.forEach(function (prod) {

            // ─── PRODUCTOS CON SERIE ─────────────
            if (parseInt(prod.maneja_serie) === 1) {

                if (!prod.series || prod.series.length === 0) {
                    tbody.innerHTML += `
                        <tr>
                            <td class="ps-3">${prod.nombre_producto}</td>
                            <td colspan="3" class="text-muted small">Sin series disponibles</td>
                        </tr>
                    `;
                    return;
                }

                prod.series.forEach(function (serie) {
                    // Solo en el modal de liquidar: botón de un clic para
                    // dar de baja sin digitar la serie.
                    const botonBaja = idTbody === 'tablaProductosEquipos'
                        ? `
                            <button type="button"
                                class="btn btn-sm btn-outline-danger rounded-pill btn-baja-producto ms-1"
                                data-id="${prod.id_producto}"
                                data-nombre="${prod.nombre_producto}"
                                data-serie="${serie.numero_serie}"
                                data-id-serie="${serie.id_producto_serie}"
                                title="Agregar como equipo de baja"
                                style="font-size:11px;">
                                <i class="mdi mdi-close-octagon-outline"></i> Baja
                            </button>`
                        : '';

                    tbody.innerHTML += `
                        <tr id="row_serie_${serie.id_producto_serie}">
                            <td class="ps-3">${prod.nombre_producto}</td>
                            <td class="serie_producto"><code class="small">${serie.numero_serie}</code></td>
                            <td class="text-center">1</td>
                            <td class="text-center">
                                <button type="button"
                                    class="btn btn-sm btn-outline-success rounded-pill btn-agregar-producto agregarProducto"
                                    data-id="${prod.id_producto}"
                                    data-nombre="${prod.nombre_producto}"
                                    data-serie="${serie.numero_serie}"
                                    data-id-serie="${serie.id_producto_serie}"
                                    data-maneja-serie="1"
                                    data-es-drop="${prod.es_drop || 0}">
                                    <i class="mdi mdi-plus"></i>
                                </button>                                ${botonBaja}
                            </td>
                        </tr>
                    `;
                });

            } else {

                // ─── PRODUCTOS SIN SERIE ─────────────
                let stockActual = parseInt(prod.stock) || 0;
                stockDisponible[prod.id_producto] = stockActual;

                tbody.innerHTML += `
                    <tr id="row_prod_${prod.id_producto}">
                        <td class="ps-3">${prod.nombre_producto}</td>
                        <td class="text-muted small">—</td>
                        <td class="text-center fw-semibold disp_prod_${prod.id_producto}">${stockActual}</td>
                        <td class="text-center">
                            <button type="button"
                                class="btn btn-sm btn-outline-success rounded-pill agregarProducto"
                                data-id="${prod.id_producto}"
                                data-nombre="${prod.nombre_producto}"
                                data-stock="${stockActual}"
                                data-maneja-serie="0"
                                data-es-drop="${prod.es_drop || 0}">
                                <i class="mdi mdi-plus"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }
        });
    }

    // ─── Cargar stock del técnico separado en 2 bloques reales:
    //     EQUIPOS y MATERIALES O FERRETERIA ──────────────────────────────
    function cargarProductos(response) {

        stockDisponible = {};

        if (!response.productos || response.productos.length === 0) {
            renderStockTabla('tablaProductosEquipos', []);
            renderStockTabla('tablaProductosMateriales', []);
            poblarSelectBajaProducto([]);
            return;
        }

        const equipos = response.productos.filter(function (p) {
            return p.categoria_liquidar === 'EQUIPO';
        });

        const materiales = response.productos.filter(function (p) {
            return p.categoria_liquidar !== 'EQUIPO';
        });

        renderStockTabla('tablaProductosEquipos', equipos);
        renderStockTabla('tablaProductosMateriales', materiales);
        poblarSelectBajaProducto(equipos);
    }

    // Selector "a qué producto pertenece" para equipos de baja: se arma con
    // los tipos de equipo que maneja el técnico (ONT, MESH, etc.), sin
    // duplicados. Si en el futuro un técnico necesita dar de baja un tipo
    // de equipo que nunca ha cargado, no aparecerá aquí — avísame si eso
    // pasa seguido y lo cambiamos para listar todo el catálogo de EQUIPOS.
    function poblarSelectBajaProducto(equipos) {

        const select = document.getElementById('liq_baja_producto');
        if (!select) return;

        const vistos = new Set();
        let opciones = '<option value="">Producto...</option>';

        equipos.forEach(function (p) {
            if (vistos.has(p.id_producto)) return;
            vistos.add(p.id_producto);
            opciones += `<option value="${p.id_producto}">${p.nombre_producto}</option>`;
        });

        select.innerHTML = opciones;
    }


    // ─── Render tabla de materiales usados ───────────────────────────────
    function renderTablaUsados() {
        let tbody = document.getElementById('tablaUsados');
        let counter = document.getElementById('contadorUsados');

        let totalItems = productosUsados.reduce(function (s, p) { return s + p.cantidad; }, 0);
        counter.textContent = productosUsados.length;

        if (productosUsados.length === 0) {
            tbody.innerHTML = '<tr id="filaVaciaUsados"><td colspan="4" class="text-center text-muted fst-italic py-3">Agrega productos desde el stock disponible</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        productosUsados.forEach(function (p, idx) {
            let cantidadCell;

            if (p.es_baja) {
                // ─── EQUIPO DE BAJA ─────────────────
                cantidadCell = '<span class="badge badge-outline-danger">Baja</span>';

            } else if (parseInt(p.maneja_serie) === 1) {
                cantidadCell = '1';

            } else if (parseInt(p.es_drop) === 1) {
                // ─── SOLO PARA DROP: metraje por inicio/fin ─────────────
                let inicioVal = (p.drop_inicio !== undefined && p.drop_inicio !== null) ? p.drop_inicio : '';
                let finVal = (p.drop_fin !== undefined && p.drop_fin !== null) ? p.drop_fin : '';

                cantidadCell = `
                    <div class="d-flex justify-content-center align-items-end gap-1">
                        <div class="text-center">
                            <div class="badge badge-outline-success mb-1" style="font-size:9px;">INICIO</div>
                            <input type="number"
                                class="form-control form-control-sm text-center drop-inicio"
                                data-idx="${idx}"
                                value="${inicioVal}"
                                style="width:68px;">
                        </div>
                        <div class="text-center">
                            <div class="badge bg-success mb-1" style="font-size:9px;">FIN</div>
                            <input type="number"
                                class="form-control form-control-sm text-center drop-fin"
                                data-idx="${idx}"
                                value="${finVal}"
                                style="width:68px;">
                        </div>
                        <div class="text-center">
                            <div class="badge bg-secondary mb-1" style="font-size:9px;">TOTAL</div>
                            <div class="form-control form-control-sm text-center bg-light drop-total"
                                data-idx="${idx}"
                                style="width:68px;">${p.cantidad || 0}</div>
                        </div>
                    </div>
                `;

            } else {
                cantidadCell = `
                    <div class="input-group input-group-sm flex-nowrap"
                                    style = "width:180px;margin:auto;" >

                        <button type="button"
                            class="btn btn-outline-secondary decrementar"
                            data-idx="${idx}">
                            −
                        </button>

                        <input type="number"
                            class="form-control text-center px-1 cantidad_usada"
                            data-idx="${idx}"
                            value="${p.cantidad}"
                            min="1"
                            max="${p.stock_max}">

                        <button type="button"
                            class="btn btn-outline-secondary incrementar"
                            data-idx="${idx}">
                            +
                        </button>

                    </div>
                    `;
            }

            tbody.innerHTML += `
            <tr>
                    <td class="ps-3">${p.nombre}</td>
                    <td>${p.numero_serie ? `<code class="small">${p.numero_serie}</code>` : '<span class="text-muted">—</span>'}</td>
                    <td class="text-center">${cantidadCell}</td>
                    <td class="text-center">
                        <button type="button"
                            class="btn btn-sm btn-outline-danger rounded-pill quitarProducto"
                            data-idx="${idx}"
                            data-id="${p.id_producto}"
                            data-serie="${p.id_producto_serie || ''}">
                            <i class="mdi mdi-trash-can-outline"></i>
                        </button>
                    </td>
                </tr > `;
        });
    }

    // Calcular cantidad automática para DROP: el carrete se va gastando,
    // así que INICIO siempre debe ser mayor que FIN. Total = INICIO − FIN.
    $(document).on('input', '.drop-inicio, .drop-fin', function () {
        const idx = $(this).data('idx');
        const fila = $(this).closest('tr');
        const inicio = parseFloat(fila.find('.drop-inicio').val()) || 0;
        const fin = parseFloat(fila.find('.drop-fin').val()) || 0;

        let total = 0;
        if (inicio > fin) { total = inicio - fin; }

        productosUsados[idx].cantidad = total;
        productosUsados[idx].drop_inicio = inicio;
        productosUsados[idx].drop_fin = fin;

        fila.find('.drop-total').text(total);

        // Avisar visualmente si supera el límite del motivo (se valida al guardar)
        const maxLimite = limiteDe(productosUsados[idx].id_producto);
        if (maxLimite && total > maxLimite) {
            fila.find('.drop-total').addClass('text-danger fw-bold');
        } else {
            fila.find('.drop-total').removeClass('text-danger fw-bold');
        }
    });

    // ─── Agregar equipos de baja (paste de series) ───────────────────────
    $(document).on('click', '#btn_agregar_bajas', function () {

        const idProducto = $('#liq_baja_producto').val();
        const nombreProducto = $('#liq_baja_producto option:selected').text();

        if (!idProducto) {
            $('#liq_baja_producto_aviso').removeClass('d-none');
            $('#liq_baja_producto').focus();
            return;
        }
        $('#liq_baja_producto_aviso').addClass('d-none');

        const texto = $('#liq_baja_series').val().trim();
        if (!texto) return;

        const lineas = texto.split(/\r?\n/)
            .map(function (s) { return s.trim(); })
            .filter(function (s) { return s !== ''; });

        let agregadas = 0;

        lineas.forEach(function (serie) {
            const yaExiste = productosUsados.some(function (p) {
                return p.es_baja && p.numero_serie === serie;
            });
            if (yaExiste) return;

            productosUsados.push({
                id_producto: idProducto,
                nombre: `${nombreProducto} (baja)`,
                maneja_serie: 1,
                numero_serie: serie,
                id_producto_serie: null,
                cantidad: 1,
                stock_max: 1,
                es_baja: 1
            });
            agregadas++;
        });

        $('#liq_baja_series').val('');
        renderTablaUsados();

        if (agregadas > 0) {
            alertCorrecto(`Se agregaron ${agregadas} equipo(s) de baja.`);
        }
    });

    // ─── Baja de un clic desde el stock de equipos ───────────────────────
    // Sin digitar la serie: el equipo ya está en el stock del técnico
    // (por ejemplo, después de una liquidación rechazada que lo devolvió).
    $(document).on('click', '.btn-baja-producto', function () {

        const id = $(this).data('id');
        const nombre = $(this).data('nombre');
        const serie = $(this).data('serie');
        const idSerie = $(this).data('id-serie');

        const yaExiste = productosUsados.some(function (p) {
            return p.es_baja && p.numero_serie === serie;
        });
        if (yaExiste) {
            Swal.fire({ icon: 'warning', title: 'Ya agregado', text: `La serie ${serie} ya está en equipos de baja.`, timer: 1500, showConfirmButton: false });
            return;
        }

        productosUsados.push({
            id_producto: id,
            nombre: `${nombre} (baja)`,
            maneja_serie: 1,
            numero_serie: serie,
            id_producto_serie: idSerie,
            cantidad: 1,
            stock_max: 1,
            es_baja: 1
        });

        renderTablaUsados();
        alertCorrecto(`Serie ${serie} agregada a equipos de baja.`);
    });

    // ─── Bloquear equipos/materiales hasta ingresar el N° de acta ────────
    // El prefijo "010-" es fijo (no editable); el técnico solo llena el
    // resto. Ambos se combinan en el input oculto #liq_numero_acta, que es
    // el que realmente se guarda y el que usa el resto del formulario.
    function actualizarBloqueoActa() {
        const tieneActa = $('#liq_numero_acta').val().trim() !== '';
        $('#liq_bloque_productos').toggleClass('liq-bloqueado', !tieneActa);
        $('#liq_acta_aviso').toggleClass('d-none', tieneActa);
    }

    function sincronizarNumeroActa() {
        const sufijo = $('#liq_numero_acta_sufijo').val().trim();
        $('#liq_numero_acta').val(sufijo !== '' ? ('010-' + sufijo) : '');
        actualizarBloqueoActa();
    }

    $(document).on('input', '#liq_numero_acta_sufijo', sincronizarNumeroActa);

    // ─── Recalcular stock visual disponible ──────────────────────────────
    function actualizarStockVisual(id_producto) {
        let usado = 0;
        productosUsados.forEach(function (p) {
            if (p.id_producto == id_producto && !p.maneja_serie) {
                usado += p.cantidad;
            }
        });
        let original = stockDisponible[id_producto] || 0;
        let restante = original - usado;

        $(`.disp_prod_${id_producto} `).text(restante);

        // Deshabilitar botón si no queda stock
        $(`[data-id= "${id_producto}"][data-maneja-serie="0"]`)
            .prop('disabled', restante <= 0)
            .toggleClass('btn-outline-secondary', restante <= 0)
            .toggleClass('btn-outline-success', restante > 0);
    }

    // ─── Agregar producto ─────────────────────────────────────────────────
    $(document).on('click', '.agregarProducto', function () {
        let id = $(this).data('id');
        let nombre = $(this).data('nombre');
        let manejaSerieF = parseInt($(this).data('maneja-serie')) === 1;
        let numero_serie = $(this).data('serie') || null;
        let id_serie = $(this).data('id-serie') || null;
        let stock_max = parseInt($(this).data('stock')) || 1;
        let es_drop = parseInt($(this).data('es-drop')) === 1;

        if (manejaSerieF) {
            // Límite de materiales del motivo (cada serie cuenta 1 unidad)
            const maxLimite = limiteDe(id);
            if (maxLimite && usadoDe(id) + 1 > maxLimite) {
                Swal.fire({ icon: 'warning', title: 'Límite de materiales', text: `Este trabajo permite máximo ${maxLimite} unidad(es) de este producto.`, timer: 1800, showConfirmButton: false });
                return;
            }
            // Verificar que la serie no esté ya en la lista
            let yaExiste = productosUsados.some(function (p) {
                return p.numero_serie === numero_serie;
            });
            if (yaExiste) {
                Swal.fire({ icon: 'warning', title: 'Ya agregado', text: `La serie ${numero_serie} ya está en la lista.`, timer: 1500, showConfirmButton: false });
                return;
            }
            // Ocultar la fila de esa serie (ya usada)
            $(`#row_serie_${id_serie} `).fadeOut(200);

        } else {
            // Verificar stock disponible
            let usado = 0;
            productosUsados.forEach(function (p) {
                if (p.id_producto == id && !p.maneja_serie) usado += p.cantidad;
            });
            let restante = (stockDisponible[id] || 0) - usado;

            if (restante <= 0) {
                Swal.fire({ icon: 'warning', title: 'Sin stock', text: 'No hay más unidades disponibles de este producto.', timer: 1500, showConfirmButton: false });
                return;
            }

            // Límite de materiales del motivo
            const maxLimite = limiteDe(id);
            if (maxLimite && usado + 1 > maxLimite) {
                Swal.fire({ icon: 'warning', title: 'Límite de materiales', text: `Este trabajo permite máximo ${maxLimite} unidad(es) de este producto.`, timer: 1800, showConfirmButton: false });
                return;
            }

            // Si ya existe el producto (sin serie), sólo sumar cantidad
            let existente = productosUsados.find(function (p) {
                return p.id_producto == id && !p.maneja_serie;
            });
            if (existente) {
                existente.cantidad = Math.min(existente.cantidad + 1, existente.stock_max);
                renderTablaUsados();
                actualizarStockVisual(id);
                return;
            }
        }

        productosUsados.push({
            id_producto: id,
            nombre: nombre,
            maneja_serie: manejaSerieF ? 1 : 0,
            numero_serie: numero_serie,
            id_producto_serie: id_serie,
            cantidad: 1,
            stock_max: stock_max,
            es_drop: es_drop ? 1 : 0
        });

        renderTablaUsados();
        if (!manejaSerieF) actualizarStockVisual(id);
    });

    // ─── Quitar producto ──────────────────────────────────────────────────
    $(document).on('click', '.quitarProducto', function () {
        let idx = parseInt($(this).data('idx'));
        let id = $(this).data('id');
        let id_serie = $(this).data('serie');
        let item = productosUsados[idx];

        if (item && item.maneja_serie) {
            // Re-mostrar la fila de la serie
            $(`#row_serie_${item.id_producto_serie} `).fadeIn(200);
        }

        productosUsados.splice(idx, 1);
        renderTablaUsados();
        if (id && !item?.maneja_serie) actualizarStockVisual(id);
    });

    // ─── Controles de cantidad ────────────────────────────────────────────
    $(document).on('click', '.incrementar', function () {
        let idx = parseInt($(this).data('idx'));
        let item = productosUsados[idx];
        let id = item.id_producto;

        let usado = 0;
        productosUsados.forEach(function (p) { if (p.id_producto == id && !p.maneja_serie) usado += p.cantidad; });
        let restante = (stockDisponible[id] || 0) - usado;

        if (restante > 0) {

            // Límite de materiales del motivo
            const maxLimite = limiteDe(id);
            if (maxLimite && usado + 1 > maxLimite) {
                Swal.fire({ icon: 'warning', title: 'Límite de materiales', text: `Este trabajo permite máximo ${maxLimite} unidad(es) de este producto.`, timer: 1800, showConfirmButton: false });
                return;
            }

            item.cantidad++;
            renderTablaUsados();
            actualizarStockVisual(id);
        } else {
            Swal.fire({ icon: 'warning', title: 'Límite de stock', text: 'No hay más unidades disponibles.', timer: 1200, showConfirmButton: false });
        }
    });

    $(document).on('click', '.decrementar', function () {
        let idx = parseInt($(this).data('idx'));
        let item = productosUsados[idx];
        if (item.cantidad > 1) {
            item.cantidad--;
            renderTablaUsados();
            actualizarStockVisual(item.id_producto);
        }
    });

    $(document).on('change', '.cantidad_usada', function () {
        let idx = parseInt($(this).data('idx'));
        let item = productosUsados[idx];
        let val = parseInt($(this).val()) || 1;

        // No superar el stock disponible
        let usadoOtros = 0;
        productosUsados.forEach(function (p, i) {
            if (i !== idx && p.id_producto == item.id_producto && !p.maneja_serie) {
                usadoOtros += p.cantidad;
            }
        });
        let maxPermitido = (stockDisponible[item.id_producto] || item.stock_max) - usadoOtros;

        // Tampoco superar el límite de materiales del motivo
        const maxLimite = limiteDe(item.id_producto);
        if (maxLimite) {
            maxPermitido = Math.min(maxPermitido, maxLimite - usadoOtros);
        }

        val = Math.min(Math.max(val, 1), maxPermitido);
        if (val < 1) val = 1;

        item.cantidad = val;
        $(this).val(val);
        actualizarStockVisual(item.id_producto);
    });

    // ─── Guardar liquidación ──────────────────────────────────────────────
    $(document).on('click', '#btn_guardar_liquidacion', function () {

        if (productosUsados.length === 0) {
            Swal.fire({ icon: 'warning', title: 'Sin materiales', text: 'Agrega al menos un producto antes de guardar.', confirmButtonText: 'OK' });
            return;
        }

        // Validar límites de materiales del motivo antes de guardar
        const idsConLimite = Object.keys(limitesMateriales).map(Number);
        for (const id of idsConLimite) {
            const max = limiteDe(id);
            const usado = usadoDe(id);
            if (max && usado > max) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Límite de materiales excedido',
                    html: `Se superó el máximo de <strong>${max} unidad(es)</strong> permitidas para este trabajo.<br>Usado: <strong>${usado}</strong>. Ajusta las cantidades antes de guardar.`,
                    confirmButtonText: 'OK'
                });
                return;
            }
        }

        let id_orden = $('#liq_id_orden').val();
        let id_trabajador = $('#liq_id_trabajador').val();
        let numero_acta = $('#liq_numero_acta').val().trim();
        let observaciones = $('#liq_observaciones').val();
        let numOrden = $('#liq_numero').text();

        // Validar número de acta
        if (numero_acta === '') {
            Swal.fire({
                icon: 'warning',
                title: 'Número de acta requerido',
                text: 'Ingrese el número de acta para continuar.',
                confirmButtonText: 'OK'
            });
            $('#liq_numero_acta_sufijo').focus();
            return;
        }

        Swal.fire({
            title: '¿Confirmar liquidación?',
            html: `Se registrarán <strong> ${productosUsados.length}</strong > producto(s) para la orden <strong> #${numOrden}</strong >.`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, guardar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#0acf97'
        }).then(function (result) {
            if (!result.isConfirmed) return;

            let btn = $('#btn_guardar_liquidacion');
            btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-1"></span>Guardando…');

            fetch(base_url + 'ordenes/liquidar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    id_orden: id_orden,
                    id_trabajador: id_trabajador,
                    numero_acta: numero_acta,
                    observaciones: observaciones,
                    productos: JSON.stringify(productosUsados)
                })
            })
                .then(function (r) { return r.json(); })
                .then(function (response) {
                    if (response.success) {
                        $('#modal_2').modal('hide');
                        alertCorrecto(response.mensaje);
                        tablaAjax.ajax.reload();
                        productosUsados = [];
                        stockDisponible = {};
                    } else {
                        Swal.fire({ icon: 'error', title: 'Error', text: response.mensaje });
                    }
                })
                .catch(function () {
                    Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo conectar con el servidor.' });
                })
                .finally(function () {
                    btn.prop('disabled', false).html('<i class="mdi mdi-content-save-outline me-1"></i> Guardar liquidación');
                });
        });
    });

    // ─── Abrir modal de liquidar ──────────────────────────────────────────
    // REEMPLAZA el bloque existente que empieza con: $(tabla).on('click', '.liquidar', function () {
    $(tabla).on('click', '.liquidar', function () {

        let id = $(this).data('id');

        productosUsados = [];
        stockDisponible = {};
        limitesMateriales = {};
        $('#liq_limites_aviso').addClass('d-none');
        $('#liq_limites_texto').empty();
        renderTablaUsados();
        $('#liq_observaciones').val('');
        $('#liq_numero_acta').val('');
        $('#liq_numero_acta_sufijo').val('');
        $('#liq_baja_series').val('');
        $('#liq_baja_producto_aviso').addClass('d-none');
        actualizarBloqueoActa();

        const placeholderCarga = '<tr><td colspan="4" class="text-center py-3"><span class="spinner-border spinner-border-sm text-primary"></span> Cargando stock…</td></tr>';
        $('#tablaProductosEquipos').html(placeholderCarga);
        $('#tablaProductosMateriales').html(placeholderCarga);

        obtenerDatos(
            url_editar,
            id,
            function (response) {

                modal_2.modal('show');
                id_titulo_modal_2.text(titulo_modal_liquidar);

                $('#liq_id_orden').val(response.data.id_orden);
                $('#liq_id_trabajador').val(response.data.id_tecnico);
                $('#liq_numero').text(response.data.numero);
                // nombre_tecnico viene del JOIN en editar_()
                $('#liq_tecnico').text(response.data.nombre_tecnico || '—');
                $('#liq_cliente').text(response.data.cliente || '—');

                rellenarFormulario(response.data);
                cargarProductos(response);
                pintarLimitesMateriales(response.limites);
            },
            function (response) {
                alertError(response.mensaje);
            }
        );
    });


    // ─── Ver liquidación (solo lectura, orden ya liquidada) ──────────────
    function fmtMonedaLiq(valor) {
        const n = parseFloat(valor) || 0;
        return 'S/ ' + n.toFixed(2);
    }

    function fmtFechaLiq(fechaStr) {
        if (!fechaStr) return '—';
        const soloFecha = fechaStr.split(' ')[0];
        const partes = soloFecha.split('-');
        if (partes.length !== 3) return fechaStr;
        const [anio, mes, dia] = partes;
        return `${parseInt(dia, 10)}/${parseInt(mes, 10)}/${anio}`;
    }

    function badgeEstadoLiqOrden(estado) {
        const map = {
            'Pendiente': 'bg-warning text-dark',
            'Aprobada': 'bg-success',
            'Rechazada': 'bg-danger'
        };
        return `<span class="badge ${map[estado] || 'bg-secondary'}">${estado || '—'}</span>`;
    }

    $(tabla).on('click', '.ver-liquidacion', function () {

        const id = $(this).data('id');

        $('#cuerpoVerLiquidacion').html(`
            <div class="text-center text-muted py-4">
                <span class="spinner-border spinner-border-sm text-primary"></span> Cargando…
            </div>
        `);

        $('#modalVerLiquidacion').modal('show');

        $.ajax({
            url: `liquidaciones/detalle/${id}`,
            type: 'GET',
            dataType: 'json',
            success: function (response) {

                if (!response.success) {
                    $('#cuerpoVerLiquidacion').html(`
                        <div class="text-center text-danger py-4">${response.mensaje || 'No se pudo cargar el detalle'}</div>
                    `);
                    return;
                }

                const c = response.data.cabecera;
                const materiales = response.data.materiales || [];

                // Cuando fue rechazada, TODOS los ítems de la liquidación
                // fueron devueltos al stock del técnico.
                const productosDevueltos = materiales.map(function (m) {
                    const nombre = m.nombre_producto || '—';
                    return m.numero_serie
                        ? `${nombre} <code class="small">${m.numero_serie}</code>`
                        : nombre;
                }).join('<br>');

                function filaMaterialLiq(m) {
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
                        </tr>
                    `;
                }

                function tablaGrupoLiq(titulo, icono, items) {
                    const filas = items.length
                        ? items.map(filaMaterialLiq).join('')
                        : `<tr><td colspan="3" class="text-center text-muted py-2 small">Sin registros</td></tr>`;

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
                                        </tr>
                                    </thead>
                                    <tbody>${filas}</tbody>
                                </table>
                            </div>
                        </div>
                    `;
                }

                const equiposLiq = materiales.filter(m => m.categoria_liquidar === 'EQUIPO');
                const materialesLiq = materiales.filter(m => m.categoria_liquidar !== 'EQUIPO');

                $('#cuerpoVerLiquidacion').html(`
                    <div class="alert alert-info py-2 mb-3 small">
                        <strong>Orden #${c.numero_orden}</strong> · Técnico: <strong>${c.tecnico}</strong><br>
                        N° Acta: <strong>${c.numero_acta || '—'}</strong> &nbsp;·&nbsp;
                        Fecha liquidación: ${fmtFechaLiq(c.fecha_liquidacion)} &nbsp;·&nbsp;
                        Estado: ${badgeEstadoLiqOrden(c.estado_liquidacion)}
                    </div>

                    ${c.estado_liquidacion === 'Rechazada' ? `
                        <div class="alert alert-danger py-2 mb-2 small">
                            <i class="mdi mdi-alert-circle-outline me-1"></i><strong>Motivo del rechazo:</strong><br>
                            ${c.motivo_rechazo || '—'}
                        </div>
                        <div class="alert alert-warning py-2 mb-3 small">
                            <i class="mdi mdi-archive-arrow-down me-1"></i><strong>Productos devueltos a tu stock:</strong><br>
                            ${productosDevueltos || 'Ninguno'}
                        </div>
                    ` : ''}

                    ${tablaGrupoLiq('Equipos', 'mdi-laptop text-primary', equiposLiq)}
                    ${tablaGrupoLiq('Materiales o ferretería', 'mdi-hammer-screwdriver text-warning', materialesLiq)}

                    ${c.observaciones ? `
                        <div class="mt-2">
                            <div class="text-muted small fw-semibold">Observaciones</div>
                            <div class="small">${c.observaciones}</div>
                        </div>
                    ` : ''}

                    <div class="text-muted small fst-italic mt-2">
                        <i class="mdi mdi-lock-outline"></i> Esta liquidación ya fue registrada y no se puede modificar desde aquí.
                    </div>
                `);
            },
            error: function () {
                $('#cuerpoVerLiquidacion').html(`
                    <div class="text-center text-danger py-4">Error al cargar el detalle</div>
                `);
            }
        });
    });



    // ─── ESCÁNER DE CÓDIGOS (cámara + foto) ──────────────────────────────
    let scanner = null;
    let scannerIniciado = false;
    let procesandoScan = false;
    let ultimoErrorScan = 0;

    function setScannerEstado(texto, tipo) {
        const el = document.getElementById('scanner_estado');
        if (!el) return;
        el.textContent = texto || '';
        el.className = 'small text-center mt-2 ' + (tipo === 'ok' ? 'text-success' : tipo === 'error' ? 'text-danger' : 'text-muted');
    }

    function detenerScanner() {
        if (scanner && scannerIniciado) {
            scannerIniciado = false;
            return scanner.stop().catch(function () { });
        }
        return Promise.resolve();
    }

    $('#btn_escanear').on('click', function () {

        $('#modalScanner').modal('show');

        scanner = new Html5Qrcode("reader");

        scanner.start(
            { facingMode: "environment" },
            {
                fps: 10,
                qrbox: 250
            },
            function (decodedText) {

                if (procesandoScan) return;
                procesandoScan = true;
                setTimeout(function () { procesandoScan = false; }, 3000);

                setScannerEstado('✓ Código leído', 'ok');
                $('#reader').css('outline', '3px solid #0acf97');
                setTimeout(function () { $('#reader').css('outline', ''); }, 600);

                buscarSerie(decodedText);
            },
            function () {
                const ahora = Date.now();
                if (ahora - ultimoErrorScan < 2000) return;
                ultimoErrorScan = ahora;
                setScannerEstado('Escaneando… acerca el código al recuadro y mantén la cámara firme.');
            }
        ).then(function () {
            scannerIniciado = true;
            setScannerEstado('Escaneando… acerca el código al recuadro.');
        }).catch(function (err) {
            setScannerEstado('No se pudo iniciar la cámara: ' + (err || 'permiso denegado'), 'error');
        });

    });

    $('#modalScanner').on('hidden.bs.modal', function () {

        procesandoScan = false;

        if (scanner) {
            const s = scanner;
            scanner = null;
            scannerIniciado = false;
            s.stop()
                .then(function () { try { s.clear(); } catch (e) { } })
                .catch(function () { try { s.clear(); } catch (e) { } });
        }

    });

    // ─── Leer desde una foto (respaldo si la cámara no decodifica) ───────
    $(document).on('change', '#scanner_archivo', function () {

        const file = this.files && this.files[0];
        this.value = '';
        if (!file) return;

        detenerScanner().then(function () {

            if (!scanner) {
                scanner = new Html5Qrcode("reader");
            }

            setScannerEstado('Leyendo foto…');

            scanner.scanFile(file, true)
                .then(function (decodedText) {
                    setScannerEstado('');
                    $('#modalScanner').modal('hide');
                    buscarSerie(decodedText);
                })
                .catch(function () {
                    setScannerEstado('No se pudo leer el código desde la foto. Usa una foto más nítida y en primer plano.', 'error');
                });
        });
    });

    // ─── Buscar la serie escaneada en el stock del técnico ───────────────
    // 1) Si existe → la agrega al carrito (igual que presionar "+").
    // 2) Si NO existe → pregunta si desea darla de baja. Si confirma, pide
    //    el tipo de equipo (catálogo de EQUIPOS) y la agrega a
    //    "equipos de baja" (es_baja=1). Al guardar la liquidación, el
    //    backend la registra en producto_series como BAJA (queda en el
    //    inventario del almacén) y NO en el stock del técnico.
    function buscarSerie(serieEscaneada) {

        const serie = String(serieEscaneada || '').trim();
        if (!serie) return;

        let filaEncontrada = null;

        $('#tablaProductosEquipos tr, #tablaProductosMateriales tr').each(function () {

            const fila = $(this);

            const texto = fila.find('.serie_producto').text().trim();

            if (texto === serie) {
                filaEncontrada = fila;
                return false;
            }

        });

        if (filaEncontrada) {

            // EXISTE EN STOCK → agregar normalmente (CLICK AUTOMÁTICO EN "+")
            $('#modalScanner').modal('hide');

            filaEncontrada.find('.btn-agregar-producto').click();

            Swal.fire({
                icon: 'success',
                title: 'Producto agregado',
                timer: 1200,
                showConfirmButton: false
            });

            return;
        }

        // NO EXISTE EN EL STOCK DEL TÉCNICO → ofrecer dar de baja
        $('#modalScanner').modal('hide');

        Swal.fire({
            icon: 'question',
            title: 'Serie no encontrada en tu stock',
            html: `El número de serie <code>${serie}</code> no existe en tu stock.<br><br><strong>¿Deseas agregarlo a equipos de baja?</strong>`,
            showCancelButton: true,
            confirmButtonText: 'Sí, a equipos de baja',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#f06548'
        }).then(function (result) {
            if (result.isConfirmed) {
                elegirProductoParaBaja(serie);
            }
        });
    }

    // Pide el tipo de equipo (catálogo de EQUIPOS) y agrega la serie a baja
    function elegirProductoParaBaja(serie) {

        fetch(base_url + 'inventario/productos/listar_equipos')
            .then(function (r) { return r.json(); })
            .then(function (productos) {

                const equipos = (productos || []).filter(function (p) {
                    return p.categoria_liquidar === 'EQUIPO' && p.estado === 'Activo';
                });

                if (!equipos.length) {
                    Swal.fire({ icon: 'error', title: 'Sin equipos', text: 'No hay equipos en el catálogo para dar de baja.' });
                    return;
                }

                const opciones = {};
                equipos.forEach(function (p) {
                    opciones[p.id_producto] = p.nombre;
                });

                Swal.fire({
                    title: 'Tipo de equipo',
                    html: `¿A qué tipo de equipo pertenece la serie <code>${serie}</code>?`,
                    input: 'select',
                    inputOptions: opciones,
                    inputPlaceholder: 'Selecciona el tipo de equipo...',
                    showCancelButton: true,
                    confirmButtonText: 'Agregar a baja',
                    cancelButtonText: 'Cancelar',
                    confirmButtonColor: '#f06548'
                }).then(function (res) {
                    if (!res.isConfirmed || !res.value) return;

                    const prod = equipos.find(function (p) {
                        return String(p.id_producto) === String(res.value);
                    });
                    if (!prod) return;

                    agregarSerieBaja(prod, serie);
                });

            })
            .catch(function () {
                Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo cargar el catálogo de equipos.' });
            });
    }

    // Agrega la serie al carrito como equipo de baja (es_baja=1)
    function agregarSerieBaja(prod, serie) {

        const yaExiste = productosUsados.some(function (p) {
            return p.es_baja && p.numero_serie === serie;
        });
        if (yaExiste) {
            Swal.fire({ icon: 'warning', title: 'Ya agregado', text: `La serie ${serie} ya está en equipos de baja.`, timer: 1500, showConfirmButton: false });
            return;
        }

        productosUsados.push({
            id_producto: prod.id_producto,
            nombre: `${prod.nombre} (baja)`,
            maneja_serie: 1,
            numero_serie: serie,
            id_producto_serie: null,
            cantidad: 1,
            stock_max: 1,
            es_baja: 1
        });

        renderTablaUsados();
        alertCorrecto(`Serie ${serie} agregada a equipos de baja.`);
    }
});