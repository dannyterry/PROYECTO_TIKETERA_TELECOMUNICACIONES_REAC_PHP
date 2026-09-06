$(document).ready(function () {
    "use strict";

    // Configuración
    const tabla = "#tabla-proveedores";

    const url_listar = "inventario/proveedores/listar";
    const url_agregar = "inventario/proveedores/agregar";
    const url_editar = "inventario/proveedores/editar";
    const url_eliminar = "inventario/proveedores/eliminar";

    const btn_agregar = $("#btn_agregar");
    const btn_modal = $("#btn_modal");
    const btn_buscar_ruc = $("#btn_buscar_ruc");

    const modal = $("#modal");
    const form = $("#form");
    const id_titulo_modal = $("#titulo_modal");

    const titulo_modal = "Nueva Proveedor";
    const titulo_modal_actualizar = "Actualizar Proveedor";

    // Inicializar tabla básica
    const columnas = [
        { data: "razon_social" },
        { data: "nombre_comercial" },
        { data: "ruc" },
        { data: "telefono" },
        { data: "email" },
        { data: "direccion" },
        { data: "estado", render: renderEstado },
        { data: "id_proveedor", render: renderAcciones }
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

    // botón buscar ruc
    btn_buscar_ruc.on('click', function () {

        let ruc = $('#ruc').val();

        consultarRUC(ruc, function (error, response) {

            if (error) {
                alertError(error.responseJSON.message);
                return;
            }

            if (!response.success) {
                alertError("No se encontró información");
                return;
            }

            let datos = response.data;

            // Rellenar inputs
            $('#ruc').val(datos.ruc);
            $('#razon_social').val(datos.nombre_o_razon_social);
            $('#direccion').val(datos.direccion_completa);
            $('#nombre_comercial').val(datos.nombre_o_razon_social);
        });


    });
});
