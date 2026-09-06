<form action="" id="form" enctype="multipart/form-data">

    <input type="hidden" id="id_usuario" name="id_usuario">

    <!-- ================= DATOS GENERALES ================= -->
    <div class="card shadow-sm mb-4">
        <div class="card-header bg-primary text-white">
            <i class="bi bi-person"></i> Datos Generales
        </div>
        <div class="card-body">
            <div class="row">
                <div class="col-md-6">
                    <div class="mb-3">
                        <label class="form-label">Estado *</label>
                        <select class="form-select" name="estado" data-required="true" data-label="Estado">
                            <option value="Activo">Activo</option>
                            <option value="Inactivo">Inactivo</option>
                        </select>
                    </div>
                </div>

                <div class="col-md-6">
                    <div class="mb-3">
                        <label for="id_rol" class="form-label">Rol *</label>
                        <select class="form-select" id="id_rol" name="id_rol" data-required="true" data-label="Rol">
                            <option disabled>Seleccione un rol</option>
                            <?php foreach ($roles as $row) { ?>
                                <option value="<?= $row->id_rol ?>"><?= $row->nombre ?></option>
                            <?php } ?>
                        </select>
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="col-md-6">
                    <div class="mb-3">
                        <label for="nombres" class="form-label">Nombres *</label>
                        <input type="text" id="nombres" name="nombres" class="form-control" placeholder="Nombres" data-required="true" data-label="Nombres">
                    </div>
                </div>

                <div class="col-md-6">
                    <div class="mb-3">
                        <label for="apellidos" class="form-label">Apellidos *</label>
                        <input type="text" id="apellidos" name="apellidos" class="form-control" placeholder="apellidos" data-required="true" data-label="Apellidos">
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="col-md-6">
                    <div class="mb-3">
                        <label for="email" class="form-label">Correo *</label>
                        <input type="email" id="email" name="email" class="form-control" placeholder="Correo" data-required="true" data-label="Correo">
                    </div>
                </div>

                <div class="col-md-6">
                    <div class="mb-3">
                        <label for="usuario" class="form-label">Usuario *</label>
                        <input type="text" id="usuario" name="usuario" class="form-control" placeholder="Usuario" data-required="true" data-label="Usuario">
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="col-md-6">
                    <div class="mb-3">
                        <label for="password" class="form-label">Contraseña *</label>
                        <input type="text" id="password" name="password" class="form-control" placeholder="Contraseña" data-required="true" data-label="Contraseña">
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- ================= DOCUMENTO ================= -->
    <div class="card shadow-sm mb-4">
        <div class="card-header bg-dark text-white">
            Documento de Identidad
        </div>
        <div class="card-body">
            <div class="row">
                <div class="col-md-6">
                    <div class="mb-3">
                        <label for="tipo_documento" class="form-label">Tipo Documento *</label>
                        <select class="form-select" id="tipo_documento" name="tipo_documento" data-required="true" data-label="Tipo Documento">
                            <option value="DNI">DNI</option>
                            <option value="Pasaporte">Pasaporte</option>
                            <option value="Carnet">Carnet</option>
                        </select>
                    </div>
                </div>

                <div class="col-md-6">
                    <div class="mb-3">
                        <label for="documento" class="form-label">Número Documento *</label>
                        <input type="text" id="documento" name="documento" class="form-control" placeholder="Documento" data-required="true" data-label="Documento">
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="col-md-6">
                    <div class="mb-3">
                        <label class="form-label">Documento - Delantera *</label>
                        <input type="file" id="doc_delantera" name="doc_delantera" class="form-control" accept="image/*" data-required="true" data-label="Documento Delantera">
                    </div>
                </div>

                <div class="col-md-6">
                    <div class="mb-3">
                        <label class="form-label">Documento - Trasera *</label>
                        <input type="file" id="doc_trasera" name="doc_trasera" class="form-control" accept="image/*" data-required="true" data-label="Documento Trasera">
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="col-md-6">
                    <div class="mb-3">
                        <img id="preview_documento_delantera"
                            src="https://via.placeholder.com/200x200?text=Preview"
                            class="img-thumbnail mt-3"
                            style="max-height:200px;">
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="mb-3">
                        <img id="preview_documento_trasera"
                            src="https://via.placeholder.com/200x200?text=Preview"
                            class="img-thumbnail mt-3"
                            style="max-height:200px;">
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- ================= BREVETE ================= -->
    <div class="card shadow-sm mb-4">
        <div class="card-header bg-warning text-dark">
            Información de Brevete
        </div>
        <div class="card-body">
            <div class="row">
                <div class="col-md-6">
                    <div class="mb-3">
                        <label for="numero_brevete" class="form-label">Número Brevete *</label>
                        <input type="text" id="numero_brevete" name="numero_brevete" class="form-control" placeholder="Brevete" data-required="true" data-label="Número Brevete">
                    </div>
                </div>

                <div class="col-md-6">
                    <div class="mb-3">
                        <label for="fecha_vencimiento_brevete" class="form-label">Fecha Vencimiento *</label>
                        <input type="date" id="fecha_vencimiento_brevete" name="fecha_vencimiento_brevete" class="form-control" data-required="true" data-label="Fecha Vencimiento Brevete">
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="col-md-6">
                    <div class="mb-3">
                        <label for="brevete_delantera" class="form-label">Brevete - Delantera *</label>
                        <input type="file" id="brevete_delantera" name="brevete_delantera" class="form-control" accept="image/*" data-required="true" data-label="Brevete Delantera">
                    </div>
                </div>

                <div class="col-md-6">
                    <div class="mb-3">
                        <label for="brevete_trasera" class="form-label">Brevete - Trasera *</label>
                        <input type="file" id="brevete_trasera" name="brevete_trasera" class="form-control" accept="image/*" data-required="true" data-label="Brevete Trasera">
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="col-md-6">
                    <div class="mb-3">
                        <img id="preview_brevete_delantera"
                            src="https://via.placeholder.com/200x200?text=Preview"
                            class="img-thumbnail mt-3"
                            style="max-height:200px;">
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="mb-3">
                        <img id="preview_brevete_trasera"
                            src="https://via.placeholder.com/200x200?text=Preview"
                            class="img-thumbnail mt-3"
                            style="max-height:200px;">
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- ================= FOTO PERSONAL ================= -->
    <div class="card shadow-sm mb-4">
        <div class="card-header bg-secondary text-white">
            Foto Personal (Fotocheck)
        </div>
        <div class="card-body">
            <div class="row">
                <div class="col-md-6">
                    <div class="mb-3">
                        <label for="foto_personal" class="form-label">Foto *</label>
                        <input type="file" id="foto_personal" name="foto_personal" class="form-control" accept="image/*" data-required="true" data-label="Foto Personal">
                    </div>
                </div>

                <div class="col-md-6 text-center">
                    <div class="mb-3">
                        <img id="preview_foto"
                            src="https://via.placeholder.com/200x200?text=Preview"
                            class="img-thumbnail mt-3"
                            style="max-height:200px;">
                    </div>
                </div>
            </div>
        </div>
    </div>

</form>