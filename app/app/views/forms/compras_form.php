<form action="" id="form">
    <input type="hidden" id="id_compra" name="id_compra">

    <div class="row g-2 mb-3">
        <div class="col-md-3">
            <label class="form-label fw-semibold">Estado *</label>
            <select class="form-select form-select-sm" id="estado" name="estado" data-required="true" data-label="Estado">
                <option value="COMPLETADA" selected>COMPLETADA</option>
                <option value="EN PROCESO">EN PROCESO</option>
                <option value="CANCELADA">CANCELADA</option>
            </select>
        </div>
        <div class="col-md-3">
            <label class="form-label fw-semibold">Fecha *</label>
            <input type="date" id="fecha" name="fecha" class="form-control form-control-sm" data-required="true" data-label="Fecha">
        </div>
        <div class="col-md-3">
            <label class="form-label fw-semibold">Proveedor *</label>
            <select class="form-select form-select-sm" id="id_proveedor" name="id_proveedor" data-required="true" data-label="Proveedor">
                <option disabled>Seleccione...</option>
                <?php foreach ($proveedores as $row): ?>
                    <option value="<?= $row->id_proveedor ?>"><?= $row->nombre_comercial ?></option>
                <?php endforeach; ?>
            </select>
        </div>
        <div class="col-md-3">
            <label class="form-label fw-semibold">Almacén destino *</label>
            <select class="form-select form-select-sm" id="id_almacen" name="id_almacen" data-required="true" data-label="Almacén destino">
                <option disabled>Seleccione...</option>
                <?php foreach ($almacenes as $row): ?>
                    <option value="<?= $row->id_almacen ?>"><?= $row->nombre ?></option>
                <?php endforeach; ?>
            </select>
        </div>
    </div>

    <!-- Detalle de productos -->
    <div class="card border-0 shadow-sm">
        <div class="card-header bg-secondary text-white d-flex justify-content-between align-items-center py-2">
            <span><i class="mdi mdi-package-variant me-1"></i> Productos</span>
            <div class="d-flex align-items-center gap-3">
                <span class="small">Total:
                    <strong>S/ <span id="span_total">0.00</span></strong>
                </span>
                <button type="button" class="btn btn-light btn-sm" id="btn_agregar_producto">
                    <i class="mdi mdi-plus"></i> Agregar
                </button>
            </div>
        </div>
        <div class="card-body p-0">
            <div class="table-responsive">
                <table class="table table-sm table-bordered mb-0" id="tbl_detalle_compra">
                    <thead class="table-dark">
                        <tr>
                            <th style="min-width:170px">Producto *</th>
                            <th style="min-width:160px">
                                Series <small class="fw-normal opacity-75">(una por línea)</small> *
                            </th>
                            <th style="min-width:140px">
                                Almacén series <small class="fw-normal opacity-75">(si aplica)</small> *
                            </th>
                            <th width="90">Precio *</th>
                            <th width="70">Cant. *</th>
                            <th width="90">Subtotal *</th>
                            <th width="45">—</th>
                        </tr>
                    </thead>
                    <tbody id="detalle_compra"></tbody>
                </table>
            </div>
        </div>
        <div class="card-footer d-flex justify-content-end">
            <div class="input-group input-group-sm" style="max-width:200px">
                <span class="input-group-text fw-bold">Total S/ *</span>
                <input type="number" id="total" name="total" class="form-control fw-bold text-end" readonly placeholder="0.00" data-required="true" data-label="Total">
            </div>
        </div>
    </div>

</form>

<script>
    /* Solo datos — lógica en function_compras.js */
    const productos = <?= json_encode($productos) ?>;
    const almacenes = <?= json_encode($almacenes) ?>;
</script>