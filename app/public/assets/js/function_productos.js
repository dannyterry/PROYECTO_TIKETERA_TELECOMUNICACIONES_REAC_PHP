// app/public/assets/js/function_productos.js — REEMPLAZAR COMPLETO

$(document).ready(function () {
    "use strict";

    const tabla = "#tabla-productos";
    const url_listar = "inventario/productos/listar";
    const url_agregar = "inventario/productos/agregar";
    const url_editar = "inventario/productos/editar";
    const url_eliminar = "inventario/productos/eliminar";
    const url_gen_codigo = "inventario/productos/generar_codigo";

    const btn_agregar = $("#btn_agregar");
    const btn_modal = $("#btn_modal");
    const modal = $("#modal");
    const form = $("#form");
    const id_titulo_modal = $("#titulo_modal");

    const titulo_modal = "Nuevo Producto";
    const titulo_modal_actualizar = "Actualizar Producto";

    const checkbox = document.getElementById("maneja_serie");
    const checkbox_vehiculo = document.getElementById("maneja_vehiculo");
    const contenedor = document.getElementById("contenedor_series");
    const lista = document.getElementById("lista_series");
    const inputStock = document.getElementById("stock");
    const lblStock = document.getElementById("lbl_stock_help");
    const colStock = document.getElementById("col_stock");
    const colStockSerie = document.getElementById("col_stock_serie");
    const stockSerieCant = document.getElementById("stock_serie_cant");

    // Columnas — iguales al original
    const columnas = [
        { data: "nombre_categoria" },
        { data: "codigo" },
        { data: "nombre" },
        { data: "es_drop", render: renderDrop },
        { data: "precio_compra" },
        { data: "precio_venta" },
        { data: "stock_total" },
        { data: "estado", render: renderEstado },
        { data: "id_producto", render: renderAcciones }
    ];
    const tablaAjax = inicializarTabla(tabla, url_listar, columnas);

    // ── Toggle series / stock ─────────────────────────────────────────────
    function actualizarStockSerie() {
        let n = 0;
        document.querySelectorAll('.input-serie').forEach(function (inp) {
            if (inp.value.trim() !== '') n++;
        });
        const existentes = document.getElementById('stock_serie_existentes');
        if (existentes) {
            n += parseInt(existentes.textContent || '0', 10) || 0;
        }
        stockSerieCant.textContent = n;
    }

    function toggleSeries() {
        const tiene = checkbox.checked;
        contenedor.style.display = tiene ? "block" : "none";
        if (tiene) {
            inputStock.readOnly = true;
            inputStock.value = '';
            lblStock.textContent = '(calculado por series)';
            colStock.style.display = 'none';
            colStockSerie.style.display = 'block';
            // SI NO HAY FILAS, CREAR UNA
            if (lista.querySelectorAll('.fila-serie').length === 0) {

                crearFilaSerie('', obtenerAlmacenPrincipal());

            }
            actualizarStockSerie();

            // FOCUS AUTOMÁTICO
            setTimeout(() => {

                const primerInput = lista.querySelector('.input-serie');

                if (primerInput) {
                    primerInput.focus();
                }

            }, 100);
        } else {
            inputStock.readOnly = false;
            inputStock.value = '';
            lblStock.textContent = '(manual)';
            colStock.style.display = '';
            colStockSerie.style.display = 'none';
            // LIMPIAR TODAS LAS SERIES
            lista.innerHTML = '';
            actualizarStockSerie();
        }
    }
    checkbox.addEventListener("change", toggleSeries);
    toggleSeries();

    // ── Agregar fila de serie (serie + selector de almacén) ───────────────
    const btn_agregar_serie = document.getElementById("btn_agregar_serie");

    // Almacén principal del producto: las series nuevas lo toman por defecto
    function obtenerAlmacenPrincipal() {
        const sel = document.getElementById("id_almacen");
        return sel ? sel.value : "";
    }

    // Valida la serie de un input (duplicado local + base de datos) y, si
    // está OK, crea una nueva fila vacía para seguir escaneando.
    // Se usa tanto con la pistola (Enter) como con el escáner de cámara.
    function validarYAgregarSerie(input) {

        const valor = input.value.trim();

        if (valor === '') {
            return;
        }

        // VALIDAR DUPLICADOS (en el formulario)
        let repetido = false;

        document.querySelectorAll('.input-serie').forEach(inp => {

            if (inp !== input && inp.value.trim() === valor) {
                repetido = true;
            }

        });

        if (repetido) {
            input.classList.add('is-invalid');

            alertErrorFlotante('La serie ya fue registrada');

            input.select();

            return;
        }

        const formData = new FormData();

        formData.append('serie', valor);

        fetch(base_url + 'inventario/productos/validar_serie', {
            method: 'POST',
            body: formData
        })
            .then(resp => resp.json())
            .then(data => {

                // EXISTE EN LA BD
                if (data.existe) {

                    input.classList.add('is-invalid');
                    input.classList.remove('is-valid');

                    alertErrorFlotante('La serie ya existe en la base de datos');

                    input.select();

                    return;
                }

                // OK
                input.classList.remove('is-invalid');
                input.classList.add('is-valid');

                // NUEVA FILA
                crearFilaSerie('', obtenerAlmacenPrincipal());

            })
            .catch(error => {

                console.error(error);

                alertErrorFlotante('Error al validar serie');

            });
    }

    function crearFilaSerie(numeroSerie, idAlmacen) {
        let optsAlm = '<option value="">Almacén principal</option>';
        almacenes.forEach(a => {
            const sel = idAlmacen && a.id_almacen == idAlmacen ? 'selected' : '';
            optsAlm += `<option value="${a.id_almacen}" ${sel}>${a.nombre}</option>`;
        });
        const div = document.createElement('div');
        div.className = 'd-flex flex-wrap gap-2 mb-2 align-items-center fila-serie';
        div.innerHTML = `
            <input type="text" name="serie[]"
                   class="form-control form-control-sm input-serie"
                   placeholder="Número de serie"
                   value="${numeroSerie || ''}">
            <select name="serie_almacen[]" class="form-select form-select-sm" style="max-width:170px">
                ${optsAlm}
            </select>
            <button type="button" class="btn btn-sm btn-outline-danger flex-shrink-0 btn-rm-serie">
                <i class="mdi mdi-minus"></i>
            </button>`;
        lista.appendChild(div);

        actualizarStockSerie();

        // AUTOFOCUS
        const input = div.querySelector('.input-serie');

        input.focus();

        // EVENTO PISTOLEO (Enter)
        input.addEventListener('keydown', function (e) {

            if (e.key === 'Enter') {

                e.preventDefault();

                validarYAgregarSerie(this);

            }

        });

        // CONTADOR DE STOCK EN VIVO
        input.addEventListener('input', actualizarStockSerie);
    }

    btn_agregar_serie.addEventListener("click", () => crearFilaSerie('', obtenerAlmacenPrincipal()));

    // Si cambias el almacén principal, las filas de serie que quedaron en
    // "Almacén principal" se actualizan solas (no hace falta elegir por serie
    const selAlmacenPrincipal = document.getElementById("id_almacen");
    if (selAlmacenPrincipal) {
        selAlmacenPrincipal.addEventListener("change", function () {
            const nuevo = this.value;
            if (!nuevo) return;
            document.querySelectorAll('.fila-serie').forEach(function (fila) {
                const sel = fila.querySelector('select[name="serie_almacen[]"]');
                if (sel && sel.value === "") {
                    sel.value = nuevo;
                }
            });
        });
    }

    lista.addEventListener("click", function (e) {
        if (e.target.closest('.btn-rm-serie')) {
            if (lista.querySelectorAll('div').length > 1) {
                e.target.closest('div').remove();
            }
            actualizarStockSerie();
        }
    });

    // ── Abrir modal nuevo ─────────────────────────────────────────────────
    btn_agregar.on('click', function () {
        form[0].reset();
        form.find('input[type="hidden"]').val('');
        lista.innerHTML = '';
        document.getElementById('sec_series_existentes').style.display = 'none';
        document.getElementById('stock_serie_existentes').textContent = '0';
        colStock.style.display = '';
        colStockSerie.style.display = 'none';
        toggleSeries();
        crearFilaSerie('', obtenerAlmacenPrincipal()); // una fila vacía por defecto

        limpiarPreviewsImagenes([{ input: "img_producto", preview: "preview_foto" }]);
        id_titulo_modal.text(titulo_modal);

        // Obtener código automático
        fetch(base_url + url_gen_codigo)
            .then(r => r.json())
            .then(d => { if (d.success) document.getElementById('codigo').value = d.codigo; });

        modal.modal("show");
    });

    // ── Guardar ───────────────────────────────────────────────────────────
    btn_modal.on('click', function () {
        enviarFormulario(
            url_agregar, form,
            function (response) {
                modal.modal("hide");
                form[0].reset();
                alertCorrecto(response.mensaje);
                tablaAjax.ajax.reload();
            },
            function (response) { alertError(response.mensaje); }
        );
    });

    // ── Editar ────────────────────────────────────────────────────────────
    $(tabla).on('click', '.editar', function () {
        const id = $(this).data('id');
        obtenerDatos(url_editar, id,
            function (response) {
                form[0].reset();
                modal.modal("show");
                id_titulo_modal.text(titulo_modal_actualizar);
                rellenarFormulario(response.data);
                lista.innerHTML = '';

                if (response.data.maneja_vehiculo == 1) {

                }

                if (response.data.maneja_serie == 1) {
                    checkbox.checked = true;
                    contenedor.style.display = "block";
                    inputStock.readOnly = true;
                    lblStock.textContent = '(calculado por series)';
                    colStock.style.display = 'none';
                    colStockSerie.style.display = 'block';

                    const sec = document.getElementById('sec_series_existentes');
                    const tbody = document.getElementById('tbody_series_existentes');
                    sec.style.display = 'block';
                    tbody.innerHTML = '';

                    const badgeColor = {
                        'DISPONIBLE': 'success',
                        'VENDIDO': 'danger',
                        'RESERVADO': 'warning',
                        'DEFECTUOSO': 'secondary'
                    };

                    if (response.data.series && response.data.series.length > 0) {
                        response.data.series.forEach(function (s) {
                            const bc = badgeColor[s.estado] || 'secondary';
                            // Nombre del almacén (si lo tuviéramos) — mostramos ID como fallback
                            const almNombre = (function () {
                                const a = almacenes.find(a => a.id_almacen == s.id_almacen);
                                return a ? a.nombre : (s.id_almacen || '—');
                            })();
                            tbody.innerHTML += `
                                <tr>
                                    <td><code class="small">${s.numero_serie}</code></td>
                                    <td><span class="badge bg-${bc}">${s.estado}</span></td>
                                    <td><small>${almNombre}</small></td>
                                </tr>`;
                        });
                    } else {
                        tbody.innerHTML = '<tr><td colspan="3" class="text-muted text-center">Sin series</td></tr>';
                    }
                    const existentes = (response.data.series || [])
                        .filter(s => s.estado === 'DISPONIBLE').length;
                    document.getElementById('stock_serie_existentes').textContent = existentes;
                    crearFilaSerie('', obtenerAlmacenPrincipal()); // fila vacía para agregar nuevas
                } else {
                    checkbox.checked = false;
                    contenedor.style.display = "none";
                    inputStock.readOnly = false;
                    lblStock.textContent = '(manual)';
                    colStock.style.display = '';
                    colStockSerie.style.display = 'none';
                    document.getElementById('stock_serie_existentes').textContent = '0';
                    document.getElementById('sec_series_existentes').style.display = 'none';
                }

                rellenarPreviewsImagenes(
                    [{ preview: "preview_foto", campo: "img_producto" }],
                    response.data,
                    base_url + RUTA_IMG_PRODUCTO
                );
            },
            function (r) { alert("Error: " + r.mensaje); }
        );
    });

    // ── Eliminar ──────────────────────────────────────────────────────────
    $(tabla).on('click', '.eliminar', function () {
        const id = $(this).data('id');
        alertConfirmacion({
            titulo: "¿Eliminar registro?",
            onConfirm: function () {
                obtenerDatos(url_eliminar, id,
                    function (r) { alertCorrecto(r.mensaje); tablaAjax.ajax.reload(); },
                    function (r) { alert("Error: " + r.mensaje); }
                );
            }
        });
    });

    configurarPreview('img_producto', 'preview_foto');

    // ── Escáner de series (cámara + foto) ─────────────────────────────────
    const btn_escanear_serie = document.getElementById("btn_escanear_serie");
    const modalScanner = $("#modalScanner");
    const scannerEstado = document.getElementById("scanner_estado");
    const scannerArchivo = document.getElementById("scanner_archivo");

    let html5QrCode = null;
    let procesandoScan = false;

    function estadoScanner(msg, tipo) {
        if (!scannerEstado) return;
        scannerEstado.textContent = msg || '';
        scannerEstado.className = 'small text-center mt-2 text-' + (tipo || 'muted');
    }

    function detenerScanner() {
        if (html5QrCode) {
            try { html5QrCode.stop(); } catch (e) {}
            try { html5QrCode.clear(); } catch (e) {}
            html5QrCode = null;
        }
    }

    // Llena la última fila vacía con la serie leída (o crea una nueva) y la valida.
    function agregarSerieEscaneada(valor) {
        const v = (valor || '').trim();
        if (!v) return;

        const inputs = lista.querySelectorAll('.input-serie');
        let target = null;
        for (let i = inputs.length - 1; i >= 0; i--) {
            if (inputs[i].value.trim() === '') { target = inputs[i]; break; }
        }
        if (!target) {
            crearFilaSerie('', obtenerAlmacenPrincipal());
            const todos = lista.querySelectorAll('.input-serie');
            target = todos[todos.length - 1];
        }
        target.value = v;
        target.focus();
        validarYAgregarSerie(target);
    }

    btn_escanear_serie.addEventListener('click', function () {
        if (typeof Html5Qrcode === 'undefined') {
            alertErrorFlotante('La librería de escaneo (html5-qrcode) no está cargada');
            return;
        }
        modalScanner.modal('show');
        setTimeout(function () {
            detenerScanner();
            html5QrCode = new Html5Qrcode("reader");
            estadoScanner('Iniciando cámara…');
            html5QrCode.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: 240 },
                function (decodedText) {
                    if (procesandoScan) return;
                    procesandoScan = true;
                    estadoScanner('Código leído: ' + decodedText, 'success');
                    setTimeout(function () { procesandoScan = false; }, 1500);
                    agregarSerieEscaneada(decodedText);
                    modalScanner.modal('hide');
                },
                function () { /* frame error, se ignora */ }
            ).catch(function (err) {
                estadoScanner('No se pudo iniciar la cámara: ' + (err && err.message ? err.message : err), 'danger');
            });
        }, 400);
    });

    modalScanner.on('hidden.bs.modal', detenerScanner);

    scannerArchivo.addEventListener('change', function () {
        const file = this.files && this.files[0];
        this.value = '';
        if (!file) return;
        detenerScanner();
        estadoScanner('Leyendo foto…');
        const lector = new Html5Qrcode("reader");
        lector.scanFile(file, true)
            .then(function (decodedText) {
                estadoScanner('Código leído: ' + decodedText, 'success');
                agregarSerieEscaneada(decodedText);
                modalScanner.modal('hide');
            })
            .catch(function () {
                estadoScanner('No se pudo leer el código de la foto', 'danger');
            })
            .finally(function () {
                try { lector.clear(); } catch (e) {}
            });
    });
});