<!-- app/views/templates/modal.php — REEMPLAZAR COMPLETO -->
<!-- FIX: isset($form2) en vez de solo $form2 para evitar undefined variable -->

<!-- Modal principal -->
<div id="modal" class="modal fade" tabindex="-1" role="dialog" aria-labelledby="standard-modalLabel" aria-hidden="true">
    <div class="modal-dialog <?= $modal_size ?? '' ?>">
        <div class="modal-content">
            <div class="modal-header">
                <h4 class="modal-title" id="titulo_modal"></h4>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-hidden="true"></button>
            </div>
            <div class="modal-body">
                <?php require_once __DIR__ . '/../forms/' . $form . '.php' ?>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-light" data-bs-dismiss="modal">Cerrar</button>
                <button type="button" id="btn_modal" class="btn btn-primary">Guardar</button>
            </div>
        </div>
    </div>
</div>

<?php if (!empty($form2)) { ?>
    <!-- Modal secundario (ej: stockear trabajador) -->
    <div id="modal_2" class="modal fade" tabindex="-1" role="dialog" aria-hidden="true">
        <div class="modal-dialog <?= $modal_size ?? '' ?>">
            <div class="modal-content">
                <div class="modal-header">
                    <h4 class="modal-title" id="titulo_modal_2"></h4>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-hidden="true"></button>
                </div>
                <div class="modal-body">
                    <?php require_once __DIR__ . '/../forms/' . $form2 . '.php' ?>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-light" data-bs-dismiss="modal">Cerrar</button>
                    <button type="button" id="btn_modal_2" class="btn btn-primary">Guardar</button>
                </div>
            </div>
        </div>
    </div>
<?php } ?>

<?php if (!empty($form_ver)) { ?>
    <!-- Modal solo lectura -->
    <div id="modal_ver" class="modal fade" tabindex="-1" role="dialog" aria-hidden="true">
        <div class="modal-dialog <?= $modal_size ?? '' ?>">
            <div class="modal-content">
                <div class="modal-header">
                    <h4 class="modal-title" id="titulo_modal_ver"></h4>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-hidden="true"></button>
                </div>
                <div class="modal-body">
                    <?php require_once __DIR__ . '/../forms/' . $form_ver . '.php' ?>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-light" data-bs-dismiss="modal">Cerrar</button>
                </div>
            </div>
        </div>
    </div>
<?php } ?>