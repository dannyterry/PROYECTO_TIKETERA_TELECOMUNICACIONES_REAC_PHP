<form action="" id="form">

    <input type="hidden" id="id_categoria" name="id_categoria">

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
        <label for="descripcion" class="form-label">Descripcion *</label>
        <textarea class="form-control" id="descripcion" name="descripcion" rows="5" placeholder="Descripcion..." data-required="true" data-label="Descripcion"></textarea>
    </div>

</form>