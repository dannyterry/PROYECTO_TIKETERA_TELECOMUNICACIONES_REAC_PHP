<form action="" id="form">

    <input type="hidden" id="id_rol" name="id_rol">

    <div class="mb-3">
        <label for="estado" class="form-label">Estado *</label>
        <select class="form-select" id="estado" name="estado" data-required="true" data-label="Estado">
            <option value="Activo" selected>Activo</option>
            <option value="Inactivo">Inactivo</option>
        </select>
    </div>

    <div class="mb-3">
        <label for="nombre" class="form-label">Nombre *</label>
        <input type="text" id="nombre" name="nombre" class="form-control" placeholder="nombre" data-required="true" data-label="Nombre">
    </div>

    <div class="mb-3">
        <label for="descripcion" class="form-label">Descripción *</label>
        <textarea class="form-control" id="descripcion" name="descripcion" rows="5" placeholder="Descripcion..." data-required="true" data-label="Descripción"></textarea>
    </div>

    <div class="mb-3">
        <label class="form-label">Áreas del rol</label>
        <div class="border rounded p-2" id="caja_areas_rol" style="max-height:180px;overflow-y:auto;">
            <?php
            if (!empty($areas)) {
                foreach ($areas as $area) {
            ?>
                    <div class="form-check form-check-inline mb-1">
                        <input class="form-check-input area-rol" type="checkbox"
                            name="areas[]" value="<?= $area->id_area ?>"
                            id="area_rol_<?= $area->id_area ?>">
                        <label class="form-check-label" for="area_rol_<?= $area->id_area ?>">
                            <?= htmlspecialchars($area->nombre) ?>
                        </label>
                    </div>
            <?php
                }
            } else {
                echo '<div class="text-muted small">No hay áreas registradas.</div>';
            }
            ?>
        </div>
        <div class="input-group mt-2">
            <input type="text" id="nueva_area" class="form-control form-control-sm" placeholder="Nueva área...">
            <button type="button" id="btn_agregar_area" class="btn btn-sm btn-outline-success">
                <i class="mdi mdi-plus"></i> Agregar
            </button>
        </div>
        <div class="form-text text-muted">Marca las áreas que tendrá este rol. El área de un usuario se elige solo entre las áreas de su rol.</div>
    </div>

</form>