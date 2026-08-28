const fs = require('fs');
const db = require('./db');

const path = "C:/xampp/htdocs/corporacionescepe/app/views/configuration/config/index.php";

const cleanContent = `<?php /* app/views/configuration/config/index.php */ ?>

<form id="form_config">
    <div class="row g-4">

        <?php
        $etiquetas = [
            'sistema'     => ['icono' => 'mdi-cog-outline',     'color' => 'primary',   'titulo' => 'Sistema'],
            'tiempo_real' => ['icono' => 'mdi-wifi',            'color' => 'success',   'titulo' => 'Conexión WIN (Tiempo Real)'],
            'general'     => ['icono' => 'mdi-tune-vertical',  'color' => 'secondary', 'titulo' => 'General'],
            'correo'      => ['icono' => 'mdi-email-outline',  'color' => 'info',      'titulo' => 'Correo (SMTP)'],
        ];

        $etiquetasCampo = [
            'NAME_EMPRESA'        => ['label' => 'Nombre de la empresa',      'tipo' => 'text',     'icono' => 'mdi-office-building'],
            'MONEDA'              => ['label' => 'Símbolo de moneda',          'tipo' => 'text',     'icono' => 'mdi-currency-usd'],
            'TR_USER'             => ['label' => 'Usuario WIN',                'tipo' => 'text',     'icono' => 'mdi-account-key-outline'],
            'TR_PASSWORD'         => ['label' => 'Contraseña WIN',             'tipo' => 'password', 'icono' => 'mdi-lock-outline'],
            'TR_COD_SUS'          => ['label' => 'Código de suscripción WIN',  'tipo' => 'text',     'icono' => 'mdi-identifier'],
            'TR_QUERY'            => ['label' => 'Query adicional WIN',        'tipo' => 'text',     'icono' => 'mdi-database-search'],
            'TR_AUTH'             => ['label' => 'Auth adicional WIN',         'tipo' => 'text',     'icono' => 'mdi-shield-key-outline'],
            'LOOKER_SESSION'      => ['label' => 'Sesión / Cookies Google (Looker Studio)', 'tipo' => 'text', 'icono' => 'mdi-google'],
            'PORCENTAJE_GANANCIA' => ['label' => 'Porcentaje de ganancia (%)', 'tipo' => 'number',   'icono' => 'mdi-percent'],
            'PORCENTAJE_IVA'      => ['label' => 'IVA / IGV',                 'tipo' => 'number',   'icono' => 'mdi-receipt-text-outline'],
            'EMAIL_HOST'          => ['label' => 'Servidor SMTP',              'tipo' => 'text',     'icono' => 'mdi-server-network'],
            'EMAIL_PORT'          => ['label' => 'Puerto SMTP',                'tipo' => 'number',   'icono' => 'mdi-numeric'],
            'EMAIL_USER'          => ['label' => 'Correo remitente',           'tipo' => 'text',     'icono' => 'mdi-account-outline'],
            'EMAIL_PASSWORD'      => ['label' => 'Contraseña SMTP',            'tipo' => 'password', 'icono' => 'mdi-lock-outline'],
            'EMAIL_SECURE'        => ['label' => 'Seguridad',                  'tipo' => 'text',     'icono' => 'mdi-shield-lock-outline'],
            'EMAIL_FROM_NAME'     => ['label' => 'Nombre remitente',           'tipo' => 'text',     'icono' => 'mdi-card-account-mail-outline'],
            'EMAIL_PRUEBA'        => ['label' => 'Correo de prueba',           'tipo' => 'text',     'icono' => 'mdi-send-check-outline'],
        ];
        ?>

        <?php foreach ($grupos as $grupo => $items): ?>
            <?php
            $meta     = $etiquetas[$grupo]  ?? ['icono' => 'mdi-tune', 'color' => 'secondary', 'titulo' => ucfirst($grupo)];
            $colClass = ($grupo === 'tiempo_real') ? 'col-12' : 'col-xl-6';
            ?>
            <div class="<?= $colClass ?>">
                <div class="card shadow-sm border-0">
                    <div class="card-header bg-<?= $meta['color'] ?> text-white py-2 d-flex align-items-center gap-2">
                        <i class="mdi <?= $meta['icono'] ?> fs-5"></i>
                        <span class="fw-semibold"><?= $meta['titulo'] ?></span>
                    </div>
                    <div class="card-body">
                        <div class="row g-3">
                            <?php foreach ($items as $item): ?>
                                <?php
                                $campo   = $etiquetasCampo[$item->clave] ?? null;
                                $label   = $campo['label'] ?? $item->clave;
                                $tipo    = $campo['tipo']  ?? 'text';
                                $icono   = $campo['icono'] ?? 'mdi-cog';
                                $esPass  = ($tipo === 'password');
                                ?>
                                <div class="col-md-6">
                                    <label class="form-label fw-semibold small">
                                        <i class="mdi <?= $icono ?> me-1 text-<?= $meta['color'] ?>"></i>
                                        <?= htmlspecialchars($label) ?>
                                    </label>
                                    <?php if ($item->descripcion): ?>
                                        <small class="text-muted d-block mb-1"><?= htmlspecialchars($item->descripcion) ?></small>
                                    <?php endif; ?>
                                    <input type="hidden" name="clave[]" value="<?= htmlspecialchars($item->clave) ?>">

                                    <?php if ($esPass): ?>
                                        <div class="input-group input-group-sm">
                                            <input type="password"
                                                name="valor[]"
                                                class="form-control"
                                                value="<?= htmlspecialchars($item->valor ?? '') ?>"
                                                autocomplete="new-password">
                                            <button type="button" class="btn btn-outline-secondary btn-toggle-pass"
                                                tabindex="-1">
                                                <i class="mdi mdi-eye-outline"></i>
                                            </button>
                                        </div>
                                    <?php else: ?>
                                        <input type="<?= $tipo ?>"
                                            name="valor[]"
                                            class="form-control form-control-sm"
                                            value="<?= htmlspecialchars($item->valor ?? '') ?>"
                                            step="any">
                                    <?php endif; ?>
                                </div>
                            <?php endforeach; ?>
                        </div>
                    </div>
                </div>
            </div>
        <?php endforeach; ?>

    </div><!-- /row -->

    <!-- Botón guardar -->
    <div class="d-flex justify-content-end mt-4">
        <button type="button" id="btn_guardar_config" class="btn btn-primary px-5 fw-semibold">
            <i class="mdi mdi-content-save-outline me-1"></i> Guardar configuración
        </button>
    </div>
</form>
`;

async function run() {
  fs.writeFileSync(path, cleanContent, 'utf8');
  console.log('✅ Archivo index.php guardado limpiamente en UTF-8!');

  await db.query("UPDATE configuracion SET descripcion = 'Sesión / Cookies Google Looker Studio' WHERE clave = 'LOOKER_SESSION'");
  const [rows] = await db.query("SELECT clave, valor, descripcion FROM configuracion WHERE grupo = 'tiempo_real'");
  console.log('Filas:', rows);
  process.exit();
}

run();
