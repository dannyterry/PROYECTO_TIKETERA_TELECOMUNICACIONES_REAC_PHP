<div class="card">
    <div class="card-body">
        <div class="mb-3 d-flex justify-content-end">
            <button type="button" class="btn btn-primary" id="btn_actualizar">
                <i class="mdi mdi-refresh me-1"></i>
                Buscar ordenes
            </button>
        </div>
        <div class="row mb-3 justify-content-start">
            <div class="col-md-2">
                <label>Fecha Desde</label>
                <input type="date" id="fechaDesde" class="form-control">
            </div>
            <div class="col-md-2">
                <label>Fecha Hasta</label>
                <input type="date" id="fechaHasta" class="form-control">
            </div>
            <div class="col-md-2 d-flex align-items-end">
                <button id="filtrarFecha" class="btn btn-success w-100">
                    <i class="mdi mdi-filter me-1"></i> Filtrar
                </button>
            </div>
            <div class="col-md-2 d-flex align-items-end">
                <button id="limpiarFiltro" class="btn btn-secondary w-100">
                    <i class="mdi mdi-refresh me-1"></i> Limpiar
                </button>
            </div>
        </div>

        <!-- Sin dt-responsive, sin nowrap — el wrapper da scroll horizontal -->
        <!-- <div style="width:100%; overflow-x:auto;"> -->
        <!-- <table id="tabla-ordenes" class="table table-striped w-100"> -->
        <table id="tabla-ordenes" class="table table-striped w-100 nowrap">
            <thead>
                <tr>
                    <th>Fecha Visita</th>
                    <th>Inconcert</th>
                    <th>N° Ticket</th>
                    <th>Cliente</th>
                    <th>Tecnico</th>
                    <th>Inicio</th>
                    <th>Fin</th>
                    <th>Estado</th>
                    <th>Cuadrilla</th>
                    <th>Tipo de Averia</th>
                    <th>Tipo de Trabajo</th>
                    <th>Acción</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
        <!-- </div> -->

    </div>
</div>

<script>
    const trabajadores = <?= json_encode($trabajadores) ?>;
</script>