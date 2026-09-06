<?php /* cespedes/app/views/human_resources/permit/index.php — REEMPLAZAR COMPLETO */ ?>

<!-- Cabecera de página -->
<div class="d-flex justify-content-between align-items-center mb-4">
    <div>
        <h4 class="mb-0 fw-bold">
            <i class="mdi mdi-shield-lock-outline text-primary me-2"></i>Permisos por Rol
        </h4>
        <p class="text-muted small mb-0">Define qué puede hacer cada rol dentro del sistema, agrupado por áreas</p>
    </div>
    <button class="btn btn-primary btn-sm" id="btn_nuevo_permiso">
        <i class="mdi mdi-plus me-1"></i> Asignar permisos
    </button>
</div>

<!-- Cards de roles -->
<div class="row g-3" id="cards_roles">
    <?php foreach ($roles as $rol): ?>
        <div class="col-md-6 col-xl-4" id="card_wrap_<?= $rol->id_rol ?>">
            <div class="card shadow-sm border-0 h-100 card-rol-item">
                <div class="card-body pb-2">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div class="d-flex align-items-center gap-2">
                            <div class="rol-avatar rounded-circle d-flex align-items-center justify-content-center"
                                style="width:40px;height:40px">
                                <i class="mdi mdi-shield-account fs-5"></i>
                            </div>
                            <div>
                                <h5 class="mb-0 fw-bold"><?= htmlspecialchars($rol->nombre) ?></h5>
                                <small class="text-muted"><?= htmlspecialchars($rol->descripcion ?? '') ?></small>
                            </div>
                        </div>
                        <span class="badge <?= $rol->estado === 'Activo' ? 'bg-success' : 'bg-secondary' ?>">
                            <?= $rol->estado ?>
                        </span>
                    </div>
                    <hr class="my-2">
                    <div class="modulos_wrap_<?= $rol->id_rol ?> mb-3" style="min-height:34px">
                        <span class="spinner-border spinner-border-sm text-primary"></span>
                    </div>
                    <p class="text-muted small mb-3">
                        Total permisos: <strong class="total_wrap_<?= $rol->id_rol ?>">—</strong>
                    </p>
                    <div class="d-flex gap-2">
                        <button class="btn btn-primary btn-sm flex-fill btn-editar-permisos"
                            data-id="<?= $rol->id_rol ?>"
                            data-nombre="<?= htmlspecialchars($rol->nombre) ?>">
                            <i class="mdi mdi-pencil-outline me-1"></i> Editar
                        </button>
                        <button class="btn btn-outline-danger btn-sm btn-limpiar-permisos"
                            data-id="<?= $rol->id_rol ?>"
                            data-nombre="<?= htmlspecialchars($rol->nombre) ?>"
                            title="Quitar todos los permisos">
                            <i class="mdi mdi-delete-sweep-outline"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    <?php endforeach; ?>
</div>

<!-- Catálogo de módulos (agrupado por área) y acciones disponibles -->
<script>
    const CATALOGO_PERMISOS = <?= json_encode($modulos, JSON_UNESCAPED_UNICODE) ?>;
    const ACCIONES_PERMISOS = <?= json_encode($acciones, JSON_UNESCAPED_UNICODE) ?>;
</script>

<!-- MODAL PERMISOS -->
<div class="modal fade" id="modalPermisos" tabindex="-1">
    <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
        <div class="modal-content border-0 shadow">

            <div class="modal-header bg-primary text-white py-2">
                <h5 class="modal-title mb-0">
                    <i class="mdi mdi-shield-edit-outline me-2"></i>
                    <span id="modal_titulo_permisos">Asignar permisos</span>
                </h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>

            <div class="modal-body p-0">

                <!-- Selector de rol + botones utilidad -->
                <div class="px-3 py-3 border-bottom bg-light">
                    <div class="row align-items-end g-2">
                        <div class="col-md-4">
                            <label class="form-label fw-semibold small mb-1">
                                Rol al que se asignan los permisos
                            </label>
                            <select class="form-select form-select-sm" id="modal_id_rol">
                                <option value="" disabled selected>Selecciona un rol...</option>
                                <?php foreach ($roles as $r): ?>
                                    <option value="<?= $r->id_rol ?>"><?= htmlspecialchars($r->nombre) ?></option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <div class="col-md-4">
                            <label class="form-label fw-semibold small mb-1">Buscar módulo</label>
                            <input type="text" class="form-control form-control-sm" id="buscar_modulo"
                                placeholder="Ej: productos, usuarios..." autocomplete="off">
                        </div>
                        <div class="col-md-4 d-flex gap-2 align-items-center flex-wrap pt-2 pt-md-0">
                            <button type="button" class="btn btn-sm btn-outline-success" id="btn_marcar_todo">
                                <i class="mdi mdi-check-all me-1"></i>Marcar todo
                            </button>
                            <button type="button" class="btn btn-sm btn-outline-secondary" id="btn_desmarcar_todo">
                                <i class="mdi mdi-close-box-multiple-outline me-1"></i>Desmarcar todo
                            </button>
                            <span class="ms-auto text-muted small">
                                <strong class="text-primary" id="contador_checks">0</strong> permisos seleccionados
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Tabla módulos x acciones, agrupados por área -->
                <div class="table-responsive">
                    <table class="table table-bordered align-middle mb-0" id="tabla_permisos_modal">
                        <thead class="table-dark">
                            <tr>
                                <th class="text-start ps-4" style="min-width:170px">Área / Módulo</th>
                                <?php foreach ($acciones as $accion => $nombre): ?>
                                    <th class="text-center text-nowrap"><?= $nombre ?></th>
                                <?php endforeach; ?>
                                <th class="text-center text-nowrap">Todos</th>
                            </tr>
                        </thead>
                        <tbody id="tbody_permisos">
                            <tr>
                                <td colspan="<?= count($acciones) + 2 ?>" class="text-center text-muted py-4 fst-italic">
                                    Selecciona un rol para ver y editar sus permisos
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

            </div>

            <div class="modal-footer">
                <button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancelar</button>
                <button type="button" class="btn btn-primary px-4 fw-semibold" id="btn_guardar_permisos">
                    <i class="mdi mdi-content-save-outline me-1"></i> Guardar permisos
                </button>
            </div>

        </div>
    </div>
</div>

<style>
    .card-rol-item {
        border-left: 4px solid #3d7fee !important;
        transition: box-shadow .2s, border-left-color .3s;
    }

    .card-rol-item:hover {
        box-shadow: 0 4px 20px rgba(0, 0, 0, .10) !important;
    }

    .rol-avatar {
        background: rgba(61, 127, 238, .12);
        color: #3d7fee;
    }

    #tabla_permisos_modal td {
        padding: .4rem .5rem;
    }

    .form-check-input {
        cursor: pointer;
    }

    /* Cabecera de cada área (grupo) dentro de la tabla */
    .grupo-header td {
        background: #f1f5fa;
        border-bottom: 1px solid #dee2e6;
        padding: .55rem 1rem !important;
    }

    .grupo-header .form-check {
        margin-bottom: 0;
    }

    .grupo-badge {
        font-size: .7rem;
        font-weight: 600;
    }

    .grupo-titulo {
        font-weight: 700;
        font-size: .85rem;
        color: #313a46;
    }

    .modulo-fila td {
        background: #fff;
    }

    .modulo-fila.d-none {
        display: none !important;
    }
</style>
