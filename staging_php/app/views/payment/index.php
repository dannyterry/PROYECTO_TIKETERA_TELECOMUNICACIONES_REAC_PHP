<?php $hoy = date('Y-m-d'); ?>

<div class="card">
    <div class="card-body">

        <!-- Filtro por rango de fechas -->
        <div class="row g-2 align-items-end mb-3">
            <div class="col-md-2">
                <label for="pago_desde" class="form-label mb-1">Desde</label>
                <input type="date" id="pago_desde" class="form-control" value="<?= $hoy ?>">
            </div>
            <div class="col-md-2">
                <label for="pago_hasta" class="form-label mb-1">Hasta</label>
                <input type="date" id="pago_hasta" class="form-control" value="<?= $hoy ?>">
            </div>
            <div class="col-md-2">
                <label for="pago_estado" class="form-label mb-1">Liquidación</label>
                <select id="pago_estado" class="form-select">
                    <option value="">Todas</option>
                    <option value="liquidada">Liquidadas</option>
                    <option value="pendiente">Pendientes</option>
                    <option value="rechazada">Rechazadas</option>
                    <option value="sin_liquidar">Sin liquidar</option>
                </select>
            </div>
            <div class="col-md-2">
                <button type="button" id="pago_btn_hoy" class="btn btn-outline-primary w-100">
                    <i class="mdi mdi-calendar-today me-1"></i> Hoy
                </button>
            </div>
            <div class="col-md-2">
                <button type="button" id="pago_btn_consultar" class="btn btn-primary w-100">
                    <i class="mdi mdi-magnify me-1"></i> Consultar
                </button>
            </div>
            <div class="col-md-2">
                <button type="button" id="pago_btn_excel" class="btn btn-success w-100">
                    <i class="mdi mdi-file-excel me-1"></i> Excel
                </button>
            </div>
        </div>

        <!-- Resumen del periodo -->
        <div class="row g-3 mb-4">
            <div class="col-xl-3 col-md-6">
                <div class="card bg-primary-lighten mb-0">
                    <div class="card-body py-3 d-flex align-items-center gap-3">
                        <div class="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" style="width:46px;height:46px;">
                            <i class="mdi mdi-cash-multiple font-20"></i>
                        </div>
                        <div>
                            <h4 class="mb-0 fw-bold" id="pago_sum_win"><?= MONEDA ?> 0.00</h4>
                            <span class="text-muted small">Ingreso WIN</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-xl-3 col-md-6">
                <div class="card bg-warning-lighten mb-0">
                    <div class="card-body py-3 d-flex align-items-center gap-3">
                        <div class="bg-warning text-white rounded-circle d-flex align-items-center justify-content-center" style="width:46px;height:46px;">
                            <i class="mdi mdi-package-variant font-20"></i>
                        </div>
                        <div>
                            <h4 class="mb-0 fw-bold" id="pago_sum_material"><?= MONEDA ?> 0.00</h4>
                            <span class="text-muted small">Costo material</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-xl-3 col-md-6">
                <div class="card bg-danger-lighten mb-0">
                    <div class="card-body py-3 d-flex align-items-center gap-3">
                        <div class="bg-danger text-white rounded-circle d-flex align-items-center justify-content-center" style="width:46px;height:46px;">
                            <i class="mdi mdi-account-cash font-20"></i>
                        </div>
                        <div>
                            <h4 class="mb-0 fw-bold" id="pago_sum_pago"><?= MONEDA ?> 0.00</h4>
                            <span class="text-muted small">Pago a técnicos</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-xl-3 col-md-6">
                <div class="card bg-success-lighten mb-0">
                    <div class="card-body py-3 d-flex align-items-center gap-3">
                        <div class="bg-success text-white rounded-circle d-flex align-items-center justify-content-center" style="width:46px;height:46px;">
                            <i class="mdi mdi-trending-up font-20"></i>
                        </div>
                        <div>
                            <h4 class="mb-0 fw-bold" id="pago_sum_ganancia"><?= MONEDA ?> 0.00</h4>
                            <span class="text-muted small">Ganancia del día</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-xl-3 col-md-6">
                <div class="card bg-info-lighten mb-0">
                    <div class="card-body py-3 d-flex align-items-center gap-3">
                        <div class="bg-info text-white rounded-circle d-flex align-items-center justify-content-center" style="width:46px;height:46px;">
                            <i class="mdi mdi-clipboard-text font-20"></i>
                        </div>
                        <div>
                            <h4 class="mb-0 fw-bold" id="pago_sum_ordenes">0</h4>
                            <span class="text-muted small">Órdenes (<span id="pago_sum_sin_precio">0</span> sin precio)</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Tabla por técnico -->
        <div class="d-flex align-items-center mb-2">
            <h5 class="mb-0 me-2">Pago por técnico</h5>
            <span class="badge bg-light text-dark border" id="pago_lbl_periodo"></span>
        </div>

        <div class="table-responsive">
            <table id="tabla-pagos" class="table table-striped dt-responsive nowrap w-100">
                <thead>
                    <tr>
                        <th>Técnico</th>
                        <th>Órdenes</th>
                        <th>Sin precio</th>
                        <th>Ingreso WIN</th>
                        <th>Material</th>
                        <th>Pago Técnico</th>
                        <th>Ganancia</th>
                        <th>Acción</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td colspan="8" class="text-center text-muted py-4">Cargando...</td>
                    </tr>
                </tbody>
            </table>
        </div>

    </div>
</div>

<!-- Modal detalle por técnico -->
<div id="modalDetallePago" class="modal fade" tabindex="-1" role="dialog" aria-hidden="true">
    <div class="modal-dialog modal-xl">
        <div class="modal-content">
            <div class="modal-header">
                <h4 class="modal-title" id="pago_detalle_titulo">Detalle</h4>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-hidden="true"></button>
            </div>
            <div class="modal-body" id="pago_detalle_body">
                <div class="text-center text-muted py-4">Cargando...</div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-light" data-bs-dismiss="modal">Cerrar</button>
            </div>
        </div>
    </div>
</div>
