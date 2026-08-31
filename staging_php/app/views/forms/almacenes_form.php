<form action="" id="form">

    <input type="hidden" id="id_almacen" name="id_almacen">

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
        <label for="direccion" class="form-label">Dirección *</label>
        <input type="text" id="direccion" name="direccion" class="form-control" placeholder="Dirección" data-required="true" data-label="Dirección">
    </div>

</form>