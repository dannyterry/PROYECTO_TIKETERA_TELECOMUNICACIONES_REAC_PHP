<form action="" id="form" enctype="multipart/form-data">

    <input type="hidden" id="id_producto" name="id_producto">

    <div class="row">
        <div class="col-md-2">
            <div class="mb-3">
                <label for="estado" class="form-label">Estado *</label>
                <select class="form-select" id="estado" name="estado" data-required="true" data-label="Estado">
                    <option value="Activo" selected>Activo</option>
                    <option value="Inactivo">Inactivo</option>
                </select>
            </div>
        </div>
        <div class="col-md-2">
            <div class="mb-3">
                <label for="codigo" class="form-label">
                    Código <span class="badge bg-secondary">AUTO</span> *
                </label>
                <input type="text" id="codigo" name="codigo" class="form-control"
                    placeholder="PROD-00000" readonly
                    style="background:#f8f9fa;cursor:not-allowed"
                    data-required="true" data-label="Código">
            </div>
        </div>
        <div class="col">
            <div class="mb-3">
                <label for="id_almacen" class="form-label">Almacén principal *</label>
                <select class="form-select" id="id_almacen" name="id_almacen" data-required="true" data-label="Almacén principal">
                    <option disabled>Seleccione un almacén</option>
                    <?php foreach ($almacenes as $row) { ?>
                        <option value="<?= $row->id_almacen ?>"><?= $row->nombre ?></option>
                    <?php } ?>
                </select>
            </div>
        </div>
        <div class="col">
            <div class="mb-3">
                <label for="id_categoria" class="form-label">Categoría *</label>
                <select class="form-select" id="id_categoria" name="id_categoria" data-required="true" data-label="Categoría">
                    <option disabled>Seleccione una categoría</option>
                    <?php foreach ($categorias as $row) { ?>
                        <option value="<?= $row->id_categoria ?>"><?= $row->nombre ?></option>
                    <?php } ?>
                </select>
            </div>
        </div>
    </div>

    <div class="row">
        <div class="col-md-3">
            <div class="mb-3">
                <label for="nombre" class="form-label">Nombre *</label>
                <input type="text" id="nombre" name="nombre" class="form-control" placeholder="Nombre" data-required="true" data-label="Nombre">
            </div>
        </div>
        <div class="col">
            <div class="mb-3">
                <label for="descripcion" class="form-label">Descripción *</label>
                <input type="text" id="descripcion" name="descripcion" class="form-control" placeholder="Descripción" data-required="true" data-label="Descripción">
            </div>
        </div>
    </div>

    <div class="row">
        <div class="col-md-3">
            <div class="mb-3">
                <label for="precio_compra" class="form-label">Precio Compra *</label>
                <div class="input-group">
                    <button class="btn btn-secondary" disabled type="button">S/</button>
                    <input type="number" id="precio_compra" name="precio_compra" class="form-control" placeholder="0.00" step="0.01" data-required="true" data-label="Precio compra">
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="mb-3">
                <label for="precio_venta" class="form-label">Precio Venta *</label>
                <div class="input-group">
                    <button class="btn btn-secondary" disabled type="button">S/</button>
                    <input type="number" id="precio_venta" name="precio_venta" class="form-control" placeholder="0.00" step="0.01" data-required="true" data-label="Precio venta">
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="mb-3">
                <label for="stock" class="form-label">
                    Stock actual <small class="text-muted" id="lbl_stock_help">(manual)</small> *
                </label>
                <input type="number" id="stock" name="stock" class="form-control" placeholder="0" data-required="true" data-label="Stock">
            </div>
        </div>
        <div class="col-md-3">
            <div class="mb-3">
                <label for="stock_minimo" class="form-label">Stock Mínimo *</label>
                <input type="number" id="stock_minimo" name="stock_minimo" class="form-control" placeholder="0" data-required="true" data-label="Stock mínimo">
            </div>
        </div>
    </div>

    <!-- ── Series ─────────────────────────────────────────────────── -->
    <div class="card shadow-sm mb-4">
        <div class="card-header bg-secondary text-white d-flex align-items-center gap-3">
            <i class="mdi mdi-barcode"></i> Series
            <div class="form-check form-switch ms-2 mb-0">
                <input class="form-check-input" type="checkbox" id="maneja_serie" name="maneja_serie" data-switch="bool">
                <label class="form-check-label text-white" for="maneja_serie" data-on-label="Si" data-off-label="No"></label>
            </div>
        </div>
        <div class="card-body" id="contenedor_series">

            <!-- Series existentes (solo edición) -->
            <div id="sec_series_existentes" style="display:none" class="mb-3">
                <p class="small fw-semibold mb-1 text-muted">Series ya registradas (solo lectura):</p>
                <div class="table-responsive" style="max-height:120px;overflow-y:auto">
                    <table class="table table-sm table-bordered mb-0">
                        <thead class="table-dark">
                            <tr>
                                <th>Número de serie *</th>
                                <th width="110">Estado *</th>
                                <th width="140">Almacén *</th>
                            </tr>
                        </thead>
                        <tbody id="tbody_series_existentes"></tbody>
                    </table>
                </div>
                <hr class="my-2">
                <p class="small text-muted mb-1">Agregar series nuevas:</p>
            </div>

            <!-- Filas de series nuevas -->
            <div id="lista_series"></div>

            <button type="button" class="btn btn-success btn-sm mt-1" id="btn_agregar_serie">
                <i class="mdi mdi-plus"></i> Agregar serie
            </button>
            <p class="text-muted small mt-2 mb-0">
                Cada serie puede pertenecer a un almacén diferente.
            </p>
        </div>
    </div>

    <!-- ── Imagen ──────────────────────────────────────────────────── -->
    <div class="card shadow-sm mb-4">
        <div class="card-header bg-dark text-white">Imagen Producto</div>
        <div class="card-body">
            <div class="row">
                <div class="col-md-6">
                    <input type="file" id="img_producto" name="img_producto" class="form-control" accept="image/*" data-required="true" data-label="Imagen producto">
                </div>
                <div class="col-md-6 text-center">
                    <img id="preview_foto"
                        src="https://via.placeholder.com/200x200?text=Preview"
                        class="img-thumbnail mt-3" style="max-height:200px;">
                </div>
            </div>
        </div>
    </div>

</form>

<script>
    const almacenes = <?= json_encode($almacenes) ?>;
</script>