export interface Vehiculo {
  id_vehiculo: number;
  placa: string;
  anio?: number;
  transmision?: string;
  color?: string;
  estado: 'Disponible' | 'En uso' | 'En mantenimiento' | 'Inactivo';
  observaciones?: string;
  marca?: string;
  modelo?: string;
  tipo_vehiculo?: string;
  combustible?: string;
  id_trabajador?: number;
  id_usuario?: number;
  tecnico_asignado?: string;
  cuadrilla?: string;
  ultimo_km?: number;
}

export interface Tecnico {
  id_trabajador: number;
  id_usuario: number;
  nombre_completo: string;
  documento?: string;
  cuadrilla?: string;
  telefono?: string;
  id_vehiculo?: number;
  vehiculo_placa?: string;
  vehiculo_marca?: string;
  vehiculo_modelo?: string;
}

export interface Inspeccion {
  id_inspeccion: number;
  id_vehiculo: number;
  id_trabajador: number;
  fecha: string;
  km_inicio?: number;
  hora_inicio?: string;
  foto_tablero_inicio?: string;
  foto_aceite?: string;
  foto_agua?: string;
  foto_estado_general?: string;
  km_fin?: number;
  hora_fin?: string;
  foto_tablero_fin?: string;
  km_recorridos?: number;
  km_estimados_ordenes?: number;
  km_gps_app?: number;
  puntos_gps_count?: number;
  hora_inicio_real?: string;
  hora_cierre_real?: string;
  alerta_inicio_tardio?: boolean;
  diferencia_km?: number;
  observaciones_tecnico?: string;
  estado_auditoria: 'Pendiente' | 'Aprobado' | 'Observado';
  observaciones_admin?: string;
  fecha_auditoria?: string;
  fecha_creacion: string;
  // Joins
  placa?: string;
  marca?: string;
  modelo?: string;
  color?: string;
  nombre_tecnico?: string;
  cuadrilla?: string;
  telefono?: string;
}

export interface ParadaGps {
  id_gps_log: number | string;
  lat: string | number;
  lng: string | number;
  tipo_evento: string;
  referencia_id?: string;
  descripcion?: string;
  hora: string;
  fecha_hora?: string;
  tramo_km?: number;
  acumulado_km?: number;
  cliente?: string;
  ticket?: string;
  direccion?: string;
  orden_visita?: number;
}

export interface RecorridoTecnicoResponse {
  fecha: string;
  id_trabajador: number;
  tecnico?: {
    id_trabajador?: number;
    nombre_tecnico?: string;
    cuadrilla?: string;
    telefono?: string;
  };
  inspeccion?: Inspeccion | null;
  total_paradas: number;
  km_recorridos_gps: number;
  km_estimados_ordenes?: number;
  paradas: ParadaGps[];
  paradas_gps?: ParadaGps[];
  paradas_ordenes?: ParadaGps[];
}

export interface CargaCombustible {
  id_combustible_registro: number;
  id_vehiculo: number;
  id_trabajador?: number;
  fecha_carga: string;
  tipo_combustible: string;
  monto_total: number | string;
  galones_m3: number | string;
  km_momento_carga: number;
  grifo_estacion?: string;
  numero_comprobante?: string;
  tipo_comprobante?: string;
  foto_comprobante?: string;
  rendimiento_km_galon?: number | string;
  registrado_por?: string;
  observaciones?: string;
  fecha_creacion: string;
  // Joins
  placa?: string;
  marca?: string;
  modelo?: string;
  nombre_tecnico?: string;
}

export interface ResumenCombustible {
  totalGasto: number;
  totalGalones: number;
  precioPromedioGalon: number;
}

export interface DashboardKmResumen {
  totalKmDeclarados: number;
  totalKmEstimados: number;
  diferenciaTotal: number;
  totalInspecciones: number;
  aprobadas: number;
  pendientes: number;
  observadas: number;
  alertasDesvioCount: number;
}
