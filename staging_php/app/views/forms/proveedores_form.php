<form action="" id="form">

    <input type="hidden" id="id_proveedor" name="id_proveedor">

    <div class="row">
        <div class="col">
            <div class="mb-3">
                <label for="estado" class="form-label">Estado *</label>
                <select class="form-select" id="estado" name="estado" data-required="true" data-label="Estado">
                    <option value="Activo" selected>Activo</option>
                    <option value="Inactivo">Inactivo</option>
                </select>
            </div>
        </div>
        <div class="col">
            <div class="mb-3">
                <label for="ruc" class="form-label">RUC *</label>
                <div class="input-group">
                    <input type="text" id="ruc" name="ruc" class="form-control" placeholder="RUC" data-required="true" data-label="RUC">
                    <button class="btn btn-success" type="button" id="btn_buscar_ruc"><i class="mdi mdi-magnify "></i></button>
                </div>
            </div>
        </div>
    </div>

    <div class="mb-3">
        <label for="razon_social" class="form-label">Razon Social *</label>
        <input type="text" id="razon_social" name="razon_social" class="form-control" placeholder="Dirección" data-required="true" data-label="Razón social">
    </div>

    <div class="mb-3">
        <label for="direccion" class="form-label">Dirección *</label>
        <input type="text" id="direccion" name="direccion" class="form-control" placeholder="Dirección" data-required="true" data-label="Dirección">
    </div>

    <div class="mb-3">
        <label for="nombre_comercial" class="form-label">Nombre Comercial *</label>
        <input type="text" id="nombre_comercial" name="nombre_comercial" class="form-control" placeholder="Dirección" data-required="true" data-label="Nombre comercial">
    </div>

    <div class="row">
        <div class="col">
            <div class="mb-3">
                <label for="telefono" class="form-label">Telefono *</label>
                <input type="text" id="telefono" name="telefono" class="form-control" placeholder="Dirección" data-required="true" data-label="Teléfono">
            </div>
        </div>
        <div class="col">
            <div class="mb-3">
                <label for="email" class="form-label">Email *</label>
                <input type="text" id="email" name="email" class="form-control" placeholder="Dirección" data-required="true" data-label="Email">
            </div>
        </div>
    </div>

</form>