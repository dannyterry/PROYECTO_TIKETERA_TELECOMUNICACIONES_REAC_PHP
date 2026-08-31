<form action="" id="form" enctype="multipart/form-data">

    <input type="hidden" id="id_vehiculo" name="id_vehiculo">

    <div class="row">
        <div class="col">
            <div class="mb-3">
                <label for="id_marca" class="form-label">Marca *</label>
                <select class="form-select" id="id_marca" name="id_marca" data-required="true" data-label="Marca">
                    <option disabled>Seleccione una marca</option>
                    <?php foreach ($marcas as $row) { ?>
                        <option value="<?= $row->id_marca ?>"><?= $row->nombre ?></option>
                    <?php } ?>
                </select>
            </div>
        </div>
        <div class="col">
            <div class="mb-3">
                <label for="id_modelo" class="form-label">Modelo *</label>
                <select class="form-select" id="id_modelo" name="id_modelo" data-required="true" data-label="Modelo">
                    <option disabled>Seleccione un modelo</option>
                    <?php foreach ($modelos as $row) { ?>
                        <option value="<?= $row->id_modelo ?>"><?= $row->nombre ?></option>
                    <?php } ?>
                </select>
            </div>
        </div>
    </div>

    <div class="row">
        <div class="col">
            <div class="mb-3">
                <label for="id_tipo_vehiculo" class="form-label">Tipo Vehiculo *</label>
                <select class="form-select" id="id_tipo_vehiculo" name="id_tipo_vehiculo" data-required="true" data-label="Tipo vehículo">
                    <option disabled>Seleccione un tipo de vehiculo</option>
                    <?php foreach ($tipos_vehiculo as $row) { ?>
                        <option value="<?= $row->id_tipo_vehiculo ?>"><?= $row->nombre ?></option>
                    <?php } ?>
                </select>
            </div>
        </div>
        <div class="col">
            <div class="mb-3">
                <label for="id_combustible" class="form-label">Combustible *</label>
                <select class="form-select" id="id_combustible" name="id_combustible" data-required="true" data-label="Combustible">
                    <option disabled>Seleccione un combustible</option>
                    <?php foreach ($combustibles as $row) { ?>
                        <option value="<?= $row->id_combustible ?>"><?= $row->nombre ?></option>
                    <?php } ?>
                </select>
            </div>
        </div>
    </div>

    <div class="row">
        <div class="col">
            <div class="mb-3">
                <label for="placa" class="form-label">Placa *</label>
                <input type="text" id="placa" name="placa" class="form-control" placeholder="placa" data-required="true" data-label="Placa">
            </div>
        </div>
        <div class="col">
            <div class="mb-3">
                <label for="anio" class="form-label">Año *</label>
                <input type="text" id="anio" name="anio" class="form-control" placeholder="año" data-required="true" data-label="Año">
            </div>
        </div>
    </div>

    <div class="row">
        <div class="col">
            <div class="mb-3">
                <label for="transmision" class="form-label">Transmision *</label>
                <select class="form-select" id="transmision" name="transmision" data-required="true" data-label="Transmisión">
                    <option value="Manual" selected>Manual</option>
                    <option value="Automática">Automática</option>
                </select>
            </div>
        </div>
        <div class="col">
            <div class="mb-3">
                <label for="color" class="form-label">Color *</label>
                <input type="text" id="color" name="color" class="form-control" placeholder="color" data-required="true" data-label="Color">
            </div>
        </div>
    </div>

    <div class="row">
        <div class="col">
            <div class="mb-3">
                <label for="estado_documento" class="form-label">Estado documento *</label>
                <select class="form-select" id="estado_documento" name="estado_documento" data-required="true" data-label="Estado documento">
                    <option value="Vigente" selected>Vigente</option>
                    <option value="Vencido">Vencido</option>
                </select>
            </div>
        </div>
        <div class="col">
            <div class="mb-3">
                <div class="mb-3">
                    <label for="fecha_vencimiento" class="form-label">Fecha vencimiento *</label>
                    <input type="date" id="fecha_vencimiento" name="fecha_vencimiento" class="form-control" placeholder="Fecha vencimiento" data-required="true" data-label="Fecha vencimiento">
                </div>
            </div>
        </div>
    </div>

    <div class="row">
        <div class="col">
            <div class="mb-3">
                <label for="estado" class="form-label">Estado Vehiculo *</label>
                <select class="form-select" id="estado" name="estado" data-required="true" data-label="Estado vehículo">
                    <option value="Disponible" selected>Disponible</option>
                    <option value="En uso">En uso</option>
                    <option value="En mantenimiento">En mantenimiento</option>
                    <option value="Inactivo">Inactivo</option>
                </select>
            </div>
        </div>
        <div class="col">
            <div class="mb-3">
                <label for="observaciones" class="form-label">Observaciones *</label>
                <textarea class="form-control" id="observaciones" name="observaciones" rows="5" placeholder="Observaciones..." data-required="true" data-label="Observaciones"></textarea>
            </div>
        </div>
    </div>

    <div class="row">
        <div class="col">
            <div class="mb-3">
                <label for="imagenDelantera" class="form-label">Vehiculo *</label>
                <input type="file" id="imagenDelantera" name="img_1" class="form-control"
                    accept="image/*" data-required="true" data-label="Imagen delantera">
            </div>
        </div>
        <div class="col">
            <div class="mb-3">
                <label for="imagenTrasera" class="form-label">Vehiculo *</label>
                <input type="file" id="imagenTrasera" name="img_2" class="form-control"
                    accept="image/*" data-required="true" data-label="Imagen trasera">
            </div>
        </div>
    </div>

    <div class="row">
        <div class="col text-center">
            <img id="previewDelantera" class="img-thumbnail">
        </div>
        <div class="col text-center">
            <img id="previewTrasera" class="img-thumbnail">
        </div>
    </div>




    <!-- Documentación -->


    <hr class="my-4">

    <h5 class="mb-3">Documentación del Vehículo</h5>

    <div class="row">
        <div class="col">
            <div class="mb-3">
                <label for="documento_soat" class="form-label">N° SOAT</label>
                <input type="text"
                    id="documento_soat"
                    name="documento_soat"
                    class="form-control"
                    placeholder="Número SOAT">
            </div>
        </div>

        <div class="col">
            <div class="mb-3">
                <label for="documento_revision" class="form-label">N° Revisión Técnica</label>
                <input type="text"
                    id="documento_revision"
                    name="documento_revision"
                    class="form-control"
                    placeholder="Número revisión técnica">
            </div>
        </div>
    </div>

    <div class="row">
        <div class="col">
            <div class="mb-3">
                <label for="fecha_ven_soat" class="form-label">Vencimiento SOAT</label>
                <input type="date"
                    id="fecha_ven_soat"
                    name="fecha_ven_soat"
                    class="form-control">
            </div>
        </div>

        <div class="col">
            <div class="mb-3">
                <label for="fecha_ven_revision" class="form-label">Vencimiento Revisión Técnica</label>
                <input type="date"
                    id="fecha_ven_revision"
                    name="fecha_ven_revision"
                    class="form-control">
            </div>
        </div>
    </div>

    <div class="row">

        <div class="col">
            <div class="mb-3">
                <label for="img_tarjeta_propiedad" class="form-label">Tarjeta de propiedad</label>
                <input type="file"
                    id="img_tarjeta_propiedad"
                    name="img_tarjeta_propiedad"
                    class="form-control"
                    accept="image/*,.pdf">
            </div>
        </div>

        <div class="col">
            <div class="mb-3">
                <label for="img_revision" class="form-label">Documento revisión técnica</label>
                <input type="file"
                    id="img_revision"
                    name="img_revision"
                    class="form-control"
                    accept="image/*,.pdf">
            </div>
        </div>

    </div>

    <div class="row">
        <div class="col text-center">
            <img id="previewTarjeta" class="img-thumbnail">
        </div>
        <div class="col text-center">
            <img id="previewRevision" class="img-thumbnail">
        </div>
    </div>

    <div class="row">

        <div class="col">
            <div class="mb-3">
                <label for="img_soat" class="form-label">Documento SOAT</label>
                <input type="file"
                    id="img_soat"
                    name="img_soat"
                    class="form-control"
                    accept="image/*,.pdf">
            </div>
        </div>

        <div class="col">
            <div class="mb-3">
                <label for="img_certificado_gas" class="form-label">Certificado de Gas</label>
                <input type="file"
                    id="img_certificado_gas"
                    name="img_certificado_gas"
                    class="form-control"
                    accept="image/*,.pdf">
            </div>
        </div>

    </div>

    <div class="row">
        <div class="col text-center">
            <img id="previewSoat" class="img-thumbnail">
        </div>
        <div class="col text-center">
            <img id="previewCertificado" class="img-thumbnail">
        </div>
    </div>


</form>