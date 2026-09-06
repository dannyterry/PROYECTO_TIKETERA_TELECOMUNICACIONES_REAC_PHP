$(document).ready(function () {
    "use strict";

    // Configuración
    const tabla = "#tabla-vehiculos";

    const url_listar = "movilidad/vehiculos/listar";
    const url_agregar = "movilidad/vehiculos/agregar";
    const url_editar = "movilidad/vehiculos/editar";
    const url_eliminar = "movilidad/vehiculos/eliminar";

    const btn_agregar = $("#btn_agregar");
    const btn_modal = $("#btn_modal");

    const modal = $("#modal");
    const form = $("#form");
    const id_titulo_modal = $("#titulo_modal");

    const titulo_modal = "Nuevo Vehiculo";
    const titulo_modal_actualizar = "Actualizar Vehiculo";

    // Inicializar tabla básica
    const columnas = [
        { data: "marca" },
        { data: "modelo" },
        { data: "tipo_vehiculo" },
        { data: "combustible" },
        { data: "placa" },
        { data: "anio" },
        { data: "transmision" },
        { data: "color" },
        { data: "estado_documento" },
        { data: "estado", render: renderEstadoVehiculo },
        { data: "observaciones" },
        { data: "id_vehiculo", render: renderAcciones }
    ];

    const tablaAjax = inicializarTabla(tabla, url_listar, columnas);

    // botón abrir modal
    btn_agregar.on('click', function () {
        form[0].reset();
        form.find('input[type="hidden"]').val('');

        limpiarPreviewsImagenes([
            { input: "imagenDelantera", preview: "previewDelantera" },
            { input: "imagenTrasera", preview: "previewTrasera" },
            { input: "img_tarjeta_propiedad", preview: "previewTarjeta" },
            { input: "img_revision", preview: "previewRevision" },
            { input: "img_soat", preview: "previewSoat" },
            { input: "img_certificado_gas", preview: "previewCertificado" },
        ]);

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
                rellenarPreviewsImagenes(
                    [
                        { preview: "previewDelantera", campo: "img_1" },
                        { preview: "previewTrasera", campo: "img_2" },
                        { preview: "previewTarjeta", campo: "img_tarjeta_propiedad" },
                        { preview: "previewRevision", campo: "img_revision" },
                        { preview: "previewSoat", campo: "img_soat" },
                        { preview: "previewCertificado", campo: "img_certificado_gas" },
                    ],
                    response.data,
                    base_url + RUTA_IMG_VEHICULO
                );

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

    document.getElementById("imagenDelantera").addEventListener("change", function (event) {
        let archivo = event.target.files[0];
        let preview = document.getElementById("previewDelantera");

        if (archivo) {
            let reader = new FileReader();
            reader.onload = function (e) {
                preview.src = e.target.result;
                preview.style.display = "block";
            }
            reader.readAsDataURL(archivo);
        }
    });

    document.getElementById("imagenTrasera").addEventListener("change", function (event) {
        let archivo = event.target.files[0];
        let preview = document.getElementById("previewTrasera");

        if (archivo) {
            let reader = new FileReader();
            reader.onload = function (e) {
                preview.src = e.target.result;
                preview.style.display = "block";
            }
            reader.readAsDataURL(archivo);
        }
    });

    document.getElementById("img_tarjeta_propiedad").addEventListener("change", function (event) {
        let archivo = event.target.files[0];
        let preview = document.getElementById("previewTarjeta");

        if (archivo) {
            let reader = new FileReader();
            reader.onload = function (e) {
                preview.src = e.target.result;
                preview.style.display = "block";
            }
            reader.readAsDataURL(archivo);
        }
    });

    document.getElementById("img_revision").addEventListener("change", function (event) {
        let archivo = event.target.files[0];
        let preview = document.getElementById("previewRevision");

        if (archivo) {
            let reader = new FileReader();
            reader.onload = function (e) {
                preview.src = e.target.result;
                preview.style.display = "block";
            }
            reader.readAsDataURL(archivo);
        }
    });

    document.getElementById("img_soat").addEventListener("change", function (event) {
        let archivo = event.target.files[0];
        let preview = document.getElementById("previewSoat");

        if (archivo) {
            let reader = new FileReader();
            reader.onload = function (e) {
                preview.src = e.target.result;
                preview.style.display = "block";
            }
            reader.readAsDataURL(archivo);
        }
    });

    document.getElementById("img_certificado_gas").addEventListener("change", function (event) {
        let archivo = event.target.files[0];
        let preview = document.getElementById("previewCertificado");

        if (archivo) {
            let reader = new FileReader();
            reader.onload = function (e) {
                preview.src = e.target.result;
                preview.style.display = "block";
            }
            reader.readAsDataURL(archivo);
        }
    });



});
