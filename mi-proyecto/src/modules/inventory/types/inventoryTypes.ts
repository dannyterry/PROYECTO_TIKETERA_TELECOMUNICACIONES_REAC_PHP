export interface ProductoStock {
  id_producto: number;
  codigo: string;
  nombre: string;
  descripcion?: string;
  categoria: string;
  stock_minimo: number;
  maneja_serie: number | boolean;
  es_drop: number | boolean;
  precio_compra: number;
  stock_central: number;
  stock_en_tecnicos: number;
  series_disponibles: number;
  fecha_ingreso?: string;
  unidad?: string;
  unidad_medida?: string;
}

export interface StockTecnicoDetalle {
  id_trabajador: number;
  tecnico_nombre: string;
  tecnico_dni?: string;
  cuadrilla: string;
  vehiculo_placa: string;
  id_producto: number;
  producto_nombre: string;
  producto_codigo: string;
  categoria: string;
  es_drop: number;
  stock: number;
  fecha_entrega?: string;
  series?: any[];
  series_disponibles?: string[];
  series_liquidadas?: string[];
  total_asignadas?: number;
  total_en_carro?: number;
  total_liquidadas?: number;
  rangos?: string[];
}

export interface SerieTecnicoDetalle {
  id_trabajador_serie: number;
  id_trabajador: number;
  tecnico_nombre: string;
  numero_serie: string;
  equipo_nombre: string;
  producto_nombre?: string;
  estado: string;
  fecha_asignacion: string;
}

export interface Proveedor {
  id_proveedor: number;
  ruc: string;
  razon_social: string;
  nombre_comercial?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
}

export interface CompraItemPayload {
  id_producto: number;
  cantidad: number;
  precio: number;
  series: string[];
}

export interface CompraPayload {
  id_proveedor?: number | null;
  ruc_proveedor?: string;
  razon_social_proveedor?: string;
  direccion_proveedor?: string;
  telefono_proveedor?: string;
  tipo_comprobante: "Factura" | "Boleta";
  numero_comprobante: string;
  fecha: string;
  items: CompraItemPayload[];
  observaciones?: string;
}

export interface DespachoPayload {
  id_trabajador: number;
  items: { id_producto: number; cantidad: number }[];
  series_pistoleadas: { numero_serie: string }[];
  observaciones?: string;
}

export interface EquipoRetirado {
  id_equipo_retirado: number;
  id_orden: number;
  tipo_equipo: string;
  numero_serie: string;
  motivo_retiro: string;
  estado: "En_Poder_Tecnico" | "Internado_Almacen" | "Defectuoso" | "Baja";
  fecha_recojo: string;
  fecha_internamiento?: string;
  recibido_por?: string;
  observaciones?: string;
  ticket: string;
  cliente: string;
  direccion: string;
  distrito: string;
  tecnico_nombre: string;
  cuadrilla: string;
}

export interface ActaLiquidacionPayload {
  id_trabajador?: number;
  numero_guia: string;
  numero_acta?: string;
  tipo_trabajo_acta: string;
  cto?: string;
  puerto?: string;
  speedtest_download?: number;
  speedtest_upload?: number;
  tipo_conexion?: string;
  drop_metro_inicio?: number;
  drop_metro_fin?: number;
  drop_total_metros?: number;
  lat_liquidacion?: number;
  lng_liquidacion?: number;
  observaciones_tecnico?: string;
  firma_cliente?: string;
  firma_tecnico?: string;
  materiales_utilizados: { id_producto: number; cantidad: number }[];
  equipos_instalados: { numero_serie: string; tipo_equipo: string }[];
  equipos_retirados: { tipo_equipo: string; numero_serie: string; motivo_retiro: string }[];
}

export interface MotivoItem {
  id_motivo: number;
  nombre: string;
  tipo_trabajo?: string;
  precio_compra?: number;
  precio_venta?: number;
  limites_materiales?: string | { id_producto?: number; nombre?: string; cantidad?: number; max?: number }[] | null;
  estado?: string;
}

export interface ActaDetalleItem {
  id_trabajador_serie: number;
  id_trabajador: number;
  id_producto_serie: number;
  numero_serie: string;
  id_producto: number;
  producto_nombre: string;
  estado: "Asignada" | "Usada" | "Devuelta";
  fecha_asignacion: string;
  id_orden?: number | null;
  orden_numero?: string | null;
  fecha_liquidacion?: string | null;
}

export interface ActaTecnicoResumen {
  id_trabajador: number;
  tecnico_nombre: string;
  cuadrilla: string;
  vehiculo_placa: string;
  telefono: string;
  total_asignadas: number;
  total_usadas: number;
  total_disponibles: number;
  rangos: string[];
  actas: ActaDetalleItem[];
}

export interface ProductoSerieItem {
  id_producto_serie: number;
  id_producto: number;
  numero_serie: string;
  estado_serie: "DISPONIBLE" | "RESERVADO" | "VENDIDO" | "DEFECTUOSO" | "BAJA" | "CONSUMIDO";
  fecha_ingreso?: string;
  id_trabajador?: number | null;
  estado_en_tecnico?: "Asignada" | "Usada" | "Devuelta" | null;
  fecha_asignacion?: string | null;
  tecnico_nombre?: string | null;
  tecnico_cuadrilla?: string | null;
  vehiculo_placa?: string | null;
}

export interface ProductoSeriesResumen {
  producto: {
    id_producto: number;
    codigo: string;
    nombre: string;
    descripcion?: string;
    categoria?: string;
    stock_minimo?: number;
  };
  total_series: number;
  disponibles_almacen: number;
  asignadas_tecnicos: number;
  series: ProductoSerieItem[];
}

export interface MaterialLiquidadoAudit {
  id_detalle_liq: number;
  id_producto: number;
  numero_serie?: string | null;
  cantidad: number;
  drop_inicio?: number | null;
  drop_fin?: number | null;
  nombre_producto: string;
  categoria_liquidar?: string;
  precio_compra: number | string;
  costo: number | string;
}

export interface LiquidacionOrdenAudit {
  id_liquidacion: number;
  id_orden: number;
  id_trabajador: number;
  tecnico: string;
  tecnico_dni?: string;
  numero_acta: string;
  numero_guia?: string;
  tipo_trabajo_acta?: string;
  cto?: string;
  puerto?: string;
  speedtest_download?: number | string;
  speedtest_upload?: number | string;
  tipo_conexion?: string;
  drop_metro_inicio?: number | null;
  drop_metro_fin?: number | null;
  drop_total_metros: number;
  observaciones?: string;
  observaciones_tecnico?: string;
  estado_liquidacion: "Pendiente" | "Aprobada" | "Rechazada";
  motivo_rechazo?: string | null;
  fecha_liquidacion: string;
  numero_orden: string;
  cliente: string;
  direccion: string;
  tipo_trabajo?: string;
  tipo_averia?: string;
  fecha_visita: string;
  total_items: number;
  total_costo: number | string;
  materiales: MaterialLiquidadoAudit[];
  metraje_fenix?: number | null;
  es_alerta: boolean;
  motivo_alerta?: string;
  max_drop_permitido?: number;
}

export interface TecnicoLiqAuditResumen {
  id_trabajador: number;
  tecnico: string;
  cuadrilla?: string;
  foto_personal?: string;
  tecnico_dni?: string;
  total_ordenes: number;
  total_liquidaciones: number;
  total_pendientes: number;
  total_aprobadas: number;
  total_rechazadas: number;
  total_costo: number | string;
  ultima_liquidacion?: string;
}

