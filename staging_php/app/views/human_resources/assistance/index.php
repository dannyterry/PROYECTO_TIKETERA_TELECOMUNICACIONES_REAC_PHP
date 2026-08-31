<?php $fecha_hoy = date('Y-m-d'); ?>

<div class="card">
    <div class="card-body">

        <!-- Filtro por fecha -->
        <div class="row g-2 align-items-center mb-3">
            <div class="col-md-3">
                <label for="filtro_fecha" class="form-label mb-1">Fecha</label>
                <input type="date" id="filtro_fecha" class="form-control" value="<?= $fecha_hoy ?>">
            </div>
            <div class="col-md-2">
                <label class="form-label mb-1 d-none d-md-block">&nbsp;</label>
                <button type="button" id="btn_hoy" class="btn btn-outline-primary w-100">
                    <i class="mdi mdi-calendar-today me-1"></i> Hoy
                </button>
            </div>
            <div class="col-md-2">
                <label class="form-label mb-1 d-none d-md-block">&nbsp;</label>
                <button type="button" id="btn_consultar" class="btn btn-primary w-100">
                    <i class="mdi mdi-magnify me-1"></i> Consultar
                </button>
            </div>
        </div>

        <!-- Resumen del día -->
        <div class="row g-3 mb-4" id="resumen-asistencias">
            <div class="col-xl-3 col-md-6">
                <div class="card bg-primary-lighten mb-0">
                    <div class="card-body py-3 d-flex align-items-center gap-3">
                        <div class="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" style="width:46px;height:46px;">
                            <i class="mdi mdi-account-group font-20"></i>
                        </div>
                        <div>
                            <h4 class="mb-0 fw-bold" id="sum_total">0</h4>
                            <span class="text-muted small">Total técnicos</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-xl-3 col-md-6">
                <div class="card bg-success-lighten mb-0">
                    <div class="card-body py-3 d-flex align-items-center gap-3">
                        <div class="bg-success text-white rounded-circle d-flex align-items-center justify-content-center" style="width:46px;height:46px;">
                            <i class="mdi mdi-check font-20"></i>
                        </div>
                        <div>
                            <h4 class="mb-0 fw-bold" id="sum_asistio">0</h4>
                            <span class="text-muted small">Asistieron</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-xl-3 col-md-6">
                <div class="card bg-warning-lighten mb-0">
                    <div class="card-body py-3 d-flex align-items-center gap-3">
                        <div class="bg-warning text-white rounded-circle d-flex align-items-center justify-content-center" style="width:46px;height:46px;">
                            <i class="mdi mdi-clock-outline font-20"></i>
                        </div>
                        <div>
                            <h4 class="mb-0 fw-bold" id="sum_tardanza">0</h4>
                            <span class="text-muted small">Tardanzas</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-xl-3 col-md-6">
                <div class="card bg-danger-lighten mb-0">
                    <div class="card-body py-3 d-flex align-items-center gap-3">
                        <div class="bg-danger text-white rounded-circle d-flex align-items-center justify-content-center" style="width:46px;height:46px;">
                            <i class="mdi mdi-close-circle font-20"></i>
                        </div>
                        <div>
                            <h4 class="mb-0 fw-bold" id="sum_falta">0</h4>
                            <span class="text-muted small">Faltas</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Tarjetas de asistencia -->
        <div class="d-flex align-items-center mb-2">
            <h5 class="mb-0 me-2">Asistencias del día</h5>
            <span class="badge bg-light text-dark border" id="lbl_fecha_mostrada"></span>
        </div>

        <div class="row g-3" id="contenedor-asistencias">
            <div class="col-12 text-center text-muted py-5">
                <i class="mdi mdi-loading mdi-spin font-24"></i>
                <p class="mt-2 mb-0">Cargando asistencias...</p>
            </div>
        </div>

    </div>
</div>
