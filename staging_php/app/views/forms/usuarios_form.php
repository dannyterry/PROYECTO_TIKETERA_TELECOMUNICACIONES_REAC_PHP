<form action="" id="form" enctype="multipart/form-data">

    <style>
        /* Campos bloqueados al editar (parecen deshabilitados, pero conservan
           su valor al enviar el formulario). */
        .campo-bloqueado {
            background-color: #e9ecef !important;
            opacity: .85;
            cursor: not-allowed;
        }
        .campo-bloqueado:focus {
            box-shadow: none;
            border-color: #dee2e6;
        }
    </style>

    <input type="hidden" id="id_usuario" name="id_usuario">
    <!-- JSON con los hijos agregados dinámicamente, se arma en el JS antes de enviar -->
    <input type="hidden" id="hijos_json" name="hijos_json" value="[]">

    <!-- ================= 1. DATOS PERSONALES ================= -->
    <div class="card shadow-sm mb-4">
        <div class="card-header bg-primary text-white">
            <i class="mdi mdi-account"></i> 1. Datos Personales
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
                            <option disabled selected>Seleccione un rol</option>
                            <?php foreach ($roles as $row) { ?>
                                <option value="<?= $row->id_rol ?>"><?= $row->nombre ?></option>
                            <?php } ?>
                        </select>
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="col-md-4">
                    <div class="mb-3">
                        <label for="tipo_documento" class="form-label">Tipo Documento *</label>
                        <select class="form-select" id="tipo_documento" name="tipo_documento" data-required="true" data-label="Tipo Documento">
                            <option value="DNI">DNI</option>
                            <option value="Pasaporte">Pasaporte</option>
                            <option value="Carnet">Carnet</option>
                        </select>
                    </div>
                </div>
                <div class="col-md-8">
                    <div class="mb-3">
                        <label for="documento" class="form-label" id="lbl_documento">N° Documento *</label>
                        <div class="input-group">
                            <input type="text" id="documento" name="documento" class="form-control solo-numeros" placeholder="DNI" data-required="true" data-label="Documento" maxlength="8" inputmode="numeric" pattern="[0-9]*">
                            <button type=" button" class="btn btn-primary" id="btn_consultar_dni">
                                <span id="btn_consultar_dni_texto">Consultar</span>
                            </button>
                        </div>
                        <div class="form-text text-danger d-none" id="dni_error"></div>
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="col-md-4">
                    <div class="mb-3">
                        <label for="nombres" class="form-label">Nombres *</label>
                        <input type="text" id="nombres" name="nombres" class="form-control" placeholder="Nombres" data-required="true" data-label="Nombres">
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="mb-3">
                        <label for="apellidos" class="form-label">Apellidos *</label>
                        <input type="text" id="apellidos" name="apellidos" class="form-control" placeholder="Apellidos" data-required="true" data-label="Apellidos">
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="mb-3">
                        <label for="email" class="form-label">Correo Electrónico</label>
                        <input type="email" id="email" name="email" class="form-control" placeholder="correo@telecom.com">
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="col-md-4">
                    <div class="mb-3">
                        <label for="usuario" class="form-label">Usuario *</label>
                        <input type="text" id="usuario" name="usuario" class="form-control" placeholder="Usuario" data-required="true" data-label="Usuario" autocomplete="off">
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="mb-3">
                        <label for="password" class="form-label">Contraseña *</label>
                        <input type="text" id="password" name="password" class="form-control" placeholder="Contraseña" data-required="true" data-label="Contraseña" autocomplete="off">
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="mb-3">
                        <label for="telefono" class="form-label">Teléfono Celular</label>
                        <input type="text" id="telefono" name="telefono" class="form-control" placeholder="Número de contacto">
                    </div>
                </div>
            </div>

            <!-- Aviso + botón para habilitar la edición de Usuario/Contraseña.
                 Solo se muestra al editar (lo controla el JS). Evita cambios
                 accidentales; al desbloquear, se guarda normal al enviar. -->
            <div class="row d-none" id="fila_desbloquear_acceso">
                <div class="col-12">
                    <div class="alert alert-warning py-2 px-3 mb-0 small d-flex flex-wrap align-items-center gap-2">
                        <i class="mdi mdi-shield-lock-outline"></i>
                        <span>Usuario y Contraseña están bloqueados para evitar cambios accidentales.</span>
                        <button type="button" id="btn_desbloquear_acceso" class="btn btn-sm btn-outline-warning">
                            <i class="mdi mdi-lock-open-variant-outline me-1"></i>Habilitar edición
                        </button>
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="col-md-3">
                    <div class="mb-3">
                        <label for="fecha_nacimiento" class="form-label">Fecha de nacimiento</label>
                        <input type="date" id="fecha_nacimiento" name="fecha_nacimiento" class="form-control">
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="mb-3">
                        <label for="direccion" class="form-label">Dirección de Residencia</label>
                        <input type="text" id="direccion" name="direccion" class="form-control" placeholder="Dirección actual">
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="mb-3">
                        <label for="distrito" class="form-label">Distrito</label>
                        <input type="text" id="distrito" name="distrito" class="form-control" placeholder="Distrito">
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- ================= INFORMACIÓN SUNAT ================= -->
    <div class="card shadow-sm mb-4">
        <div class="card-header bg-info text-white">
            Información SUNAT
        </div>
        <div class="card-body">
            <div class="row">
                <div class="col-md-4">
                    <div class="mb-3">
                        <label for="ruc" class="form-label">RUC</label>
                        <!-- Botón "Consultar RUC" eliminado: el RUC se autocompleta
                             desde el DNI (10 + DNI + dígito verificador). -->
                        <input type="text" id="ruc" name="ruc" class="form-control solo-numeros campo-bloqueado" placeholder="RUC" maxlength="11" inputmode="numeric" pattern="[0-9]*" readonly>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="mb-3">
                        <label for="sunat_estado" class="form-label">Estado Contribuyente</label>
                        <input type="text" id="sunat_estado" name="sunat_estado" class="form-control" readonly>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="mb-3">
                        <label for="sunat_condicion" class="form-label">Condición Contribuyente</label>
                        <input type="text" id="sunat_condicion" name="sunat_condicion" class="form-control" readonly>
                    </div>
                </div>
            </div>
            <div class="mb-3">
                <label for="sunat_actividad" class="form-label">Actividad Económica</label>
                <textarea id="sunat_actividad" name="sunat_actividad" class="form-control" rows="2" readonly></textarea>
            </div>
        </div>
    </div>

    <!-- ================= DERECHOHABIENTES (ESSALUD) ================= -->
    <div class="card shadow-sm mb-4">
        <div class="card-header bg-success text-white">
            Derechohabientes (EsSalud)
        </div>
        <div class="card-body">

            <div class="border rounded p-3 mb-3 bg-light">
                <div class="fw-semibold mb-2">Datos de la Cónyuge / Esposa (opcional)</div>
                <div class="row">
                    <div class="col-md-3">
                        <label class="form-label">Nombres</label>
                        <input type="text" id="conyuge_nombres" name="conyuge_nombres" class="form-control" placeholder="Nombres">
                    </div>
                    <div class="col-md-3">
                        <label class="form-label">Primer Apellido</label>
                        <input type="text" id="conyuge_apellido1" name="conyuge_apellido1" class="form-control" placeholder="Primer Apellido">
                    </div>
                    <div class="col-md-3">
                        <label class="form-label">Segundo Apellido</label>
                        <input type="text" id="conyuge_apellido2" name="conyuge_apellido2" class="form-control" placeholder="Segundo Apellido">
                    </div>
                    <div class="col-md-3">
                        <label class="form-label">Fecha de Nacimiento</label>
                        <input type="date" id="conyuge_fecha_nacimiento" name="conyuge_fecha_nacimiento" class="form-control">
                    </div>
                </div>
            </div>

            <div class="border rounded p-3 bg-light">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <div class="fw-semibold">Hijos (opcional)</div>
                    <button type="button" class="btn btn-success btn-sm" id="btn_agregar_hijo">
                        <i class="mdi mdi-plus"></i> Agregar Hijo
                    </button>
                </div>
                <div id="contenedor_hijos"></div>
                <!-- Las filas de hijos se agregan dinámicamente aquí por JS -->
            </div>

        </div>
    </div>

    <!-- ================= 2. LABORAL Y PLANILLA ================= -->
    <div class="card shadow-sm mb-4">
        <div class="card-header bg-primary text-white">
            2. Laboral y Planilla
        </div>
        <div class="card-body">
            <div class="row">
                <div class="col-md-6">
                    <div class="mb-3">
                        <label for="area" class="form-label">Área</label>
                        <!-- Las opciones se llenan dinámicamente según el Rol
                             seleccionado (ver actualizarAreasPorRol() en
                             function_usuarios.js). El campo "Cargo" se eliminó
                             porque cumple la misma función que "Roles". -->
                        <select class="form-select" id="area" name="area">
                            <option value="">Seleccione área</option>
                        </select>
                        <div class="form-text text-muted" id="area_ayuda"></div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="mb-3">
                        <label for="fecha_ingreso" class="form-label">Fecha Ingreso</label>
                        <input type="date" id="fecha_ingreso" name="fecha_ingreso" class="form-control">
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="mb-3">
                        <label for="fecha_salida" class="form-label">Fecha de salida</label>
                        <input type="date" id="fecha_salida" name="fecha_salida" class="form-control">
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="col-md-3">
                    <div class="mb-3">
                        <label for="regimen_pensionario" class="form-label">Régimen Pensionario (AFP/ONP)</label>
                        <select class="form-select" id="regimen_pensionario" name="regimen_pensionario">
                            <option value="">Elegir Régimen</option>
                            <option value="ONP">ONP</option>
                            <option value="AFP Habitat">AFP Habitat</option>
                            <option value="AFP Integra">AFP Integra</option>
                            <option value="AFP Prima">AFP Prima</option>
                            <option value="AFP Profuturo">AFP Profuturo</option>
                        </select>
                    </div>
                </div>
                <div class="col-md-3" id="col_tipo_comision_afp" style="display:none;">
                    <div class="mb-3">
                        <label for="tipo_comision_afp" class="form-label">Tipo de Comisión AFP</label>
                        <select class="form-select" id="tipo_comision_afp" name="tipo_comision_afp">
                            <option value="flujo">Comisión sobre Flujo</option>
                            <option value="saldo">Comisión sobre Saldo (Mixta)</option>
                        </select>
                    </div>
                </div>
                <div class="col-md-3" id="col_cuspp" style="display:none;">
                    <div class="mb-3">
                        <label for="cuspp" class="form-label">CUSPP (Código AFP)</label>
                        <input type="text" id="cuspp" name="cuspp" class="form-control" placeholder="Ej. 123456FHTWA1">
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="mb-3">
                        <label for="opcion_personal" class="form-label">Opción personal</label>
                        <select class="form-select" id="opcion_personal" name="opcion_personal">
                            <option value="">Seleccione</option>
                            <option value="autonomo">Autónomo</option>
                            <option value="directo">Directo</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- Caja informativa de tasas: se llena y se muestra/oculta por JS
                 según el régimen pensionario elegido -->
            <div class="border rounded p-3 mb-3 bg-light d-none" id="caja_tasas_pensionario"></div>

            <div class="row">
                <div class="col-md-3">
                    <div class="mb-3">
                        <label for="cuadrilla" class="form-label">Cuadrilla</label>
                        <input type="text" id="cuadrilla" name="cuadrilla" class="form-control" placeholder="Cuadrilla">
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="mb-3">
                        <label for="banco" class="form-label">Banco</label>
                        <select class="form-select" id="banco" name="banco">
                            <option value="">Seleccione</option>
                            <option value="BCP">BCP</option>
                            <option value="BBVA">BBVA</option>
                            <option value="Interbank">Interbank</option>
                            <option value="Scotiabank">Scotiabank</option>
                            <option value="Banco de la Nación">Banco de la Nación</option>
                        </select>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="mb-3">
                        <label for="cuenta_bancaria" class="form-label">N° Cuenta</label>
                        <input type="text" id="cuenta_bancaria" name="cuenta_bancaria" class="form-control" placeholder="N° Cuenta">
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="mb-3">
                        <label for="cci" class="form-label">CCI</label>
                        <input type="text" id="cci" name="cci" class="form-control" placeholder="CCI">
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- ================= 3. SEGURIDAD (SSOMA) Y EPPS ================= -->
    <div class="card shadow-sm mb-4">
        <div class="card-header bg-warning text-dark">
            3. Seguridad (SSOMA) y EPPs
        </div>
        <div class="card-body">
            <div class="row">
                <div class="col-md-4">
                    <div class="mb-3">
                        <label for="vencimiento_sctr" class="form-label">Vencimiento SCTR</label>
                        <input type="date" id="vencimiento_sctr" name="vencimiento_sctr" class="form-control">
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="mb-3">
                        <label for="vencimiento_emo" class="form-label">Vencimiento EMO (Médico)</label>
                        <input type="date" id="vencimiento_emo" name="vencimiento_emo" class="form-control">
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="mb-3">
                        <label for="categoria_licencia" class="form-label">Licencia de Conducir</label>
                        <select class="form-select" id="categoria_licencia" name="categoria_licencia">
                            <option value="Sin Licencia">Sin Licencia</option>
                            <option value="A-I">A-I</option>
                            <option value="A-IIa">A-IIa</option>
                            <option value="A-IIb">A-IIb</option>
                            <option value="A-IIIa">A-IIIa</option>
                            <option value="A-IIIb">A-IIIb</option>
                            <option value="A-IIIc">A-IIIc</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="col-md-4">
                    <div class="mb-3">
                        <label for="talla_polo" class="form-label">Talla Polo / Casaca</label>
                        <select class="form-select" id="talla_polo" name="talla_polo">
                            <option value="">Elegir Talla</option>
                            <option>XS</option>
                            <option>S</option>
                            <option>M</option>
                            <option>L</option>
                            <option>XL</option>
                            <option>XXL</option>
                        </select>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="mb-3">
                        <label for="talla_pantalon" class="form-label">Talla Pantalón</label>
                        <select class="form-select" id="talla_pantalon" name="talla_pantalon">
                            <option value="">Elegir Talla</option>
                            <?php for ($t = 28; $t <= 44; $t += 2) { ?>
                                <option><?= $t ?></option>
                            <?php } ?>
                        </select>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="mb-3">
                        <label for="talla_calzado" class="form-label">Talla Calzado (Botas)</label>
                        <select class="form-select" id="talla_calzado" name="talla_calzado">
                            <option value="">Elegir Talla</option>
                            <?php for ($t = 36; $t <= 45; $t++) { ?>
                                <option><?= $t ?></option>
                            <?php } ?>
                        </select>
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="col-md-6">
                    <div class="mb-3">
                        <label for="numero_brevete" class="form-label">Número Brevete</label>
                        <input type="text" id="numero_brevete" name="numero_brevete" class="form-control" placeholder="Brevete">
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="mb-3">
                        <label for="emision_brevete" class="form-label">Emisión Licencia</label>
                        <input type="date" id="emision_brevete" name="emision_brevete" class="form-control">
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="mb-3">
                        <label for="fecha_vencimiento_brevete" class="form-label">Venc. Licencia</label>
                        <input type="date" id="fecha_vencimiento_brevete" name="fecha_vencimiento_brevete" class="form-control">
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- ================= 4. EXPERIENCIA PREVIA ================= -->
    <div class="card shadow-sm mb-4">
        <div class="card-header bg-primary text-white">
            4. Experiencia Previa (últimos empleos)
        </div>
        <div class="card-body">
            <div class="mb-3">
                <label for="ultimo_empleo_1" class="form-label">Último Empleo 1</label>
                <input type="text" id="ultimo_empleo_1" name="ultimo_empleo_1" class="form-control" placeholder="Empresa - Cargo - Fechas">
            </div>
            <div class="mb-3">
                <label for="ultimo_empleo_2" class="form-label">Último Empleo 2</label>
                <input type="text" id="ultimo_empleo_2" name="ultimo_empleo_2" class="form-control" placeholder="Empresa - Cargo - Fechas">
            </div>
            <div class="mb-3">
                <label for="ultimo_empleo_3" class="form-label">Último Empleo 3</label>
                <input type="text" id="ultimo_empleo_3" name="ultimo_empleo_3" class="form-control" placeholder="Empresa - Cargo - Fechas">
            </div>
        </div>
    </div>

    <!-- ================= 5. CONTACTO DE EMERGENCIA ================= -->
    <div class="card shadow-sm mb-4">
        <div class="card-header bg-danger text-white">
            5. Contacto de Emergencia
        </div>
        <div class="card-body">
            <div class="row">
                <div class="col-md-6">
                    <div class="mb-3">
                        <label for="emergencia_nombre" class="form-label">Nombre Contacto Emergencia</label>
                        <input type="text" id="emergencia_nombre" name="emergencia_nombre" class="form-control" placeholder="Nombre completo">
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="mb-3">
                        <label for="emergencia_parentesco" class="form-label">Parentesco</label>
                        <select class="form-select" id="emergencia_parentesco" name="emergencia_parentesco">
                            <option value="">Elegir Parentesco</option>
                            <option>Padre</option>
                            <option>Madre</option>
                            <option>Cónyuge</option>
                            <option>Hermano/a</option>
                            <option>Hijo/a</option>
                            <option>Otro</option>
                        </select>
                    </div>
                </div>
            </div>
            <div class="row">
                <div class="col-md-4">
                    <div class="mb-3">
                        <label for="numero_emergencia" class="form-label">Teléfono Principal</label>
                        <input type="text" id="numero_emergencia" name="numero_emergencia" class="form-control" placeholder="Teléfono 1">
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="mb-3">
                        <label for="emergencia_telefono_2" class="form-label">Teléfono Alternativo</label>
                        <input type="text" id="emergencia_telefono_2" name="emergencia_telefono_2" class="form-control" placeholder="Teléfono 2">
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="mb-3">
                        <label for="emergencia_direccion" class="form-label">Dirección Emergencia</label>
                        <input type="text" id="emergencia_direccion" name="emergencia_direccion" class="form-control" placeholder="Dirección">
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- ================= 6. DOCUMENTOS ADJUNTOS ================= -->
    <div class="card shadow-sm mb-4">
        <div class="card-header bg-secondary text-white">
            6. Documentos Adjuntos
        </div>
        <div class="card-body">

            <div class="row">
                <div class="col-md-4">
                    <div class="mb-3">
                        <label class="form-label">Foto Perfil (JPG/PNG)</label>
                        <input type="file" id="foto_personal" name="foto_personal" class="form-control" accept="image/*">
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="mb-3">
                        <label class="form-label">Licencia (PDF Cara/Sello)</label>
                        <input type="file" id="licencia_pdf" name="licencia_pdf" class="form-control" accept="application/pdf">
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="mb-3">
                        <label class="form-label">CV (PDF)</label>
                        <input type="file" id="cv_pdf" name="cv_pdf" class="form-control" accept="application/pdf">
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="col-md-4">
                    <div class="mb-3">
                        <label class="form-label">DNI (PDF)</label>
                        <input type="file" id="dni_pdf" name="dni_pdf" class="form-control" accept="application/pdf">
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="mb-3">
                        <label class="form-label">Recibo Agua/Luz (PDF)</label>
                        <input type="file" id="recibo_servicio_pdf" name="recibo_servicio_pdf" class="form-control" accept="application/pdf">
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="mb-3">
                        <label class="form-label">CertiJoven/Adulto (PDF)</label>
                        <input type="file" id="certificado_pdf" name="certificado_pdf" class="form-control" accept="application/pdf">
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="col-md-6 text-center">
                    <div class="mb-3">
                        <img id="preview_foto"
                            src="https://via.placeholder.com/200x200?text=Preview"
                            class="img-thumbnail mt-3"
                            style="max-height:200px;">
                    </div>
                </div>
            </div>

            <!-- NOTA: La sección "Documentos anteriores (imágenes)" se eliminó:
                 esa información ya queda cubierta por los PDF (DNI, Licencia, CV,
                 Recibo y Certificado) que se suben arriba. -->
        </div>
    </div>

</form>

<!-- Plantilla oculta de una fila de hijo, el JS la clona -->
<template id="tpl_hijo">
    <div class="row hijo-fila align-items-end mb-2">
        <div class="col-md-3">
            <label class="form-label small">Nombres</label>
            <input type="text" class="form-control form-control-sm hijo-nombres" placeholder="Nombres">
        </div>
        <div class="col-md-3">
            <label class="form-label small">Primer Apellido</label>
            <input type="text" class="form-control form-control-sm hijo-apellido1" placeholder="Primer Apellido">
        </div>
        <div class="col-md-3">
            <label class="form-label small">Segundo Apellido</label>
            <input type="text" class="form-control form-control-sm hijo-apellido2" placeholder="Segundo Apellido">
        </div>
        <div class="col-md-2">
            <label class="form-label small">Fecha Nac.</label>
            <input type="date" class="form-control form-control-sm hijo-fecha">
        </div>
        <div class="col-md-1">
            <button type="button" class="btn btn-outline-danger btn-sm btn_quitar_hijo">
                <i class="mdi mdi-trash-can-outline"></i>
            </button>
        </div>
    </div>
</template>