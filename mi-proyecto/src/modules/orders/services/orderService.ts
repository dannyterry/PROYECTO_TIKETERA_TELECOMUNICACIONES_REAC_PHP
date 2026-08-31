import { Order } from "../types/Order";
import { API_URL } from "../../../config/api";
import { mapTipificacionWinToTipoTrabajo, matchWithCatalog, TIPOS_TRABAJO_CATALOGO } from "../utils/tipoTrabajoMapper";
import { extractCuadrillaMemberName } from "../utils/cuadrillaUtils";

export interface TecnicoOption {
  idTecnico: number | string;
  nombreCompleto: string;
  cuadrilla?: string;
  telefono?: string;
}

/**
 * Normaliza el estado de una orden proveniente de BD/Scraping/Fenix
 */
export const normalizeOrderStatus = (rawStatus?: string): string => {
  if (!rawStatus) return "Agendada";
  return rawStatus.trim();
};

/**
 * Formatea fechas procedentes de MySQL/JSON a string legible solo fecha "YYYY-MM-DD"
 */
export const formatFechaOrden = (val: any): string => {
  if (!val) return "";
  if (typeof val === "string") {
    const s = val.trim();
    // Si viene en formato DD/MM/YYYY o DD-MM-YYYY
    if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(s)) {
      const parts = s.split(/[\/\-\s:]/);
      const day = parts[0].padStart(2, "0");
      const month = parts[1].padStart(2, "0");
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
    // Si viene con ISO T (ej. 2026-08-19T08:30:00.000Z) o con espacio (ej. 2026-08-19 16:00:00)
    return s.split("T")[0].split(" ")[0];
  }
  if (val instanceof Date || (typeof val === "object" && typeof val.getFullYear === "function")) {
    const pad = (n: number) => String(n).padStart(2, "0");
    const y = val.getFullYear();
    const m = pad(val.getMonth() + 1);
    const d = pad(val.getDate());
    return `${y}-${m}-${d}`;
  }
  return String(val).split("T")[0].split(" ")[0];
};

/**
 * Extrae solo la hora en formato HH:mm (Hora local de Perú)
 */
export const formatHora = (val: any): string => {
  if (!val) return "";
  if (typeof val === "string") {
    const s = val.trim();
    if (!s) return "";

    // 1. Si viene en formato ISO con 'Z' (ej: "2026-08-19T17:57:12.000Z" -> 12:57 Perú)
    if (s.includes("T") && (s.endsWith("Z") || s.includes("+00"))) {
      const d = new Date(s);
      if (!isNaN(d.getTime())) {
        const hh = String(d.getHours()).padStart(2, "0");
        const mm = String(d.getMinutes()).padStart(2, "0");
        return `${hh}:${mm}`;
      }
    }

    // 2. Si viene con AM/PM (ej: "8/19/2026 1:11:05 PM", "12:57:12 PM", "2:37:33 PM")
    const ampmMatch = s.match(/(?:^|\s)(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM|am|pm)/i);
    if (ampmMatch) {
      let h = parseInt(ampmMatch[1], 10);
      const m = ampmMatch[2];
      const mer = ampmMatch[3].toUpperCase();
      if (mer === "PM" && h < 12) h += 12;
      if (mer === "AM" && h === 12) h = 0;
      return `${String(h).padStart(2, "0")}:${m}`;
    }

    // 3. Si viene como "YYYY-MM-DD HH:mm:ss" o "HH:mm:ss"
    const match = s.match(/(?:^|\s|T)(\d{1,2}):(\d{2})/);
    if (match) {
      return `${match[1].padStart(2, "0")}:${match[2]}`;
    }

    return s.substring(0, 5);
  }
  if (val instanceof Date || (typeof val === "object" && typeof val.getHours === "function")) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(val.getHours())}:${pad(val.getMinutes())}`;
  }
  return String(val);
};

/**
 * Extrae el CTO del texto técnico ej: 'CTO/Alfanumérico/W-35PN21-25;'
 */
const extractCTO = (datosTecnicos?: string): string => {
  if (!datosTecnicos) return "";
  const match = datosTecnicos.match(/CTO\/[^\/]*\/([^;]+)/i);
  return match && match[1] ? match[1].trim() : "";
};

/**
 * Limpia el texto de región/zona para dejar únicamente el nombre del distrito
 * Ej: "REGION SUR 5 LIMA CHORRILLOS" -> "CHORRILLOS"
 *     "REGION SUR 6 LIMA LURÍN" -> "LURÍN"
 */
export const cleanDistrito = (rawDistrito?: string): string => {
  if (!rawDistrito) return "";
  let d = rawDistrito.trim();

  // Quitar patrones como "REGION SUR 5 LIMA", "REGION NORTE 2 LIMA", "REGION CENTRO LIMA", etc.
  d = d.replace(/^REGION\s+(SUR|NORTE|CENTRO|ESTE|OESTE)?\s*\d*\s*LIMA\s*/i, "");
  // Quitar "LIMA " al inicio
  d = d.replace(/^LIMA\s*[-–:]*\s*/i, "");
  // Quitar "REGION " genérico
  d = d.replace(/^REGION\s+\d*\s*/i, "");

  return d.trim().toUpperCase();
};

/**
 * Calcula el Tramo horario a partir de la Fecha de Solicitud (o Fecha de Visita) de Fénix
 * - 08:00 (8:00 AM)  -> "08:00 - 12:00"
 * - 12:00 (12:00 PM) -> "12:00 - 16:00"
 * - 16:00 (4:00 PM)  -> "16:00 - 20:00"
 */
export const calculateTramo = (val?: any): string => {
  if (!val) return "-";
  const s = String(val).trim();
  if (!s || s === "-" || s === "null" || s === "undefined") return "-";

  let hour = -1;

  // 1. Si viene en formato ISO con 'Z' o zona horaria
  if (s.includes("T") && (s.endsWith("Z") || s.includes("+00"))) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      hour = d.getHours();
    }
  }

  // 2. Si viene con formato AM/PM (ej: "19/08/2026 8:00:00 AM", "12:00 PM", "4:00 PM")
  if (hour === -1) {
    const ampmMatch = s.match(/(?:^|\s|T)(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM|am|pm)?/i);
    if (ampmMatch) {
      let h = parseInt(ampmMatch[1], 10);
      const mer = (ampmMatch[3] || "").toUpperCase();
      if (mer === "PM" && h < 12) h += 12;
      if (mer === "AM" && h === 12) h = 0;
      hour = h;
    }
  }

  // 3. Si viene como "YYYY-MM-DD HH:mm:ss" o "DD/MM/YYYY HH:mm"
  if (hour === -1) {
    const match = s.match(/(?:^|\s|T)(\d{1,2}):(\d{2})/);
    if (match) {
      hour = parseInt(match[1], 10);
    }
  }

  if (hour === -1 || isNaN(hour)) return "-";

  // Clasificación en los tramos de trabajo:
  // 1. Tramo Mañana (8am a 12pm)
  if (hour >= 6 && hour < 12) {
    return "08:00 - 12:00";
  }
  // 2. Tramo Tarde 1 (12pm a 4pm)
  if (hour >= 12 && hour < 16) {
    return "12:00 - 16:00";
  }
  // 3. Tramo Tarde 2 (4pm a 8pm)
  if (hour >= 16 && hour <= 22) {
    return "16:00 - 20:00";
  }

  const endHour = (hour + 4) % 24;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hour)}:00 - ${pad(endHour)}:00`;
};

/**
 * 🚀 1. Obtener lista completa de órdenes desde la API
 */
export const getOrders = async (filters?: { fechaDesde?: string; fechaHasta?: string }): Promise<Order[]> => {
  try {
    const params = new URLSearchParams();
    params.set("t", String(new Date().getTime()));
    if (filters?.fechaDesde) params.set("fechaDesde", filters.fechaDesde);
    if (filters?.fechaHasta) params.set("fechaHasta", filters.fechaHasta);

    const response = await fetch(`${API_URL}/ordenes?${params.toString()}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Error en el servidor: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) return [];

    const normalizeClientName = (str?: string): string => {
      if (!str) return "";
      return String(str)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    };

    // Mapeo en memoria para garantizar detección tanto de BD histórica como de la lista actual
    const clientCountMap = new Map<string, number>();
    data.forEach((raw: any) => {
      const c = normalizeClientName(raw.cliente);
      if (c && c !== "sin cliente") {
        clientCountMap.set(c, (clientCountMap.get(c) || 0) + 1);
      }
    });

    return data.map((raw: any, index: number): Order => {
      const orderId = Number(raw.id_orden || raw.id || raw.ID || index + 1);
      const numeroOrden = String(raw.numero || raw.ticket || raw.numero_orden || raw.id_orden || `ORD-${orderId}`);
      // N° Ticket = Código de seguimiento (VT-46635497, AT-46606997, WN-22N-1340431)
      const ticket = String(raw.codigo_seguimiento || raw.codigoSeguimiento || raw.ot || numeroOrden);
      // OT = Número numérico de la orden (3367633, 3367728)
      const ot = numeroOrden;
      
      const rawInconcert = raw.llamada_inconcert || raw.inconcert;
      const isInconcert = 
        rawInconcert === "Si" || 
        rawInconcert === "SI" || 
        rawInconcert === "Sí" || 
        rawInconcert === 1 || 
        rawInconcert === true || 
        rawInconcert === "1" || 
        rawInconcert === "true";

      const rawDate = raw.fecha_visita || raw.fecha_solicitud || raw.fechavisita || raw.fecha || raw.fecha_creacion || raw.created_at || raw.fecha_registro || "";

      // Detección de cliente reiterado / repetido en la base de datos
      const clientKey = normalizeClientName(raw.cliente);
      const countDB = Number(raw.total_ordenes_cliente || (raw.es_reiterada ? 2 : 1));
      const countMemory = clientCountMap.get(clientKey) || 1;
      const totalOrdenes = Math.max(countDB, countMemory);
      const esReiterada = (totalOrdenes > 1 || Boolean(raw.es_reiterada)) && clientKey !== "sin cliente" && clientKey !== "";

        const rawMotivoLiq = String(raw.motivo_liquidacion || raw.tipo_liquidacion || raw.motivo_finalizacion || raw.motivo_de_finalizacion || raw.motivo_cancelacion || raw.motivo_regestion || raw.motivo_anulacion || "").trim();
        const rawTipoTrabajo = String(raw.tipo_trabajo || "").trim();
        const rawTipoTrabajoAsignado = String(raw.tipo_trabajo_asignado || "").trim();
        const rawAveria = String(raw.motivo_trabajo || raw.tipo_averia || raw.motivo || raw.averia || "").trim();

        const rawStatus = String(raw.estado || raw.status || "").toLowerCase().trim();
        const isFinalizada = rawStatus.includes("finaliz") || rawStatus.includes("liquid") || rawStatus.includes("termin") || rawStatus.includes("cerrad") || rawStatus.includes("fenix");

        // 1. Verificamos si raw.tipo_trabajo ya coincide con un tipo oficial de la tabla tipos_trabajo
        const matchedTipoTrabajo = matchWithCatalog(rawTipoTrabajo);
        // 2. Si no, emparejamos automáticamente usando el motivo de liquidación y la avería
        const autoPairedTipoTrabajo = mapTipificacionWinToTipoTrabajo(rawMotivoLiq, `${rawAveria} ${rawTipoTrabajo}`) || "";
        
        let finalTipoTrabajo = "";
        // Regla: Solo poner Tipo de Trabajo en órdenes FINALIZADAS; en el resto dejar en blanco
        if (isFinalizada) {
          if (matchedTipoTrabajo) {
            finalTipoTrabajo = matchedTipoTrabajo;
          } else if (autoPairedTipoTrabajo) {
            finalTipoTrabajo = autoPairedTipoTrabajo;
          } else {
            finalTipoTrabajo = rawTipoTrabajo || rawTipoTrabajoAsignado || "";
          }
        } else {
          finalTipoTrabajo = "";
        }

        return {
          id: orderId,
          fecha: formatFechaOrden(rawDate),
          celular: String(raw.movil || raw.celular || raw.telefono || raw.telefono_cliente || raw.telefono1 || ""),
          inconcert: isInconcert,
          ticket: ticket,
          codigoPedido: String(raw.cod_seguimiento_cliente || raw.codigo_pedido || raw.codSeguimientoCliente || raw.codigoPedido || "").trim(),
          ot: ot,
          numeroOrden: numeroOrden,
          cliente: String(raw.cliente || raw.nombre_cliente || raw.razon_social || "Sin Cliente").toUpperCase(),
          tecnico: (() => {
            const rawTec = String(raw.nombre_tecnico || raw.tecnico || raw.tecnico_asignado || raw.nombre_tecnico_usuario || "").trim();
            if (rawTec && rawTec !== "-" && rawTec !== "-- Seleccione --" && rawTec !== "-- Seleccionar --") {
              return rawTec;
            }
            const rawCuad = String(raw.cuadrilla || raw.nombre_cuadrilla || "").trim();
            return extractCuadrillaMemberName(rawCuad) || "";
          })(),
          idTecnico: raw.id_tecnico || raw.id_trabajador || undefined,
          horaAsignacion: formatHora(raw.hora_asignacion || raw.fecha_solicitud),
          horaEnCamino: formatHora(raw.hora_en_camino),
          horaInicio: formatHora(raw.inicio_visita || raw.hora_inicio),
          horaFin: formatHora(raw.fin_visita || raw.hora_fin),
          tramo: raw.tramo && raw.tramo !== "-" && raw.tramo !== ""
            ? String(raw.tramo)
            : calculateTramo(raw.fecha_solicitud || raw.fechasolicitud || raw.fecha_visita || raw.fechavisita || raw.fecha),
          status: normalizeOrderStatus(raw.estado || raw.status || raw.estado_orden),
          cuadrilla: String(raw.cuadrilla || raw.nombre_cuadrilla || ""),
          tipoAveria: String(raw.motivo_trabajo || raw.tipo_averia || raw.motivo || raw.averia || ""),
          tipoTrabajoAsignado: rawTipoTrabajoAsignado || autoPairedTipoTrabajo || "",
          tipoTrabajo: finalTipoTrabajo,
          dni: String(raw.numero_documento || raw.dni || raw.documento || raw.ruc || ""),
          direccion: String(raw.direccion || raw.direccion_instalacion || ""),
          distrito: cleanDistrito(raw.region_zona || raw.distrito || raw.localidad || ""),
          cto: extractCTO(raw.datos_tecnicos) || String(raw.cto || ""),
          cajaPosicionPasivo: String(raw.caja_posicion_pasivo || raw.caja_pasivo || raw.caja || ""),
          acta: String(raw.numero_acta || raw.acta || ""),
          totalDrop: raw.total_drop || raw.totalDrop || raw.drop_metros || 0,
          anchoBanda: String(raw.suscripcion || raw.ancho_banda || raw.anchoBanda || ""),
          observacionesAtencion: String(raw.observaciones_atencion || raw.observacionesAtencion || raw.observacion_atencion || raw.observacion || raw.observaciones || ""),
          observacionLlamada: String(raw.observacion_llamada || raw.motivo_llamada || ""),
          motivoFinalizacion: String(raw.motivo_finalizacion || raw.motivo_de_finalizacion || ""),
          motivoCancelacion: String(raw.motivo_cancelacion || raw.motivo_de_cancelacion || ""),
          motivoRegestion: String(raw.motivo_regestion || raw.motivo_de_regestion || ""),
          motivoAnulacion: String(raw.motivo_anulacion || raw.motivo_de_anulacion || ""),
          motivoLiquidacion: rawMotivoLiq,
          tipoLiquidacion: rawMotivoLiq,
          esReiterada: esReiterada,
          totalOrdenesCliente: totalOrdenes,
          esReiteradaTecnico: Boolean(raw.es_reiterada_tecnico),
          totalOrdenesMismoTecnico: Number(raw.total_ordenes_mismo_tecnico || 1),
          georeferencia: String(raw.georeferencia || raw.geolocalizacion || raw.coordenadas || "").trim(),
        };
    });
  } catch (error) {
    console.error("Error al obtener órdenes de la API:", error);
    throw error;
  }
};

/**
 * 🚀 2. Obtener lista de técnicos disponibles para el selector
 */
export const getTecnicos = async (): Promise<TecnicoOption[]> => {
  try {
    const response = await fetch(`${API_URL}/tecnicos?t=${new Date().getTime()}`, {
      cache: "no-store",
    });
    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data)) return [];

    return data.map((t: any) => ({
      idTecnico: t.id_tecnico || t.id_trabajador || t.id_usuario,
      nombreCompleto: String(t.nombre_completo || t.nombres || "").trim(),
      cuadrilla: t.cuadrilla || "",
      telefono: t.telefono || "",
    }));
  } catch (error) {
    console.error("Error al obtener lista de técnicos:", error);
    return [];
  }
};

/**
 * 🚀 3. Asignar técnico a una orden en BD
 */
export const updateOrderTecnico = async (
  orderId: number | string,
  tecnicoNombre: string,
  idTecnico?: number | string,
  numero?: string
) => {
  const response = await fetch(`${API_URL}/ordenes/${orderId}/tecnico`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id_tecnico: idTecnico || null,
      tecnico: tecnicoNombre,
      numero: numero || String(orderId)
    }),
  });
  if (!response.ok) throw new Error("Error al asignar técnico en la base de datos");
  return await response.json();
};

/**
 * 🚀 4. Guardar / Alternar llamada Inconcert en BD
 */
export const updateOrderInconcert = async (
  orderId: number | string,
  inconcert: boolean | string,
  numero?: string
) => {
  const isSi = 
    inconcert === true || 
    inconcert === "Si" || 
    inconcert === "SI" || 
    inconcert === "Sí" || 
    inconcert === ("1" as any) ||
    inconcert === (1 as any);

  const valStr = isSi ? "Si" : "No";

  const response = await fetch(`${API_URL}/ordenes/${orderId}/inconcert`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      llamada_inconcert: valStr, 
      inconcert: valStr,
      numero: numero || String(orderId)
    }),
  });
  if (!response.ok) throw new Error("Error al actualizar estado Inconcert en la base de datos");
  return await response.json();
};

/**
 * 🚀 4.1 Guardar Observación de Llamada en BD
 */
export const updateOrderObservacionLlamada = async (
  orderId: number | string,
  observacion: string,
  numero?: string
) => {
  const response = await fetch(`${API_URL}/ordenes/${orderId}/observacion-llamada`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      observacionLlamada: observacion,
      numero: numero || String(orderId)
    }),
  });
  if (!response.ok) throw new Error("Error al actualizar observación de llamada");
  return await response.json();
};

/**
 * 🚀 4.1.1 Guardar Observaciones de la Atención en BD
 */
export const updateOrderObservacionesAtencion = async (
  orderId: number | string,
  observacion: string,
  numero?: string
) => {
  const response = await fetch(`${API_URL}/ordenes/${orderId}/observaciones-atencion`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      observacionesAtencion: observacion,
      numero: numero || String(orderId)
    }),
  });
  if (!response.ok) throw new Error("Error al actualizar observaciones de la atención");
  return await response.json();
};

/**
 * 🚀 4.2 Obtener catálogo de Tipos de Trabajo
 */
export const getTiposTrabajo = async (): Promise<string[]> => {
  try {
    const response = await fetch(`${API_URL}/tipos-trabajo?t=${new Date().getTime()}`, {
      cache: "no-store",
    });
    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data)) return [];

    const nombres = data
      .map((item: any) => String(item.nombre || item.tipo_trabajo || item.descripcion || "").trim())
      .filter((n: string) => n.length > 0);

    return Array.from(new Set(nombres));
  } catch (error) {
    console.error("Error al obtener tipos de trabajo:", error);
    return [];
  }
};

/**
 * 🚀 4.3 Actualizar Tipo de Trabajo de una orden en BD
 */
export const updateOrderTipoTrabajo = async (
  orderId: number | string,
  tipoTrabajo: string,
  numero?: string
) => {
  const response = await fetch(`${API_URL}/ordenes/${orderId}/tipo-trabajo`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      tipoTrabajo,
      numero: numero || String(orderId)
    }),
  });
  if (!response.ok) throw new Error("Error al actualizar tipo de trabajo");
  return await response.json();
};

/**
 * 🚀 5. Sincronizar órdenes directamente con WIN / Fénix desde la API
 */
export const syncOrdersFromWin = async (fechaDesde?: string, fechaHasta?: string) => {
  const response = await fetch(`${API_URL}/ordenes/sincronizar-win`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fechaDesde, fechaHasta }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error || "Error al sincronizar con WIN / Fénix");
  }
  return await response.json();
};

/**
 * 🚀 6. Obtener tareas en tiempo real de una orden (Modal Fénix)
 */
export interface OrderTask {
  index: number;
  id: string;
  titulo: string;
  estado: string;
  imagen_base64?: string | null;
}

export interface TaskDetail {
  coordenadas_inicio?: { gd: string; gms: string };
  coordenadas_fin?: { gd: string; gms: string };
  descripcion?: string;
  tiempos?: {
    estimado?: string;
    inicio?: string;
    fin?: string;
    duracion?: string;
    motivo?: string;
  };
  fotografias?: Array<{
    titulo: string;
    imagen: string;
  }>;
}

// ⚡ Caché en memoria para tareas e historial de Fénix (Apertura Instantánea a 0ms)
const tasksCache = new Map<string, { ordeVisiId: string | null; tareas: OrderTask[]; timestamp: number }>();
const historyCache = new Map<string, { historial: OrderStatusHistoryItem[]; timestamp: number }>();

const PROGRESS_STORAGE_KEY = "fenix_tasks_progress_map";

export const getStoredTasksProgressMap = (): Record<string, { total: number; done: number; pct: number }> => {
  try {
    const raw = sessionStorage.getItem(PROGRESS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const saveTaskProgress = (key: string, progress: { total: number; done: number; pct: number }) => {
  try {
    if (!key) return;
    const current = getStoredTasksProgressMap();
    current[String(key)] = progress;
    sessionStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Silencioso
  }
};

export const getCachedOrderTasks = (numeroTicket: string): { ordeVisiId: string | null; tareas: OrderTask[] } | null => {
  if (!numeroTicket) return null;
  const cached = tasksCache.get(String(numeroTicket));
  return cached ? { ordeVisiId: cached.ordeVisiId, tareas: cached.tareas } : null;
};

export const getCachedOrderStatusHistory = (numeroTicket: string): OrderStatusHistoryItem[] | null => {
  if (!numeroTicket) return null;
  const cached = historyCache.get(String(numeroTicket));
  return cached ? cached.historial : null;
};

export const getOrderTasks = async (
  numeroTicket: string,
  options?: { forceFresh?: boolean; signal?: AbortSignal }
): Promise<{ ordeVisiId: string | null; tareas: OrderTask[] }> => {
  const key = String(numeroTicket);
  const cached = tasksCache.get(key);

  // Si tenemos caché reciente (menos de 60 segundos) y no se fuerza recarga, devolver inmediatamente
  if (cached && !options?.forceFresh && Date.now() - cached.timestamp < 60000) {
    return { ordeVisiId: cached.ordeVisiId, tareas: cached.tareas };
  }

  try {
    const response = await fetch(`${API_URL}/ordenes/${numeroTicket}/tareas`, {
      signal: options?.signal,
    });
    if (!response.ok) {
      if (cached) return { ordeVisiId: cached.ordeVisiId, tareas: cached.tareas };
      throw new Error("Error al obtener las tareas de la orden");
    }
    const data = await response.json();
    const result = {
      ordeVisiId: data.ordeVisiId || null,
      tareas: data.tareas || []
    };

    tasksCache.set(key, { ...result, timestamp: Date.now() });
    return result;
  } catch (err: any) {
    if (cached) return { ordeVisiId: cached.ordeVisiId, tareas: cached.tareas };
    throw err;
  }
};

/**
 * 🚀 7. Obtener detalle de una tarea (coordenadas, fotos, tiempos)
 */
export const getTaskDetail = async (idTarea: string, index: number): Promise<TaskDetail | null> => {
  const response = await fetch(`${API_URL}/ordenes/tarea-detalle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idTarea, index }),
  });
  if (!response.ok) throw new Error("Error al consultar el detalle de la tarea");
  const data = await response.json();
  return data.detalle || null;
};

/**
 * 🚀 7.1 Obtener Imagen HD de una tarea (Fénix ObtenerImagen)
 */
export const getTaskImage = async (dataId: string | number): Promise<string | null> => {
  try {
    const response = await fetch(`${API_URL}/ordenes/tarea-imagen`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataId }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.success ? data.imagen : null;
  } catch (error) {
    console.error("Error al obtener imagen HD:", error);
    return null;
  }
};

/**
 * 🚀 8. Obtener Historial de Estados (CargarHistoEstaGrilla)
 */
export interface OrderStatusHistoryItem {
  fecha: string;
  estado: string;
  duracion?: string;
  usuario?: string;
  datosAdicionales?: string;
  observaciones?: string;
}

export const getOrderStatusHistory = async (
  numeroTicket: string,
  options?: { forceFresh?: boolean; signal?: AbortSignal }
): Promise<OrderStatusHistoryItem[]> => {
  const key = String(numeroTicket);
  const cached = historyCache.get(key);

  if (cached && !options?.forceFresh && Date.now() - cached.timestamp < 60000) {
    return cached.historial;
  }

  try {
    const response = await fetch(`${API_URL}/ordenes/${numeroTicket}/historial-estados`, {
      signal: options?.signal,
    });
    if (!response.ok) return cached ? cached.historial : [];
    const data = await response.json();
    const list = data.historial || [];
    historyCache.set(key, { historial: list, timestamp: Date.now() });
    return list;
  } catch (e) {
    return cached ? cached.historial : [];
  }
};

/**
 * 🛡️ 9. Registrar log de auditoría en segundo plano
 */
export const registrarLogAuditoria = async (data: {
  id_usuario?: string | number | null;
  usuario_nombre?: string;
  rol_nombre?: string;
  area?: string;
  modulo: string;
  accion: string;
  id_referencia?: string | number;
  descripcion: string;
}) => {
  try {
    await fetch(`${API_URL}/auditoria/registrar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch (e) {
    console.warn("Aviso al registrar log de auditoría:", e);
  }
};


