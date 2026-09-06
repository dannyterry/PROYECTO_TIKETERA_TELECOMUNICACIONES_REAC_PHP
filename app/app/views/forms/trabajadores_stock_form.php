<form action="" id="form_2">

    <input type="hidden" id="id_trabajador_stock" name="id_trabajador_stock">

    <div class="row">
        <div class="col-md-4">
            <div class="mb-3">
                <label for="nombre" class="form-label">Trabajador *</label>
                <input type="text" id="nombre" name="nombre" class="form-control" placeholder="nombre" readonly>
            </div>
        </div>
        <div class="col-md-4">
            <div class="mb-3">
                <label for="total" class="form-label">Total *</label>
                <div class="input-group">
                    <button class="btn btn-secondary" disabled type="button">S/</button>
                    <input type="number" id="total" name="total" class="form-control" placeholder="0.00" readonly>
                </div>
            </div>
        </div>
    </div>

    <div class="card shadow-sm mb-4">
        <div class="card-header bg-secondary text-white">
            <i class="bi bi-person"></i> Stock actual
        </div>
        <div class="card-body">
            <h6>Stock actual del trabajador</h6>

            <table class="table table-bordered table-sm">

                <thead>
                    <tr>
                        <th>Producto</th>
                        <th>Serie</th>
                        <th>Cantidad</th>
                    </tr>
                </thead>

                <tbody id="detalle_actual"></tbody>

            </table>
        </div>
    </div>

    <div class="card shadow-sm mb-4">
        <div class="card-header bg-secondary text-white">
            <i class="bi bi-person"></i> Productos
        </div>
        <div class="card-body">
            <button type="button" class="btn btn-success" id="btn_agregar_producto">
                <i class="mdi mdi-plus"></i> Agregar Producto
            </button>
            <div class="card mt-2">
                <div class="card-body p-2">
                    <table class="table table-bordered table-sm">
                        <thead>
                            <tr>
                                <th width="35%">Producto *</th>
                                <th width="20%">Serie *</th>
                                <th width="15%">Precio *</th>
                                <th width="10%">Cantidad *</th>
                                <th width="12%">Subtotal *</th>
                                <th width="8%">Acción</th>
                            </tr>
                        </thead>
                        <tbody id="detalle_compra"></tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

</form>

<script>
    // Solo datos — la lógica está en function_trabajadores.js
    const productos = <?= json_encode($productos) ?>;
</script>