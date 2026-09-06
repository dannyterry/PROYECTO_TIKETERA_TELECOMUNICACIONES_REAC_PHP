<form id="form_liquidar">
    <input type="hidden" id="liq_id_orden" name="id_orden">
    <input type="hidden" id="liq_id_trabajador" name="id_trabajador">

    <!-- Info de la orden -->
    <div class="alert alert-info d-flex align-items-center gap-2 py-2 mb-3">
        <i class="mdi mdi-clipboard-check-outline fs-5"></i>
        <div class="small">
            <strong>Orden&nbsp;#<span id="liq_numero">—</span></strong>
            &nbsp;·&nbsp;
            Técnico:&nbsp;<span id="liq_tecnico" class="fw-semibold">—</span>
        </div>
    </div>

    <!-- Stock disponible -->
    <div class="card mb-3 border">
        <div class="card-header bg-light py-2 d-flex align-items-center gap-2">
            <i class="mdi mdi-package-variant text-primary"></i>
            <span class="fw-semibold small">Stock disponible del técnico</span>
        </div>
        <div class="card-body p-0">
            <div class="table-responsive" style="max-height:220px;overflow-y:auto">
                <table class="table table-sm mb-0" id="tablaStockOrig">
                    <thead class="table-light sticky-top">
                        <tr>
                            <th class="ps-3">Producto *</th>
                            <th width="140">Serie *</th>
                            <th width="70" class="text-center">Disp.</th>
                            <th width="55" class="text-center">+</th>
                        </tr>
                    </thead>
                    <tbody id="tablaProductos">
                        <tr>
                            <td colspan="4" class="text-center text-muted py-3">Sin stock cargado</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- Materiales a liquidar -->
    <div class="card mb-3 border">
        <div class="card-header py-2 d-flex justify-content-between align-items-center"
            style="background:rgba(10,207,151,.08)">
            <div class="d-flex align-items-center gap-2">
                <i class="mdi mdi-cart-check text-success"></i>
                <span class="fw-semibold small">Materiales a liquidar</span>
            </div>
            <span class="badge bg-success rounded-pill" id="contadorUsados">0</span>
        </div>
        <div class="card-body p-0">
            <div class="table-responsive" style="max-height:200px;overflow-y:auto">
                <table class="table table-sm mb-0">
                    <thead class="table-light sticky-top">
                        <tr>
                            <th class="ps-3">Producto *</th>
                            <th width="140">Serie *</th>
                            <th width="110" class="text-center">Cantidad *</th>
                            <th width="55" class="text-center">−</th>
                        </tr>
                    </thead>
                    <tbody id="tablaUsados">
                        <tr id="filaVaciaUsados">
                            <td colspan="4" class="text-center text-muted fst-italic py-3">
                                Agrega productos desde el stock disponible
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- Observaciones -->
    <div class="mb-3">
        <label class="form-label fw-semibold small">
            Observaciones *
        </label>
        <textarea id="liq_observaciones" name="observaciones"
            class="form-control form-control-sm" rows="2"
            placeholder="Notas sobre los materiales usados…"
            data-required="true" data-label="Observaciones"></textarea>
    </div>

    <!-- Botones -->
    <div class="d-flex justify-content-end gap-2 mt-2">
        <button type="button" class="btn btn-light btn-sm" data-bs-dismiss="modal">Cancelar</button>
        <button type="button" class="btn btn-success btn-sm px-4 fw-semibold"
            id="btn_guardar_liquidacion">
            <i class="mdi mdi-content-save-outline me-1"></i> Guardar liquidación
        </button>
    </div>

</form>