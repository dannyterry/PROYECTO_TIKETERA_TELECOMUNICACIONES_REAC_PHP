<form action="" id="form">

    <input type="hidden" id="id_asistencia" name="id_asistencia">

    <div class="row">
        <div class="col">
            <div class="mb-3">
                <label for="estado" class="form-label">Estado *</label>
                <select class="form-select" id="estado" name="estado" data-required="true" data-label="Estado">
                    <option value="Asistio" selected>Asistio</option>
                    <option value="Tardanza">Tardanza</option>
                    <option value="Falta">Falta</option>
                </select>
            </div>
        </div>
        <div class="col">
            <div class="mb-3">
                <label for="id_trabajador" class="form-label">Trabajador *</label>
                <select class="form-select" id="id_trabajador" name="id_trabajador" data-required="true" data-label="Trabajador">
                    <option disabled>Seleccione un trabajador</option>
                    <?php foreach ($trabajadores as $row) { ?>
                        <option value="<?= $row->id_trabajador ?>"> <?= $row->rol_trabajador ?> - <?= $row->nombre_trabajador ?> <?= $row->apellido_trabajador ?></option>
                    <?php } ?>
                </select>
            </div>
        </div>
    </div>

    <div class="row">
        <div class="col">
            <div class="mb-3">
                <label for="fecha" class="form-label">Fecha *</label>
                <input type="date" id="fecha" name="fecha" class="form-control" data-required="true" data-label="Fecha">
            </div>
        </div>
        <div class="col">
            <div class="mb-3">
                <label for="minutos_tarde" class="form-label">Minutos tarde *</label>
                <input type="number" min="0" max="60" id="minutos_tarde" name="minutos_tarde" class="form-control" placeholder="0" data-required="true" data-label="Minutos tarde">
            </div>
        </div>
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

    <div class="mb-3">
        <label for="observacion" class="form-label">Observaciones *</label>
        <textarea class="form-control" id="observacion" name="observacion" rows="5" placeholder="Observaciones..." data-required="true" data-label="Observaciones"></textarea>
    </div>

</form>