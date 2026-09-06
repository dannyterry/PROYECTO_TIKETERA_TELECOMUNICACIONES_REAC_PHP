<form action="" id="form">

    <input type="hidden" id="id_horario" name="id_horario">

    <div class="mb-3">
        <label for="estado" class="form-label">Estado *</label>
        <select class="form-select" id="estado" name="estado" data-required="true" data-label="Estado">
            <option value="Activo" selected>Activo</option>
            <option value="Inactivo">Inactivo</option>
        </select>
    </div>

    <div class="row">
        <div class="col">
            <div class="mb-3">
                <label for="hora_entrada" class="form-label">Hora entrada *</label>
                <input type="time" id="hora_entrada" name="hora_entrada" class="form-control" data-required="true" data-label="Hora entrada">
            </div>
        </div>
        <div class="col">
            <div class="mb-3">
                <label for="hora_salida" class="form-label">Hora salida *</label>
                <input type="time" id="hora_salida" name="hora_salida" class="form-control" data-required="true" data-label="Hora salida">
            </div>
        </div>
    </div>

    <div class="row">
        <div class="col">
            <div class="mb-3">
                <label for="nombre" class="form-label">Nombre *</label>
                <input type="text" id="nombre" name="nombre" class="form-control" placeholder="nombre" data-required="true" data-label="Nombre">
            </div>
        </div>
        <div class="col">
            <div class="mb-3">
                <label for="tolerancia_min" class="form-label">Tolerancia Min. *</label>
                <input type="number" min="0" max="60" id="tolerancia_min" name="tolerancia_min" class="form-control" placeholder="0" data-required="true" data-label="Tolerancia mínima">
            </div>
        </div>
    </div>

</form>