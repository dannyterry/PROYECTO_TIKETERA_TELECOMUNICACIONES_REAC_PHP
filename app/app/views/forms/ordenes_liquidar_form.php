<form id="form_liquidar">
    <input type="hidden" id="liq_id_orden" name="id_orden">
    <input type="hidden" id="liq_id_trabajador" name="id_trabajador">

    <!-- Info de la orden -->
    <div class="alert alert-info d-flex align-items-center gap-2 py-2 mb-3">
        <i class="mdi mdi-clipboard-check-outline fs-5"></i>
        <div class="small">
            <strong>Orden&nbsp;#<span id="liq_numero">—</span></strong>
            &nbsp;·&nbsp;
            Técnico:&nbsp;<span id="liq_tecnico" class="fw-semibold">—</span> <br>
            Cliente:&nbsp;<span id="liq_cliente" class="fw-semibold">—</span>
        </div>
    </div>

    <!-- Aviso de límites de materiales del motivo -->
    <div class="alert alert-warning d-none d-flex align-items-start gap-2 py-2 mb-3" id="liq_limites_aviso">
        <i class="mdi mdi-information-outline mt-1"></i>
        <div class="small" id="liq_limites_texto"></div>
    </div>

    <!-- Número de acta: va primero, bloquea el resto del formulario -->
    <div class="mb-3">
        <label class="form-label fw-semibold small mb-1"> N° de acta * </label>
        <div class="input-group input-group-sm" style="max-width: 160px;">
            <span class="input-group-text fw-semibold">001-</span>
            <input type="text"
                id="liq_numero_acta_sufijo"
                class="form-control"
                placeholder="1234"
                autocomplete="off"
                inputmode="numeric">
        </div>
        <input type="hidden" id="liq_numero_acta" name="numero_acta" data-required="true" data-label="Número de acta">
        <div class="form-text text-danger d-none" id="liq_acta_aviso">
            Debes ingresar el número de acta antes de agregar equipos o materiales.
        </div>
    </div>

    <!-- Bloque bloqueado hasta ingresar el número de acta -->
    <div id="liq_bloque_productos">

        <!-- EQUIPOS -->
        <div class="card mb-3 border">
            <div class="card-header bg-light py-2 d-flex align-items-center gap-2">
                <i class="mdi mdi-laptop text-primary"></i>
                <span class="fw-semibold small text-uppercase">Equipos</span>
            </div>
            <div class="card-body p-0">
                <div class="table-responsive" style="max-height:180px;overflow-y:auto">
                    <table class="table table-sm mb-0" id="tablaStockEquipos">
                        <thead class="table-light sticky-top">
                            <tr>
                                <th class="ps-3">Producto *</th>
                                <th width="120">Serie *</th>
                                <th width="70" class="text-center">Disp.</th>
                                <th width="55" class="text-center">+</th>
                            </tr>
                        </thead>
                        <tbody id="tablaProductosEquipos">
                            <tr>
                                <td colspan="4" class="text-center text-muted py-3">Sin stock cargado</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Equipos de baja -->
            <div class="card-footer bg-white py-2">
                <div class="d-flex align-items-center gap-2 mb-1">
                    <i class="mdi mdi-delete-sweep text-danger"></i>
                    <span class="fw-semibold small">Equipos de baja</span>
                </div>
                <div class="d-flex flex-column flex-md-row gap-2 align-items-md-center">
                    <select id="liq_baja_producto" class="form-select form-select-sm" style="max-width:140px;">
                        <option value="">Producto...</option>
                    </select>
                    <textarea id="liq_baja_series"
                        class="form-control form-control-sm"
                        rows="2"
                        placeholder="Pega aquí las series de los equipos de baja, una por línea"></textarea>
                    <button type="button" class="btn btn-sm btn-outline-danger text-nowrap" id="btn_agregar_bajas">
                        <i class="mdi mdi-plus"></i> Agregar
                    </button>
                </div>
                <div class="form-text text-danger d-none" id="liq_baja_producto_aviso">
                    Selecciona a qué producto pertenecen estas series.
                </div>
            </div>
        </div>

        <!-- MATERIALES O FERRETERIA -->
        <div class="card mb-3 border">
            <div class="card-header bg-light py-2 d-flex align-items-center gap-2">
                <i class="mdi mdi-hammer-screwdriver text-warning"></i>
                <span class="fw-semibold small text-uppercase">Materiales o ferretería</span>
            </div>
            <div class="card-body p-0">
                <div class="table-responsive" style="max-height:180px;overflow-y:auto">
                    <table class="table table-sm mb-0" id="tablaStockMateriales">
                        <thead class="table-light sticky-top">
                            <tr>
                                <th class="ps-3">Producto *</th>
                                <th width="120">Serie *</th>
                                <th width="70" class="text-center">Disp.</th>
                                <th width="55" class="text-center">+</th>
                            </tr>
                        </thead>
                        <tbody id="tablaProductosMateriales">
                            <tr>
                                <td colspan="4" class="text-center text-muted py-3">Sin stock cargado</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Materiales a liquidar (carrito) -->
        <div class="card mb-3 border">
            <div class="card-header py-2 d-flex justify-content-between align-items-center"
                style="background:rgba(10,207,151,.08)">
                <div class="d-flex align-items-center gap-2">
                    <i class="mdi mdi-cart-check text-success"></i>
                    <span class="fw-semibold small">Materiales a liquidar</span>
                </div>

                <div class="d-flex align-items-center gap-2">

                    <button type="button"
                        class="btn btn-sm btn-primary"
                        id="btn_escanear">

                        <i class="mdi mdi-camera"></i>
                    </button>

                    <span class="badge bg-success rounded-pill"
                        id="contadorUsados">0</span>

                </div>

            </div>
            <div class="card-body p-0">
                <div class="table-responsive" style="max-height:220px;overflow-y:auto">
                    <table class="table table-sm mb-0">
                        <thead class="table-light sticky-top">
                            <tr>
                                <th class="ps-3">Producto *</th>
                                <th width="120">Serie *</th>
                                <th width="120" class="text-center">Cantidad *</th>
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

    </div>
    <!-- /liq_bloque_productos -->

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


<div class="modal fade" id="modalScanner" tabindex="-1">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">

            <div class="modal-header">
                <h5 class="modal-title">
                    Escanear serie
                </h5>

                <button type="button"
                    class="btn-close"
                    data-bs-dismiss="modal"></button>
            </div>

            <div class="modal-body">

                <div id="reader" style="width:100%"></div>

                <div id="scanner_estado" class="small text-muted text-center mt-2"></div>

                <hr class="my-2">

                <label class="btn btn-outline-secondary w-100 text-nowrap" for="scanner_archivo">
                    <i class="mdi mdi-image-outline me-1"></i> Leer desde una foto
                </label>
                <input type="file" id="scanner_archivo" accept="image/*" class="d-none">

            </div>

        </div>
    </div>
</div>