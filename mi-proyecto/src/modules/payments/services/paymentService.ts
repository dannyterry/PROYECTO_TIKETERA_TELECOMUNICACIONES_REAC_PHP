import { API_URL } from "../../../config/api";

export interface PagoTotales {
  num_ordenes: number;
  sin_precio: number;
  ingreso_win: number;
  costo_material: number;
  pago_tecnicos: number;
  ganancia: number;
  total_adelantos?: number;
  neto_total?: number;
}

export interface TecnicoPagoItem {
  id_trabajador: number;
  tecnico: string;
  num_ordenes: number;
  sin_precio: number;
  ingreso_win: number;
  costo_material: number;
  pago_tecnico: number;
  ganancia: number;
  adelantos?: number;
  neto_a_pagar?: number;
}

export interface PagoResumenResponse {
  success: boolean;
  fecha_desde?: string;
  fecha_hasta?: string;
  estado?: string;
  totales: PagoTotales;
  tecnicos: TecnicoPagoItem[];
}

export interface AdelantoTecnicoItem {
  id_adelanto: number;
  monto: number;
  fecha_adelanto: string;
  metodo_pago: string;
  numero_operacion?: string;
  motivo?: string;
  estado: string;
  fecha_descuento?: string;
  observaciones?: string;
}

export interface OrdenPagoDetalle {
  id_orden: number;
  numero: string;
  fecha_visita: string;
  cliente?: string;
  tipo_trabajo?: string;
  motivo?: string;
  precio_win: number;
  pago_tecnico: number;
  costo_material: number;
  ganancia: number;
}

export interface TecnicoDetalleResponse {
  success: boolean;
  id_trabajador: number;
  tecnico: string;
  totales: PagoTotales & { total_adelantos?: number; neto_a_pagar?: number };
  ordenes: OrdenPagoDetalle[];
  adelantos?: AdelantoTecnicoItem[];
}

export const getPagosResumen = async (
  desde?: string,
  hasta?: string,
  estado?: string
): Promise<PagoResumenResponse> => {
  const params = new URLSearchParams();
  if (desde) params.append("desde", desde);
  if (hasta) params.append("hasta", hasta);
  if (estado) params.append("estado", estado);

  const res = await fetch(`${API_URL}/api/pagos/resumen?${params.toString()}`);
  if (!res.ok) throw new Error("Error al obtener el reporte de pagos");
  return res.json();
};

export const getPagoDetalleTecnico = async (
  id_trabajador: number | string,
  desde?: string,
  hasta?: string,
  estado?: string
): Promise<TecnicoDetalleResponse> => {
  const params = new URLSearchParams();
  if (desde) params.append("desde", desde);
  if (hasta) params.append("hasta", hasta);
  if (estado) params.append("estado", estado);

  const res = await fetch(
    `${API_URL}/api/pagos/detalle/${id_trabajador}?${params.toString()}`
  );
  if (!res.ok) throw new Error("Error al obtener el detalle de pagos del técnico");
  return res.json();
};
