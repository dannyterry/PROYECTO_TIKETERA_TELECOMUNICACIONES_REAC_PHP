// app/public/assets/js/function_movimientos.js — REEMPLAZAR COMPLETO
// FIX: usa `productosConSeries` del form (ya viene en la variable global del PHP)
//      elimina el fetch() redundante a listar_ps
// FIX: al editar, carga la serie correcta en el select

$(document).ready(function () {
    "use strict";

    const tabla = "#tabla-movimientos";
    const url_listar = "inventario/movimientos/listar";
    const url_agregar = "inventario/movimientos/agregar";
    const url_editar = "inventario/movimientos/editar";
    const url_eliminar = "inventario/movimientos/eliminar";

    const btn_agregar = $("#btn_agregar");
    const btn_modal = $("#btn_modal");
    const modal = $("#modal");
    const form = $("#form");
    const id_titulo_modal = $("#titulo_modal");

    const titulo_modal = "Nuevo Movimiento";
    const titulo_modal_actualizar = "Actualizar Movimiento";

    // columnas tabla
    const columnas = [
        { data: "nombre_almacen" },
        { data: "nombre_producto" },
        {
            data: "tipo",
            render: v => {
                const map = { ENTRADA: 'success', SALIDA: 'danger', TRASLADO: 'info' };
                return `<span class="badge bg-${map[v] || 'secondary'}">${v}</span>`;
            }
        },
        { data: "cantidad" },
        { data: "numero_serie", render: v => v ? `<code>${v}</code>` : '—' },
        { data: "nombre_almacen_destino", render: v => v || '—' },
        {
            data: "id_movimiento",
            render: d => renderAcciones(d, { ocultarEliminar: true })
        }
    ];
    const tablaAjax = inicializarTabla(tabla, url_listar, columnas);

    // ── Referencias del form ──────────────────────────────────────────────
    const selProducto = document.getElementById("id_producto");
    const selTipo = document.getElementById("tipo");
    const selSerie = document.getElementById("id_producto_serie");
    const inpCantidad = document.getElementById("cantidad");
    const inpPC = document.getElementById("precio_compra");
    const inpPV = document.getElementById("precio_venta");
    const inpTotal = document.getElementById("total");
    const wrapSerie = document.getElementById("wrap_serie");
    const wrapDestino = document.getElementById("wrap_almacen_destino");

    // productosConSeries viene del <script> en movimientos_form.php
    // (pasado desde PHP via MotionController → listar_ps_())

    // ── Actualizar campos según producto + tipo ───────────────────────────
    function actualizarCampos() {
        const tipo = selTipo.value;
        const prodId = selProducto.value;
        const prod = productos.find(p => p.id_producto == prodId);
        const conSerie = prod ? parseInt(prod.maneja_serie) === 1 : false;

        wrapDestino.style.display = tipo === 'TRASLADO' ? 'block' : 'none';

        if (conSerie && tipo !== 'ENTRADA') {
            wrapSerie.style.display = 'block';
            inpCantidad.value = '1';
            inpCantidad.readOnly = true;
            cargarSeriesSelect(prodId);
        } else {
            wrapSerie.style.display = 'none';
            inpCantidad.readOnly = false;
            selSerie.innerHTML = '<option value="">— Sin serie —</option>';
        }
        calcTotal();
    }

    // ── Llenar select de series disponibles ──────────────────────────────
    function cargarSeriesSelect(id_producto, preselId = null) {
        const prod = productosConSeries.find(p => p.id_producto == id_producto);
        selSerie.innerHTML = '<option value="">— Seleccione serie —</option>';
        if (prod && prod.series && prod.series.length > 0) {
            prod.series.forEach(s => {
                const sel = preselId && s.id_producto_serie == preselId ? 'selected' : '';
                selSerie.innerHTML +=
                    `<option value="${s.id_producto_serie}" ${sel}>${s.numero_serie}</option>`;
            });
        } else {
            selSerie.innerHTML = '<option value="" disabled>Sin series disponibles</option>';
        }
    }

    // ── Eventos ───────────────────────────────────────────────────────────
    selProducto.addEventListener("change", function () {
        const prod = productos.find(p => p.id_producto == this.value);
        if (prod) { inpPC.value = prod.precio_compra; inpPV.value = prod.precio_venta; }
        actualizarCampos();
    });
    selTipo.addEventListener("change", actualizarCampos);
    inpCantidad.addEventListener("input", calcTotal);

    function calcTotal() {
        const c = parseFloat(inpCantidad.value) || 0;
        const p = parseFloat(inpPC.value) || 0;
        inpTotal.value = (c * p).toFixed(2);
    }

    // ── CRUD ──────────────────────────────────────────────────────────────
    btn_agregar.on('click', function () {
        form[0].reset();
        form.find('input[type="hidden"]').val('');
        wrapDestino.style.display = 'none';
        wrapSerie.style.display = 'none';
        inpCantidad.readOnly = false;
        modal.modal("show");
        id_titulo_modal.text(titulo_modal);
    });

    btn_modal.on('click', function () {
        enviarFormulario(url_agregar, form,
            r => { modal.modal("hide"); form[0].reset(); alertCorrecto(r.mensaje); tablaAjax.ajax.reload(); },
            r => { alertError(r.mensaje); }
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

                // Después de rellenar el form, actualizar campos dinámicos
                // y preseleccionar la serie si aplica
                setTimeout(function () {
                    const preselSerie = res.data.id_producto_serie || null;
                    if (preselSerie) {
                        cargarSeriesSelect(res.data.id_producto, preselSerie);
                    }
                    actualizarCampos();
                }, 80);
            },
            r => { alertError(r.mensaje); }
        );
    });

    $(tabla).on('click', '.eliminar', function () {
        const id = $(this).data('id');
        alertConfirmacion({
            titulo: "¿Eliminar movimiento?",
            onConfirm: function () {
                obtenerDatos(url_eliminar, id,
                    r => { alertCorrecto(r.mensaje); tablaAjax.ajax.reload(); },
                    r => { alertError(r.mensaje); }
                );
            }
        });
    });
});