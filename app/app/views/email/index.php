<?php
// app/views/email/index.php — MÓDULO DE ENVÍO DE CORREOS
$mesActual = date('Y-m');
?>

<div class="row">
    <!-- ── Configuración SMTP ── -->
    <div class="col-lg-5">
        <div class="card">
            <div class="card-header d-flex align-items-center justify-content-between">
                <h5 class="mb-0"><i class="mdi mdi-server-network me-1"></i> Configuración SMTP</h5>
                <span class="badge bg-light text-dark border" id="correo_lbl_estado">Sin verificar</span>
            </div>
            <div class="card-body">
                <div class="row g-2">
                    <div class="col-md-8">
                        <label class="form-label mb-1">Servidor SMTP (host)</label>
                        <input type="text" class="form-control" id="cfg_EMAIL_HOST" data-clave="EMAIL_HOST"
                               placeholder="smtp.gmail.com" value="<?= htmlspecialchars($config['EMAIL_HOST'] ?? '') ?>">
                    </div>
                    <div class="col-md-4">
                        <label class="form-label mb-1">Puerto</label>
                        <input type="number" class="form-control" id="cfg_EMAIL_PORT" data-clave="EMAIL_PORT"
                               value="<?= htmlspecialchars($config['EMAIL_PORT'] ?? '587') ?>">
                    </div>
                    <div class="col-md-8">
                        <label class="form-label mb-1">Correo remitente (usuario)</label>
                        <input type="text" class="form-control" id="cfg_EMAIL_USER" data-clave="EMAIL_USER"
                               placeholder="sistema@correo.com" value="<?= htmlspecialchars($config['EMAIL_USER'] ?? '') ?>">
                    </div>
                    <div class="col-md-4">
                        <label class="form-label mb-1">Seguridad</label>
                        <select class="form-select" id="cfg_EMAIL_SECURE" data-clave="EMAIL_SECURE">
                            <option value="tls" <?= ($config['EMAIL_SECURE'] ?? '') === 'tls' ? 'selected' : '' ?>>TLS</option>
                            <option value="ssl" <?= ($config['EMAIL_SECURE'] ?? '') === 'ssl' ? 'selected' : '' ?>>SSL</option>
                            <option value=""   <?= ($config['EMAIL_SECURE'] ?? '') === '' ? 'selected' : '' ?>>Sin cifrado</option>
                        </select>
                    </div>
                    <div class="col-12">
                        <label class="form-label mb-1">Contraseña / clave de aplicación</label>
                        <div class="input-group">
                            <input type="password" class="form-control" id="cfg_EMAIL_PASSWORD" data-clave="EMAIL_PASSWORD"
                                   autocomplete="new-password" value="<?= htmlspecialchars($config['EMAIL_PASSWORD'] ?? '') ?>">
                            <button class="btn btn-outline-secondary" type="button" id="correo_btn_ver_clave">
                                <i class="mdi mdi-eye-outline"></i>
                            </button>
                        </div>
                    </div>
                    <div class="col-12">
                        <label class="form-label mb-1">Nombre visible del remitente</label>
                        <input type="text" class="form-control" id="cfg_EMAIL_FROM_NAME" data-clave="EMAIL_FROM_NAME"
                               placeholder="Sistema Cespedes" value="<?= htmlspecialchars($config['EMAIL_FROM_NAME'] ?? '') ?>">
                    </div>
                    <div class="col-8">
                        <label class="form-label mb-1">Correo de prueba</label>
                        <input type="email" class="form-control" id="cfg_EMAIL_PRUEBA" data-clave="EMAIL_PRUEBA"
                               placeholder="tucorreo@correo.com" value="<?= htmlspecialchars($config['EMAIL_PRUEBA'] ?? '') ?>">
                    </div>
                    <div class="col-4 d-flex align-items-end">
                        <button type="button" class="btn btn-outline-warning w-100" id="correo_btn_prueba"
                                <?= $permiso_enviar ? '' : 'disabled' ?>>
                            <i class="mdi mdi-send me-1"></i> Prueba
                        </button>
                    </div>
                </div>

                <div class="d-grid gap-2 d-md-flex justify-content-md-end mt-3">
                    <button type="button" class="btn btn-primary" id="correo_btn_guardar_config"
                            <?= $permiso_editar ? '' : 'disabled' ?>>
                        <i class="mdi mdi-content-save me-1"></i> Guardar configuración
                    </button>
                </div>
            </div>
        </div>

        <!-- Ayuda -->
        <div class="card border-light">
            <div class="card-body py-3">
                <h6 class="text-uppercase text-muted small mb-2"><i class="mdi mdi-information-outline me-1"></i> Datos típicos</h6>
                <ul class="small mb-0 ps-3 text-muted">
                    <li><b>Gmail</b>: smtp.gmail.com · 465 SSL · usuario + contraseña de aplicación (2 pasos)</li>
                    <li><b>Outlook</b>: smtp.office365.com · 587 TLS</li>
                    <li><b>Hosting cPanel</b>: mail.sudominio.com · 465 SSL</li>
                </ul>
            </div>
        </div>
    </div>

    <!-- ── Envío de reportes ── -->
    <div class="col-lg-7">
        <div class="card">
            <div class="card-header">
                <h5 class="mb-0"><i class="mdi mdi-email-multiple-outline me-1"></i> Envío de reportes a técnicos</h5>
            </div>
            <div class="card-body">
                <div class="row g-2 mb-3">
                    <div class="col-md-3">
                        <button type="button" class="btn btn-primary w-100" id="correo_btn_diario"
                                <?= $permiso_enviar ? '' : 'disabled' ?>>
                            <i class="mdi mdi-calendar-today me-1"></i> Reporte DIARIO
                        </button>
                        <small class="text-muted d-block text-center mt-1">Órdenes de hoy</small>
                    </div>
                    <div class="col-md-3">
                        <button type="button" class="btn btn-info w-100" id="correo_btn_mensual"
                                <?= $permiso_enviar ? '' : 'disabled' ?>>
                            <i class="mdi mdi-calendar-month me-1"></i> Reporte MENSUAL
                        </button>
                        <small class="text-muted d-block text-center mt-1">Órdenes del mes</small>
                    </div>
                    <div class="col-md-3">
                        <label class="form-label mb-1">Mes del reporte</label>
                        <input type="month" class="form-control" id="correo_mes" value="<?= $mesActual ?>">
                    </div>
                    <div class="col-md-3">
                        <label class="form-label mb-1">Destinatarios</label>
                        <button type="button" class="btn btn-outline-secondary w-100" id="correo_btn_todos">
                            <i class="mdi mdi-checkbox-multiple-marked-outline me-1"></i> Todos / Ninguno
                        </button>
                    </div>
                </div>

                <div class="table-responsive">
                    <table class="table table-sm table-hover mb-0">
                        <thead class="table-light">
                            <tr>
                                <th style="width:40px;" class="text-center">
                                    <input type="checkbox" id="correo_check_todos" class="form-check-input" checked>
                                </th>
                                <th>Técnico</th>
                                <th>Correo</th>
                                <th style="width:90px;" class="text-center">PDF</th>
                            </tr>
                        </thead>
                        <tbody id="correo_tbody_tecnicos">
                            <?php if (empty($tecnicos)): ?>
                                <tr>
                                    <td colspan="4" class="text-center text-muted py-3">
                                        No hay técnicos con correo registrado. Asigna un correo en
                                        Personal &rarr; Trabajadores.
                                    </td>
                                </tr>
                            <?php else: ?>
                                <?php foreach ($tecnicos as $t): ?>
                                    <tr>
                                        <td class="text-center">
                                            <input type="checkbox" class="form-check-input correo_ck" value="<?= (int)$t->id_trabajador ?>" checked>
                                        </td>
                                        <td><?= htmlspecialchars($t->tecnico) ?></td>
                                        <td><?= htmlspecialchars($t->email) ?></td>
                                        <td class="text-center">
                                            <a href="<?= base_url() ?>correos/previsualizar?id=<?= (int)$t->id_trabajador ?>&tipo=d"
                                               target="_blank" class="btn btn-sm btn-outline-primary" title="Ver PDF diario">
                                                <i class="mdi mdi-file-pdf-box"></i> Hoy
                                            </a>
                                            <a href="<?= base_url() ?>correos/previsualizar?id=<?= (int)$t->id_trabajador ?>&tipo=m&mes=<?= $mesActual ?>"
                                               target="_blank" class="btn btn-sm btn-outline-info" title="Ver PDF mensual">
                                                <i class="mdi mdi-file-pdf-box"></i> Mes
                                            </a>
                                        </td>
                                    </tr>
                                <?php endforeach; ?>
                            <?php endif; ?>
                        </tbody>
                    </table>
                </div>

                <?php if (!$permiso_enviar): ?>
                    <div class="alert alert-warning py-2 mt-3 mb-0">
                        <i class="mdi mdi-shield-alert me-1"></i> No tienes permiso para enviar correos.
                    </div>
                <?php endif; ?>
            </div>
        </div>

        <!-- Resultado del envío -->
        <div class="card d-none" id="correo_card_resultado">
            <div class="card-header">
                <h5 class="mb-0"><i class="mdi mdi-send-check me-1"></i> Resultado del envío</h5>
            </div>
            <div class="card-body">
                <div id="correo_resultado"></div>
            </div>
        </div>
    </div>
</div>
