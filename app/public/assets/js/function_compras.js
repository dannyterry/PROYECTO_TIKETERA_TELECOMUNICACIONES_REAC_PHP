// app/public/assets/js/function_compras.js — REEMPLAZAR COMPLETO

$(document).ready(function () {
    "use strict";

    const tabla = "#tabla-compras";
    const url_listar = "inventario/compras/listar";
    const url_agregar = "inventario/compras/agregar";
    const url_editar = "inventario/compras/editar";
    const url_eliminar = "inventario/compras/eliminar";

    const btn_agregar = $("#btn_agregar");
    const btn_modal = $("#btn_modal");
    const modal = $("#modal");
    const form = $("#form");
    const id_titulo_modal = $("#titulo_modal");

    const titulo_modal = "Nueva Compra";
    const titulo_modal_actualizar = "Actualizar Compra";

    const columnas = [
        { data: "nombre_almacen" },
        { data: "nombre_proveedor" },
        { data: "fecha" },
        { data: "total", render: v => `S/ ${parseFloat(v).toFixed(2)}` },
        { data: "estado", render: renderEstadoCompra },
        {
            data: "id_compra",
            render: d => renderAcciones(d, { ocultarEliminar: true })
        }
    ];
    const tablaAjax = inicializarTabla(tabla, url_listar, columnas);

    // ── Abrir modal nuevo ─────────────────────────────────────────────────
    btn_agregar.on('click', function () {
        form[0].reset();
        form.find('input[type="hidden"]').val('');
        document.getElementById("detalle_compra").innerHTML = "";
        document.getElementById("total").value = "0.00";
        modal.modal("show");
        id_titulo_modal.text(titulo_modal);
    });

    btn_modal.on('click', function () {
        enviarFormulario(url_agregar, form,
            function (r) { modal.modal("hide"); form[0].reset(); alertCorrecto(r.mensaje); tablaAjax.ajax.reload(); },
            function (r) { alertError(r.mensaje); }
        );
    });

    $(tabla).on('click', '.editar', function () {
        const id = $(this).data('id');
        obtenerDatos(url_editar, id,
            function (res) {
                form[0].reset();
                modal.modal("show");
                id_titulo_modal.text(titulo_modal_actualizar);
                rellenarFormulario(res.data);
                rellenarDetalle(res.data);
            },
            function (r) { alertError(r.mensaje); }
        );
    });

    $(tabla).on('click', '.eliminar', function () {
        const id = $(this).data('id');
        alertConfirmacion({
            titulo: "¿Eliminar compra?",
            onConfirm: function () {
                obtenerDatos(url_eliminar, id,
                    r => { alertCorrecto(r.mensaje); tablaAjax.ajax.reload(); },
                    r => { alertError(r.mensaje); }
                );
            }
        });
    });

    // ══════════════════════════════════════════════════════
    // DETALLE
    // ══════════════════════════════════════════════════════
    const tbody = document.getElementById("detalle_compra");

    document.getElementById("btn_agregar_producto")
        .addEventListener("click", () => tbody.appendChild(crearFila()));

    // ── Opciones de almacén ───────────────────────────────────────────────
    function optsAlmacen(selId) {
        let h = '<option value="">— Mismo que compra —</option>';
        almacenes.forEach(a => {
            const s = selId && a.id_almacen == selId ? 'selected' : '';
            h += `<option value="${a.id_almacen}" ${s}>${a.nombre}</option>`;
        });
        return h;
    }

    // ── Crear fila ────────────────────────────────────────────────────────
    function crearFila(prodId = null, precioInit = 0, cantInit = 0,
        subtInit = 0, seriesInit = '', almSerieId = '') {
        const tr = document.createElement("tr");

        let optsP = '<option value="" disabled selected>Seleccione producto</option>';
        productos.forEach(p => {
            const s = prodId && p.id_producto == prodId ? 'selected' : '';
            optsP += `<option value="${p.id_producto}"
                               data-precio="${p.precio_compra}"
                               data-serie="${p.maneja_serie}"
                               ${s}>${p.codigo || ''} ${p.nombre}</option>`;
        });

        tr.innerHTML = `
            <td>
                <select name="producto[]" class="form-select form-select-sm sel-prod">${optsP}</select>
            </td>
            <td class="td-series">
                <textarea name="series_texto[]"
                          class="form-control form-control-sm txt-series"
                          rows="2"
                          placeholder="Solo para productos con serie"
                          style="font-size:.78rem;resize:none">${seriesInit}</textarea>
            </td>
            <td class="td-alm-serie">
                <select name="series_almacen[]" class="form-select form-select-sm sel-alm-serie">
                    ${optsAlmacen(almSerieId)}
                </select>
            </td>
            <td>
                <input type="number" name="precio[]"
                       class="form-control form-control-sm inp-precio"
                       step="0.01" value="${precioInit}" min="0">
            </td>
            <td>
                <input type="number" name="cantidad[]"
                       class="form-control form-control-sm inp-cant"
                       min="1" value="${cantInit}">
            </td>
            <td>
                <input type="number" name="subtotal[]"
                       class="form-control form-control-sm inp-sub"
                       readonly value="${subtInit}">
            </td>
            <td class="text-center">
                <button type="button" class="btn btn-sm btn-outline-danger btn-elim">
                    <i class="mdi mdi-trash-can-outline"></i>
                </button>
            </td>`;

        if (prodId) setTimeout(() => initFila(tr, prodId), 0);
        return tr;
    }

    // ── Inicializar fila al elegir producto ───────────────────────────────
    function initFila(tr, id_producto) {
        const prod = productos.find(p => p.id_producto == id_producto);
        if (!prod) return;

        tr.querySelector('.inp-precio').value = prod.precio_compra || 0;

        const txtSeries = tr.querySelector('.txt-series');
        const tdAlmSerie = tr.querySelector('.td-alm-serie');
        const inpCant = tr.querySelector('.inp-cant');

        if (prod.maneja_serie == 1) {
            txtSeries.readOnly = false;
            txtSeries.placeholder = "Una serie por línea (requerido)";
            tdAlmSerie.style.display = '';
            inpCant.readOnly = true;
            contarSeries(tr);
        } else {
            txtSeries.readOnly = true;
            txtSeries.value = '';
            txtSeries.placeholder = "No aplica";
            tdAlmSerie.style.display = 'none';
            inpCant.readOnly = false;
            if (!inpCant.value || inpCant.value == 0) inpCant.value = 1;
        }
        recalcFila(tr);
    }

    // ── Contar series en textarea → cantidad ──────────────────────────────
    function contarSeries(tr) {
        const txt = tr.querySelector('.txt-series');
        const cant = tr.querySelector('.inp-cant');
        const n = txt.value.split('\n').map(s => s.trim()).filter(Boolean).length;
        cant.value = n;
        recalcFila(tr);
    }

    // ── Eventos delegados ─────────────────────────────────────────────────
    tbody.addEventListener('change', e => {
        if (e.target.classList.contains('sel-prod'))
            initFila(e.target.closest('tr'), e.target.value);
    });

    tbody.addEventListener('input', e => {
        const tr = e.target.closest('tr');
        if (e.target.classList.contains('txt-series')) {
            const id = tr.querySelector('.sel-prod').value;
            const prod = productos.find(p => p.id_producto == id);
            if (prod && prod.maneja_serie == 1) contarSeries(tr);
        }
        if (e.target.classList.contains('inp-precio') ||
            e.target.classList.contains('inp-cant'))
            recalcFila(tr);
    });

    tbody.addEventListener('click', e => {
        if (e.target.closest('.btn-elim')) {
            e.target.closest('tr').remove();
            recalcTotal();
        }
    });

    // ── Cálculos ──────────────────────────────────────────────────────────
    function recalcFila(tr) {
        const p = parseFloat(tr.querySelector('.inp-precio').value) || 0;
        const c = parseFloat(tr.querySelector('.inp-cant').value) || 0;
        tr.querySelector('.inp-sub').value = (p * c).toFixed(2);
        recalcTotal();
    }

    function recalcTotal() {
        let t = 0;
        document.querySelectorAll('.inp-sub').forEach(i => t += parseFloat(i.value) || 0);
        document.getElementById('total').value = t.toFixed(2);
        const span = document.getElementById('span_total');
        if (span) span.textContent = t.toFixed(2);
    }

    // ── Rellenar detalle al editar ────────────────────────────────────────
    function rellenarDetalle(data) {
        tbody.innerHTML = "";
        (data.productos || []).forEach(item => {
            let st = '';
            if (item.series_ingresadas) {
                try {
                    const a = JSON.parse(item.series_ingresadas);
                    if (Array.isArray(a)) st = a.join('\n');
                } catch (_) { }
            }
            tbody.appendChild(
                crearFila(item.id_producto, item.precio, item.cantidad, item.subtotal, st, '')
            );
        });
        recalcTotal();
    }
});