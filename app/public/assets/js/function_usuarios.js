$(document).ready(function () {
    "use strict";

    // Configuración
    const tabla = "#tabla-usuarios";

    const url_listar = "recursos_humanos/usuarios/listar";
    const url_agregar = "recursos_humanos/usuarios/agregar";
    const url_editar = "recursos_humanos/usuarios/editar";
    const url_eliminar = "recursos_humanos/usuarios/eliminar";

    const btn_agregar = $("#btn_agregar");
    const btn_modal = $("#btn_modal");

    const modal = $("#modal");
    const form = $("#form");
    const id_titulo_modal = $("#titulo_modal");

    const titulo_modal = "Nuevo Usuario";
    const titulo_modal_actualizar = "Actualizar Usuario";

    // Inicializar tabla básica
    const columnas = [
        { data: "nombre_rol" },
        {
            data: null,
            render: function (data, type, row) {
                return `${row.nombres} ${row.apellidos}`;
            }
        },
        { data: "email" },
        { data: "usuario" },
        { data: "estado", render: renderEstado },
        {
            data: "id_usuario",
            render: function (data, type, row) {
                let html = renderAcciones(data);

                const siguienteEstado = row.estado === 'Activo' ? 'Inactivo' : 'Activo';
                const claseBtn = row.estado === 'Activo' ? 'btn-outline-danger' : 'btn-outline-success';
                const icono = row.estado === 'Activo' ? 'mdi-toggle-switch-off-outline' : 'mdi-toggle-switch-outline';

                html += `
                    <button type="button"
                        class="btn btn-sm ${claseBtn} toggle-estado"
                        data-id="${data}"
                        data-siguiente="${siguienteEstado}"
                        title="Marcar como ${siguienteEstado}">
                        <i class="mdi ${icono}"></i> ${siguienteEstado}
                    </button>
                `;

                return html;
            }
        }
    ];

    // Sin paginación (se muestran todos los registros) + scroll vertical con
    // header fijo (sticky) dentro de la tabla. scrollX se necesita para que
    // DataTables combine bien scrollY con la extensión Responsive.
    const tablaAjax = inicializarTabla(tabla, url_listar, columnas, {
        paging: false,
        info: false,
        dom: 'Bfrti',
        scrollY: '60vh',
        scrollCollapse: true,
        scrollX: true
    });

    // Con scrollX activo, DataTables clona el header en una tabla aparte y
    // sincroniza sus anchos por JS. Si no se le pide reajustar tras cada
    // draw (o al cambiar el tamaño de la ventana), el header queda
    // desalineado del cuerpo de la tabla. Esto lo soluciona.
    tablaAjax.on('draw', function () {
        tablaAjax.columns.adjust();
    });

    $(window).on('resize', function () {
        tablaAjax.columns.adjust();
    });

    // Áreas por rol: se cargan una vez al entrar al módulo
    cargarAreasPorRol();

    // botón abrir modal
    btn_agregar.on('click', function () {
        form[0].reset();
        form.find('input[type="hidden"]').val('');

        // Eventos
        document.getElementById("nombres").addEventListener("keyup", generarUsuario);
        document.getElementById("apellidos").addEventListener("keyup", generarUsuario);

        generarPassword();

        limpiarPreviewsImagenes([
            { input: "foto_personal", preview: "preview_foto" }
        ]);

        // Modo crear: campos de acceso y datos básicos quedan editables,
        // pero el RUC se arma automáticamente desde el DNI y queda en solo
        // lectura (el usuario no debe teclearlo).
        desbloquearCamposAcceso();
        desbloquearDatosBasicos();
        $('#ruc').prop('readonly', true).addClass('campo-bloqueado');
        bloquearConyuge(false);
        $('#btn_consultar_dni').prop('disabled', false);

        // Reset del área según rol y limpieza de derechohabientes.
        // Se recargan las áreas desde la BD para reflejar áreas nuevas
        // agregadas en el módulo de roles sin recargar la página.
        cargarAreasPorRol();
        $('#area').val('');
        $('#area_ayuda').text('');

        $('#contenedor_hijos').empty();
        $('#hijos_json').val('[]');
        $('#dni_error').addClass('d-none').text('');
        $('#caja_tasas_pensionario').addClass('d-none').html('');
        $('#col_tipo_comision_afp, #col_cuspp').hide();

        // Rótulo del documento según el tipo elegido por defecto
        actualizarLabelDocumento();

        modal.modal("show");
        id_titulo_modal.text(titulo_modal);
    });

    // boton agregar
    btn_modal.on('click', function () {

        serializarHijos();

        enviarFormulario(
            url_agregar,
            form,
            function (response) {
                modal.modal("hide");
                form[0].reset();
                $('#contenedor_hijos').empty();
                alertCorrecto(response.mensaje)
                tablaAjax.ajax.reload(); cargarSelectEmpleados();
            },
            function (response) {
                alertError(response.mensaje || "Ocurrió un error.");
            }
        );
    })

    // botón editar
    $(tabla).on('click', '.editar', function () {
        abrirEdicion($(this).data('id'));
    });

    function abrirEdicion(id) {

        obtenerDatos(
            url_editar,
            id,
            function (response) {
                form[0].reset();
                modal.modal("show");
                id_titulo_modal.text(titulo_modal_actualizar);
                rellenarFormulario(response.data);
                actualizarLabelDocumento();
                rellenarPreviewsImagenes(
                    [
                        { preview: "preview_foto", campo: "foto_personal" }
                    ],
                    response.data,
                    base_url + RUTA_IMG_USUARIO
                );

                // ── Bloqueos del modo edición ──
                bloquearDatosBasicos();
                bloquearCamposAcceso();
                $('#btn_consultar_dni').prop('disabled', true);

                // Área: cargar las áreas del rol (frescas de la BD) y
                // conservar el valor guardado al terminar la carga
                cargarAreasPorRol(function () {
                    fijarArea(response.data.area);
                });

                // Derechohabientes: los existentes se bloquean (solo se pueden
                // agregar nuevos); la cónyuge se bloquea si ya existe registro.
                $('#contenedor_hijos').empty();
                (response.hijos || []).forEach(function (hijo) {
                    agregarFilaHijo(hijo, true);
                });
                if (response.data.conyuge_nombres ||
                    response.data.conyuge_apellido1 ||
                    response.data.conyuge_apellido2 ||
                    response.data.conyuge_fecha_nacimiento) {
                    bloquearConyuge(true);
                } else {
                    bloquearConyuge(false);
                }

                $('#dni_error').addClass('d-none').text('');

                if ($('#regimen_pensionario').val()) {
                    actualizarCajaPensionario();
                }

            },
            function (response) {
                alertError(response.mensaje || "Ocurrió un error.");
            }
        )
    }

    // ── Bloqueos: datos personales básicos (no editables al editar) ──────
    function bloquearDatosBasicos() {
        ['nombres', 'apellidos', 'documento', 'ruc'].forEach(function (id) {
            $('#' + id).prop('readonly', true).addClass('campo-bloqueado');
        });
    }

    function desbloquearDatosBasicos() {
        ['nombres', 'apellidos', 'documento', 'ruc'].forEach(function (id) {
            $('#' + id).prop('readonly', false).removeClass('campo-bloqueado');
        });
    }

    // ── Usuario / Contraseña: bloqueados por defecto al editar ───────────
    function bloquearCamposAcceso() {
        // La contraseña no se muestra (en blanco) y no se reenvía a menos que
        // se habilite la edición y se escriba una nueva.
        $('#usuario, #password').prop('readonly', true).addClass('campo-bloqueado');
        $('#password').val('').removeAttr('data-required');
        $('#fila_desbloquear_acceso').removeClass('d-none');
    }

    function desbloquearCamposAcceso() {
        $('#usuario, #password').prop('readonly', false).removeClass('campo-bloqueado');
        $('#password').attr('data-required', 'true');
        $('#fila_desbloquear_acceso').addClass('d-none');
    }

    // Botón para habilitar la edición de Usuario/Contraseña
    $('#btn_desbloquear_acceso').on('click', function () {
        $('#usuario, #password').prop('readonly', false).removeClass('campo-bloqueado');
        $('#fila_desbloquear_acceso').addClass('d-none');
        alertCorrecto('Edición de usuario/contraseña habilitada.');
    });

    // ── Área dinámica según el Rol seleccionado ──────────────────────────
    // Las áreas por rol se cargan desde la BD (tablas areas + roles_areas)
    // mediante recursos_humanos/roles/areas_por_rol. Ya no son estáticas:
    // si se editan los roles o las áreas, el combo se actualiza.
    let areasPorRol = {}; // { id_rol: [ { id_area, nombre } ] }

    function cargarAreasPorRol(callback) {
        fetch(base_url + "recursos_humanos/roles/areas_por_rol")
            .then(function (response) { return response.json(); })
            .then(function (data) {
                areasPorRol = {};
                (data || []).forEach(function (rol) {
                    areasPorRol[rol.id_rol] = rol.areas || [];
                });
                // Si el modal ya está abierto con un rol elegido, refrescar
                actualizarAreasPorRol();
                if (typeof callback === 'function') callback();
            })
            .catch(function () {
                areasPorRol = {};
                actualizarAreasPorRol();
                if (typeof callback === 'function') callback();
            });
    }

    function actualizarAreasPorRol() {
        const idRol = $('#id_rol').val();
        const areas = idRol ? (areasPorRol[idRol] || []) : [];

        let opciones = '<option value="">Seleccione área</option>';
        areas.forEach(function (a) {
            opciones += `<option value="${a.nombre}">${a.nombre}</option>`;
        });
        $('#area').html(opciones);
        $('#area_ayuda').text(areas.length
            ? 'Áreas del rol seleccionado'
            : 'Seleccione un rol para ver las áreas disponibles.');
    }

    function fijarArea(valorArea) {
        if (!valorArea) return;
        if (!$(`#area option[value="${valorArea}"]`).length) {
            $('#area').append(`<option value="${valorArea}">${valorArea}</option>`);
        }
        $('#area').val(valorArea);
    }

    $('#id_rol').on('change', actualizarAreasPorRol);

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
                        tablaAjax.ajax.reload(); cargarSelectEmpleados();
                    },
                    function (response) {
                        alertError(response.mensaje || "Ocurrió un error.");
                    }
                )
            }
        });

    });

    // Generar usuario automáticamente
    function generarUsuario() {
        let nombres = document.getElementById("nombres").value.trim().toLowerCase();
        let apellidos = document.getElementById("apellidos").value.trim().toLowerCase();

        if (nombres && apellidos) {
            let primerNombre = nombres.split(" ")[0];
            let primerApellido = apellidos.split(" ")[0];

            let numeroRandom = Math.floor(Math.random() * 100);

            let usuarioGenerado = primerNombre + "." + primerApellido + numeroRandom;

            document.getElementById("usuario").value = usuarioGenerado;
        }
    }

    // Generar contraseña random segura
    function generarPassword(longitud = 10) {
        const caracteres = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&";
        let password = "";

        for (let i = 0; i < longitud; i++) {
            let randomIndex = Math.floor(Math.random() * caracteres.length);
            password += caracteres[randomIndex];
        }

        document.getElementById("password").value = password;
    }

    // Inicializar previews
    configurarPreview('foto_personal', 'preview_foto');

    // ─── Régimen pensionario: comisiones AFP/ONP ──────────────────────────
    let comisionesCache = null; // se pide una sola vez por sesión de página

    function cargarComisionesPensionarias(callback) {
        if (comisionesCache) {
            callback(comisionesCache);
            return;
        }

        $.ajax({
            url: base_url + 'recursos_humanos/usuarios/comisiones_pensionarias',
            type: 'GET',
            dataType: 'json',
            success: function (response) {
                if (response.success) {
                    comisionesCache = response;
                    callback(response);
                }
            }
        });
    }

    function actualizarCajaPensionario() {
        const regimen = $('#regimen_pensionario').val();
        const caja = $('#caja_tasas_pensionario');

        const esAfp = regimen && regimen.startsWith('AFP');
        $('#col_tipo_comision_afp, #col_cuspp').toggle(!!esAfp);

        if (!regimen) {
            caja.addClass('d-none').html('');
            return;
        }

        cargarComisionesPensionarias(function (data) {

            if (regimen === 'ONP') {
                caja.removeClass('d-none').html(`
                    <div class="fw-semibold text-uppercase small mb-2">Tasa ONP (Sistema Nacional de Pensiones)</div>
                    <div class="row">
                        <div class="col-md-4">
                            <div class="text-muted small">Aporte Obligatorio Único</div>
                            <div class="fs-5 fw-bold">${data.onp.aporte_obligatorio}</div>
                        </div>
                        <div class="col-md-8">
                            <div class="text-muted small">Información</div>
                            <div class="small">${data.onp.info}</div>
                        </div>
                    </div>
                `);
                return;
            }

            // AFP: buscar por nombre (regimen = "AFP Integra" -> "INTEGRA")
            const nombreAfp = regimen.replace('AFP', '').trim().toUpperCase();
            const info = data.afp ? data.afp[nombreAfp] : null;

            if (!info) {
                caja.removeClass('d-none').html(`
                    <div class="text-muted small">
                        No se pudieron obtener las tasas actualizadas de la SBS en este momento.
                        Puedes continuar igual, se puede completar esto más tarde.
                    </div>
                `);
                return;
            }

            const tipoComision = $('#tipo_comision_afp').val() || 'flujo';
            const comisionMostrada = tipoComision === 'saldo' ? info.comision_saldo : info.comision_flujo;
            const etiquetaComision = tipoComision === 'saldo' ? 'COMISIÓN (SALDO)' : 'COMISIÓN (FLUJO)';

            caja.removeClass('d-none').html(`
                <div class="fw-semibold text-uppercase small mb-2">Tasas SBS actualizadas - ${info.afp}</div>
                <div class="row">
                    <div class="col-md-4">
                        <div class="text-muted small">${etiquetaComision}</div>
                        <div class="fs-5 fw-bold">${comisionMostrada || '—'}</div>
                    </div>
                    <div class="col-md-4">
                        <div class="text-muted small">Prima de Seguros (%)</div>
                        <div class="fs-5 fw-bold">${info.prima_seguro || '—'}</div>
                    </div>
                    <div class="col-md-4">
                        <div class="text-muted small">Aporte Obligatorio</div>
                        <div class="fs-5 fw-bold">${info.aporte_obligatorio || '—'}</div>
                    </div>
                </div>
            `);
        });
    }

    $('#regimen_pensionario, #tipo_comision_afp').on('change', actualizarCajaPensionario);

    // ─── Activar / Inactivar rápido desde el listado ──────────────────────
    $(tabla).on('click', '.toggle-estado', function () {
        cambiarEstado($(this).data('id'), $(this).data('siguiente'));
    });

    function cambiarEstado(id, siguiente) {
        alertConfirmacion({
            titulo: `¿Marcar como ${siguiente}?`,
            texto: `El empleado quedará marcado como ${siguiente}.`,
            textoConfirmacion: `Sí, marcar como ${siguiente}`,
            icono: 'question',
            onConfirm: function () {
                $.ajax({
                    url: base_url + `recursos_humanos/usuarios/cambiar_estado/${id}`,
                    type: 'POST',
                    dataType: 'json',
                    data: { estado: siguiente },
                    success: function (response) {
                        if (!response.success) {
                            alertError(response.mensaje || "No se pudo actualizar el estado.");
                            return;
                        }
                        alertCorrecto(response.mensaje);
                        tablaAjax.ajax.reload();
                        cargarSelectEmpleados(id);
                    },
                    error: function () {
                        alertError("Error al actualizar el estado.");
                    }
                });
            }
        });
    }

    // ─── Consultar DNI (apiperu.dev vía backend) ──────────────────────────
    $('#btn_consultar_dni').on('click', function () {
        const dni = $('#documento').val().trim();
        const btn = $(this);
        const texto = $('#btn_consultar_dni_texto');

        $('#dni_error').addClass('d-none').text('');

        if (!/^\d{8}$/.test(dni)) {
            $('#dni_error').removeClass('d-none').text('Ingresa un DNI válido de 8 dígitos.');
            return;
        }

        btn.prop('disabled', true);
        texto.text('Consultando...');

        $.ajax({
            url: base_url + `recursos_humanos/usuarios/consultar_dni/${dni}`,
            type: 'GET',
            dataType: 'json',
            success: function (response) {
                if (!response.success) {
                    $('#dni_error').removeClass('d-none').text(response.mensaje || 'No se encontró el DNI.');
                    return;
                }
                $('#nombres').val(response.data.nombres);
                $('#apellidos').val(response.data.apellidos);

                // Solo autogenerar el usuario cuando es un registro NUEVO.
                // Si se está editando, el usuario ya existe y no debe
                // reasignarse solo por volver a consultar el DNI.
                const esNuevo = !$('#id_usuario').val();
                if (esNuevo) {
                    generarUsuario();
                }

                autocompletarRuc(dni, response.data);
            },
            error: function () {
                $('#dni_error').removeClass('d-none').text('Error al consultar el DNI.');
            },
            complete: function () {
                btn.prop('disabled', false);
                texto.text('Consultar');
            }
        });
    });

    // El botón "Consultar RUC" se eliminó del formulario, pero su consulta se
    // dispara automáticamente al consultar el DNI: se arma el RUC de persona
    // natural (10 + DNI + dígito verificador) y se consultan los datos SUNAT.
    function autocompletarRuc(dni, datosDni) {
        const codVerifica = datosDni.codVerifica;

        if (!dni || !codVerifica) {
            return; // la API no trajo el dígito verificador, no se puede armar
        }

        const rucArmado = '10' + dni + codVerifica;
        $('#ruc').val(rucArmado);
        consultarSunat(rucArmado);
    }

    // Consulta SUNAT para el RUC autogenerado: llena Estado, Condición y
    // Actividad Económica. Usa el mismo proxy backend (el token nunca viaja
    // al navegador).
    function consultarSunat(ruc) {
        $('#sunat_estado').val('');
        $('#sunat_condicion').val('');
        $('#sunat_actividad').val('');

        $.ajax({
            url: base_url + `recursos_humanos/usuarios/consultar_ruc/${ruc}`,
            type: 'GET',
            dataType: 'json',
            success: function (response) {
                if (!response.success) {
                    $('#sunat_estado').val('No encontrado');
                    $('#sunat_condicion').val('No encontrado');
                    $('#sunat_actividad').val('');
                    return;
                }
                $('#sunat_estado').val(response.data.estado || '');
                $('#sunat_condicion').val(response.data.condicion || '');
                $('#sunat_actividad').val(response.data.actividad || '');
            },
            error: function () {
                $('#sunat_estado').val('Error al consultar');
                $('#sunat_condicion').val('Error al consultar');
                $('#sunat_actividad').val('');
            }
        });
    }

    // ─── Hijos dinámicos (clona el <template id="tpl_hijo">) ──────────────
    // esExistente = true cuando se carga desde BD: las filas existentes quedan
    // bloqueadas (no se pueden modificar ni quitar), solo se permiten nuevos.
    function agregarFilaHijo(hijo = {}, esExistente = false) {
        const tpl = document.getElementById('tpl_hijo');
        const nodo = tpl.content.cloneNode(true);
        const fila = nodo.querySelector('.hijo-fila');

        fila.querySelector('.hijo-nombres').value = hijo.nombres || '';
        fila.querySelector('.hijo-apellido1').value = hijo.apellido1 || '';
        fila.querySelector('.hijo-apellido2').value = hijo.apellido2 || '';
        fila.querySelector('.hijo-fecha').value = hijo.fecha_nacimiento ? hijo.fecha_nacimiento.split(' ')[0] : '';

        if (esExistente) {
            fila.classList.add('hijo-existente');
            fila.querySelectorAll('input').forEach(function (i) {
                i.setAttribute('readonly', 'readonly');
                i.classList.add('campo-bloqueado');
            });
            const btn = fila.querySelector('.btn_quitar_hijo');
            if (btn) btn.style.display = 'none';
        }

        document.getElementById('contenedor_hijos').appendChild(nodo);
    }

    $('#btn_agregar_hijo').on('click', function () {
        agregarFilaHijo();
    });

    // La cónyuge se bloquea cuando ya existe un registro guardado.
    function bloquearConyuge(bloquear) {
        const campos = [
            '#conyuge_nombres', '#conyuge_apellido1', '#conyuge_apellido2',
            '#conyuge_fecha_nacimiento'
        ];
        campos.forEach(function (sel) {
            $(sel).prop('readonly', !!bloquear).toggleClass('campo-bloqueado', !!bloquear);
        });
    }

    $(document).on('click', '.btn_quitar_hijo', function () {
        $(this).closest('.hijo-fila').remove();
    });

    // Junta todas las filas de hijos visibles en un JSON y lo mete en el
    // input oculto #hijos_json, que es lo que realmente se envía.
    function serializarHijos() {
        const hijos = [];

        $('#contenedor_hijos .hijo-fila').each(function () {
            const nombres = $(this).find('.hijo-nombres').val().trim();
            if (!nombres) return; // fila vacía, se ignora

            hijos.push({
                nombres: nombres,
                apellido1: $(this).find('.hijo-apellido1').val().trim(),
                apellido2: $(this).find('.hijo-apellido2').val().trim(),
                fecha_nacimiento: $(this).find('.hijo-fecha').val()
            });
        });

        $('#hijos_json').val(JSON.stringify(hijos));
    }

    // ─── Selector de empleado + tarjeta de perfil ─────────────────────────
    let empleadosCache = [];

    function cargarSelectEmpleados(idSeleccionarDespues) {

        $.ajax({
            url: base_url + url_listar,
            type: 'GET',
            dataType: 'json',
            success: function (response) {

                empleadosCache = response.data || response || [];

                const valorActual = idSeleccionarDespues || $('#sel_empleado').val();

                let opciones = '<option value="">— Elige un empleado —</option>';
                empleadosCache.forEach(function (u) {
                    opciones += `<option value="${u.id_usuario}">${u.nombres} ${u.apellidos}</option>`;
                });
                $('#sel_empleado').html(opciones);

                if (valorActual) {
                    $('#sel_empleado').val(valorActual);
                    if ($('#sel_empleado').val()) {
                        pintarPerfilEmpleado(valorActual);
                    }
                }
            }
        });
    }

    $('#sel_empleado').on('change', function () {
        const id = $(this).val();

        if (!id) {
            $('#perfil_empleado').addClass('d-none');
            return;
        }

        pintarPerfilEmpleado(id);
    });

    function pintarPerfilEmpleado(id) {
        obtenerDatos(
            url_editar,
            id,
            function (response) {
                const u = response.data;

                $('#perfil_empleado').removeClass('d-none');

                const fotoUrl = u.foto_personal
                    ? base_url + RUTA_IMG_USUARIO + u.foto_personal
                    : url_assets + 'uploads/default_user.webp';

                $('#perfil_foto').attr('src', fotoUrl);
                $('#perfil_nombre').text(`${u.nombres} ${u.apellidos}`);
                $('#perfil_dni').text(u.documento || '—');
                $('#perfil_rol').text(u.nombre_rol || '—');
                $('#perfil_area').text(u.area || '—');

                const esActivo = u.estado === 'Activo';
                $('#perfil_estado_badge')
                    .text(u.estado || '—')
                    .removeClass('bg-success bg-secondary')
                    .addClass(esActivo ? 'bg-success' : 'bg-secondary');

                const siguienteEstado = esActivo ? 'Inactivo' : 'Activo';
                $('#btn_toggle_estado_texto').text(`Marcar como ${siguienteEstado}`);
                $('#btn_toggle_estado_perfil').data('id', u.id_usuario).data('siguiente', siguienteEstado);
                $('#btn_editar_perfil').data('id', u.id_usuario);

                // ── Datos Personales ──
                $('#dp_tipo_doc').text(u.tipo_documento || 'N/A');
                $('#dp_dni').text(u.documento || 'N/A');
                $('#dp_nombres').text(`${u.nombres || ''} ${u.apellidos || ''}`.trim() || 'N/A');
                $('#dp_fecha_nacimiento').text(u.fecha_nacimiento || 'N/A');
                $('#dp_correo').text(u.email || 'N/A');
                $('#dp_celular').text(u.telefono || 'N/A');
                $('#dp_direccion').text(u.direccion || 'N/A');
                $('#dp_distrito').text(u.distrito || 'N/A');
                $('#dp_estado').text(u.estado || 'N/A');

                // ── Datos Laborales ──
                $('#dl_rol').text(u.nombre_rol || 'N/A');
                $('#dl_area').text(u.area || 'N/A');
                $('#dl_fecha_ingreso').text(u.fecha_ingreso || 'N/A');
                $('#dl_fecha_salida').text(u.fecha_salida || 'N/A');
                $('#dl_regimen').text(u.regimen_pensionario || 'N/A');
                $('#dl_opcion_personal').text(u.opcion_personal || 'N/A');
                $('#dl_cuadrilla').text(u.cuadrilla || 'N/A');
                $('#dl_licencia').text(u.categoria_licencia || 'Sin licencia');
                $('#dl_num_brevete').text(u.numero_brevete || 'N/A');
                $('#dl_emision_licencia').text(u.emision_brevete || 'N/A');
                $('#dl_venc_licencia').text(u.fecha_vencimiento_brevete || 'N/A');
                $('#dl_talla_polo').text(u.talla_polo || 'N/A');
                $('#dl_talla_pantalon').text(u.talla_pantalon || 'N/A');
                $('#dl_talla_calzado').text(u.talla_calzado || 'N/A');
                $('#dl_venc_sctr').text(u.vencimiento_sctr || 'N/A');
                $('#dl_venc_emo').text(u.vencimiento_emo || 'N/A');

                // ── Datos Bancarios ──
                $('#db_banco').text(u.banco || 'N/A');
                $('#db_cuenta').text(u.cuenta_bancaria || 'N/A');
                $('#db_cci').text(u.cci || 'N/A');

                // ── Emergencia ──
                $('#em_nombre').text(u.emergencia_nombre || 'N/A');
                $('#em_parentesco').text(u.emergencia_parentesco || 'N/A');
                $('#em_celular').text(u.numero_emergencia || 'N/A');
                $('#em_celular_alt').text(u.emergencia_telefono_2 || 'N/A');
                $('#em_direccion').text(u.emergencia_direccion || 'N/A');

                // ── Derechohabientes (EsSalud) ──
                pintarDerechohabientes(u, response.hijos || []);

                // ── Documentos (indicador Sí/No + descarga) ──
                pintarDocumentos(u);
            },
            function () {
                alertError('No se pudo cargar el perfil del empleado.');
            }
        );
    }

    // Indicador de estado (Sí/No) para cada archivo adjunto y, si existe,
    // botón para descargarlo/verlo.
    function pintarDocumentos(u) {
        const docs = [
            { key: 'foto_personal', label: 'Foto de perfil' },
            { key: 'licencia_pdf', label: 'Licencia (PDF)' },
            { key: 'cv_pdf', label: 'CV (PDF)' },
            { key: 'dni_pdf', label: 'DNI (PDF)' },
            { key: 'recibo_servicio_pdf', label: 'Recibo de servicio (PDF)' },
            { key: 'certificado_pdf', label: 'Certificado (PDF)' }
        ];

        let html = '';
        docs.forEach(function (d) {
            const valor = u[d.key];
            const existe = !!valor;
            const badge = existe
                ? '<span class="badge bg-success">Sí</span>'
                : '<span class="badge bg-secondary">No</span>';
            const btnDescarga = existe
                ? `<a class="btn btn-sm btn-outline-primary" href="${base_url + RUTA_IMG_USUARIO + valor}" target="_blank" rel="noopener" title="Descargar/Ver"><i class="mdi mdi-download"></i></a>`
                : '';
            html += `
                <div class="d-flex justify-content-between align-items-center py-1 border-bottom">
                    <span class="small">${d.label}</span>
                    <span class="d-flex align-items-center gap-2">${badge} ${btnDescarga}</span>
                </div>`;
        });

        $('#perfil_documentos').html(html);
    }

    // Cónyuge + hijos registrados.
    function pintarDerechohabientes(u, hijos) {
        const conyuge = [u.conyuge_nombres, u.conyuge_apellido1, u.conyuge_apellido2]
            .filter(Boolean).join(' ').trim();
        $('#dere_conyuge').text(conyuge || 'No registrada');
        $('#dere_conyuge_nac').text(u.conyuge_fecha_nacimiento || '—');

        let html = '';
        (hijos || []).forEach(function (h) {
            html += `
                <div class="small py-1 border-bottom">
                    <i class="mdi mdi-account-child-outline me-1 text-muted"></i>
                    ${h.nombres} ${h.apellido1 || ''} ${h.apellido2 || ''}
                    <span class="text-muted">(${h.fecha_nacimiento ? h.fecha_nacimiento.split(' ')[0] : '—'})</span>
                </div>`;
        });
        html = html || '<div class="text-muted small">Sin hijos registrados</div>';
        $('#dere_hijos').html(html);
    }

    $('#btn_editar_perfil').on('click', function () {
        abrirEdicion($(this).data('id'));
    });

    $('#btn_toggle_estado_perfil').on('click', function () {
        cambiarEstado($(this).data('id'), $(this).data('siguiente'));
    });

    // ── Etiqueta del documento según el tipo (DNI/Pasaporte/Carnet) ──────
    // Se llama al cambiar el tipo, al abrir en modo crear y al editar.
    function actualizarLabelDocumento() {
        const tipo = ($('#tipo_documento').val() || 'DNI').trim().toUpperCase();
        const nombre = {
            'DNI': 'DNI',
            'PASAPORTE': 'Pasaporte',
            'CARNET': 'Carnet'
        }[tipo] || 'Documento';

        $('#lbl_documento').text(`N° ${nombre} *`);
        $('#documento').attr('placeholder', nombre);

        const esDni = tipo === 'DNI';
        $('#documento')
            .attr('maxlength', esDni ? 8 : 12)
            .toggleClass('solo-numeros', esDni);
    }

    $('#tipo_documento').on('change', actualizarLabelDocumento);

    // Solo números en inputs con clase .solo-numeros (DNI/RUC). Delegado para
    // que siga aplicando cuando la clase cambia según el tipo de documento.
    document.addEventListener('input', function (e) {
        if (e.target.classList.contains('solo-numeros')) {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
        }
    });

    // Carga inicial del selector
    cargarSelectEmpleados();
});