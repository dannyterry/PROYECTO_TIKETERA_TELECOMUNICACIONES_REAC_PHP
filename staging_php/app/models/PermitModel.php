<?php
// cespedes/app/models/PermitModel.php — REEMPLAZAR COMPLETO

class PermitModel extends Model
{
    /**
     * Catálogo de módulos agrupados por área.
     *
     * Edita aquí para agregar/quitar módulos o acciones del sistema.
     * Estructura:
     *   grupo => [ 'nombre' => 'Etiqueta del área', 'modulos' => [ 'clave_modulo' => [ 'nombre' => 'Etiqueta', 'acciones' => [...] ] ] ]
     *
     * Las claves de permiso se construyen como "clave_modulo.accion"
     * (ej: productos.crear). Este mismo catálogo alimenta la interfaz de
     * permisos (vista + JS) y las rutas de redirección.
     */
    public static function modulos()
    {
        return [
            'operaciones' => [
                'nombre' => 'Operaciones',
                'icono'  => 'mdi-clipboard-text-outline',
                'modulos' => [
                    'dashboard'     => ['nombre' => 'Dashboard',       'acciones' => ['ver']],
                    'ordenes'       => ['nombre' => 'Órdenes',         'acciones' => ['ver', 'crear', 'editar', 'eliminar', 'liquidar', 'sincronizar', 'ver_stock']],
                    'liquidaciones' => ['nombre' => 'Liquidaciones',   'acciones' => ['ver', 'aprobar']],
                    'pagos'         => ['nombre' => 'Pagos',           'acciones' => ['ver']],
                    'correos'       => ['nombre' => 'Correos',         'acciones' => ['ver', 'enviar', 'editar']],
                ],
            ],
            'recursos_humanos' => [
                'nombre' => 'Recursos Humanos',
                'icono'  => 'mdi-account-group-outline',
                'modulos' => [
                    'usuarios'    => ['nombre' => 'Personal / Empleados',    'acciones' => ['ver', 'crear', 'editar', 'eliminar']],
                    'roles'       => ['nombre' => 'Roles',       'acciones' => ['ver', 'crear', 'editar', 'eliminar']],
                    'permisos'    => ['nombre' => 'Permisos',    'acciones' => ['ver', 'editar']],
                    'horarios'    => ['nombre' => 'Horarios',    'acciones' => ['ver', 'crear', 'editar', 'eliminar']],
                    'asistencias' => ['nombre' => 'Asistencias', 'acciones' => ['ver', 'crear', 'editar', 'eliminar']],
                ],
            ],
            'personal' => [
                'nombre' => 'Personal',
                'icono'  => 'mdi-badge-account-horizontal-outline',
                'modulos' => [
                    'trabajadores' => ['nombre' => 'Trabajadores', 'acciones' => ['ver', 'crear', 'editar', 'eliminar']],
                ],
            ],
            'inventario' => [
                'nombre' => 'Inventario',
                'icono'  => 'mdi-package-variant-closed',
                'modulos' => [
                    'productos'   => ['nombre' => 'Productos',   'acciones' => ['ver', 'crear', 'editar', 'eliminar', 'exportar']],
                    'categorias'  => ['nombre' => 'Categorías',  'acciones' => ['ver', 'crear', 'editar', 'eliminar']],
                    'almacenes'   => ['nombre' => 'Almacenes',   'acciones' => ['ver', 'crear', 'editar', 'eliminar']],
                    'proveedores' => ['nombre' => 'Proveedores', 'acciones' => ['ver', 'crear', 'editar', 'eliminar']],
                    'compras'     => ['nombre' => 'Compras',     'acciones' => ['ver', 'crear', 'editar', 'eliminar', 'exportar']],
                    'movimientos' => ['nombre' => 'Movimientos', 'acciones' => ['ver', 'crear', 'editar', 'eliminar']],
                    'stock'       => ['nombre' => 'Stock',       'acciones' => ['ver', 'editar']],
                ],
            ],
            'movilidad' => [
                'nombre' => 'Movilidad',
                'icono'  => 'mdi-car',
                'modulos' => [
                    'vehiculos'      => ['nombre' => 'Vehículos',        'acciones' => ['ver', 'crear', 'editar', 'eliminar']],
                    'marcas'         => ['nombre' => 'Marcas',           'acciones' => ['ver', 'crear', 'editar', 'eliminar']],
                    'modelos'        => ['nombre' => 'Modelos',          'acciones' => ['ver', 'crear', 'editar', 'eliminar']],
                    'tipos_vehiculo' => ['nombre' => 'Tipos de vehículo', 'acciones' => ['ver', 'crear', 'editar', 'eliminar']],
                    'combustibles'   => ['nombre' => 'Combustibles',     'acciones' => ['ver', 'crear', 'editar', 'eliminar']],
                ],
            ],
            'configuracion' => [
                'nombre' => 'Configuración',
                'icono'  => 'mdi-cog-outline',
                'modulos' => [
                    'motivos'       => ['nombre' => 'Motivos',   'acciones' => ['ver', 'crear', 'editar', 'eliminar']],
                    'tipo_trabajo'  => ['nombre' => 'Tipos de trabajo', 'acciones' => ['ver', 'crear', 'editar', 'eliminar']],
                    'configuracion' => ['nombre' => 'Sistema',   'acciones' => ['ver', 'editar']],
                ],
            ],
        ];
    }

    /** Orden de visualización de las acciones en la tabla de permisos */
    public static function acciones()
    {
        return [
            'ver'         => 'Ver',
            'crear'       => 'Crear',
            'editar'      => 'Editar',
            'eliminar'    => 'Eliminar',
            'exportar'    => 'Exportar',
            'liquidar'    => 'Liquidar',
            'sincronizar' => 'Sincronizar',
            'aprobar'     => 'Aprobar',
            'enviar'      => 'Enviar',
            'ver_stock'   => 'Ver Stock',
        ];
    }

    /** Mapa plano clave_modulo => [acciones] (útil para validaciones internas) */
    public static function modulos_planos()
    {
        $planos = [];
        foreach (self::modulos() as $grupo) {
            foreach ($grupo['modulos'] as $modulo => $info) {
                $planos[$modulo] = $info['acciones'];
            }
        }
        return $planos;
    }

    /** Nombre visible de un módulo (ej: 'productos' => 'Productos') */
    public static function modulo_nombre($modulo)
    {
        foreach (self::modulos() as $grupo) {
            if (isset($grupo['modulos'][$modulo])) {
                return $grupo['modulos'][$modulo]['nombre'];
            }
        }
        return ucfirst($modulo);
    }

    /** Grupo (área) al que pertenece un módulo */
    public static function grupo_de($modulo)
    {
        foreach (self::modulos() as $grupoKey => $grupo) {
            if (isset($grupo['modulos'][$modulo])) {
                return $grupoKey;
            }
        }
        return null;
    }

    /** Ruta pública del módulo (para redirecciones del menú y del login) */
    public static function rutaModulo($modulo)
    {
        $rutas = [
            'dashboard'     => 'reportes',
            'ordenes'       => 'ordenes',
            'liquidaciones' => 'liquidaciones',
            'pagos'         => 'pagos',
            'correos'       => 'correos',
            'usuarios'      => 'recursos_humanos/usuarios',
            'roles'         => 'recursos_humanos/roles',
            'permisos'      => 'recursos_humanos/permisos',
            'horarios'      => 'recursos_humanos/horarios',
            'asistencias'   => 'recursos_humanos/asistencias',
            'trabajadores'  => 'personal/trabajadores',
            'productos'     => 'inventario/productos',
            'categorias'    => 'inventario/categorias',
            'almacenes'     => 'inventario/almacenes',
            'proveedores'   => 'inventario/proveedores',
            'compras'       => 'inventario/compras',
            'movimientos'   => 'inventario/movimientos',
            'stock'         => 'inventario/stock',
            'vehiculos'     => 'movilidad/vehiculos',
            'marcas'        => 'movilidad/marcas',
            'modelos'       => 'movilidad/modelos',
            'tipos_vehiculo'=> 'movilidad/tipos_vehiculo',
            'combustibles'  => 'movilidad/combustibles',
            'motivos'       => 'configuracion/motivos',
            'tipo_trabajo'  => 'configuracion/tipo_trabajo',
            'configuracion' => 'configuracion/sistema',
        ];
        return $rutas[$modulo] ?? 'reportes';
    }

    /** Claves activas de un rol como array de strings */
    public function listar_por_rol_($id_rol)
    {
        $sql  = "SELECT p.clave
                 FROM permisos p
                 INNER JOIN roles_permisos rp ON rp.id_permiso = p.id_permiso
                 WHERE rp.id_rol = :id_rol AND p.estado = 'Activo'";
        $rows = $this->getAll($sql, [':id_rol' => $id_rol]);

        return array_column(
            array_map(fn($r) => (array)$r, $rows),
            'clave'
        );
    }

    /** Resumen de cada rol para las cards */
    public function resumen_roles_()
    {
        // El "módulo" se deriva de la clave (ej: 'productos.crear' => 'productos')
        // para que las cards muestren el nombre correcto aunque la columna
        // `modulo` de la tabla permisos tenga valores viejos ('reportes', etc.).
        $sql = "SELECT r.id_rol, r.nombre AS nombre_rol, r.estado,
                       COUNT(rp.id_permiso) AS total_permisos,
                       GROUP_CONCAT(DISTINCT SUBSTRING_INDEX(p.clave, '.', 1) ORDER BY SUBSTRING_INDEX(p.clave, '.', 1) SEPARATOR ',') AS modulos_activos
                FROM roles r
                LEFT JOIN roles_permisos rp ON rp.id_rol    = r.id_rol
                LEFT JOIN permisos p        ON p.id_permiso = rp.id_permiso AND p.estado = 'Activo'
                GROUP BY r.id_rol
                ORDER BY r.id_rol ASC";
        return $this->getAll($sql);
    }

    /**
     * Guarda (sincroniza) los permisos de un rol.
     * - Elimina todos los permisos previos del rol
     * - Inserta los nuevos (creando en tabla permisos si no existen)
     */
    public function guardar_()
    {
        try {
            $id_rol     = $_POST['id_rol']  ?? null;
            $claves_raw = $_POST['claves']  ?? '[]';
            $claves     = json_decode($claves_raw, true);

            if (empty($id_rol)) {
                return ['success' => false, 'mensaje' => 'Rol no especificado.'];
            }
            if (!is_array($claves)) $claves = [];

            // Validar que las claves pertenezcan al catálogo (evita guardar basura)
            $catalogo = self::modulos_planos();
            $claves   = array_filter($claves, function ($clave) use ($catalogo) {
                $partes = explode('.', (string)$clave);
                return count($partes) === 2
                    && isset($catalogo[$partes[0]])
                    && in_array($partes[1], $catalogo[$partes[0]], true);
            });
            $claves = array_values(array_unique($claves));

            // Eliminar permisos actuales del rol
            $this->query("DELETE FROM roles_permisos WHERE id_rol = :id_rol", [':id_rol' => $id_rol]);

            foreach ($claves as $clave) {
                $clave  = trim($clave);
                if (empty($clave)) continue;

                $partes = explode('.', $clave);
                [$modulo, $accion] = $partes;

                $nombre = ucfirst($accion) . ' ' . self::modulo_nombre($modulo);

                // Buscar o crear en tabla permisos
                $permiso = $this->getOne(
                    "SELECT id_permiso FROM permisos WHERE clave = :c",
                    [':c' => $clave]
                );

                if (!$permiso) {
                    $this->query(
                        "INSERT INTO permisos (nombre, clave, modulo, estado) VALUES (:n,:c,:m,'Activo')",
                        [':n' => $nombre, ':c' => $clave, ':m' => $modulo]
                    );
                    $id_permiso = $this->lastInsertId();
                } else {
                    $id_permiso = $permiso->id_permiso;
                    // Actualizar nombre, módulo y estado (corrige filas viejas)
                    $this->query(
                        "UPDATE permisos SET nombre=:n, modulo=:m, estado='Activo' WHERE id_permiso=:id",
                        [':n' => $nombre, ':m' => $modulo, ':id' => $id_permiso]
                    );
                }

                // Insertar en roles_permisos (IGNORE evita error si ya existe por el UNIQUE)
                $this->query(
                    "INSERT IGNORE INTO roles_permisos (id_rol, id_permiso) VALUES (:rol,:perm)",
                    [':rol' => $id_rol, ':perm' => $id_permiso]
                );
            }

            return ['success' => true, 'mensaje' => 'Permisos guardados correctamente.'];
        } catch (Exception $e) {
            return ['success' => false, 'mensaje' => 'Error: ' . $e->getMessage()];
        }
    }

    /** Quitar todos los permisos de un rol */
    public function eliminar_rol_($id_rol)
    {
        try {
            $this->query("DELETE FROM roles_permisos WHERE id_rol = :id_rol", [':id_rol' => $id_rol]);
            return ['success' => true, 'mensaje' => 'Permisos del rol eliminados.'];
        } catch (Exception $e) {
            return ['success' => false, 'mensaje' => 'Error: ' . $e->getMessage()];
        }
    }

    // Alias para compatibilidad con PermitController::listar()
    public function listar_()
    {
        return $this->resumen_roles_();
    }
}
