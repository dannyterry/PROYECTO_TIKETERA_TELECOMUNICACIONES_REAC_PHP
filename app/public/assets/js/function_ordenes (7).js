// cespedes/public/assets/js/function_permisos.js — ARCHIVO NUEVO (o reemplazar)

$(document).ready(function () {
    "use strict";

    // ─── Módulos y acciones (debe coincidir con PermitModel::modulos()) ──
    const MODULOS = {
        'dashboard': ['ver'],
        'ordenes': ['ver', 'crear', 'editar', 'eliminar', 'liquidar', 'sincronizar'],
        'usuarios': ['ver', 'crear', 'editar', 'eliminar'],
        'trabajadores': ['ver', 'crear', 'editar', 'eliminar'],
        'roles': ['ver', 'crear', 'editar', 'eliminar'],
        'permisos': ['ver', 'editar'],
        'horarios': ['ver', 'crear', 'editar', 'eliminar'],
        'asistencias': ['ver', 'crear', 'editar', 'eliminar'],
        'productos': ['ver', 'crear', 'editar', 'eliminar', 'exportar'],
        'categorias': ['ver', 'crear', 'editar', 'eliminar'],
        'almacenes': ['ver', 'crear', 'editar', 'eliminar'],
        'proveedores': ['ver', 'crear', 'editar', 'eliminar'],
        'compras': ['ver', 'crear', 'editar', 'eliminar', 'exportar'],
        'movimientos': ['ver', 'crear', 'editar', 'eliminar'],
        'stock': ['ver', 'editar'],
        'vehiculos': ['ver', 'crear', 'editar', 'eliminar'],
        'motivos': ['ver', 'crear', 'editar', 'eliminar'],
        'configuracion': ['ver', 'editar'],
    };

    // Columnas de la tabla (unión de todas las acciones posibles)
    const COLUMNAS = ['ver', 'crear', 'editar', 'eliminar', 'exportar', 'liquidar', 'sincronizar'];

    // Paleta de colores para las cards (por índice de rol)
    const COLORES = ['#3d7fee', '#0acf97', '#ffbc00', '#fa5c7c', '#727cf5', '#39afd1', '#fd7e14', '#20c997'];

    // ─── Cargar resumen en las cards ──────────────────────────────────────
    function cargarResumen() {
        $.getJSON(base_url + 'recursos_humanos/permisos/resumen', function (res) {
            if (!res.success || !res.data) return;
            res.data.forEach(function (row, idx) {
                let color = COLORES[idx % COLORES.length];
                aplicarColorCard(row.id_rol, color);

                // Contador
                $(`.total_wrap_${row.id_rol}`).text(row.total_permisos || 0);

                // Badges de módulos
                let html = '';
                if (row.modulos_activos) {
                    row.modulos_activos.split(',').filter(Boolean).forEach(function (mod) {
                        html += `<span class="badge me-1 mb-1"
                            style="background:${hex2rgba(color, .13)};color:${color};border:1px solid ${hex2rgba(color, .3)}">
                            ${cap(mod)}</span>`;
                    });
                }
                $(`.modulos_wrap_${row.id_rol}`).html(html || '<span class="text-muted small fst-italic">Sin permisos</span>');
            });
        });
    }

    cargarResumen();

    // ─── Abrir modal desde botón "Asignar permisos" (nuevo) ──────────────
    $('#btn_nuevo_permiso').on('click', function () {
        $('#modal_id_rol').val('').trigger('change');   // limpia el selector
        $('#modal_titulo_permisos').text('Asignar permisos');
        renderTablaPermisos([]);
        $('#modalPermisos').modal('show');
    });

    // ─── Abrir modal desde botón "Editar" de una card ────────────────────
    $(document).on('click', '.btn-editar-permisos', function () {
        let id_rol = $(this).data('id');
        let nombre = $(this).data('nombre');

        $('#modal_id_rol').val(id_rol).trigger('change');
        $('#modal_titulo_permisos').text('Editar permisos: ' + nombre);
        $('#tbody_permisos').html(
            '<tr><td colspan="8" class="text-center py-4">' +
            '<span class="spinner-border spinner-border-sm text-primary"></span> Cargando…</td></tr>'
        );
        $('#modalPermisos').modal('show');

        cargarPermisosRol(id_rol);
    });

    // ─── Al cambiar el selector de rol dentro del modal ──────────────────
    $(document).on('change', '#modal_id_rol', function () {
        let id_rol = $(this).val();
        if (!id_rol) {
            renderTablaPermisos([]);
            return;
        }
        let nombre = $(this).find('option:selected').text();
        $('#modal_titulo_permisos').text('Editar permisos: ' + nombre);
        cargarPermisosRol(id_rol);
    });

    function cargarPermisosRol(id_rol) {
        $.getJSON(base_url + `recursos_humanos/permisos/listar/${id_rol}`, function (res) {
            renderTablaPermisos(res.success ? res.data : []);
        }).fail(function () { renderTablaPermisos([]); });
    }

    // ─── Render tabla de permisos ─────────────────────────────────────────
    function renderTablaPermisos(clavesActivas) {
        let html = '';

        Object.keys(MODULOS).forEach(function (modulo) {
            let acciones = MODULOS[modulo];
            html += `<tr>
                <td class="ps-4 fw-semibold text-capitalize">${cap(modulo)}</td>`;

            COLUMNAS.forEach(function (col) {
                if (acciones.includes(col)) {
                    let clave = `${modulo}.${col}`;
                    let checked = clavesActivas.includes(clave) ? 'checked' : '';
                    html += `<td class="text-center">
                        <div class="form-check d-flex justify-content-center mb-0">
                            <input class="form-check-input permiso-check"
                                   type="checkbox"
                                   data-clave="${clave}"
                                   data-modulo="${modulo}"
                                   ${checked}>
                        </div></td>`;
                } else {
                    html += `<td class="text-center text-muted small">—</td>`;
                }
            });

            // Columna "Todos" para marcar/desmarcar fila
            let todosMarcados = acciones.every(a => clavesActivas.includes(`${modulo}.${a}`));
            html += `<td class="text-center">
                <div class="form-check d-flex justify-content-center mb-0">
                    <input class="form-check-input chk-fila"
                           type="checkbox"
                           data-modulo="${modulo}"
                           ${todosMarcados ? 'checked' : ''}>
                </div></td></tr>`;
        });

        $('#tbody_permisos').html(html);
        actualizarContador();
    }

    // ─── Contador de permisos seleccionados ──────────────────────────────
    function actualizarContador() {
        $('#contador_checks').text($('.permiso-check:checked').length);
    }

    // ─── Marcar/desmarcar fila completa ──────────────────────────────────
    $(document).on('change', '.chk-fila', function () {
        let modulo = $(this).data('modulo');
        let checked = $(this).is(':checked');
        $(`.permiso-check[data-modulo="${modulo}"]`).prop('checked', checked);
        actualizarContador();
    });

    // ─── Sincronizar chk-fila cuando cambia check individual ─────────────
    $(document).on('change', '.permiso-check', function () {
        let modulo = $(this).data('modulo');
        let total = $(`.permiso-check[data-modulo="${modulo}"]`).length;
        let marcados = $(`.permiso-check[data-modulo="${modulo}"]:checked`).length;
        let chkFila = $(`.chk-fila[data-modulo="${modulo}"]`);
        chkFila.prop('checked', total === marcados);
        chkFila.prop('indeterminate', marcados > 0 && marcados < total);
        actualizarContador();
    });

    // ─── Marcar todo / Desmarcar todo ────────────────────────────────────
    $('#btn_marcar_todo').on('click', function () {
        $('.permiso-check, .chk-fila').prop('checked', true).prop('indeterminate', false);
        actualizarContador();
    });
    $('#btn_desmarcar_todo').on('click', function () {
        $('.permiso-check, .chk-fila').prop('checked', false).prop('indeterminate', false);
        actualizarContador();
    });

    // ─── Guardar permisos ─────────────────────────────────────────────────
    $('#btn_guardar_permisos').on('click', function () {
        let id_rol = $('#modal_id_rol').val();
        if (!id_rol) {
            Swal.fire({ icon: 'warning', title: 'Selecciona un rol', text: 'Debes elegir el rol al que asignar los permisos.', confirmButtonText: 'OK' });
            return;
        }

        let claves = [];
        $('.permiso-check:checked').each(function () {
            claves.push($(this).data('clave'));
        });

        let btn = $(this);
        btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-1"></span>Guardando…');

        fetch(base_url + 'recursos_humanos/permisos/guardar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ id_rol: id_rol, claves: JSON.stringify(claves) })
        })
            .then(r => r.json())
            .then(function (response) {
                if (response.success) {
                    $('#modalPermisos').modal('hide');
                    Swal.fire({ icon: 'success', title: '¡Guardado!', text: response.mensaje, timer: 1800, showConfirmButton: false });
                    cargarResumen();   // Actualizar las cards
                } else {
                    Swal.fire({ icon: 'error', title: 'Error', text: response.mensaje });
                }
            })
            .catch(function () {
                Swal.fire({ icon: 'error', title: 'Error de red', text: 'No se pudo conectar con el servidor.' });
            })
            .finally(function () {
                btn.prop('disabled', false).html('<i class="mdi mdi-content-save-outline me-1"></i> Guardar permisos');
            });
    });

    // ─── Limpiar todos los permisos de un rol ────────────────────────────
    $(document).on('click', '.btn-limpiar-permisos', function () {
        let id_rol = $(this).data('id');
        let nombre = $(this).data('nombre');

        Swal.fire({
            title: `¿Quitar todos los permisos?`,
            html: `El rol <strong>${nombre}</strong> quedará sin acceso a ningún módulo.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, limpiar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#fa5c7c'
        }).then(function (result) {
            if (!result.isConfirmed) return;

            fetch(base_url + `recursos_humanos/permisos/eliminar/${id_rol}`)
                .then(r => r.json())
                .then(function (response) {
                    if (response.success) {
                        Swal.fire({ icon: 'success', title: 'Listo', text: response.mensaje, timer: 1500, showConfirmButton: false });
                        cargarResumen();
                    } else {
                        Swal.fire({ icon: 'error', title: 'Error', text: response.mensaje });
                    }
                });
        });
    });

    // ─── Helpers ─────────────────────────────────────────────────────────
    function cap(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function hex2rgba(hex, alpha) {
        let r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (!r) return `rgba(61,127,238,${alpha})`;
        return `rgba(${parseInt(r[1], 16)},${parseInt(r[2], 16)},${parseInt(r[3], 16)},${alpha})`;
    }

    function aplicarColorCard(id_rol, color) {
        let card = $(`#card_wrap_${id_rol} .card-rol-item`);
        card.css('border-left-color', color);
        card.find('.rol-avatar').css({ background: hex2rgba(color, .12), color: color });
        card.find('.total_wrap_' + id_rol).closest('p').find('strong').css('color', color);
    }

});