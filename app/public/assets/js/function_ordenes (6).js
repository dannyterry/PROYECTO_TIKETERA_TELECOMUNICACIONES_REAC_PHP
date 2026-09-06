$(document).ready(function () {
    "use strict";

    $('<style>').prop('type', 'text/css').html(`

        /* ── Tabla de órdenes ───────────────────────────── */
        #tabla-ordenes {
            table-layout: auto !important;
            white-space: nowrap !important;
            font-size: 0.63rem !important;
        }

        #tabla-ordenes td,
        #tabla-ordenes th {
            padding-top: 2px!important;
            padding-bottom: 2px!important;
            vertical-align: middle !important;
        }

        #tabla-ordenes .badge {
            font-size: 0.58rem !important;
        }

        #tabla-ordenes .form-select {
            font-size: 0.70rem !important;
            padding: 1px 4px !important;
            height: auto !important;
            min-width: 110px;
        }

        /* ── BOTONES SOLO DE ESTA TABLA ─────────────────── */
        #tabla-ordenes .btn {
            font-size: 0.70rem !important;
            padding: 2px 6px !important;
            line-height: 1.2 !important;
        }

        /* opcional: botones más compactos aún */
        #tabla-ordenes .btn-sm {
            font-size: 0.65rem !important;
            padding: 1px 5px !important;
        }

    `).appendTo('head');

    // Configuración
    let _idOrdenActual = null;
    const tabla = "#tabla-ordenes";

    const url_listar = "ordenes/listar";
    const url_agregar = "ordenes/agregar";
    const url_editar = "ordenes/editar";
    const url_ver = "ordenes/ver";
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

    // Inicializar tabla
    const columnas = [
        {
            data: "fecha_visita"
        },
        {
            data: "llamada_inconcert",
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
            data: "cliente"
        },
        {
            data: "id_tecnico",
            render: function (data, type, row) {

                if (type !== "display") {
                    return data;
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
                    data-id="${row.id_orden}">
                    ${options}
                </select>
            `;
            }
        },
        {
            data: "inicio_visita",
            render: function (data, type) {
                if (!data) return "";
                return data.split(" ")[1]?.substring(0, 5); // HH:mm
            }
        },
        {
            data: "fin_visita",
            render: function (data, type) {
                if (!data) return "";
                return data.split(" ")[1]?.substring(0, 5); // HH:mm
            }
        },
        {
            data: "estado",
            render: renderEstadoOrden
        },
        { data: "cuadrilla" },
        { data: "tipo_averia" },
        {
            data: "motivo_tipo_trabajo",
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

                let liquidar = row.estado === "Finalizada";

                return renderAcciones(data, {
                    mostrarVer: true,
                    mostrarLiq: liquidar,
                    ocultarEditar: true,
                    ocultarEliminar: true
                });
            }
        }
    ];

    const tablaAjax = inicializarTabla(tabla, url_listar, columnas, {
        scrollX: true,          // scroll horizontal en vez de responsive
        scrollCollapse: true,
        autoWidth: false,
        responsive: false,         // desactivar el plugin responsive
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

    // botón actualizar
    btn_actualizar.on('click', function () {
        alertActualizar("Buscando ordenes...", "Por favor espere un momento");

        $.ajax({
            url: "ordenes/actualizar_masivo",
            type: "POST",
            dataType: "json",
            success: function (response) {

                if (!response.success) {
                    alertError("Ocurrió un error al procesar la información.");
                    return;
                }

                if (response.total_insertados > 0 && response.total_actualizados > 0) {

                    alertCorrecto(
                        `Se insertaron ${response.total_insertados} y se actualizaron ${response.total_actualizados} órdenes.`
                    );

                    tablaAjax.ajax.reload();

                } else if (response.total_insertados > 0) {

                    alertCorrecto(
                        `Se insertaron ${response.total_insertados} órdenes nuevas.`
                    );

                    tablaAjax.ajax.reload();

                } else if (response.total_actualizados > 0) {

                    alertCorrecto(
                        `Se actualizaron ${response.total_actualizados} órdenes existentes.`
                    );

                    tablaAjax.ajax.reload();

                } else {

                    alertWarning("No se encontraron órdenes nuevas ni cambios para actualizar.");
                }
            },
            error: function () {
                alertError(response.mensaje);
            }
        });
    });

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
        const idOrden = span.data('id');
        const valorActual = span.data('value') || "";

        const input = $(`
            <input type="text"
                class="form-control form-control-sm editar-motivo-temp"
                value="${valorActual}"
            />
        `);

        span.replaceWith(input);
        input.focus();

        // Guardar con Enter o cuando pierde foco
        input.on('keydown blur', function (e) {

            if (e.type === "blur" || e.key === "Enter") {

                const nuevoValor = input.val().trim();

                $.ajax({
                    url: "ordenes/actualizar_motivo",
                    type: "POST",
                    data: {
                        id: idOrden,
                        motivo_tipo_trabajo: nuevoValor
                    },
                    beforeSend: function () {
                        input.prop("disabled", true);
                    },
                    success: function () {

                        const textoFinal = nuevoValor || "Sin especificar";

                        input.replaceWith(`
                            <span class="badge bg-light text-dark editar-motivo "
                                data-id="${idOrden}"
                                data-value="${nuevoValor}"
                                style="cursor:pointer;">
                                ${textoFinal}
                                 <i class="mdi mdi-pencil ms-1"></i>
                            </span>
                        `);

                        alertCorrecto("Tipo trabajo actualizado");
                    },
                    error: function () {
                        alertError("Error al actualizar");
                        input.prop("disabled", false);
                    }
                });
            }

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
                <div class="card shadow-sm border-secondary border mb-3">
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
                </div>
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
            ? `<span class="badge bg-danger">SI</span>`
            : `<span class="badge bg-secondary">NO</span>`;

        let fotosHTML = '';

        if (data.fotografias.length > 0) {
            data.fotografias.forEach(foto => {
                fotosHTML += `
                <div class="col-md-3 mb-3">
                    <div class="card shadow-sm h-100">
                        <img src="${foto.imagen}" class="card-img-top" style="height:150px; object-fit:cover;">
                        <div class="card-body p-2 text-center">
                            <small class="fw-bold">${foto.titulo}</small>
                        </div>
                    </div>
                </div>
            `;
            });
        }

        let html = `
        <div class="table-responsive mb-3">
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
        </div>

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
                // Solo ese card tiene data.inicio y data.fin
                const esFotoDomicilio = titulo && titulo.includes("FOTO");
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
    });

    // ─── Render tabla de stock disponible ────────────────────────────────
    function cargarProductos(response) {
        let tbody = document.getElementById('tablaProductos');
        tbody.innerHTML = '';

        if (!response.productos || response.productos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">Sin stock disponible</td></tr>';
            return;
        }

        // Inicializar stock disponible
        stockDisponible = {};

        response.productos.forEach(function (prod) {

            if (parseInt(prod.maneja_serie) === 1) {

                if (!prod.series || prod.series.length === 0) {
                    tbody.innerHTML += `
                        <tr>
                            <td class="ps-3">${prod.nombre_producto}</td>
                            <td colspan="3" class="text-muted small">Sin series disponibles</td>
                        </tr>`;
                    return;
                }

                prod.series.forEach(function (serie) {
                    tbody.innerHTML += `
                        <tr id="row_serie_${serie.id_producto_serie}">
                            <td class="ps-3">${prod.nombre_producto}</td>
                            <td><code class="small">${serie.numero_serie}</code></td>
                            <td class="text-center">1</td>
                            <td class="text-center">
                                <button type="button"
                                    class="btn btn-sm btn-outline-success rounded-pill agregarProducto"
                                    data-id="${prod.id_producto}"
                                    data-nombre="${prod.nombre_producto}"
                                    data-serie="${serie.numero_serie}"
                                    data-id-serie="${serie.id_producto_serie}"
                                    data-maneja-serie="1">
                                    <i class="mdi mdi-plus"></i>
                                </button>
                            </td>
                        </tr>`;
                });

            } else {
                // Sin serie — guardar stock disponible para validación
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
                                data-maneja-serie="0">
                                <i class="mdi mdi-plus"></i>
                            </button>
                        </td>
                    </tr>`;
            }
        });
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
            if (parseInt(p.maneja_serie) === 1) {
                cantidadCell = '1';
            } else {
                cantidadCell = `
                    <div class="input-group input-group-sm justify-content-center" style="width:96px;margin:auto">
                        <button type="button" class="btn btn-outline-secondary decrementar" data-idx="${idx}">−</button>
                        <input type="number"
                               class="form-control text-center px-1 cantidad_usada"
                               data-idx="${idx}"
                               value="${p.cantidad}"
                               min="1"
                               max="${p.stock_max}"
                               style="width:36px">
                        <button type="button" class="btn btn-outline-secondary incrementar" data-idx="${idx}">+</button>
                    </div>`;
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
                </tr>`;
        });
    }

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

        $(`.disp_prod_${id_producto}`).text(restante);

        // Deshabilitar botón si no queda stock
        $(`[data-id="${id_producto}"][data-maneja-serie="0"]`)
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

        if (manejaSerieF) {
            // Verificar que la serie no esté ya en la lista
            let yaExiste = productosUsados.some(function (p) {
                return p.numero_serie === numero_serie;
            });
            if (yaExiste) {
                Swal.fire({ icon: 'warning', title: 'Ya agregado', text: `La serie ${numero_serie} ya está en la lista.`, timer: 1500, showConfirmButton: false });
                return;
            }
            // Ocultar la fila de esa serie (ya usada)
            $(`#row_serie_${id_serie}`).fadeOut(200);

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
            stock_max: stock_max
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
            $(`#row_serie_${item.id_producto_serie}`).fadeIn(200);
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
        val = Math.min(Math.max(val, 1), maxPermitido);

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

        let id_orden = $('#liq_id_orden').val();
        let id_trabajador = $('#liq_id_trabajador').val();
        let observaciones = $('#liq_observaciones').val();
        let numOrden = $('#liq_numero').text();

        Swal.fire({
            title: '¿Confirmar liquidación?',
            html: `Se registrarán <strong>${productosUsados.length}</strong> producto(s) para la orden <strong>#${numOrden}</strong>.`,
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
        renderTablaUsados();
        $('#liq_observaciones').val('');
        $('#tablaProductos').html('<tr><td colspan="4" class="text-center py-3"><span class="spinner-border spinner-border-sm text-primary"></span> Cargando stock…</td></tr>');

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

                rellenarFormulario(response.data);
                cargarProductos(response);
            },
            function (response) {
                alertError(response.mensaje);
            }
        );
    });
    // =====================================================================
    // FIN SECCIÓN LIQUIDAR
    // =====================================================================

});
