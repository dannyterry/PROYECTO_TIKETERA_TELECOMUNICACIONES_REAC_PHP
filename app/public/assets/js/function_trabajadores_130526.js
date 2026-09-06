// app/public/assets/js/function_trabajadores.js — REEMPLAZAR COMPLETO
// ÚNICO CAMBIO respecto al actual:
//   crearFila() y inicializarFila() ahora soportan MÚLTIPLES filas del mismo
//   producto con serie (una fila por check de serie elegida).
//   El select de series muestra todas las DISPONIBLES del producto.
//   Al rellenar stock existente, crea una fila por cada serie asignada al técnico.

$(document).ready(function () {
    "use strict";

    const tabla = "#tabla-trabajadores";
    const url_listar = "personal/trabajadores/listar";
    const url_agregar = "personal/trabajadores/agregar";
    const url_stockear = "personal/trabajadores/agregar_stock";
    const url_editar = "personal/trabajadores/editar";
    const url_obtener_stock = "personal/trabajadores/obtener_stock";
    const url_eliminar = "personal/trabajadores/eliminar";

    const btn_agregar = $("#btn_agregar");
    const btn_modal = $("#btn_modal");
    const btn_modal_2 = $("#btn_modal_2");
    const modal = $("#modal");
    const form = $("#form");
    const id_titulo_modal = $("#titulo_modal");
    const modal_2 = $("#modal_2");
    const form_2 = $("#form_2");
    const id_titulo_modal_2 = $("#titulo_modal_2");

    const titulo_modal = "Nuevo Trabajador";
    const titulo_modal_actualizar = "Actualizar Trabajador";
    const titulo_modal_stockear = "Stockear Trabajador";

    // ── Tabla ─────────────────────────────────────────────────────────────
    const columnas = [
        { data: "fecha_ingreso" },
        { data: "nombres" },
        { data: "apellidos" },
        { data: "email" },
        { data: "usuario" },
        { data: "turno" },
        { data: "estado", render: renderEstado },
        {
            data: "id_trabajador",
            render: function (data) {
                return renderAcciones(data, { mostrarStock: true });
            }
        }
    ];
    const tablaAjax = inicializarTabla(tabla, url_listar, columnas);

    // ── Nuevo trabajador ──────────────────────────────────────────────────
    btn_agregar.on('click', function () {
        form[0].reset();
        form.find('input[type="hidden"]').val('');
        modal.modal("show");
        id_titulo_modal.text(titulo_modal);
    });

    // ── Guardar trabajador ────────────────────────────────────────────────
    btn_modal.on('click', function () {
        enviarFormulario(url_agregar, form,
            function (r) { modal.modal("hide"); form[0].reset(); alertCorrecto(r.mensaje); tablaAjax.ajax.reload(); },
            function (r) { alert("Error: " + r.mensaje); }
        );
    });

    // ── Guardar stock ─────────────────────────────────────────────────────
    btn_modal_2.on('click', function () {
        enviarFormulario(url_stockear, form_2,
            function (r) { modal_2.modal("hide"); form_2[0].reset(); alertCorrecto(r.mensaje); tablaAjax.ajax.reload(); },
            function (r) { alert("Error: " + r.mensaje); }
        );
    });

    // ── Editar trabajador ─────────────────────────────────────────────────
    $(tabla).on('click', '.editar', function () {
        const id = $(this).data('id');
        obtenerDatos(url_editar, id,
            function (r) { form[0].reset(); modal.modal("show"); id_titulo_modal.text(titulo_modal_actualizar); rellenarFormulario(r.data); },
            function (r) { alert("Error: " + r.mensaje); }
        );
    });

    // ── Stockear trabajador ───────────────────────────────────────────────
    $(tabla).on('click', '.stockear', function () {
        const id = $(this).data('id');
        const detalle = document.getElementById("detalle_compra");
        detalle.innerHTML = "";
        form_2[0].reset();
        modal_2.modal("show");
        id_titulo_modal_2.text(titulo_modal_stockear);

        obtenerDatos(url_obtener_stock, id,
            function (r) {
                form_2[0].reset();
                id_titulo_modal_2.text(titulo_modal_stockear);
                rellenarFormulario(r.data);
                rellenarDetalleCompra(r.data);
            },
            function (r) { alertError(r.mensaje); }
        );
    });

    // ── Eliminar trabajador ───────────────────────────────────────────────
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

    // ════════════════════════════════════════════════════════════════════
    // LÓGICA DEL DETALLE DE STOCK
    // ════════════════════════════════════════════════════════════════════

    const btn_agregar_producto = document.getElementById("btn_agregar_producto");
    const detalle = document.getElementById("detalle_compra");

    btn_agregar_producto.addEventListener("click", function () {
        detalle.appendChild(crearFila());
    });

    // ── Crear fila ────────────────────────────────────────────────────────
    function crearFila(productoPresel = null, cantidadInit = '', idSerieInit = '') {
        const fila = document.createElement("tr");

        let options = '<option value="" disabled selected>Seleccione</option>';
        productos.forEach(p => {
            const sel = productoPresel && p.id_producto == productoPresel ? 'selected' : '';
            options += `<option value="${p.id_producto}"
                                data-precio="${p.precio_compra}"
                                data-serie="${p.maneja_serie}"
                                ${sel}>${p.nombre}</option>`;
        });

        fila.innerHTML = `
            <td>
                <select name="producto[]" class="form-select form-select-sm sel-producto">${options}</select>
            </td>
            <td>
                <select name="serie[]" class="form-select form-select-sm sel-serie" style="display:none">
                    <option value="">Seleccione serie</option>
                </select>
                <span class="no-serie text-muted small">—</span>
            </td>
            <td>
                <input type="text" name="precio[]"
                       class="form-control form-control-sm inp-precio" readonly>
            </td>
            <td>
                <input type="number" name="cantidad[]"
                       class="form-control form-control-sm inp-cantidad" min="1"
                       value="${cantidadInit}">
            </td>
            <td>
                <input type="number" name="subtotal[]"
                       class="form-control form-control-sm inp-subtotal" readonly>
            </td>
            <td>
                <button type="button" class="btn btn-sm btn-danger btn-eliminar-fila">X</button>
            </td>`;

        if (productoPresel) {
            setTimeout(() => inicializarFila(fila, productoPresel, cantidadInit, idSerieInit), 0);
        }
        return fila;
    }

    // ── Inicializar fila con datos del producto ───────────────────────────
    function inicializarFila(fila, id_producto, cantidadInit, idSerieInit) {
        const producto = productos.find(p => p.id_producto == id_producto);
        if (!producto) return;

        const inpPrecio = fila.querySelector('.inp-precio');
        const inpCantidad = fila.querySelector('.inp-cantidad');
        const selSerie = fila.querySelector('.sel-serie');
        const noSerie = fila.querySelector('.no-serie');

        inpPrecio.value = producto.precio_compra;

        if (producto.maneja_serie == 1) {
            selSerie.style.display = 'block';
            if (noSerie) noSerie.style.display = 'none';
            inpCantidad.value = '1';
            inpCantidad.readOnly = true;

            // Opciones: series DISPONIBLES del producto
            let opsSerie = '<option value="">Seleccione serie</option>';
            if (producto.series && producto.series.length > 0) {
                producto.series.forEach(s => {
                    const sel = idSerieInit && s.id_producto_serie == idSerieInit ? 'selected' : '';
                    opsSerie += `<option value="${s.id_producto_serie}" ${sel}>${s.numero_serie}</option>`;
                });
            } else {
                opsSerie += '<option value="" disabled>Sin series disponibles</option>';
            }
            selSerie.innerHTML = opsSerie;
        } else {
            selSerie.style.display = 'none';
            if (noSerie) noSerie.style.display = 'inline';
            inpCantidad.value = cantidadInit || '';
            inpCantidad.readOnly = false;
        }
        recalcularFila(fila);
    }

    // ── Eventos delegados ─────────────────────────────────────────────────
    document.addEventListener("change", function (e) {
        if (e.target.classList.contains("sel-producto")) {
            inicializarFila(e.target.closest("tr"), e.target.value, '', '');
        }
    });

    document.addEventListener("input", function (e) {
        if (e.target.classList.contains("inp-precio") ||
            e.target.classList.contains("inp-cantidad")) {
            recalcularFila(e.target.closest("tr"));
        }
    });

    document.addEventListener("click", function (e) {
        if (e.target.classList.contains("btn-eliminar-fila")) {
            e.target.closest("tr").remove();
            calcularTotal();
        }
    });

    // ── Cálculos ──────────────────────────────────────────────────────────
    function recalcularFila(fila) {
        const precio = parseFloat(fila.querySelector(".inp-precio").value) || 0;
        const cantidad = parseFloat(fila.querySelector(".inp-cantidad").value) || 0;
        fila.querySelector(".inp-subtotal").value = (precio * cantidad).toFixed(2);
        calcularTotal();
    }

    function calcularTotal() {
        let total = 0;
        document.querySelectorAll(".inp-subtotal").forEach(i => total += parseFloat(i.value) || 0);
        const inp = document.getElementById("total");
        if (inp) inp.value = total.toFixed(2);
    }

    // ── Rellenar detalle al cargar stock existente ────────────────────────
    // Para productos CON serie: una fila por cada serie asignada al técnico
    // Para productos SIN serie: una fila con la cantidad
    function rellenarDetalleCompra(data) {
        const det = document.getElementById("detalle_compra");
        det.innerHTML = "";

        if (!data.productos || data.productos.length === 0) return;

        data.productos.forEach(function (item) {
            if (!item.id_producto) return;

            const prod = productos.find(p => p.id_producto == item.id_producto);
            if (!prod) return;

            if (prod.maneja_serie == 1 && item.series_asignadas && item.series_asignadas.length > 0) {
                // Una fila por serie asignada al técnico
                // Importante: actualizar las opciones del select con las series de este técnico
                // para que aparezca la serie ya asignada preseleccionada

                // Inyectar temporalmente las series asignadas en el objeto producto
                // para que crearFila pueda usarlas
                const seriesOriginal = prod.series;
                prod.series = item.series_asignadas.map(s => ({
                    id_producto_serie: s.id_producto_serie,
                    numero_serie: s.numero_serie
                }));

                item.series_asignadas.forEach(function (serie) {
                    const fila = crearFila(item.id_producto, '1', serie.id_producto_serie);
                    det.appendChild(fila);
                });

                // Restaurar series originales (disponibles)
                prod.series = seriesOriginal;
            } else {
                const fila = crearFila(item.id_producto, item.stock, '');
                det.appendChild(fila);
            }
        });

        calcularTotal();
    }

    window.rellenarDetalleCompra = rellenarDetalleCompra;
});