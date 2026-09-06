$(document).ready(function () {
    "use strict";

    // Configuración
    const tabla = "#tabla-motivos";

    const url_listar = "configuracion/motivos/listar";
    const url_agregar = "configuracion/motivos/agregar";
    const url_editar = "configuracion/motivos/editar";
    const url_eliminar = "configuracion/motivos/eliminar";

    const btn_agregar = $("#btn_agregar");
    const btn_modal = $("#btn_modal");

    const modal = $("#modal");
    const form = $("#form");
    const id_titulo_modal = $("#titulo_modal");

    const titulo_modal = "Nueva Motivo";
    const titulo_modal_actualizar = "Actualizar Motivo";

    // Inicializar tabla básica
    const columnas = [
        { data: "nombre" },
        { data: "tipo_trabajo", render: function (data) { return data ? data : '<span class="text-muted">—</span>'; } },
        { data: "precio_compra" },
        { data: "precio_venta" },
        {
            data: "limites_materiales",
            render: function (data) {
                if (!data) return '<span class="text-muted">—</span>';
                try {
                    const arr = JSON.parse(data);
                    if (!arr.length) return '<span class="text-muted">—</span>';
                    return `<span class="badge bg-warning text-dark">${arr.length} límite(s)</span>`;
                } catch (e) {
                    return '<span class="text-muted">—</span>';
                }
            }
        },
        { data: "estado", render: renderEstado },
        { data: "id_motivo", render: renderAcciones }
    ];

    const tablaAjax = inicializarTabla(tabla, url_listar, columnas);

    // ─── Límites de materiales ───────────────────────────────────────────
    // Fila editable: producto + cantidad máxima + quitar.
    function filaLimite(row) {
        const opts = (productosParaLimites || []).map(function (p) {
            const sel = row && parseInt(row.id_producto) === parseInt(p.id_producto) ? 'selected' : '';
            const drop = parseInt(p.es_drop) === 1 ? ' <span class="text-info">DROP</span>' : '';
            return `<option value="${p.id_producto}" ${sel}>${p.nombre}${drop}</option>`;
        }).join('');

        return `
            <div class="input-group input-group-sm mb-2 fila-limite">
                <select class="form-select limite-producto">
                    <option value="">Producto…</option>
                    ${opts}
                </select>
                <input type="number" class="form-control limite-cantidad"
                    min="0" step="any" placeholder="Cant. máx."
                    value="${row ? row.cantidad : ''}" style="max-width:110px">
                <button type="button" class="btn btn-outline-danger btn-remove-limite" title="Quitar">
                    <i class="mdi mdi-close"></i>
                </button>
            </div>
        `;
    }

    function agregarFilaLimite(row) {
        $('#limites_wrap').append(filaLimite(row || null));
    }

    function serializarLimites() {
        const lista = [];
        $('#limites_wrap .fila-limite').each(function () {
            const id = $(this).find('.limite-producto').val();
            const cant = parseFloat($(this).find('.limite-cantidad').val());
            if (id && !isNaN(cant) && cant > 0) {
                lista.push({ id_producto: parseInt(id), cantidad: cant });
            }
        });
        return lista.length ? JSON.stringify(lista) : '';
    }

    // botón agregar límite
    $(document).on('click', '#btn_agregar_limite', function () {
        agregarFilaLimite(null);
    });

    // quitar fila de límite
    $(document).on('click', '.btn-remove-limite', function () {
        $(this).closest('.fila-limite').remove();
    });

    // botón abrir modal
    btn_agregar.on('click', function () {
        form[0].reset();
        form.find('input[type="hidden"]').val('');
        $('#limites_wrap').empty();

        modal.modal("show");
        id_titulo_modal.text(titulo_modal);
    });

    // boton agregar
    btn_modal.on('click', function () {
        $('#limites_materiales').val(serializarLimites());

        enviarFormulario(
            url_agregar,
            form,
            function (response) {
                modal.modal("hide");
                form[0].reset();
                alertCorrecto(response.mensaje)
                tablaAjax.ajax.reload();
            },
            function (response) {
                alert("Error: " + response.mensaje);
            }
        );
    })

    // botón editar
    $(tabla).on('click', '.editar', function () {
        const id = $(this).data('id');

        obtenerDatos(
            url_editar,
            id,
            function (response) {
                form[0].reset();
                $('#limites_wrap').empty();

                let limites = [];
                if (response.data && response.data.limites_materiales) {
                    try { limites = JSON.parse(response.data.limites_materiales) || []; }
                    catch (e) { limites = []; }
                }
                if (!limites.length) agregarFilaLimite(null);
                limites.forEach(agregarFilaLimite);

                modal.modal("show");
                id_titulo_modal.text(titulo_modal_actualizar);
                rellenarFormulario(response.data);

            },
            function (response) {
                alert("Error: " + response.mensaje);
            }
        )
    });

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
});
