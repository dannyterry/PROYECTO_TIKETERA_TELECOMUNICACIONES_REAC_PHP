<form action="" id="form">

    <input type="hidden" id="id_tipo_trabajo" name="id_tipo_trabajo">

    <div class="mb-3">
        <label for="nombre" class="form-label">Nombre *</label>
        <input type="text" id="nombre" name="nombre" class="form-control"
            placeholder="Ej: VISITA EXTERNA, RECABLEADO, TRASLADO..."
            data-required="true" data-label="Nombre">
        <small class="text-muted">
            Este catálogo alimenta los selectores de tipo de trabajo en Órdenes y Motivos.
        </small>
    </div>

    <div class="mb-3">
        <label for="estado" class="form-label">Estado *</label>
        <select class="form-select" id="estado" name="estado" data-required="true" data-label="Estado">
            <option value="Activo" selected>Activo</option>
            <option value="Inactivo">Inactivo</option>
        </select>
    </div>

</form>
