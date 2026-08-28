const fs = require('fs');

const jsPath = "C:/xampp/htdocs/corporacionescepe/public/assets/js/function_configuracion.js";

const cleanJs = `// app/public/assets/js/function_configuracion.js

$(document).ready(function () {
    "use strict";

    // Toggle mostrar/ocultar contraseña
    $(document).on('click', '.btn-toggle-pass', function () {
        const input = $(this).closest('.input-group').find('input');
        const icon = $(this).find('i');
        if (input.attr('type') === 'password') {
            input.attr('type', 'text');
            icon.removeClass('mdi-eye-outline').addClass('mdi-eye-off-outline');
        } else {
            input.attr('type', 'password');
            icon.removeClass('mdi-eye-off-outline').addClass('mdi-eye-outline');
        }
    });

    // 🚀 Botón: Conectar Cuenta de Google para Looker Studio
    $(document).on('click', '#btn_conectar_google', function () {
        const btn = $(this);
        btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-1"></span> Abriendo Chrome...');

        Swal.fire({
            icon: 'info',
            title: 'Iniciando conexión con Google...',
            html: 'Se abrirá una ventana de Google Chrome en tu pantalla.<br><br><b>1.</b> Ingresa tu correo (<b>liquidacionescorpces@gmail.com</b>) y contraseña.<br><b>2.</b> Deja que cargue el reporte.<br><b>3.</b> La ventana se cerrará sola y la sesión quedará guardada.',
            confirmButtonText: 'Entendido'
        });

        fetch('http://localhost:3000/api/looker/launch-login', { method: 'POST' })
            .then(res => res.json())
            .then(data => {
                btn.prop('disabled', false).html('<i class="mdi mdi-google fs-6"></i> Conectar Cuenta Google (Looker Studio)');
            })
            .catch(err => {
                console.error(err);
                btn.prop('disabled', false).html('<i class="mdi mdi-google fs-6"></i> Conectar Cuenta Google (Looker Studio)');
            });
    });

    // Guardar configuración
    $('#btn_guardar_config').on('click', function () {
        const btn = $(this);
        btn.prop('disabled', true)
            .html('<span class="spinner-border spinner-border-sm me-1"></span>Guardando...');

        enviarFormulario(
            'configuracion/sistema/guardar',
            $('#form_config'),
            function (response) {
                Swal.fire({
                    icon: 'success',
                    title: '¡Guardado!',
                    html: response.mensaje +
                        '<br><small class="text-muted mt-1 d-block">' +
                        'Los cambios se aplican en la próxima carga de página.</small>',
                    confirmButtonText: 'OK'
                }).then(function () {
                    location.reload();
                });
            },
            function (response) {
                alertError(response.mensaje);
            }
        );

        setTimeout(function () {
            btn.prop('disabled', false)
                .html('<i class="mdi mdi-content-save-outline me-1"></i> Guardar configuración');
        }, 1500);
    });
});
`;

fs.writeFileSync(jsPath, cleanJs, 'utf8');
console.log('✅ function_configuracion.js actualizado!');
