<form action="" id="form">

    <input type="hidden" id="id_trabajador" name="id_trabajador">

    <div class="row">
        <div class="col">
            <div class="mb-3">
                <label for="id_vehiculo" class="form-label">Vehiculo *</label>
                <select class="form-select" id="id_vehiculo" name="id_vehiculo" data-required="true" data-label="Vehículo">
                    <option disabled>Seleccione un vehiculo</option>
                    <?php foreach ($vehiculos as $row) { ?>
                        <option value="<?= $row->id_vehiculo ?>">PLACA: <?= $row->placa ?> - COLOR: <?= $row->color ?></option>
                    <?php } ?>
                </select>
            </div>
        </div>
        <div class="col">

            <div class="mb-3">
                <label for="id_usuario" class="form-label">Usuario *</label>
                <select class="form-select" id="id_usuario" name="id_usuario" data-required="true" data-label="Usuario">
                    <option disabled>Seleccione un usuario</option>
                    <?php foreach ($usuarios as $row) { ?>
                        <option value="<?= $row->id_usuario ?>"><?= $row->nombres ?> <?= $row->apellidos ?></option>
                    <?php } ?>
                </select>
            </div>
        </div>
    </div>

    <div class="row">
        <div class="col">
            <div class="mb-3">
                <label for="id_horario" class="form-label">Horario *</label>
                <select class="form-select" id="id_horario" name="id_horario" data-required="true" data-label="Horario">
                    <option disabled>Seleccione un horario</option>
                    <?php foreach ($horarios as $row) { ?>
                        <option value="<?= $row->id_horario ?>"><?= $row->nombre ?></option>
                    <?php } ?>
                </select>
            </div>
        </div>
        <div class="col">
            <div class="mb-3">
                <label for="fecha_ingreso" class="form-label">Fecha Ingreso *</label>
                <input type="date" id="fecha_ingreso" name="fecha_ingreso" class="form-control" data-required="true" data-label="Fecha ingreso">
            </div>
        </div>
    </div>

</form>