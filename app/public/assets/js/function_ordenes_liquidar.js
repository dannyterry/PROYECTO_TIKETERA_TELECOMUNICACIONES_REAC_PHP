// ==============================================================
// LIQUIDAR — Reemplaza la sección "// LIQUIDAR" al final del
// $(document).ready(function() { ... }), antes del cierre });
// ==============================================================

// Array en memoria con los productos ya agregados
let productosUsados = [];

// ---- Cargar stock del técnico en el modal ----
function cargarProductos(response) {
    let tbody = document.getElementById("tablaProductos");
    tbody.innerHTML = "";

    if (!response.productos || response.productos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">Sin stock disponible</td></tr>`;
        return;
    }

    response.productos.forEach(producto => {

        if (producto.maneja_serie == 1) {
            // Un renglón por serie disponible
            if (!producto.series || producto.series.length === 0) {
                tbody.innerHTML += `
                        <tr>
                            <td>${producto.nombre_producto}</td>
                            <td colspan="3" class="text-muted">Sin series disponibles</td>
                        </tr>`;
                return;
            }

            producto.series.forEach(serie => {
                tbody.innerHTML += `
                        <tr>
                            <td>${producto.nombre_producto}</td>
                            <td><code>${serie.numero_serie}</code></td>
                            <td class="text-center">1</td>
                            <td class="text-center">
                                <button type="button"
                                    class="btn btn-sm btn-outline-success rounded-pill agregarProducto"
                                    data-id="${producto.id_producto}"
                                    data-nombre="${producto.nombre_producto}"
                                    data-serie="${serie.numero_serie}"
                                    data-id-serie="${serie.id_producto_serie}"
                                    data-maneja-serie="1">
                                    <i class="mdi mdi-plus"></i>
                                </button>
                            </td>
                        </tr>`;
            });

        } else {
            // Sin serie
            tbody.innerHTML += `
                    <tr>
                        <td>${producto.nombre_producto}</td>
                        <td>—</td>
                        <td class="text-center" id="disp_${producto.id_producto}">${producto.stock}</td>
                        <td class="text-center">
                            <button type="button"
                                class="btn btn-sm btn-outline-success rounded-pill agregarProducto"
                                data-id="${producto.id_producto}"
                                data-nombre="${producto.nombre_producto}"
                                data-stock="${producto.stock}"
                                data-maneja-serie="0">
                                <i class="mdi mdi-plus"></i>
                            </button>
                        </td>
                    </tr>`;
        }
    });
}

// ---- Render de tabla de productos usados ----
function renderTablaUsados() {
    let tbody = document.getElementById("tablaUsados");
    let contador = document.getElementById("contadorUsados");
    tbody.innerHTML = "";
    contador.textContent = productosUsados.length;

    if (productosUsados.length === 0) {
        tbody.innerHTML = `<tr id="filaVaciaUsados"><td colspan="4" class="text-center text-muted fst-italic">Aún no se agregan materiales</td></tr>`;
        return;
    }

    productosUsados.forEach((p, idx) => {
        tbody.innerHTML += `
                <tr>
                    <td>${p.nombre}</td>
                    <td>${p.numero_serie ? `<code>${p.numero_serie}</code>` : '—'}</td>
                    <td class="text-center">
                        ${p.maneja_serie
                ? '1'
                : `<div class="input-group input-group-sm" style="width:90px">
                                <button type="button" class="btn btn-outline-secondary decrementar" data-idx="${idx}">−</button>
                                <input type="number" class="form-control text-center cantidad_usada" data-idx="${idx}" value="${p.cantidad}" min="1" max="${p.stock_max}">
                                <button type="button" class="btn btn-outline-secondary incrementar" data-idx="${idx}">+</button>
                               </div>`
            }
                    </td>
                    <td class="text-center">
                        <button type="button" class="btn btn-sm btn-outline-danger rounded-pill quitarProducto" data-idx="${idx}">
                            <i class="mdi mdi-trash-can-outline"></i>
                        </button>
                    </td>
                </tr>`;
    });
}

// ---- Click en "Agregar" producto ----
$(document).on('click', '.agregarProducto', function () {
    const id = $(this).data('id');
    const nombre = $(this).data('nombre');
    const manejaSerieFlag = parseInt($(this).data('maneja-serie')) === 1;
    const numero_serie = $(this).data('serie') || null;
    const id_serie = $(this).data('id-serie') || null;
    const stock_max = parseInt($(this).data('stock')) || 1;

    // Evitar duplicar misma serie
    if (manejaSerieFlag && numero_serie) {
        const yaExiste = productosUsados.some(p => p.numero_serie === numero_serie);
        if (yaExiste) {
            Swal.fire({ icon: 'warning', title: 'Ya agregado', text: `La serie ${numero_serie} ya está en la lista.`, timer: 1500, showConfirmButton: false });
            return;
        }
    }

    productosUsados.push({
        id_producto: id,
        nombre: nombre,
        maneja_serie: manejaSerieFlag ? 1 : 0,
        numero_serie: numero_serie,
        id_producto_serie: id_serie,
        cantidad: 1,
        stock_max: stock_max
    });

    renderTablaUsados();
});

// ---- Quitar producto de la lista ----
$(document).on('click', '.quitarProducto', function () {
    const idx = parseInt($(this).data('idx'));
    productosUsados.splice(idx, 1);
    renderTablaUsados();
});

// ---- Controles de cantidad ----
$(document).on('click', '.incrementar', function () {
    const idx = parseInt($(this).data('idx'));
    if (productosUsados[idx].cantidad < productosUsados[idx].stock_max) {
        productosUsados[idx].cantidad++;
        renderTablaUsados();
    }
});
$(document).on('click', '.decrementar', function () {
    const idx = parseInt($(this).data('idx'));
    if (productosUsados[idx].cantidad > 1) {
        productosUsados[idx].cantidad--;
        renderTablaUsados();
    }
});
$(document).on('change', '.cantidad_usada', function () {
    const idx = parseInt($(this).data('idx'));
    let val = parseInt($(this).val()) || 1;
    val = Math.min(Math.max(val, 1), productosUsados[idx].stock_max);
    productosUsados[idx].cantidad = val;
    $(this).val(val);
});

// ---- Guardar liquidación ----
$('#btn_guardar_liquidacion').on('click', function () {

    if (productosUsados.length === 0) {
        Swal.fire({ icon: 'warning', title: 'Sin materiales', text: 'Debes agregar al menos un producto antes de guardar.', confirmButtonText: 'OK' });
        return;
    }

    const id_orden = $('#liq_id_orden').val();
    const id_trabajador = $('#liq_id_trabajador').val();
    const observaciones = $('#liq_observaciones').val();

    Swal.fire({
        title: '¿Confirmar liquidación?',
        text: `Se registrarán ${productosUsados.length} producto(s) para la orden ${$('#liq_numero').text()}.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, guardar',
        cancelButtonText: 'Cancelar'
    }).then(result => {
        if (!result.isConfirmed) return;

        $.ajax({
            url: 'ordenes/liquidar',
            type: 'POST',
            data: {
                id_orden: id_orden,
                id_trabajador: id_trabajador,
                observaciones: observaciones,
                productos: JSON.stringify(productosUsados)
            },
            beforeSend: function () {
                $('#btn_guardar_liquidacion').prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span> Guardando...');
            },
            success: function (response) {
                if (response.success) {
                    Swal.fire({ icon: 'success', title: '¡Listo!', text: response.mensaje, timer: 2000, showConfirmButton: false });
                    modal_2.modal('hide');
                    tablaAjax.ajax.reload();
                    productosUsados = [];
                } else {
                    Swal.fire({ icon: 'error', title: 'Error', text: response.mensaje });
                }
            },
            error: function () {
                Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo conectar con el servidor.' });
            },
            complete: function () {
                $('#btn_guardar_liquidacion').prop('disabled', false).html('<i class="mdi mdi-content-save"></i> Guardar liquidación');
            }
        });
    });
});

// ---- Al abrir modal liquidar, resetear lista ----
// Esto va dentro del handler del botón .liquidar:
//   productosUsados = [];
//   renderTablaUsados();
//   $('#liq_observaciones').val('');
// (Ya contemplado en el handler de abajo)

// botón liquidar — REEMPLAZA el bloque existente con este
$(tabla).on('click', '.liquidar', function () {

    const id = $(this).data('id');

    productosUsados = [];
    renderTablaUsados();
    $('#liq_observaciones').val('');

    obtenerDatos(
        url_editar,
        id,
        function (response) {
            Swal.close();
            modal_2.modal('show');
            id_titulo_modal_2.text(titulo_modal_liquidar);

            // Cargar datos en el form
            $('#liq_id_orden').val(response.data.id_orden);
            $('#liq_id_trabajador').val(response.data.id_tecnico);
            $('#liq_numero').text(response.data.numero);
            $('#liq_tecnico').text(response.data.nombre_tecnico || '—');

            // También rellenar campos ocultos heredados
            rellenarFormulario(response.data);
            cargarProductos(response);
        },
        function (response) {
            alertError(response.mensaje);
        }
    );
});
// ==============================================================
// FIN SECCIÓN LIQUIDAR
// ==============================================================