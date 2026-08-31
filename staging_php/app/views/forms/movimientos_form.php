<form action="" id="form">
    <input type="hidden" id="id_movimiento" name="id_movimiento">

    <div class="row">
        <div class="col-md-4">
            <div class="mb-3">
                <label class="form-label">Almacén origen *</label>
                <select class="form-select" id="id_almacen" name="id_almacen" data-required="true" data-label="Almacén origen">
                    <option disabled>Seleccione almacén</option>
                    <?php foreach ($almacenes as $row) { ?>
                        <option value="<?= $row->id_almacen ?>"><?= $row->nombre ?></option>
                    <?php } ?>
                </select>
            </div>
        </div>
        <div class="col-md-4">
            <div class="mb-3">
                <label class="form-label">Tipo *</label>
                <select class="form-select" id="tipo" name="tipo" data-required="true" data-label="Tipo">
                    <option value="ENTRADA">ENTRADA</option>
                    <option value="SALIDA">SALIDA</option>
                    <option value="TRASLADO">TRASLADO</option>
                </select>
            </div>
        </div>
        <!-- Almacén destino — solo visible en TRASLADO -->
        <div class="col-md-4" id="wrap_almacen_destino" style="display:none">
            <div class="mb-3">
                <label class="form-label">Almacén destino *</label>
                <select class="form-select" id="id_almacen_destino" name="id_almacen_destino" data-required="true" data-label="Almacén destino">
                    <option value="">— Sin destino —</option>
                    <?php foreach ($almacenes as $row) { ?>
                        <option value="<?= $row->id_almacen ?>"><?= $row->nombre ?></option>
                    <?php } ?>
                </select>
            </div>
        </div>
    </div>

    <div class="row">
        <div class="col-md-4">
            <div class="mb-3">
                <label class="form-label">Producto *</label>
                <select class="form-select" id="id_producto" name="id_producto" data-required="true" data-label="Producto">
                    <option disabled>Seleccione un producto</option>
                    <?php foreach ($productos as $row) { ?>
                        <option value="<?= $row->id_producto ?>"
                            data-serie="<?= $row->maneja_serie ?>">
                            <?= $row->codigo ?> - <?= $row->nombre ?>
                        </option>
                    <?php } ?>
                </select>
            </div>
        </div>
        <!-- Serie — solo si el producto maneja serie y tipo no es ENTRADA -->
        <div class="col-md-4" id="wrap_serie" style="display:none">
            <div class="mb-3">
                <label class="form-label">Número de serie *</label>
                <select class="form-select" id="id_producto_serie" name="id_producto_serie" data-required="true" data-label="Número de serie">
                    <option value="">— Seleccione serie —</option>
                </select>
            </div>
        </div>
        <div class="col-md-4" id="wrap_cantidad">
            <div class="mb-3">
                <label class="form-label">Cantidad *</label>
                <input type="number" id="cantidad" name="cantidad"
                    class="form-control" placeholder="0" min="1" data-required="true" data-label="Cantidad">
            </div>
        </div>
    </div>

    <div class="row">
        <div class="col-md-4">
            <div class="mb-3">
                <label class="form-label">Precio compra *</label>
                <div class="input-group">
                    <button class="btn btn-secondary" disabled type="button">S/</button>
                    <input type="number" id="precio_compra" name="precio_compra"
                        class="form-control" placeholder="0.00" readonly data-required="true" data-label="Precio compra">
                </div>
            </div>
        </div>
        <div class="col-md-4">
            <div class="mb-3">
                <label class="form-label">Precio venta *</label>
                <div class="input-group">
                    <button class="btn btn-secondary" disabled type="button">S/</button>
                    <input type="number" id="precio_venta" name="precio_venta"
                        class="form-control" placeholder="0.00" readonly data-required="true" data-label="Precio venta">
                </div>
            </div>
        </div>
        <div class="col-md-4">
            <div class="mb-3">
                <label class="form-label">Total *</label>
                <div class="input-group">
                    <button class="btn btn-secondary" disabled type="button">S/</button>
                    <input type="number" id="total" name="total"
                        class="form-control" placeholder="0.00" readonly data-required="true" data-label="Total">
                </div>
            </div>
        </div>
    </div>

    <div class="mb-3">
        <label class="form-label">Referencia *</label>
        <input type="text" id="referencia" name="referencia"
            class="form-control" placeholder="Nro. de documento, nota, etc." data-required="true" data-label="Referencia">
    </div>

</form>

<script>
    // Datos pasados desde PHP — lógica en function_movimientos.js
    const productosConSeries = <?= json_encode($productos_con_series) ?>;
    const productos = <?= json_encode($productos) ?>;
</script>