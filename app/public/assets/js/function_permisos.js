// cespedes/public/assets/js/function_permisos.js — REEMPLAZAR COMPLETO
// La interfaz ahora se agrupa por áreas (Operaciones, RRHH, Inventario, ...)
// usando el catálogo servido desde PermitModel (CATALOGO_PERMISOS).

$(document).ready(function () {
    "use strict";

    // ─── Catálogo servido desde la vista (PermitModel::modulos / acciones) ──
    // Si faltan (p. ej. carga directa del JS), no hacemos nada.
    if (typeof CATALOGO_PERMISOS === 'undefined' || typeof ACCIONES_PERMISOS === 'undefined') return;

    const ACCIONES = Object.keys(ACCIONES_PERMISOS);              // orden de columnas
    const TOTAL_COLS = ACCIONES.length + 2;                        // + módulo + "Todos"

    // Paleta de colores para las cards (por índice de rol)
    const COLORES = ['#3d7fee', '#0acf97', '#ffbc00', '#fa5c7c', '#727cf5', '#39afd1', '#fd7e14', '#20c997'];

    // Selección actual (Set de claves "modulo.accion")
    let seleccion = new Set();

    // ─── Helpers ────────────────────────────────────────────────────────────
    function nombreModulo(modulo) {
        for (const grupo of Object.values(CATALOGO_PERMISOS)) {
            if (grupo.modulos[modulo]) return grupo.modulos[modulo].nombre;
        }
        return cap(modulo);
    }

    function cap(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function hex2rgba(hex, alpha) {
        let r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (!r) return `rgba(61,127,238,${alpha})`;
        return `rgba(${parseInt(r[1], 16)},${parseInt(r[2], 16)},${parseInt(r[3], 16)},${alpha})`;
    }

    function clavesDeModulo(modulo) {
        for (const grupo of Object.values(CATALOGO_PERMISOS)) {
            if (grupo.modulos[modulo]) {
                return grupo.modulos[modulo].acciones.map(a => `${modulo}.${a}`);
            }
        }
        return [];
    }

    function clavesDeGrupo(grupoKey) {
        let claves = [];
        Object.keys(CATALOGO_PERMISOS[grupoKey].modulos).forEach(function (modulo) {
            claves = claves.concat(clavesDeModulo(modulo));
        });
        return claves;
    }

    function aplicarColorCard(id_rol, color) {
        let card = $(`#card_wrap_${id_rol} .card-rol-item`);
        card.css('border-left-color', color);
        card.find('.rol-avatar').css({ background: hex2rgba(color, .12), color: color });
        card.find('.total_wrap_' + id_rol).closest('p').find('strong').css('color', color);
    }

    // ─── Cargar resumen en las cards ──────────────────────────────────────
    function cargarResumen() {
        $.getJSON(base_url + 'recursos_humanos/permisos/resumen', function (res) {
            if (!res.success || !res.data) return;
            res.data.forEach(function (row, idx) {
                let color = COLORES[idx % COLORES.length];
                aplicarColorCard(row.id_rol, color);

                $(`.total_wrap_${row.id_rol}`).text(row.total_permisos || 0);

                let html = '';
                if (row.modulos_activos) {
                    row.modulos_activos.split(',').filter(Boolean).forEach(function (mod) {
                        html += `<span class="badge me-1 mb-1"
                            style="background:${hex2rgba(color, .13)};color:${color};border:1px solid ${hex2rgba(color, .3)}">
                            ${nombreModulo(mod)}</span>`;
                    });
                }
                $(`.modulos_wrap_${row.id_rol}`).html(html || '<span class="text-muted small fst-italic">Sin permisos</span>');
            });
        });
    }

    cargarResumen();

    // ─── Abrir modal desde botón "Asignar permisos" (nuevo) ──────────────
    $('#btn_nuevo_permiso').on('click', function () {
        $('#modal_id_rol').val('').trigger('change');
        $('#buscar_modulo').val('');
        $('#modal_titulo_permisos').text('Asignar permisos');
        renderTablaPermisos([]);
        $('#modalPermisos').modal('show');
    });

    // ─── Abrir modal desde botón "Editar" de una card ────────────────────
    $(document).on('click', '.btn-editar-permisos', function () {
        let id_rol = $(this).data('id');
        let nombre = $(this).data('nombre');

        $('#modal_id_rol').val(id_rol).trigger('change');
        $('#buscar_modulo').val('');
        $('#modal_titulo_permisos').text('Editar permisos: ' + nombre);
        $('#tbody_permisos').html(
            '<tr><td colspan="' + TOTAL_COLS + '" class="text-center py-4">' +
            '<span class="spinner-border spinner-border-sm text-primary"></span> Cargando…</td></tr>'
        );
        $('#modalPermisos').modal('show');

        cargarPermisosRol(id_rol);
    });

    // ─── Al cambiar el selector de rol dentro del modal ──────────────────
    $(document).on('change', '#modal_id_rol', function () {
        let id_rol = $(this).val();
        $('#buscar_modulo').val('');
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

    // ─── Render tabla de permisos (agrupada por área) ─────────────────────
    function renderTablaPermisos(clavesActivas) {
        seleccion = new Set(clavesActivas || []);
        let html = '';

        Object.keys(CATALOGO_PERMISOS).forEach(function (grupoKey) {
            let grupo = CATALOGO_PERMISOS[grupoKey];
            let clavesGrupo = clavesDeGrupo(grupoKey);
            let marcadas = clavesGrupo.filter(c => seleccion.has(c)).length;

            // Fila cabecera del área
            html += `<tr class="grupo-header" data-grupo-fila="${grupoKey}">
                <td colspan="${TOTAL_COLS}">
                    <div class="d-flex align-items-center gap-2">
                        <div class="form-check mb-0">
                            <input class="form-check-input chk-grupo" type="checkbox"
                                   data-grupo="${grupoKey}" ${marcadas === clavesGrupo.length && clavesGrupo.length ? 'checked' : ''}>
                        </div>
                        <i class="mdi ${grupo.icono || 'mdi-folder-outline'} me-1 text-primary"></i>
                        <span class="grupo-titulo">${grupo.nombre}</span>
                        <span class="badge bg-primary grupo-badge badge-grupo-${grupoKey}">${marcadas}/${clavesGrupo.length}</span>
                    </div>
                </td>
            </tr>`;

            // Filas de módulos
            Object.keys(grupo.modulos).forEach(function (modulo) {
                let info = grupo.modulos[modulo];
                let filaMarcadas = 0;

                html += `<tr class="modulo-fila" data-grupo="${grupoKey}" data-modulo="${modulo}">
                    <td class="ps-4 fw-semibold">${info.nombre}</td>`;

                ACCIONES.forEach(function (accion) {
                    if (info.acciones.includes(accion)) {
                        let clave = `${modulo}.${accion}`;
                        let checked = seleccion.has(clave);
                        if (checked) filaMarcadas++;
                        html += `<td class="text-center">
                            <div class="form-check d-flex justify-content-center mb-0">
                                <input class="form-check-input permiso-check"
                                       type="checkbox"
                                       data-clave="${clave}"
                                       data-modulo="${modulo}"
                                       data-grupo="${grupoKey}"
                                       ${checked ? 'checked' : ''}>
                            </div></td>`;
                    } else {
                        html += `<td class="text-center text-muted small">—</td>`;
                    }
                });

                let todosMarcados = info.acciones.length > 0 && filaMarcadas === info.acciones.length;
                html += `<td class="text-center">
                    <div class="form-check d-flex justify-content-center mb-0">
                        <input class="form-check-input chk-fila"
                               type="checkbox"
                               data-modulo="${modulo}"
                               data-grupo="${grupoKey}"
                               ${todosMarcados ? 'checked' : ''}>
                    </div></td></tr>`;
            });
        });

        $('#tbody_permisos').html(html);
        actualizarContadores();
    }

    // ─── Contadores (total + por grupo) y estados de "todos" ──────────────
    function actualizarContadores() {
        $('#contador_checks').text(seleccion.size);

        Object.keys(CATALOGO_PERMISOS).forEach(function (grupoKey) {
            let clavesGrupo = clavesDeGrupo(grupoKey);
            let marcadas = clavesGrupo.filter(c => seleccion.has(c)).length;

            $(`.badge-grupo-${grupoKey}`).text(`${marcadas}/${clavesGrupo.length}`);

            let chkGrupo = $(`.chk-grupo[data-grupo="${grupoKey}"]`);
            if (clavesGrupo.length === 0) {
                chkGrupo.prop('checked', false).prop('indeterminate', false);
            } else if (marcadas === clavesGrupo.length) {
                chkGrupo.prop('checked', true).prop('indeterminate', false);
            } else if (marcadas === 0) {
                chkGrupo.prop('checked', false).prop('indeterminate', false);
            } else {
                chkGrupo.prop('checked', false).prop('indeterminate', true);
            }

            // Estado "Todos" de cada módulo del grupo
            Object.keys(CATALOGO_PERMISOS[grupoKey].modulos).forEach(function (modulo) {
                let clavesMod = clavesDeModulo(modulo);
                let marcadasMod = clavesMod.filter(c => seleccion.has(c)).length;
                let chkFila = $(`.chk-fila[data-modulo="${modulo}"]`);
                if (clavesMod.length === 0) {
                    chkFila.prop('checked', false).prop('indeterminate', false);
                } else if (marcadasMod === clavesMod.length) {
                    chkFila.prop('checked', true).prop('indeterminate', false);
                } else if (marcadasMod === 0) {
                    chkFila.prop('checked', false).prop('indeterminate', false);
                } else {
                    chkFila.prop('checked', false).prop('indeterminate', true);
                }
            });
        });
    }

    // ─── Marcar/desmarcar un área completa ────────────────────────────────
    $(document).on('change', '.chk-grupo', function () {
        let grupoKey = $(this).data('grupo');
        let checked = $(this).is(':checked');

        clavesDeGrupo(grupoKey).forEach(function (clave) {
            if (checked) seleccion.add(clave); else seleccion.delete(clave);
        });

        $(`.permiso-check[data-grupo="${grupoKey}"], .chk-fila[data-grupo="${grupoKey}"]`)
            .prop('checked', checked).prop('indeterminate', false);
        actualizarContadores();
    });

    // ─── Marcar/desmarcar módulo completo ─────────────────────────────────
    $(document).on('change', '.chk-fila', function () {
        let modulo = $(this).data('modulo');
        let checked = $(this).is(':checked');

        clavesDeModulo(modulo).forEach(function (clave) {
            if (checked) seleccion.add(clave); else seleccion.delete(clave);
        });

        $(`.permiso-check[data-modulo="${modulo}"]`).prop('checked', checked).prop('indeterminate', false);
        actualizarContadores();
    });

    // ─── Cambio de check individual ───────────────────────────────────────
    $(document).on('change', '.permiso-check', function () {
        let clave = $(this).data('clave');
        if ($(this).is(':checked')) {
            seleccion.add(clave);
        } else {
            seleccion.delete(clave);
        }
        actualizarContadores();
    });

    // ─── Buscador de módulos ──────────────────────────────────────────────
    $('#buscar_modulo').on('input', function () {
        let q = $(this).val().toLowerCase().trim();

        // Re-render conservando la selección actual
        renderTablaPermisos(Array.from(seleccion));

        if (!q) return;

        $('.modulo-fila').each(function () {
            let nombre = $(this).data('modulo');
            let label = nombreModulo(nombre).toLowerCase();
            $(this).toggleClass('d-none', !(nombre.includes(q) || label.includes(q)));
        });

        Object.keys(CATALOGO_PERMISOS).forEach(function (grupoKey) {
            let visibles = $(`.modulo-fila[data-grupo="${grupoKey}"]`).not('.d-none').length;
            $(`.grupo-header[data-grupo-fila="${grupoKey}"]`).toggleClass('d-none', visibles === 0);
        });
    });

    // ─── Marcar todo / Desmarcar todo ────────────────────────────────────
    $('#btn_marcar_todo').on('click', function () {
        let todas = [];
        Object.keys(CATALOGO_PERMISOS).forEach(function (g) {
            todas = todas.concat(clavesDeGrupo(g));
        });
        todas.forEach(c => seleccion.add(c));
        $('.permiso-check, .chk-fila, .chk-grupo').prop('checked', true).prop('indeterminate', false);
        actualizarContadores();
    });
    $('#btn_desmarcar_todo').on('click', function () {
        seleccion.clear();
        $('.permiso-check, .chk-fila, .chk-grupo').prop('checked', false).prop('indeterminate', false);
        actualizarContadores();
    });

    // ─── Guardar permisos ─────────────────────────────────────────────────
    $('#btn_guardar_permisos').on('click', function () {
        let id_rol = $('#modal_id_rol').val();
        if (!id_rol) {
            Swal.fire({ icon: 'warning', title: 'Selecciona un rol', text: 'Debes elegir el rol al que asignar los permisos.', confirmButtonText: 'OK' });
            return;
        }

        let claves = Array.from(seleccion);

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

});
