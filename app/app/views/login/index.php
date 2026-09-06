<!DOCTYPE html>
<html lang="en">


<!-- Mirrored from coderthemes.com/hyper/saas/pages-login-2.html by HTTrack Website Copier/3.x [XR&CO'2014], Fri, 29 Jul 2022 10:21:16 GMT -->

<head>
    <meta charset="utf-8" />
    <title>Iniciar Sesion | <?= NAME_EMPRESA ?></title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta content="A fully featured admin theme which can be used to build CRM, CMS, etc." name="description" />
    <meta content="Coderthemes" name="author" />
    <!-- App favicon -->
    <link rel="shortcut icon" href="<?= url_assets() ?>assets/images/LOGO_CORPORACION_SM.png">

    <!-- App css -->
    <link href="<?= url_assets() ?>assets/css/icons.min.css" rel="stylesheet" type="text/css" />
    <link href="<?= url_assets() ?>assets/css/app.min.css" rel="stylesheet" type="text/css" id="app-style" />

</head>

<body class="authentication-bg pb-0" data-layout-config='{"darkMode":false}'>

    <div class="auth-fluid">
        <!--Auth fluid left content -->
        <div class="auth-fluid-form-box">
            <div class="align-items-center d-flex h-100">
                <div class="card-body">

                    <!-- Logo -->
                    <div class="auth-brand text-center text-lg-start">
                        <a href="index.html" class="logo-dark">
                            <span><img src="<?= url_assets() ?>assets/images/LOGO_CORPORACION.png" alt="" height="90"></span>
                        </a>
                        <a href="index.html" class="logo-light">
                            <span><img src="<?= url_assets() ?>assets/images/LOGO_CORPORACION_DARK.png" alt="" height="18"></span>
                        </a>
                    </div>

                    <!-- title-->
                    <h4 class="mt-0">Iniciar sesión</h4>
                    <p class="text-muted mb-4">Introduzca su dirección de correo electrónico y contraseña para acceder a la cuenta.</p>

                    <!-- form -->
                    <form action="" id="form">
                        <div class="mb-3">
                            <label for="usuario" class="form-label">Usuario</label>
                            <input class="form-control" type="text" id="usuario" name="usuario" required="" placeholder="Ingrese su usuario">
                        </div>
                        <div class="mb-3">
                            <label for="password" class="form-label">Contraseña</label>
                            <input class="form-control" type="password" required="" id="password" name="password" placeholder="Ingrese su contraseña">
                        </div>
                        <div class="d-grid mb-0 text-center">

                            <button class="btn btn-primary" type="button" id="btn_modal"><i class="mdi mdi-login"></i> Ingresar</button>
                        </div>
                    </form>
                    <!-- end form-->


                </div> <!-- end .card-body -->
            </div> <!-- end .align-items-center.d-flex.h-100-->
        </div>
        <!-- end auth-fluid-form-box-->

        <!-- Auth fluid right content -->
        <div class="auth-fluid-right text-center">
            <div class="auth-user-testimonial">
                <h2 class="mb-3">I love the color!</h2>
                <p class="lead"><i class="mdi mdi-format-quote-open"></i> It's a elegent templete. I love it very much! . <i class="mdi mdi-format-quote-close"></i>
                </p>
                <p>
                    - Hyper Admin User
                </p>
            </div> <!-- end auth-user-testimonial-->
        </div>
        <!-- end Auth fluid right content -->
    </div>
    <!-- end auth-fluid-->

    <!-- bundle -->
    <script src="<?= url_assets() ?>assets/js/vendor.min.js"></script>
    <script src="<?= url_assets() ?>assets/js/app.min.js"></script>

    <!-- js -->
    <?php if ($js) { ?>
        <script>
            const base_url = "<?= base_url() ?>";
        </script>
        <!-- plantillas -->
        <script src="<?= url_assets() ?>assets/js/plantilla_tabla.js"></script>
        <!-- end plantillas -->
        <script src="<?= url_assets() ?>assets/js/function_<?= $js ?>.js"></script>
    <?php } ?>

</body>


<!-- Mirrored from coderthemes.com/hyper/saas/pages-login-2.html by HTTrack Website Copier/3.x [XR&CO'2014], Fri, 29 Jul 2022 10:21:16 GMT -->

</html>