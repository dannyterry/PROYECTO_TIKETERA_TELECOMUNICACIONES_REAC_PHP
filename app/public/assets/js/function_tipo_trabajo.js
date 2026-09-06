$(document).ready(function () {
    "use strict";

    // Configuración
    const tabla = "#tabla-tipos-trabajo";

    const url_listar = "configuracion/tipo_trabajo/listar";
    const url_agregar = "configuracion/tipo_trabajo/agregar";
    const url_editar = "configuracion/tipo_trabajo/editar";
    const url_eliminar = "configuracion/tipo_trabajo/eliminar";

    const btn_agregar = $("#btn_agregar");
    const btn_modal = $("#btn_modal");

    const modal = $("#modal");
    const form = $("#form");
    const id_titulo_modal = $("#titulo_modal");

    const titulo_modal = "Nuevo Tipo de Trabajo";
    const titulo_modal_actualizar = "Actualizar Tipo de Trabajo";

    // Inicializar tabla básica
    const columnas = [
        { data: "nombre" },
        { data: "estado", render: renderEstado },
        { data: "id_tipo_trabajo", render: renderAcciones }
    ];

    const tablaAjax = inicializarTabla(tabla, url_listar, columnas);

    // botón abrir modal
    btn_agregar.on('click', function () {
        form[0].reset();
        form.find('input[type="hidden"]').val('');

        modal.modal("show");
        id_titulo_modal.text(titulo_modal);
    });

    // boton agregar
    btn_modal.on('click', function () {
        enviarFormulario(
            url_agregar,
            form,
            function (response) {
                modal.modal("hide");
                form[0].reset();
                alertCorrecto(response.mensaje);
                tablaAjax.ajax.reload();
            },
            function (response) {
                alert("Error: " + response.mensaje);
            }
        );
    });

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
                alert("Error: " + response.mensaje);
            }
        );
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
                        alertCorrecto(response.mensaje);
                        tablaAjax.ajax.reload();
                    },
                    function (response) {
                        alert("Error: " + response.mensaje);
                    }
                );
            }
        });
    });
});
