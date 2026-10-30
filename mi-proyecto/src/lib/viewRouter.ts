// Mapeo explícito: hash → módulo interno
export type AppModule =
  | 'executive' | 'orders' | 'inventory' | 'mobility'
  | 'personal' | 'settings' | 'payments' | 'supervision'
  | 'portal' | 'unknown';

const VIEW_MAP: Record<string, AppModule> = {
  // Dashboard/Análisis
  'dashboard': 'executive', 'inicio': 'executive', 'reportes': 'executive',
  'auditoria': 'executive', 'torre-control': 'executive',
  // Órdenes (default también)
  'ordenes': 'orders', 'orden': 'orders', 'asignadas': 'orders',
  'finalizadas': 'orders', 'canceladas': 'orders', 'pendientes': 'orders',
  // Inventario/Almacén
  'almacen': 'inventory', 'inventario': 'inventory', 'stock': 'inventory',
  'kardex': 'inventory', 'movimientos': 'inventory', 'kardex-movimientos': 'inventory',
  'kardex_movimientos': 'inventory', 'kardex-general': 'inventory',
  'equipos': 'inventory', 'equipos-generales': 'inventory', 'equipos_generales': 'inventory',
  'equiposgenerales': 'inventory', 'compras': 'inventory', 'despacho': 'inventory',
  'historial': 'inventory', 'historial-despachos': 'inventory', 'historial_despachos': 'inventory',
  'recogidos': 'inventory', 'devolucion': 'inventory', 'devoluciones': 'inventory',
  'cruce_inventario': 'inventory', 'cruce-inventario': 'inventory', 'cruce': 'inventory',
  'liquidacion': 'inventory', 'liquidaciones': 'inventory',
  'liquidaciones_ordenes': 'inventory', 'liquidaciones-ordenes': 'inventory',
  'productos': 'inventory', 'categorias': 'inventory', 'proveedores': 'inventory',
  'transferencias': 'inventory', 'transferencia': 'inventory',
  'traspasos': 'inventory', 'traspaso': 'inventory',
  'traspasos_tecnicos': 'inventory', 'traspasos-tecnicos': 'inventory',
  'transferencias_tecnicos': 'inventory', 'transferencias-tecnicos': 'inventory',
  // Movilidad
  'movilidad': 'mobility', 'vehiculos': 'mobility', 'combustibles': 'mobility',
  'combustible': 'mobility', 'flota': 'mobility', 'inspecciones': 'mobility',
  'checklist-tecnico': 'mobility',
  // Personal/RR.HH.
  'personal': 'personal', 'empleados': 'personal', 'general': 'personal',
  'roles': 'personal', 'rol': 'personal', 'asistencia': 'personal', 'asistencias': 'personal',
  // Configuración
  'configuracion': 'settings', 'motivos': 'settings', 'tipos-trabajo': 'settings',
  'tipo_trabajo': 'settings', 'sistema': 'settings', 'permisos': 'settings',
  'correos': 'settings', 'email': 'settings',
  // Pagos
  'pagos': 'payments', 'pago': 'payments', 'finanzas': 'payments',
  'liquidaciones-tecnicos': 'payments',
  // Supervisión
  'supervision': 'supervision', 'calidad': 'supervision', 'auditoria-calidad': 'supervision',
  // Portal técnico
  'portal-tecnico': 'portal',
};

export function resolveModule(view: string): AppModule {
  const v = (view || '').toLowerCase().trim();
  // Búsqueda exacta
  if (VIEW_MAP[v]) return VIEW_MAP[v];
  // Búsqueda por prefijo (ej: "cruce_inventario_detalle" → inventory)
  for (const [key, mod] of Object.entries(VIEW_MAP)) {
    if (v.startsWith(key) || v.includes(key)) return mod;
  }
  // Default explícito: órdenes (NO catch-all negativo)
  return 'orders';
}
