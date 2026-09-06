function renderAreas(data) {
    if (!data || !data.length) {
        return '<span class="text-muted">—</span>';
    }
    return data.map(function (nombre) {
        return `<span class="badge bg-soft-primary text-primary">${nombre}</span>`;
    }).join(' ');
}

$(document).ready(function () {
    "use strict";

    // Configuración
    const tabla = "#tabla-roles";

    const url_listar = "recursos_humanos/roles/listar";
    const url_agregar = "recursos_humanos/roles/agregar";
    const url_editar = "recursos_humanos/roles/editar";
    const url_eliminar = "recursos_humanos/roles/eliminar";
    const url_agregar_area = "recursos_humanos/roles/agregar_area";

    const btn_agregar = $("#btn_agregar");
    const btn_modal = $("#btn_modal");

    const modal = $("#modal");
    const form = $("#form");
    const id_titulo_modal = $("#titulo_modal");

    const titulo_modal = "Nuevo Rol";
    const titulo_modal_actualizar = "Actualizar Rol";

    // Inicializar tabla básica
    const columnas = [
        { data: "nombre" },
        { data: "descripcion" },
        { data: "areas", render: renderAreas },
        { data: "estado", render: renderEstado },
        { data: "id_rol", render: renderAcciones }
    ];

    const tablaAjax = inicializarTabla(tabla, url_listar, columnas);

    // botón abrir modal
    btn_agregar.on('click', function () {
        form[0].reset();
        form.find('input[type="hidden"]').val('');

        // Ningún área marcada al crear un rol nuevo
        form.find('.area-rol').prop('checked', false);

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

                // Marcar las áreas asignadas al rol
                const areasRol = (response.data.areas || []).map(Number);
                form.find('.area-rol').prop('checked', function () {
                    return areasRol.indexOf(Number($(this).val())) !== -1;
                });

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

    // Agregar una nueva área al catálogo (sin salir del formulario)
    $('#btn_agregar_area').on('click', function () {
        const nombre = $('#nueva_area').val().trim();

        if (!nombre) {
            alertWarning('Escribe el nombre del área.');
            return;
        }

        fetch(base_url + url_agregar_area, {
            method: "POST",
            body: new URLSearchParams({ nombre: nombre })
        })
            .then(function (response) { return response.json(); })
            .then(function (data) {
                if (data.success) {
                    const idArea = data.id_area;

                    // Nuevo checkbox, marcado por defecto
                    const $cb = $(
                        `<div class="form-check form-check-inline mb-1">
                            <input class="form-check-input area-rol" type="checkbox"
                                name="areas[]" value="${idArea}" id="area_rol_${idArea}">
                            <label class="form-check-label" for="area_rol_${idArea}">${data.nombre}</label>
                        </div>`
                    );
                    $cb.find('input').prop('checked', true);
                    $('#caja_areas_rol').append($cb);
                    $cb[0].scrollIntoView({ block: 'nearest', behavior: 'smooth' });

                    $('#nueva_area').val('');
                    alertCorrecto('Área agregada.');
                } else {
                    alertError(data.mensaje || 'No se pudo agregar el área.');
                }
            })
            .catch(function () {
                alertError('Error de red o del servidor.');
            });
    });
});
