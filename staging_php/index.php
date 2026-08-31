<?php
ob_start();
// 🇵🇪 Forzar Zona Horaria oficial de Perú (America/Lima)
date_default_timezone_set('America/Lima');

// Activar reporte de errores
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once 'app/config/constants.php';
require_once 'app/helpers/url_helper.php';
require_once 'app/core/App.php';
require_once 'app/core/Controller.php';
require_once 'app/core/Model.php';
require_once 'app/core/Database.php';

$app = new App();

error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
