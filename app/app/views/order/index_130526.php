<div class="card border-0 shadow-sm">

    <!-- ── Toolbar compact: todo en una fila ── -->
    <div class="card-header bg-white py-2 border-bottom">
        <div class="d-flex flex-wrap align-items-center gap-2">

            <!-- Título del módulo -->
            <div class="d-flex align-items-center gap-2 me-2">
                <i class="mdi mdi-clipboard-list-outline text-primary fs-5"></i>
                <span class="fw-bold text-dark">Órdenes de Trabajo</span>
            </div>

            <!-- Separador visual -->
            <div class="vr mx-1"></div>

            <!-- Filtros de fecha en línea -->
            <div class="d-flex align-items-center gap-1">
                <label class="text-muted small mb-0 text-nowrap">Desde</label>
                <input type="date" id="fechaDesde"
                    class="form-control form-control-sm"
                    style="width:135px">
            </div>
            <div class="d-flex align-items-center gap-1">
                <label class="text-muted small mb-0 text-nowrap">Hasta</label>
                <input type="date" id="fechaHasta"
                    class="form-control form-control-sm"
                    style="width:135px">
            </div>

            <!-- Botones filtro -->
            <button id="filtrarFecha" class="btn btn-success btn-sm">
                <i class="mdi mdi-filter me-1"></i>Filtrar
            </button>
            <button id="limpiarFiltro" class="btn btn-outline-secondary btn-sm">
                <i class="mdi mdi-close me-1"></i>Limpiar
            </button>

            <!-- Separador -->
            <div class="vr mx-1"></div>

            <!-- Selector de filas por página -->
            <div class="d-flex align-items-center gap-1">
                <label class="text-muted small mb-0 text-nowrap">Mostrar</label>
                <select id="sel_page_length" class="form-select form-select-sm" style="width:70px">
                    <option value="10">10</option>
                    <option value="25" selected>25</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                    <option value="-1">Todo</option>
                </select>
            </div>

            <div class="ms-auto">


                <button type="button"
                    class="btn btn-outline-danger btn-sm"
                    id="btn_toggle_sync">

                    <i class="mdi mdi-pause-circle" id="iconToggle"></i>
                </button>

                <!-- Botón actualizar WIN (a la derecha) -->
                <button type="button" class="btn btn-primary btn-sm ms-auto" id="btn_actualizar">
                    <i class="mdi mdi-refresh me-1" id="textoSync"></i>
                </button>
            </div>


        </div>
    </div>

    <div class="card-body p-0">
        <table id="tabla-ordenes" class="table table-striped w-100 nowrap">
            <thead>
                <tr>
                    <th>Fecha Visita</th>
                    <th>Inconcert</th>
                    <th>N° Ticket</th>
                    <th>Cliente</th>
                    <th>Técnico</th>
                    <th>Inicio</th>
                    <th>Fin</th>
                    <th>Estado</th>
                    <th>Cuadrilla</th>
                    <th>Tipo Avería</th>
                    <th>Tipo Trabajo</th>
                    <th>Acción</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    </div>

</div>

<script>
    const trabajadores = <?= json_encode($trabajadores) ?>;
</script>