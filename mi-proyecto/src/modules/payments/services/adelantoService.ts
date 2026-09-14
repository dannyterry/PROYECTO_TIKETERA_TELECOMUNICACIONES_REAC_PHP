import { API_URL } from "../../../config/api";

export interface AdelantoItem {
  id_adelanto: number;
  id_trabajador: number;
  id_usuario_registro?: number;
  monto: number;
  fecha_adelanto: string;
  metodo_pago: string;
  numero_operacion?: string;
  motivo?: string;
  estado: "PENDIENTE" | "DESCONTADO" | "ANULADO";
  fecha_descuento?: string;
  id_orden_liquidacion?: number;
  observaciones?: string;
  created_at: string;
  trabajador?: string;
  documento?: string;
  telefono?: string;
  rol_nombre?: string;
  registrado_por_nombre?: string;
}

export interface AdelantoTotales {
  total_monto: number;
  total_pendiente: number;
  total_descontado: number;
  total_anulado: number;
  cantidad: number;
}

export interface AdelantosResponse {
  success: boolean;
  totales: AdelantoTotales;
  adelantos: AdelantoItem[];
}

export interface CrearAdelantoPayload {
  id_trabajador: number;
  id_usuario_registro?: number;
  monto: number;
  fecha_adelanto: string;
  metodo_pago: string;
  numero_operacion?: string;
  motivo?: string;
  observaciones?: string;
}

export const getAdelantos = async (
  desde?: string,
  hasta?: string,
  estado?: string,
  id_trabajador?: number | string
): Promise<AdelantosResponse> => {
  const params = new URLSearchParams();
  if (desde) params.append("desde", desde);
  if (hasta) params.append("hasta", hasta);
  if (estado && estado !== "TODOS") params.append("estado", estado);
  if (id_trabajador) params.append("id_trabajador", String(id_trabajador));

  const res = await fetch(`${API_URL}/api/pagos/adelantos?${params.toString()}`);
  if (!res.ok) throw new Error("Error al obtener los adelantos de sueldo");
  return res.json();
};

export const crearAdelanto = async (
  payload: CrearAdelantoPayload
): Promise<{ success: boolean; message: string; id_adelanto: number }> => {
  const res = await fetch(`${API_URL}/api/pagos/adelantos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Error al registrar el adelanto");
  }
  return res.json();
};

export const actualizarAdelanto = async (
  id: number,
  payload: Partial<CrearAdelantoPayload & { estado: string; fecha_descuento?: string }>
): Promise<{ success: boolean; message: string }> => {
  const res = await fetch(`${API_URL}/api/pagos/adelantos/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Error al actualizar el adelanto");
  }
  return res.json();
};

export const eliminarAdelanto = async (
  id: number
): Promise<{ success: boolean; message: string }> => {
  const res = await fetch(`${API_URL}/api/pagos/adelantos/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Error al eliminar el adelanto");
  }
  return res.json();
};
