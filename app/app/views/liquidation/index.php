<div class="card border-0 shadow-sm">

    <!-- Toolbar -->
    <div class="card-header bg-white py-2 border-bottom">
        <div class="d-flex flex-wrap align-items-center gap-2">

            <div class="d-flex align-items-center gap-2 me-2">
                <i class="mdi mdi-invoice-text-outline text-primary fs-5"></i>
                <span class="fw-bold text-dark">Liquidaciones por técnico</span>
            </div>

            <div class="vr mx-1"></div>

            <div class="d-flex align-items-center gap-1">
                <label class="text-muted small mb-0 text-nowrap">Desde</label>
                <input type="date" id="liqFechaDesde" class="form-control form-control-sm" style="width:135px">
            </div>
            <div class="d-flex align-items-center gap-1">
                <label class="text-muted small mb-0 text-nowrap">Hasta</label>
                <input type="date" id="liqFechaHasta" class="form-control form-control-sm" style="width:135px">
            </div>

            <button id="liqFiltrar" class="btn btn-success btn-sm">
                <i class="mdi mdi-filter me-1"></i>Filtrar
            </button>
            <button id="liqLimpiar" class="btn btn-outline-secondary btn-sm">
                <i class="mdi mdi-close me-1"></i>Limpiar
            </button>
        </div>
    </div>

    <div class="card-body">
        <div class="row g-3">

            <!-- Columna izquierda: técnicos -->
            <div class="col-lg-5">
                <div class="border rounded">
                    <div class="table-responsive" style="max-height:65vh; overflow-y:auto;">
                        <table class="table table-sm table-hover mb-0" id="tablaTecnicosLiq">
                            <thead class="table-light sticky-top">
                                <tr>
                                    <th class="ps-3">Técnico</th>
                                    <th class="text-center">Liq.</th>
                                    <th class="text-center">Órdenes</th>
                                    <th class="text-center">Pend.</th>
                                    <th class="text-center">Rech.</th>
                                    <th class="text-end pe-3">Costo</th>
                                </tr>
                            </thead>
                            <tbody id="tbodyTecnicosLiq">
                                <tr>
                                    <td colspan="6" class="text-center text-muted py-4">
                                        <span class="spinner-border spinner-border-sm text-primary"></span> Cargando…
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Columna derecha: liquidaciones del técnico seleccionado -->
            <div class="col-lg-7">
                <div class="border rounded">
                    <div class="px-3 py-2 bg-light border-bottom d-flex justify-content-between align-items-center">
                        <span class="fw-semibold small" id="tituloTecnicoSeleccionado">
                            Selecciona un técnico para ver sus liquidaciones
                        </span>
                    </div>
                    <div class="table-responsive" style="max-height:60vh; overflow-y:auto;">
                        <table class="table table-sm table-hover mb-0" id="tablaLiqTecnico">
                            <thead class="table-light sticky-top">
                                <tr>
                                    <th class="ps-3">Fecha</th>
                                    <th>N° Orden</th>
                                    <th>Cliente</th>
                                    <th>Acta</th>
                                    <th class="text-center">Estado</th>
                                    <th class="text-end pe-3">Costo</th>
                                </tr>
                            </thead>
                            <tbody id="tbodyLiqTecnico">
                                <tr>
                                    <td colspan="6" class="text-center text-muted fst-italic py-4">
                                        Sin técnico seleccionado
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

        </div>
    </div>
</div>

<!-- Modal: detalle de una liquidación -->
<div class="modal fade" id="modalDetalleLiq" tabindex="-1">
    <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
        <div class="modal-content">
            <div class="modal-header py-2">
                <h6 class="modal-title mb-0">
                    <i class="mdi mdi-clipboard-check-outline me-1"></i>
                    Detalle de liquidación
                </h6>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body" id="cuerpoDetalleLiq">
                <div class="text-center text-muted py-4">
                    <span class="spinner-border spinner-border-sm text-primary"></span> Cargando…
                </div>
            </div>
            <div class="modal-footer py-2" id="footerDetalleLiq"></div>
        </div>
    </div>
</div>

<script>
    const puedeAprobar = <?= $puedeAprobar ? 'true' : 'false' ?>;
</script>