</div>
<!-- container -->
</div>
<!-- content -->

<!-- Footer Start -->
<footer class="footer">
    <div class="container-fluid">
        <div class="row">
            <div class="col-md-6">
                <script>
                    document.write(new Date().getFullYear());
                </script>
                © Cespedes - cespedes.com
            </div>
        </div>
    </div>
</footer>
<!-- end Footer -->
</div>

<!-- ============================================================== -->
<!-- End Page content -->
<!-- ============================================================== -->
</div>
<!-- END wrapper -->


<!-- bundle -->
<script src="<?= url_assets() ?>assets/js/vendor.min.js"></script>
<script src="<?= url_assets() ?>assets/js/app.min.js"></script>

<!-- third party js -->
<script src="<?= url_assets() ?>assets/js/vendor/jquery.dataTables.min.js"></script>
<script src="<?= url_assets() ?>assets/js/vendor/dataTables.bootstrap5.js"></script>
<script src="<?= url_assets() ?>assets/js/vendor/dataTables.responsive.min.js"></script>
<script src="<?= url_assets() ?>assets/js/vendor/responsive.bootstrap5.min.js"></script>
<script src="<?= url_assets() ?>assets/js/vendor/dataTables.buttons.min.js"></script>
<script src="<?= url_assets() ?>assets/js/vendor/buttons.bootstrap5.min.js"></script>

<script src="<?= url_assets() ?>assets/js/vendor/buttons.html5.min.js"></script>
<script src="<?= url_assets() ?>assets/js/vendor/buttons.flash.min.js"></script>
<script src="<?= url_assets() ?>assets/js/vendor/buttons.print.min.js"></script>

<!-- Para Excel -->

<script src="https://cdn.jsdelivr.net/npm/apexcharts"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>

<!-- Para PDF -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.js"></script>

<!-- Sweetalert2 -->
<script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
<!-- end Sweetalert2 -->

<!-- demo app -->
<!-- <script src="<?= url_assets() ?>assets/js/pages/demo.dashboard.js"></script> -->
<!-- end demo js-->

<script src="https://unpkg.com/html5-qrcode@2.3.8"></script>

<!-- js -->
<?php if ($js) { ?>
    <script>
        const base_url = "<?= base_url() ?>";
        const url_assets = "<?= url_assets() ?>";
        const PORCENTAJE_GANANCIA = <?= PORCENTAJE_GANANCIA ?>;
        const PORCENTAJE_IVA = <?= PORCENTAJE_IVA ?>;
        const MONEDA = "<?= MONEDA ?>";

        const API_DNI_URL = "<?= API_DNI_URL ?>";
        const API_RUC_URL = "<?= API_RUC_URL ?>";
        const API_CONSULTA_TOKEN = "<?= API_CONSULTA_TOKEN ?>";
        const RUTA_IMG_VEHICULO = "<?= RUTA_IMG_VEHICULO ?>";
        const RUTA_IMG_USUARIO = "<?= RUTA_IMG_USUARIO ?>";
        const RUTA_IMG_PRODUCTO = "<?= RUTA_IMG_PRODUCTO ?>";
    </script>
    <!-- plantillas -->
    <script src="<?= url_assets() ?>assets/js/plantilla_tabla.js"></script>
    <!-- end plantillas -->
    <script src="<?= url_assets() ?>assets/js/function_<?= $js ?>.js"></script>
<?php } ?>
<!-- end js-->

<!-- En pantallas pequeñas la barra lateral es un overlay: al elegir una
     opción del menú se cierra sola para que la página elegida se vea bien. -->
<script>
    $(document).on('click', '.leftside-menu .side-nav-link:not([data-bs-toggle="collapse"])', function () {
        if (window.innerWidth < 992) {
            document.body.classList.remove('sidebar-enable');
            document.body.classList.remove('enlarge');
        }
    });
</script>

</body>


</html>