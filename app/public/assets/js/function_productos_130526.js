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
    const contenedor = document.getElementById("contenedor_series");
    const lista = document.getElementById("lista_series");
    const inputStock = document.getElementById("stock");
    const lblStock = document.getElementById("lbl_stock_help");

    // Columnas — iguales al original
    const columnas = [
        { data: "nombre_categoria" },
        { data: "codigo" },
        { data: "nombre" },
        { data: "precio_compra" },
        { data: "precio_venta" },
        { data: "stock_total" },
        { data: "estado", render: renderEstado },
        { data: "id_producto", render: renderAcciones }
    ];
    const tablaAjax = inicializarTabla(tabla, url_listar, columnas);

    // ── Toggle series / stock ─────────────────────────────────────────────
    function toggleSeries() {
        const tiene = checkbox.checked;
        contenedor.style.display = tiene ? "block" : "none";
        inputStock.readOnly = tiene;
        if (tiene) {
            inputStock.value = '';
            lblStock.textContent = '(calculado por series)';
        } else {
            lblStock.textContent = '(manual)';
        }
    }
    checkbox.addEventListener("change", toggleSeries);
    toggleSeries();

    // ── Agregar fila de serie (serie + selector de almacén) ───────────────
    const btn_agregar_serie = document.getElementById("btn_agregar_serie");

    function crearFilaSerie(numeroSerie, idAlmacen) {
        let optsAlm = '<option value="">Almacén principal</option>';
        almacenes.forEach(a => {
            const sel = idAlmacen && a.id_almacen == idAlmacen ? 'selected' : '';
            optsAlm += `<option value="${a.id_almacen}" ${sel}>${a.nombre}</option>`;
        });
        const div = document.createElement('div');
        div.className = 'd-flex gap-2 mb-2 align-items-center';
        div.innerHTML = `
            <input type="text" name="serie[]"
                   class="form-control form-control-sm"
                   placeholder="Número de serie"
                   value="${numeroSerie || ''}">
            <select name="serie_almacen[]" class="form-select form-select-sm" style="max-width:170px">
                ${optsAlm}
            </select>
            <button type="button" class="btn btn-sm btn-outline-danger flex-shrink-0 btn-rm-serie">
                <i class="mdi mdi-minus"></i>
            </button>`;
        lista.appendChild(div);
    }

    btn_agregar_serie.addEventListener("click", () => crearFilaSerie('', ''));

    lista.addEventListener("click", function (e) {
        if (e.target.closest('.btn-rm-serie')) {
            if (lista.querySelectorAll('div').length > 1) {
                e.target.closest('div').remove();
            }
        }
    });

    // ── Abrir modal nuevo ─────────────────────────────────────────────────
    btn_agregar.on('click', function () {
        form[0].reset();
        form.find('input[type="hidden"]').val('');
        lista.innerHTML = '';
        document.getElementById('sec_series_existentes').style.display = 'none';
        toggleSeries();
        crearFilaSerie('', ''); // una fila vacía por defecto

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

                if (response.data.maneja_serie == 1) {
                    checkbox.checked = true;
                    contenedor.style.display = "block";
                    inputStock.readOnly = true;
                    lblStock.textContent = '(calculado por series)';

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
                    crearFilaSerie('', ''); // fila vacía para agregar nuevas
                } else {
                    checkbox.checked = false;
                    contenedor.style.display = "none";
                    inputStock.readOnly = false;
                    lblStock.textContent = '(manual)';
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
});