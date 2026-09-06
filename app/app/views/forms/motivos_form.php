<form action="" id="form">

    <input type="hidden" id="id_motivo" name="id_motivo">

    <div class="mb-3">
        <label for="estado" class="form-label">Estado *</label>
        <select class="form-select" id="estado" name="estado" data-required="true" data-label="Estado">
            <option value="Activo" selected>Activo</option>
            <option value="Inactivo">Inactivo</option>
        </select>
    </div>

    <div class="mb-3">
        <label for="nombre" class="form-label">Nombre *</label>
        <input type="text" id="nombre" name="nombre" class="form-control" placeholder="nombre" data-required="true" data-label="Nombre">
    </div>

    <div class="mb-3">
        <label for="tipo_trabajo" class="form-label">Tipo de Trabajo (clave de enlace con órdenes)</label>
        <select class="form-select" id="tipo_trabajo" name="tipo_trabajo">
            <option value="">— Sin enlazar —</option>
            <?php foreach ($tipo_trabajos as $tt): ?>
                <option value="<?= htmlspecialchars((string)$tt) ?>"><?= htmlspecialchars((string)$tt) ?></option>
            <?php endforeach; ?>
        </select>
        <small class="text-muted">Elige el tipo de trabajo tal como aparece en las órdenes para enlazarlo y calcular el pago.</small>
    </div>

    <div class="row">
        <div class="col">
            <div class="mb-3">
                <label for="precio_compra" class="form-label">Precio Win *</label>
                <div class="input-group">
                    <button class="btn btn-secondary" disabled type="button">S/</button>
                    <input type="number" id="precio_compra" name="precio_compra" class="form-control" placeholder="0.00" data-required="true" data-label="Precio Win">
                </div>
            </div>
        </div>
        <div class="col">
            <div class="mb-3">
                <label for="precio_venta" class="form-label">Precio Tecnico *</label>
                <div class="input-group">
                    <button class="btn btn-secondary" disabled type="button">S/</button>
                    <input type="number" id="precio_venta" name="precio_venta" class="form-control" placeholder="0.00" data-required="true" data-label="Precio Tecnico">
                </div>
            </div>
        </div>
    </div>

    <hr>

    <!-- Límites de materiales por motivo -->
    <div class="mb-2">
        <label class="form-label fw-semibold small mb-1">Límites de materiales (opcional)</label>
        <small class="text-muted d-block mb-2">
            Al liquidar una orden con este motivo solo se podrá usar la cantidad máxima
            de cada producto indicada aquí (puede usarse menos, pero no más).
        </small>

        <div id="limites_wrap" class="mb-2"></div>

        <button type="button" class="btn btn-sm btn-outline-primary" id="btn_agregar_limite">
            <i class="mdi mdi-plus me-1"></i>Agregar límite
        </button>

        <input type="hidden" id="limites_materiales" name="limites_materiales" value="">
    </div>

</form>

<script>
    const productosParaLimites = <?= json_encode($productos ?? []) ?>;
</script>