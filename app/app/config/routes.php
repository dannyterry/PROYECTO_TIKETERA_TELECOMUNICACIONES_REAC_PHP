<?php

return [
    // INICIO
    '' => ['controller' => 'DashboardController', 'method' => 'index'],
    '' => ['controller' => 'LoginController', 'method' => 'index'],

    // LOGIN 
    'login' => ['controller' => 'LoginController', 'method' => 'index'],
    'login/validar' => ['controller' => 'LoginController', 'method' => 'validar'],
    'login/salir' => ['controller' => 'LoginController', 'method' => 'salir'],

    // DASHBOARD
    'dashboard' => ['controller' => 'DashboardController', 'method' => 'index'],

    // REPORTES
    'reportes' => ['controller' => 'ReportController', 'method' => 'index'],
    'reportes/kpis'                => ['controller' => 'ReportController', 'method' => 'kpis'],
    'reportes/ordenes_estado'      => ['controller' => 'ReportController', 'method' => 'ordenes_estado'],
    'reportes/ordenes_tecnico'     => ['controller' => 'ReportController', 'method' => 'ordenes_tecnico'],
    'reportes/ordenes_mes'         => ['controller' => 'ReportController', 'method' => 'ordenes_mes'],
    'reportes/liquidaciones_tecnico' => ['controller' => 'ReportController', 'method' => 'liquidaciones_tecnico'],
    'reportes/materiales_usados'   => ['controller' => 'ReportController', 'method' => 'materiales_usados'],
    'reportes/stock_almacen'       => ['controller' => 'ReportController', 'method' => 'stock_almacen'],
    'reportes/compras_proveedor'   => ['controller' => 'ReportController', 'method' => 'compras_proveedor'],
    'reportes/series_estado'       => ['controller' => 'ReportController', 'method' => 'series_estado'],
    'reportes/movimientos_recientes' => ['controller' => 'ReportController', 'method' => 'movimientos_recientes'],

    // ORDENES
    'ordenes' => ['controller' => 'OrderController', 'method' => 'index'],
    'ordenes/listar' => ['controller' => 'OrderController', 'method' => 'listar'],
    'ordenes/listar_liquidaciones/{id}'  => ['controller' => 'OrderController',  'method' => 'listar_liquidaciones'],
    'ordenes/liquidar' => ['controller' => 'OrderController', 'method' => 'liquidar'],
    'ordenes/editar/{id}' => ['controller' => 'OrderController', 'method' => 'editar'],
    'ordenes/ver/{id}' => ['controller' => 'OrderController', 'method' => 'ver'],
    'ordenes/consulta/{id}/{index}' => ['controller' => 'OrderController', 'method' => 'consulta'],
    'ordenes/actualizar_llamada' => ['controller' => 'OrderController', 'method' => 'actualizar_llamada'],
    'ordenes/actualizar_tecnico' => ['controller' => 'OrderController', 'method' => 'actualizar_tecnico'],
    'ordenes/actualizar_tecnico_reemplazo' => ['controller' => 'OrderController', 'method' => 'actualizar_tecnico_reemplazo'],
    'ordenes/actualizar_motivo' => ['controller' => 'OrderController', 'method' => 'actualizar_motivo'],
    'ordenes/actualizar_masivo' => ['controller' => 'OrderController', 'method' => 'actualizar_masivo'],
    'ordenes/progreso_sincronizacion' => ['controller' => 'OrderController', 'method' => 'progreso_sincronizacion'],
    'ordenes/mi_stock' => ['controller' => 'OrderController', 'method' => 'mi_stock'],
    'ordenes/dar_baja' => ['controller' => 'OrderController', 'method' => 'dar_baja'],

    // ── Módulo Liquidaciones (reporte por técnico) ──────────────────────
    'liquidaciones' => ['controller' => 'LiquidationController', 'method' => 'index'],
    'liquidaciones/resumen_tecnicos' => ['controller' => 'LiquidationController', 'method' => 'resumen_tecnicos'],
    'liquidaciones/por_tecnico/{id_trabajador}' => ['controller' => 'LiquidationController', 'method' => 'por_tecnico'],
    'liquidaciones/detalle/{id_liquidacion}' => ['controller' => 'LiquidationController', 'method' => 'detalle'],
    'liquidaciones/cambiar_estado/{id_liquidacion}' => ['controller' => 'LiquidationController', 'method' => 'cambiar_estado'],

    // ── Módulo Pagos (cuánto pagar a cada técnico) ───────────────────────
    'pagos' => ['controller' => 'PaymentController', 'method' => 'index'],
    'pagos/resumen' => ['controller' => 'PaymentController', 'method' => 'resumen'],
    'pagos/detalle/{id_trabajador}' => ['controller' => 'PaymentController', 'method' => 'detalle'],

    // ── Módulo Correos (reportes PDF a técnicos) ─────────────────────────
    'correos' => ['controller' => 'EmailController', 'method' => 'index'],
    'correos/guardar_config' => ['controller' => 'EmailController', 'method' => 'guardar_config'],
    'correos/enviar_prueba'  => ['controller' => 'EmailController', 'method' => 'enviar_prueba'],
    'correos/enviar_diario'  => ['controller' => 'EmailController', 'method' => 'enviar_diario'],
    'correos/enviar_mensual' => ['controller' => 'EmailController', 'method' => 'enviar_mensual'],
    'correos/progreso_envio' => ['controller' => 'EmailController', 'method' => 'progreso_envio'],
    'correos/previsualizar'  => ['controller' => 'EmailController', 'method' => 'previsualizar'],

    // ── Módulo Notificaciones ─────────────────────────────────────────────
    'notificaciones/marcar_todas' => ['controller' => 'NotificacionController', 'method' => 'marcar_todas'],
    'notificaciones/ir/{id}'      => ['controller' => 'NotificacionController', 'method' => 'ir'],

    'ordenes/obtener_estado/{id}' => ['controller' => 'OrderController', 'method' => 'obtener_estado'],

    // CONFIGURACION
    'configuracion/motivos' => ['controller' => 'ReasonController', 'method' => 'index'],
    'configuracion/motivos/listar' => ['controller' => 'ReasonController', 'method' => 'listar'],
    'configuracion/motivos/agregar' => ['controller' => 'ReasonController', 'method' => 'agregar'],
    'configuracion/motivos/editar/{id}' => ['controller' => 'ReasonController', 'method' => 'editar'],
    'configuracion/motivos/eliminar/{id}' => ['controller' => 'ReasonController', 'method' => 'eliminar'],
    'configuracion/tipo_trabajo' => ['controller' => 'TipoTrabajoController', 'method' => 'index'],
    'configuracion/tipo_trabajo/listar' => ['controller' => 'TipoTrabajoController', 'method' => 'listar'],
    'configuracion/tipo_trabajo/agregar' => ['controller' => 'TipoTrabajoController', 'method' => 'agregar'],
    'configuracion/tipo_trabajo/editar/{id}' => ['controller' => 'TipoTrabajoController', 'method' => 'editar'],
    'configuracion/tipo_trabajo/eliminar/{id}' => ['controller' => 'TipoTrabajoController', 'method' => 'eliminar'],

    'configuracion/sistema'         => ['controller' => 'ConfigController', 'method' => 'index'],
    'configuracion/sistema/guardar' => ['controller' => 'ConfigController', 'method' => 'guardar'],


    // RECURSOS HUMANOS
    'recursos_humanos/usuarios' => ['controller' => 'UserController', 'method' => 'index'],
    'recursos_humanos/usuarios/listar' => ['controller' => 'UserController', 'method' => 'listar'],
    'recursos_humanos/usuarios/agregar' => ['controller' => 'UserController', 'method' => 'agregar'],
    'recursos_humanos/usuarios/editar/{id}' => ['controller' => 'UserController', 'method' => 'editar'],
    'recursos_humanos/usuarios/eliminar/{id}' => ['controller' => 'UserController', 'method' => 'eliminar'],
    'recursos_humanos/usuarios/cambiar_estado/{id}' => ['controller' => 'UserController', 'method' => 'cambiar_estado'],
    'recursos_humanos/usuarios/consultar_dni/{dni}' => ['controller' => 'UserController', 'method' => 'consultar_dni'],
    'recursos_humanos/usuarios/consultar_ruc/{ruc}' => ['controller' => 'UserController', 'method' => 'consultar_ruc'],
    'recursos_humanos/usuarios/comisiones_pensionarias' => ['controller' => 'UserController', 'method' => 'comisiones_pensionarias'],

    'recursos_humanos/roles' => ['controller' => 'RolController', 'method' => 'index'],
    'recursos_humanos/roles/listar' => ['controller' => 'RolController', 'method' => 'listar'],
    'recursos_humanos/roles/agregar' => ['controller' => 'RolController', 'method' => 'agregar'],
    'recursos_humanos/roles/editar/{id}' => ['controller' => 'RolController', 'method' => 'editar'],
    'recursos_humanos/roles/eliminar/{id}' => ['controller' => 'RolController', 'method' => 'eliminar'],
    'recursos_humanos/roles/areas_por_rol' => ['controller' => 'RolController', 'method' => 'areas_por_rol'],
    'recursos_humanos/roles/agregar_area' => ['controller' => 'RolController', 'method' => 'agregar_area'],

    'recursos_humanos/permisos' => ['controller' => 'PermitController', 'method' => 'index'],
    'recursos_humanos/permisos/resumen'          => ['controller' => 'PermitController', 'method' => 'resumen'],
    'recursos_humanos/permisos/guardar'          => ['controller' => 'PermitController', 'method' => 'guardar'],
    'recursos_humanos/permisos/listar/{id}'      => ['controller' => 'PermitController', 'method' => 'listar'],
    'recursos_humanos/permisos/eliminar/{id}'    => ['controller' => 'PermitController', 'method' => 'eliminar'],


    'recursos_humanos/horarios' => ['controller' => 'ScheduleController', 'method' => 'index'],
    'recursos_humanos/horarios/listar' => ['controller' => 'ScheduleController', 'method' => 'listar'],
    'recursos_humanos/horarios/agregar' => ['controller' => 'ScheduleController', 'method' => 'agregar'],
    'recursos_humanos/horarios/editar/{id}' => ['controller' => 'ScheduleController', 'method' => 'editar'],
    'recursos_humanos/horarios/eliminar/{id}' => ['controller' => 'ScheduleController', 'method' => 'eliminar'],

    'recursos_humanos/asistencias' => ['controller' => 'AssistanceController', 'method' => 'index'],
    'recursos_humanos/asistencias/listar' => ['controller' => 'AssistanceController', 'method' => 'listar'],
    'recursos_humanos/asistencias/registrar_auto' => ['controller' => 'AssistanceController', 'method' => 'registrar_auto'],

    // INVENTARIO
    'inventario/productos' => ['controller' => 'ProductController', 'method' => 'index'],
    'inventario/productos/listar' => ['controller' => 'ProductController', 'method' => 'listar'],
    'inventario/productos/listar_equipos' => ['controller' => 'ProductController', 'method' => 'listar_equipos'],
    'inventario/productos/agregar' => ['controller' => 'ProductController', 'method' => 'agregar'],
    'inventario/productos/editar/{id}' => ['controller' => 'ProductController', 'method' => 'editar'],
    'inventario/productos/eliminar/{id}' => ['controller' => 'ProductController', 'method' => 'eliminar'],
    'inventario/productos/generar_codigo'  => ['controller' => 'ProductController', 'method' => 'generar_codigo'],
    'inventario/productos/listar_ps'       => ['controller' => 'ProductController', 'method' => 'listar_ps'],
    'inventario/productos/validar_serie'       => ['controller' => 'ProductController', 'method' => 'validar_serie'],


    'inventario/categorias' => ['controller' => 'CategoryController', 'method' => 'index'],
    'inventario/categorias/listar' => ['controller' => 'CategoryController', 'method' => 'listar'],
    'inventario/categorias/agregar' => ['controller' => 'CategoryController', 'method' => 'agregar'],
    'inventario/categorias/editar/{id}' => ['controller' => 'CategoryController', 'method' => 'editar'],
    'inventario/categorias/eliminar/{id}' => ['controller' => 'CategoryController', 'method' => 'eliminar'],

    'inventario/almacenes' => ['controller' => 'StoreController', 'method' => 'index'],
    'inventario/almacenes/listar' => ['controller' => 'StoreController', 'method' => 'listar'],
    'inventario/almacenes/agregar' => ['controller' => 'StoreController', 'method' => 'agregar'],
    'inventario/almacenes/editar/{id}' => ['controller' => 'StoreController', 'method' => 'editar'],
    'inventario/almacenes/eliminar/{id}' => ['controller' => 'StoreController', 'method' => 'eliminar'],

    'inventario/proveedores' => ['controller' => 'SupplierController', 'method' => 'index'],
    'inventario/proveedores/listar' => ['controller' => 'SupplierController', 'method' => 'listar'],
    'inventario/proveedores/agregar' => ['controller' => 'SupplierController', 'method' => 'agregar'],
    'inventario/proveedores/editar/{id}' => ['controller' => 'SupplierController', 'method' => 'editar'],
    'inventario/proveedores/eliminar/{id}' => ['controller' => 'SupplierController', 'method' => 'eliminar'],

    'inventario/compras' => ['controller' => 'BuyController', 'method' => 'index'],
    'inventario/compras/listar' => ['controller' => 'BuyController', 'method' => 'listar'],
    'inventario/compras/agregar' => ['controller' => 'BuyController', 'method' => 'agregar'],
    'inventario/compras/editar/{id}' => ['controller' => 'BuyController', 'method' => 'editar'],
    'inventario/compras/eliminar/{id}' => ['controller' => 'BuyController', 'method' => 'eliminar'],

    'inventario/movimientos' => ['controller' => 'MotionController', 'method' => 'index'],
    'inventario/movimientos/listar' => ['controller' => 'MotionController', 'method' => 'listar'],
    'inventario/movimientos/agregar' => ['controller' => 'MotionController', 'method' => 'agregar'],
    'inventario/movimientos/editar/{id}' => ['controller' => 'MotionController', 'method' => 'editar'],
    'inventario/movimientos/eliminar/{id}' => ['controller' => 'MotionController', 'method' => 'eliminar'],

    'inventario/stock'              => ['controller' => 'StockController', 'method' => 'index'],
    'inventario/stock/listar'       => ['controller' => 'StockController', 'method' => 'listar'],
    'inventario/stock/series/{id}'  => ['controller' => 'StockController', 'method' => 'series'],
    'inventario/stock/tecnicos'     => ['controller' => 'StockController', 'method' => 'tecnicos'],
    'inventario/stock/stock_tecnico/{id}'   => ['controller' => 'StockController', 'method' => 'stock_tecnico'],
    'inventario/stock/stockear_tecnico'     => ['controller' => 'StockController', 'method' => 'stockear_tecnico'],
    'inventario/stock/devolver_todo_tecnico' => ['controller' => 'StockController', 'method' => 'devolver_todo_tecnico'],
    'inventario/stock/devolver_drop'        => ['controller' => 'StockController', 'method' => 'devolver_drop'],
    'inventario/stock/editar/{id}'  => ['controller' => 'StockController', 'method' => 'editar'],
    'inventario/stock/eliminar/{id}' => ['controller' => 'StockController', 'method' => 'eliminar'],

    // PERSONAL
    'personal/trabajadores' => ['controller' => 'StaffController', 'method' => 'worker'],
    'personal/trabajadores/listar' => ['controller' => 'StaffController', 'method' => 'worker_listar'],
    'personal/trabajadores/agregar' => ['controller' => 'StaffController', 'method' => 'agregar'],
    'personal/trabajadores/agregar_stock' => ['controller' => 'StaffController', 'method' => 'agregar_stock'],
    'personal/trabajadores/editar/{id}' => ['controller' => 'StaffController', 'method' => 'editar'],
    'personal/trabajadores/obtener_stock/{id}' => ['controller' => 'StaffController', 'method' => 'obtener_stock'],
    'personal/trabajadores/eliminar/{id}' => ['controller' => 'StaffController', 'method' => 'eliminar'],

    // MOVILIDAD
    'movilidad/vehiculos' => ['controller' => 'VehicleController', 'method' => 'index'],
    'movilidad/vehiculos/listar' => ['controller' => 'VehicleController', 'method' => 'listar'],
    'movilidad/vehiculos/agregar' => ['controller' => 'VehicleController', 'method' => 'agregar'],
    'movilidad/vehiculos/editar/{id}' => ['controller' => 'VehicleController', 'method' => 'editar'],
    'movilidad/vehiculos/eliminar/{id}' => ['controller' => 'VehicleController', 'method' => 'eliminar'],

    'movilidad/marcas' => ['controller' => 'BrandController', 'method' => 'index'],
    'movilidad/marcas/listar' => ['controller' => 'BrandController', 'method' => 'listar'],
    'movilidad/marcas/agregar' => ['controller' => 'BrandController', 'method' => 'agregar'],
    'movilidad/marcas/editar/{id}' => ['controller' => 'BrandController', 'method' => 'editar'],
    'movilidad/marcas/eliminar/{id}' => ['controller' => 'BrandController', 'method' => 'eliminar'],

    'movilidad/modelos' => ['controller' => 'PatternController', 'method' => 'index'],
    'movilidad/modelos/listar' => ['controller' => 'PatternController', 'method' => 'listar'],
    'movilidad/modelos/agregar' => ['controller' => 'PatternController', 'method' => 'agregar'],
    'movilidad/modelos/editar/{id}' => ['controller' => 'PatternController', 'method' => 'editar'],
    'movilidad/modelos/eliminar/{id}' => ['controller' => 'PatternController', 'method' => 'eliminar'],

    'movilidad/tipos_vehiculo' => ['controller' => 'VehicleTypeController', 'method' => 'index'],
    'movilidad/tipos_vehiculo/listar' => ['controller' => 'VehicleTypeController', 'method' => 'listar'],
    'movilidad/tipos_vehiculo/agregar' => ['controller' => 'VehicleTypeController', 'method' => 'agregar'],
    'movilidad/tipos_vehiculo/editar/{id}' => ['controller' => 'VehicleTypeController', 'method' => 'editar'],
    'movilidad/tipos_vehiculo/eliminar/{id}' => ['controller' => 'VehicleTypeController', 'method' => 'eliminar'],

    'movilidad/combustibles' => ['controller' => 'FuelController', 'method' => 'index'],
    'movilidad/combustibles/listar' => ['controller' => 'FuelController', 'method' => 'listar'],
    'movilidad/combustibles/agregar' => ['controller' => 'FuelController', 'method' => 'agregar'],
    'movilidad/combustibles/editar/{id}' => ['controller' => 'FuelController', 'method' => 'editar'],
    'movilidad/combustibles/eliminar/{id}' => ['controller' => 'FuelController', 'method' => 'eliminar'],

    // 'inicio/{id}' => ['controller' => 'HomeController', 'method' => 'obtener']
];
