$(document).ready(function () {
    "use strict";

    // Configuración
    const url_validar = "login/validar";
    const btn_modal = $("#btn_modal");
    const form = $("#form");

    // boton validar
    btn_modal.on('click', function () {
        enviarFormulario(
            url_validar,
            form,
            function (response) {
                form[0].reset();
                window.location = base_url + "reportes";
            },
            function (response) {
                alertError(response.mensaje);
            }
        );
    })


});
