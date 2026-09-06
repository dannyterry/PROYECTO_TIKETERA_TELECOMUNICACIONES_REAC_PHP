
function inicializarTabla(selector, urlDatos, columnas, opcionesExtras = {}) {
    const opcionesBase = {
        keys: true,
        order: [],
        dom: 'Bfrtip',
        buttons: [
            {
                extend: 'copyHtml5',
                title: 'Reporte',
                text: '<i class="mdi mdi-content-copy"></i> Copiar',
                className: 'btn btn-secondary',
                titleAttr: 'Copiar al portapapeles',
                exportOptions: {
                    columns: ':not(:last-child)'
                }
            },
            {
                extend: 'excelHtml5',
                title: 'Reporte',
                text: '<i class="mdi mdi-file-excel"></i> Excel',
                className: 'btn btn-success',
                titleAttr: 'Exportar a Excel',
                exportOptions: {
                    columns: ':not(:last-child)'
                }
            },
            {
                extend: 'pdfHtml5',
                title: 'Reporte',
                text: '<i class="mdi mdi-file-pdf-box"></i> PDF',
                className: 'btn btn-danger',
                titleAttr: 'Exportar a PDF',
                exportOptions: {
                    columns: ':not(:last-child)'
                },
                customize: function (doc) {

                    // Centrar tabla
                    doc.content[1].table.widths =
                        Array(doc.content[1].table.body[0].length + 1).join('*').split('');

                    // Opcional: márgenes más pequeños
                    doc.pageMargins = [20, 20, 20, 20];


                    // Forzar ancho 100%
                    var table = doc.content[1].table;
                    var columnCount = table.body[0].length;
                    table.widths = Array(columnCount).fill('*');

                    // Centrar encabezados y contenido
                    table.body.forEach(function (row, rowIndex) {
                        row.forEach(function (cell) {
                            cell.alignment = 'center';
                        });
                    });
                }
            }
        ],
        ajax: {
            url: base_url + urlDatos,
            type: "POST",
            dataSrc: ""
        },
        columns: columnas,
        language: {
            url: "//cdn.datatables.net/plug-ins/1.13.4/i18n/es-ES.json",
            paginate: {
                previous: "<i class='mdi mdi-chevron-left'></i>",
                next: "<i class='mdi mdi-chevron-right'></i>"
            }
        },
        responsive: true,
        autoWidth: false,
        scrollCollapse: false,
        drawCallback: function () {
            $(".dataTables_paginate > .pagination").addClass("pagination-rounded");
        }
    };

    const opcionesFinales = $.extend(true, {}, opcionesBase, opcionesExtras);
    return $(selector).DataTable(opcionesFinales);
}

function renderImagen(data) {
    const imagen = data ? data : "default.webp";
    return `<img src="${url_assets}uploads/productos/${imagen}" alt="image" class="img-fluid avatar-sm" onerror="this.onerror=null;this.src='${url_assets}uploads/productos/default.webp';">`;
}

function renderPrecio(data) {
    return `${MONEDA} ${parseFloat(data).toFixed(2)}`;
}

function renderEstado(data) {
    const isActivo = data.toLowerCase() === 'activo';
    const badgeClass = isActivo ? 'success' : 'danger';

    return `<span class="badge bg-${badgeClass}">${data}</span>`;
}

function renderDrop(data) {
    const esDrop = parseInt(data) === 1;
    if (!esDrop) return '<span class="text-muted">—</span>';
    return '<span class="badge bg-info text-white">DROP</span>';
}

function renderEstadoAsistencia(data) {
    const estados = {
        asistio: 'success',
        tardanza: 'warning',
        falta: 'danger'
    };

    const estado = data.toLowerCase();
    const badgeClass = estados[estado] || 'secondary';

    return `<span class="badge bg-${badgeClass}">${data}</span>`;
}

function renderEstadoVehiculo(data) {
    const estados = {
        'disponible': 'success',
        'en uso': 'warning',
        'en mantenimiento': 'danger',
        'inactivo': 'secondary'
    };

    const estado = data.trim().toLowerCase();
    const badgeClass = estados[estado] || 'secondary';

    return `<span class="badge bg-${badgeClass}">${data}</span>`;
}

function renderEstadoCompra(data) {
    const estados = {
        'completada': 'success',
        'en proceso': 'warning',
        'cancelada': 'danger'
    };

    const estado = data.trim().toLowerCase();
    const badgeClass = estados[estado] || 'secondary';

    return `<span class="badge bg-${badgeClass}">${data}</span>`;
}

function renderEstadoOrden(data) {
    const estados = {
        'finalizada': 'primary',
        'agendada': 'secondary',
        'en camino': 'warning',
        'iniciada': 'info',
        'cancelada': 'danger',
        'regestión': 'dark'
    };

    const estado = data.trim().toLowerCase();
    const badgeClass = estados[estado] || 'secondary';

    return `<span class="badge bg-${badgeClass}">${data}</span>`;
}

function renderEstadoLLamada(data) {
    const estados = {
        si: 'success',
        no: 'danger'
    };

    const estado = data.toLowerCase();
    const badgeClass = estados[estado] || 'secondary';

    return `<span class="badge bg-${badgeClass}">${data}</span>`;
}

function renderAcciones(data, opciones = {}) {

    const {
        mostrarVer = false,
        mostrarEstado = false,
        mostrarLiq = false,
        mostrarStock = false,
        ocultarEditar = false,
        ocultarEliminar = false
    } = opciones;

    let botones = '';

    if (!ocultarEditar) {
        botones += `
            <button class="btn btn-sm btn-primary editar"
                data-id="${data}">
                Editar
            </button>
        `;
    }

    if (!ocultarEliminar) {
        botones += `
            <button class="btn btn-sm btn-danger eliminar"
                data-id="${data}">
                Eliminar
            </button>
        `;
    }

    if (mostrarVer) {
        botones += `
            <button class="btn btn-sm btn-info ver"
                data-id="${data}">
                Ver
            </button>
        `;
    }

    if (mostrarEstado) {
        botones += `
            <button class="btn btn-sm btn-info estado"
                data-id="${data}">
                Estado
            </button>
        `;
    }

    if (mostrarLiq) {
        botones += `
            <button class="btn btn-sm btn-primary liquidar"
                data-id="${data}">
                Liquidar
            </button>
        `;
    }

    if (mostrarStock) {
        botones += `
            <button class="btn btn-sm btn-info stockear"
                data-id="${data}">
                Stockear
            </button>
        `;
    }

    return botones;
}


(function injectValidationStyles() {
    if (document.getElementById('_cespedes_val_styles')) return;
    const s = document.createElement('style');
    s.id = '_cespedes_val_styles';
    s.textContent = `
        /* Campo inválido */
        .is-invalid-cespedes {
            border-color: #fa5c7c !important;
            box-shadow: 0 0 0 0.18rem rgba(250,92,124,.25) !important;
            background-color: #fff8f9 !important;
        }
        /* Mensaje de error debajo del campo */
        .invalid-feedback-cespedes {
            display: block;
            font-size: .78rem;
            color: #fa5c7c;
            margin-top: 2px;
        }
        /* Animación de shake */
        @keyframes _shake {
            0%,100%{ transform:translateX(0) }
            20%    { transform:translateX(-5px) }
            40%    { transform:translateX( 5px) }
            60%    { transform:translateX(-4px) }
            80%    { transform:translateX( 4px) }
        }
        .is-invalid-cespedes { animation: _shake .35s ease; }
    `;
    document.head.appendChild(s);
})();

function validarFormulario(form) {
    const el = form instanceof jQuery ? form[0] : form;
    const campos = el.querySelectorAll('[data-required="true"]');
    let valido = true;

    // Limpiar errores previos
    el.querySelectorAll('.is-invalid-cespedes').forEach(function (c) {
        c.classList.remove('is-invalid-cespedes');
    });
    el.querySelectorAll('.invalid-feedback-cespedes').forEach(function (m) {
        m.remove();
    });

    campos.forEach(function (campo) {

        // IGNORAR IMÁGENES
        if (campo.type === 'file') {
            return true;
        }

        let vacio = false;

        if (campo.tagName === 'SELECT') {
            vacio = !campo.value || campo.value === '';
        } else if (campo.tagName === 'TEXTAREA') {
            vacio = campo.value.trim() === '';
        } else {
            vacio = campo.value.trim() === '';
        }

        if (vacio) {
            valido = false;
            campo.classList.add('is-invalid-cespedes');

            // Mensaje debajo del campo
            const msg = document.createElement('div');
            msg.className = 'invalid-feedback-cespedes';
            msg.textContent = campo.dataset.label
                ? `El campo "${campo.dataset.label}" es obligatorio.`
                : 'Este campo es obligatorio.';

            // Insertar después del campo (o después del input-group si está dentro de uno)
            const parent = campo.closest('.input-group') || campo;
            parent.parentNode.insertBefore(msg, parent.nextSibling);

            // Quitar el error cuando el usuario empiece a escribir
            campo.addEventListener('input', function () { limpiarError(campo); }, { once: true });
            campo.addEventListener('change', function () { limpiarError(campo); }, { once: true });
        }
    });

    // Hacer scroll al primer campo inválido
    if (!valido) {
        const primero = el.querySelector('.is-invalid-cespedes');
        if (primero) {
            primero.scrollIntoView({ behavior: 'smooth', block: 'center' });
            primero.focus();
        }
    }

    return valido;
}

function validarFormularioSinImagen(form) {
    let valido = true;

    form.find('input, select, textarea').each(function () {
        const name = $(this).attr('name');

        // ignorar inputs de imagen
        if (name === 'imagen' || name === 'imagenes') {
            return true; // continue
        }

        if ($(this).prop('required') && !$(this).val()) {
            valido = false;
            $(this).addClass('is-invalid');
        }
    });

    return valido;
}

function limpiarError(campo) {
    campo.classList.remove('is-invalid-cespedes');
    const msg = campo.parentNode.querySelector('.invalid-feedback-cespedes') ||
        (campo.closest('.input-group') &&
            campo.closest('.input-group').parentNode.querySelector('.invalid-feedback-cespedes'));
    if (msg) msg.remove();
}


function enviarFormulario(url, form, onSuccess = () => { }, onError = () => { }) {

    // Validar antes de enviar
    if (!validarFormulario(form)) return;

    const formData = new FormData(form[0]);

    fetch(base_url + url, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                onSuccess(data);
            } else {
                onError(data);
            }
        })
        .catch(error => {
            console.error('Error en la petición:', error);
            onError({ mensaje: 'Error de red o del servidor.' });
        });
}

function obtenerDatos(url, id, onSuccess = () => { }, onError = () => { }) {
    fetch(base_url + url + "/" + id, {
        method: "GET"
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                onSuccess(data);
            } else {
                onError(data);
            }
        })
        .catch(error => {
            console.error("Error en la petición:", error);
            onError({ mensaje: "Error de red o del servidor." });
        });
}

function rellenarFormulario(datos) {
    for (const key in datos) {
        const campo = document.getElementById(key);
        if (
            campo &&
            (campo.tagName === "INPUT" || campo.tagName === "SELECT" || campo.tagName === "TEXTAREA")
        ) {

            if (campo.type === "file") continue;

            // CHECKBOX
            if (campo.type === "checkbox") {
                campo.checked = Boolean(datos[key]);
            }

            // RADIO
            else if (campo.type === "radio") {
                if (campo.value == datos[key]) {
                    campo.checked = true;
                }
            }

            campo.value = datos[key];
        }
    }
}

function rellenarPreviewsImagenes(lista, data, rutaBase = "") {

    lista.forEach(function (item) {

        let preview = document.getElementById(item.preview);

        if (!preview) return;

        let nombreImagen = data[item.campo];

        if (nombreImagen) {
            preview.src = rutaBase + nombreImagen;
            preview.style.display = "block";
        } else {
            preview.src = "";
            preview.style.display = "none";
        }

    });

}

function alertCorrecto(mensaje, time = 1500) {
    Swal.fire({
        position: "center",
        icon: "success",
        title: mensaje,
        showConfirmButton: false,
        timer: time
    });
}

function alertError(mensaje, time = 1500) {
    Swal.fire({
        position: "center",
        icon: "error",
        title: mensaje,
        showConfirmButton: false,
        timer: time
    });
}

function alertErrorFlotante(mensaje, time = 1500) {

    Swal.fire({
        toast: true,
        position: "top-end",
        icon: "error",
        title: mensaje,
        showConfirmButton: false,
        timer: time,

        heightAuto: false,
        scrollbarPadding: false
    });

}


function alertActualizar(mensaje, html, time = 1500) {
    Swal.fire({
        title: mensaje,
        html: html,
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });
}

function alertWarning(mensaje, titulo = "Advertencia") {
    Swal.fire({
        icon: "warning",
        title: titulo,
        text: mensaje,
        confirmButtonColor: "#f0ad4e",
        background: "#fff",
        allowOutsideClick: false,

        // AUTO CERRAR
        timer: 3000,
        timerProgressBar: true,
        showConfirmButton: false
    });
}

function alertConfirmacion({
    titulo = "¿Estás seguro?",
    texto = "¡No podrás revertir esto!",
    icono = "warning",
    textoConfirmacion = "Sí, eliminar",
    textoCancelar = "Cancelar",
    confirmColor = "#3085d6",
    cancelColor = "#d33",
    onConfirm = () => { }
}) {
    Swal.fire({
        title: titulo,
        text: texto,
        icon: icono,
        showCancelButton: true,
        confirmButtonColor: confirmColor,
        cancelButtonColor: cancelColor,
        confirmButtonText: textoConfirmacion,
        cancelButtonText: textoCancelar
    }).then((result) => {
        if (result.isConfirmed) {
            // Antes se mostraba aquí un "¡Hecho!" fijo apenas se llamaba a
            // onConfirm(), sin esperar la respuesta real del servidor (que
            // es asíncrona). Eso hacía ver un éxito falso incluso cuando la
            // acción fallaba. Cada handler ya muestra su propio resultado
            // real (alertCorrecto/alertError) cuando el servidor responde,
            // así que aquí ya no hace falta ni corresponde mostrar nada.
            onConfirm();
        }
    });
}

function limpiarPreviewsImagenes(lista) {

    lista.forEach(function (item) {

        let input = document.getElementById(item.input);
        let preview = document.getElementById(item.preview);

        if (input) input.value = "";

        if (preview) {
            preview.src = "";
            preview.style.display = "none";
        }

    });
}

function consultarDNI(dni, callback) {
    $.ajax({
        url: API_DNI_URL,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": API_DNI_TOKEN
        },
        data: JSON.stringify({
            dni: String(dni) // lo forzamos a string
        }),
        success: function (response) {
            callback(null, response);
        },
        error: function (xhr) {
            callback(xhr, null);
        }
    });
}

function consultarRUC(ruc, callback) {
    $.ajax({
        url: API_RUC_URL,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": API_CONSULTA_TOKEN
        },
        data: JSON.stringify({
            ruc: String(ruc)
        }),
        success: function (response) {
            callback(null, response);
        },
        error: function (xhr) {
            callback(xhr, null);
        }
    });
}

function configurarPreview(inputId, previewId) {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);

    if (!input || !preview) return;

    input.addEventListener('change', function (e) {
        const file = e.target.files[0];

        if (!file) return;

        const reader = new FileReader();

        reader.onload = function (event) {
            preview.src = event.target.result;
            preview.style.display = "block";
        };

        reader.readAsDataURL(file);
    });
}
