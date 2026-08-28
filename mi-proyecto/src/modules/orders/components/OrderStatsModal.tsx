import React, { useState, useMemo, useEffect } from "react";
import {
  X,
  Clock,
  Navigation,
  PlayCircle,
  CheckCircle2,
  AlertTriangle,
  User,
  Users,
  FileText,
  MapPin,
  Calendar,
  Gauge,
  ArrowRight,
  TrendingUp,
  Activity,
  Copy,
  Check,
  CalendarRange,
  Zap,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { Order } from "../types/Order";
import { getBadgeColorByStatus, getRowColorByStatus } from "../utils/statusColors";
import { extractCuadrillaKey, isSameCuadrilla, extractCuadrillaMemberName } from "../utils/cuadrillaUtils";
import { getOrderTasks } from "../services/orderService";

interface OrderStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  allOrders?: Order[];
  onViewTasks?: (order: Order) => void;
  initialTasksProgress?: Record<string, { total: number; done: number; pct: number }>;
}

/**
 * Normaliza texto quitando tildes, caracteres especiales y espacios dobles
 */
const normalizeText = (text?: string): string => {
  if (!text) return "";
  return text
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-_.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * Normaliza cualquier formato de fecha a "YYYY-MM-DD"
 */
const getCleanDate = (fechaStr?: string): string => {
  if (!fechaStr) return "";
  const s = String(fechaStr).trim();
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(s)) {
    const parts = s.split(/[\/\-\s:]/);
    return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
  }
  return s.split("T")[0].split(" ")[0];
};

/**
 * Convierte un string de hora (HH:mm o HH:mm:ss o AM/PM) a minutos desde las 00:00
 */
const timeToMinutes = (timeStr?: string): number | null => {
  if (!timeStr || timeStr === "-" || timeStr.trim() === "") return null;
  const s = timeStr.trim();

  // AM/PM
  const ampmMatch = s.match(/(?:^|\s)(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM|am|pm)/i);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10);
    const m = parseInt(ampmMatch[2], 10);
    const mer = ampmMatch[3].toUpperCase();
    if (mer === "PM" && h < 12) h += 12;
    if (mer === "AM" && h === 12) h = 0;
    return h * 60 + m;
  }

  // 24h format
  const match = s.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  return h * 60 + m;
};

/**
 * Calcula la diferencia en minutos entre dos horas (timeA a timeB)
 */
const diffMinutes = (timeA?: string, timeB?: string): number | null => {
  const minA = timeToMinutes(timeA);
  const minB = timeToMinutes(timeB);
  if (minA === null || minB === null) return null;
  let diff = minB - minA;
  if (diff < 0) diff += 24 * 60;
  return diff;
};

/**
 * Formatea minutos a formato legible (ej: "1 hs, 25 min" o "45 min")
 */
const formatDuration = (minutes: number | null): string => {
  if (minutes === null) return "Sin registro";
  if (minutes === 0) return "0 min";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hs`;
  return `${h} hs, ${m} min`;
};

/**
 * Formatea minutos desde 00:00 a HH:mm
 */
const minutesToHourStr = (minutes: number): string => {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

/**
 * Obtiene el código de tramo abreviado (AM1, AM2, PM1, PM2)
 */
const getTramoTag = (tramo?: string): string => {
  if (!tramo) return "OT";
  const t = tramo.toLowerCase();
  if (t.includes("08:") || t.includes("8:") || t.includes("09:") || t.includes("10:")) return "AM1";
  if (t.includes("12:") || t.includes("13:") || t.includes("14:")) return "AM2";
  if (t.includes("16:") || t.includes("17:") || t.includes("18:")) return "PM1";
  if (t.includes("20:") || t.includes("21:")) return "PM2";
  return "OT";
};

/**
 * Calcula el rango de tiempo de inicio y fin para el gráfico Gantt
 */
const calculateGanttTimeRange = (o: Order, index: number) => {
  const realInicio = timeToMinutes(o.horaInicio);
  const realCamino = timeToMinutes(o.horaEnCamino);
  const realFin = timeToMinutes(o.horaFin);

  let tramoStart: number | null = null;
  let tramoEnd: number | null = null;

  if (o.tramo) {
    const tramoMatch = o.tramo.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
    if (tramoMatch) {
      tramoStart = parseInt(tramoMatch[1], 10) * 60 + parseInt(tramoMatch[2], 10);
      tramoEnd = parseInt(tramoMatch[3], 10) * 60 + parseInt(tramoMatch[4], 10);
    } else {
      const singleMatch = o.tramo.match(/(\d{1,2}):(\d{2})/);
      if (singleMatch) {
        tramoStart = parseInt(singleMatch[1], 10) * 60 + parseInt(singleMatch[2], 10);
        tramoEnd = tramoStart + 120;
      }
    }
  }

  // 1. Hora de Inicio en el Gantt:
  let startM: number;
  if (realInicio !== null) {
    startM = realInicio;
  } else if (realCamino !== null) {
    startM = realCamino;
  } else if (tramoStart !== null) {
    startM = tramoStart;
  } else {
    // Si tiene hora de asignación diurna (entre 08:00 y 19:00)
    const asigM = timeToMinutes(o.horaAsignacion);
    if (asigM !== null && asigM >= 8 * 60 && asigM <= 19 * 60) {
      startM = asigM;
    } else {
      // Distribución por índice
      startM = 8 * 60 + ((index * 90) % (11 * 60));
    }
  }

  // 2. Hora de Fin en el Gantt:
  let endM: number;
  if (realFin !== null) {
    endM = realFin;
  } else if (tramoEnd !== null && tramoEnd > startM) {
    endM = tramoEnd;
  } else {
    endM = startM + 75; // Duración estándar 1h 15m
  }

  if (endM <= startM) {
    endM = startM + 60;
  }

  return { startM, endM };
};

export const OrderStatsModal: React.FC<OrderStatsModalProps> = ({
  isOpen,
  onClose,
  order,
  allOrders = [],
  onViewTasks,
  initialTasksProgress = {},
}) => {
  const [activeTab, setActiveTab] = useState<"orden" | "gantt">("gantt");
  const [groupBy, setGroupBy] = useState<"tecnico" | "cuadrilla">("cuadrilla");
  const [copied, setCopied] = useState<boolean>(false);
  const [activeOrder, setActiveOrder] = useState<Order | null>(order);

  // Sincronizar activeOrder al abrir o cambiar la orden de entrada
  useEffect(() => {
    if (order) {
      setActiveOrder(order);
    }
  }, [order]);

  // Hora actual en vivo con actualización automática cada 10 segundos
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    if (!isOpen) return;
    const clockInterval = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(clockInterval);
  }, [isOpen]);

  // Escala horaria para el Gantt (08:00 a 21:00)
  const startHour = 8;
  const endHour = 21;
  const totalHours = endHour - startHour;
  const totalMinutes = totalHours * 60;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const currentHourStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const currentPercent = Math.max(
    0,
    Math.min(100, ((currentMinutes - startHour * 60) / totalMinutes) * 100)
  );

  // Filtrar órdenes del día según el modelo seleccionado (Por Cuadrilla o Por Técnico)
  const timelineOrders = useMemo(() => {
    const current = activeOrder || order;
    if (!current) return [];
    if (!allOrders || allOrders.length === 0) return [current];

    const targetDate = getCleanDate(current.fecha);
    const targetTec = normalizeText(current.tecnico);
    const targetCuad = normalizeText(current.cuadrilla);

    if (groupBy === "tecnico") {
      const hasTec = Boolean(
        targetTec &&
        targetTec !== "SELECCIONE" &&
        targetTec !== "SIN ASIGNAR" &&
        targetTec !== "-" &&
        targetTec.length > 2
      );

      if (!hasTec) return [current];

      const matched = allOrders.filter((o) => {
        const oDate = getCleanDate(o.fecha);
        if (targetDate && oDate && targetDate !== oDate) return false;
        const oTec = normalizeText(o.tecnico);
        return oTec === targetTec || oTec.includes(targetTec) || targetTec.includes(oTec);
      });

      // Ordenar cronológicamente
      matched.sort((a, b) => {
        const tA = calculateGanttTimeRange(a, 0).startM;
        const tB = calculateGanttTimeRange(b, 0).startM;
        return tA - tB;
      });

      return matched.length > 0 ? matched : [current];
    } else {
      // 👥 Agrupación por Cuadrilla de WIN / Fénix (diferenciando por prefijo + descriptor: ej. K 5 CESPEDES vs K 5 TRASLADO)
      const targetCuadKey = extractCuadrillaKey(current.cuadrilla);

      // Si no tiene cuadrilla explícita, intentamos agrupar por el técnico de la cuadrilla
      if (!targetCuadKey) {
        if (targetTec && targetTec !== "SELECCIONE" && targetTec.length > 2) {
          const matched = allOrders.filter((o) => {
            const oDate = getCleanDate(o.fecha);
            if (targetDate && oDate && targetDate !== oDate) return false;
            return normalizeText(o.tecnico) === targetTec;
          });
          return matched.length > 0 ? matched : [current];
        }
        return [current];
      }

      const matched = allOrders.filter((o) => {
        const oDate = getCleanDate(o.fecha);
        if (targetDate && oDate && targetDate !== oDate) return false;

        // Coincidencia estricta de la cuadrilla (K 5 CESPEDES solo con K 5 CESPEDES)
        return isSameCuadrilla(o.cuadrilla, current.cuadrilla);
      });

      // Ordenar cronológicamente según hora de inicio calculada
      matched.sort((a, b) => {
        const tA = calculateGanttTimeRange(a, 0).startM;
        const tB = calculateGanttTimeRange(b, 0).startM;
        return tA - tB;
      });

      return matched.length > 0 ? matched : [current];
    }
  }, [activeOrder, order, allOrders, groupBy]);

  // 🚀 Mapa reactivo de progreso de tareas de Fénix (para mostrar el % exacto de tareas en las barras del Gantt)
  const [tasksProgressMap, setTasksProgressMap] = useState<Record<string, { total: number; done: number; pct: number }>>(initialTasksProgress || {});

  // Sincronizar si entran nuevos datos pre-cargados
  useEffect(() => {
    if (initialTasksProgress && Object.keys(initialTasksProgress).length > 0) {
      setTasksProgressMap((prev) => ({ ...initialTasksProgress, ...prev }));
    }
  }, [initialTasksProgress]);

  useEffect(() => {
    if (!isOpen || timelineOrders.length === 0) return;

    let isMounted = true;
    const fetchTasksProgress = () => {
      const activeOrders = timelineOrders.filter((o) => {
        const st = (o.status || "").toLowerCase();
        return st.includes("inicia") || st.includes("camino") || st.includes("proceso") || st.includes("finaliz");
      });

      if (activeOrders.length === 0) return;

      Promise.allSettled(
        activeOrders.map(async (o) => {
          // En Fénix, la búsqueda de tareas funciona por número de orden / OT
          const orderNum = o.numeroOrden || o.ot || o.ticket;
          if (!orderNum) return null;
          try {
            const res = await getOrderTasks(orderNum);
            const tareas = res.tareas || [];
            const done = tareas.filter((t) => {
              const raw = (t.estado || "").toLowerCase().trim();
              return raw.includes("finaliz") || raw.includes("realiz") || raw.includes("complet");
            }).length;
            const total = tareas.length;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            return { id: o.id, ot: o.ot, ticket: o.ticket, numeroOrden: o.numeroOrden, data: { total, done, pct } };
          } catch {
            return null;
          }
        })
      ).then((results) => {
        if (!isMounted) return;
        const newMap: Record<string, { total: number; done: number; pct: number }> = {};
        results.forEach((r) => {
          if (r.status === "fulfilled" && r.value) {
            const v = r.value;
            if (v.id) newMap[String(v.id)] = v.data;
            if (v.ot) newMap[String(v.ot)] = v.data;
            if (v.ticket) newMap[String(v.ticket)] = v.data;
            if (v.numeroOrden) newMap[String(v.numeroOrden)] = v.data;
          }
        });
        setTasksProgressMap((prev) => ({ ...prev, ...newMap }));
      });
    };

    // Carga inmediata
    fetchTasksProgress();

    // ⚡ Sondeo automático cada 30 segundos para mantener el % y las tareas siempre al día
    const progressInterval = setInterval(fetchTasksProgress, 30000);

    return () => {
      isMounted = false;
      clearInterval(progressInterval);
    };
  }, [isOpen, timelineOrders]);

  if (!isOpen || (!activeOrder && !order)) return null;

  const current = activeOrder || order!;
  const badgeColorClass = getBadgeColorByStatus(current.status);

  // Cálculos de tiempos y demoras de la orden activa
  const tiempoSalida = diffMinutes(current.horaAsignacion, current.horaEnCamino);
  const tiempoTraslado = diffMinutes(current.horaEnCamino, current.horaInicio);
  const tiempoTrabajo = diffMinutes(current.horaInicio, current.horaFin);
  const tiempoOperativo = diffMinutes(current.horaEnCamino, current.horaFin); // 🚀 Tiempo total desde que salió hasta que finalizó
  const tiempoTotal = diffMinutes(current.horaAsignacion, current.horaFin);

  // Verificación de cumplimiento de tramo
  let cumplimientoTramo: { cumplio: boolean | null; mensaje: string } = {
    cumplio: null,
    mensaje: "Sin tramo especificado",
  };

  if (current.tramo && current.horaInicio) {
    const tramoMatch = current.tramo.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
    const inicioMin = timeToMinutes(current.horaInicio);

    if (tramoMatch && inicioMin !== null) {
      const tramoInicioMin = parseInt(tramoMatch[1], 10) * 60 + parseInt(tramoMatch[2], 10);
      const tramoFinMin = parseInt(tramoMatch[3], 10) * 60 + parseInt(tramoMatch[4], 10);

      if (inicioMin >= tramoInicioMin && inicioMin <= tramoFinMin) {
        cumplimientoTramo = {
          cumplio: true,
          mensaje: "¡Inició dentro del tramo horario agendado!",
        };
      } else if (inicioMin < tramoInicioMin) {
        cumplimientoTramo = {
          cumplio: true,
          mensaje: `Llegó antes del tramo (${formatDuration(tramoInicioMin - inicioMin)} antes)`,
        };
      } else {
        cumplimientoTramo = {
          cumplio: false,
          mensaje: `Llegó fuera de tramo (${formatDuration(inicioMin - tramoFinMin)} después)`,
        };
      }
    }
  }

  // Copiar reporte de tiempos
  const handleCopyReport = () => {
    const report = [
      `📊 *GESTIÓN DE CUADRILLA Y LÍNEA DE TIEMPO*`,
      `• OT: ${current.ot || current.ticket}`,
      `• Código de Pedido: ${current.codigoPedido || "-"}`,
      `• Cliente: ${current.cliente}`,
      `• Técnico: ${current.tecnico || "Sin Asignar"}`,
      `• Cuadrilla: ${current.cuadrilla || "-"}`,
      `• Estado: ${current.status}`,
      `• Tramo: ${current.tramo || "-"}`,
      ``,
      `⏱️ *HITOS DE TIEMPO:*`,
      `1. Asignación: ${current.horaAsignacion || "-"}`,
      `2. En Camino: ${current.horaEnCamino || "-"} (Demora en salir: ${formatDuration(tiempoSalida)})`,
      `3. Inicio Visita: ${current.horaInicio || "-"} (Traslado: ${formatDuration(tiempoTraslado)})`,
      `4. Fin Visita: ${current.horaFin || "-"} (Trabajo en sitio: ${formatDuration(tiempoTrabajo)})`,
      ``,
      `📈 *RESUMEN OPERATIVO:*`,
      `• Tiempo en Ruta a Fin (Operativo): ${formatDuration(tiempoOperativo)}`,
      `• Tiempo Total de Atención (Gestión): ${formatDuration(tiempoTotal)}`,
      `• Puntualidad: ${cumplimientoTramo.mensaje}`,
    ].join("\n");

    navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hoursArray = Array.from({ length: totalHours + 1 }, (_, i) => startHour + i);

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[94vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        
        {/* HEADER DEL MODAL */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-100 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 bg-indigo-500/20 text-indigo-300 rounded-lg border border-indigo-500/30">
                <Gauge className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                  <span>Línea de Tiempo & Control de Cuadrilla</span>
                </h3>
                <p className="text-xs text-slate-300 truncate max-w-[450px]">
                  Orden #{current.ot || current.ticket} • <strong className="text-white">{current.cliente}</strong>
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${badgeColorClass}`}>
              {current.status}
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Cerrar modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* TABS DE NAVEGACIÓN */}
        <div className="flex border-b border-slate-200 bg-slate-50/90 px-6 gap-3 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab("gantt")}
            className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === "gantt"
                ? "border-indigo-600 text-indigo-600 bg-white rounded-t-lg shadow-2xs"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <CalendarRange size={14} />
            <span>Línea de Tiempo (Gantt del Día)</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-100 text-indigo-700 font-black">
              {timelineOrders.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("orden")}
            className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === "orden"
                ? "border-indigo-600 text-indigo-600 bg-white rounded-t-lg shadow-2xs"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <Clock size={14} />
            <span>Detalles de Orden #{current.ot || current.ticket}</span>
          </button>
        </div>

        {/* CONTENIDO DEL MODAL */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 custom-scrollbar bg-slate-50/40">

          {activeTab === "gantt" ? (
            /* ============================================================ */
            /* VISTA GANTT / LÍNEA DE TIEMPO DEL DÍA (TÉCNICO / CUADRILLA)  */
            /* ============================================================ */
            <div className="space-y-5">
              
              {/* SELECTOR SWITCH: POR CUADRILLA vs POR TÉCNICO */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setGroupBy("cuadrilla")}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                      groupBy === "cuadrilla"
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    }`}
                  >
                    <Users size={14} />
                    <span>Por Cuadrilla</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGroupBy("tecnico")}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                      groupBy === "tecnico"
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    }`}
                  >
                    <User size={14} />
                    <span>Por Técnico</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <span>Modo:</span>
                  <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    {groupBy === "cuadrilla" ? "👥 Cuadrilla WIN / Fénix" : "👤 Técnico Individual"}
                  </span>
                </div>
              </div>

              {/* CABECERA DEL CRONOGRAMA */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-900 text-white rounded-2xl shadow-md gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-indigo-600 border-2 border-indigo-400 flex items-center justify-center font-black text-xs text-white shadow-md shrink-0 text-center leading-tight">
                    {groupBy === "cuadrilla"
                      ? extractCuadrillaKey(current.cuadrilla)
                        ? extractCuadrillaKey(current.cuadrilla).split(" ").slice(0, 2).join(" ")
                        : "CU"
                      : current.tecnico
                      ? current.tecnico.substring(0, 2).toUpperCase()
                      : "TE"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-black text-white tracking-tight">
                        {groupBy === "cuadrilla"
                          ? extractCuadrillaKey(current.cuadrilla) || current.cuadrilla || "Cuadrilla Asignada"
                          : current.tecnico && current.tecnico !== "-- SELECCIONE --"
                          ? current.tecnico
                          : "Sin Técnico Asignado"}
                      </h4>
                      {groupBy === "cuadrilla" && extractCuadrillaKey(current.cuadrilla) && (
                        <span className="text-[10px] font-black bg-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded border border-indigo-400/40 uppercase">
                          Cuadrilla Activa
                        </span>
                      )}
                    </div>

                    {/* Nombre limpio del técnico / integrante debajo del título */}
                    {groupBy === "cuadrilla" && extractCuadrillaMemberName(current.cuadrilla, current.tecnico) && (
                      <div className="text-xs font-bold text-amber-300 mt-0.5 tracking-tight flex items-center gap-1">
                        <span>👤 {extractCuadrillaMemberName(current.cuadrilla, current.tecnico)}</span>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-300">
                      <span className="font-bold text-indigo-300">
                        Total Órdenes: <strong>{timelineOrders.length}</strong>
                      </span>
                      <span>•</span>
                      <span className="text-sky-300 font-semibold">
                        Finalizadas: <strong>{timelineOrders.filter(o => (o.status || '').toLowerCase().includes('finaliz')).length}</strong>
                      </span>
                      <span>•</span>
                      <span className="text-emerald-400 font-semibold">
                        En curso: <strong>{timelineOrders.filter(o => (o.status || '').toLowerCase().includes('inicia') || (o.status || '').toLowerCase().includes('camino')).length}</strong>
                      </span>
                      <span>•</span>
                      <span className="text-amber-300 font-semibold">
                        Pendientes: <strong>{timelineOrders.filter(o => !(o.status || '').toLowerCase().includes('finaliz') && !(o.status || '').toLowerCase().includes('inicia') && !(o.status || '').toLowerCase().includes('camino')).length}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-left sm:text-right shrink-0 bg-white/5 p-2 rounded-xl border border-white/10">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Hora Actual en Vivo</span>
                  <span className="text-sm font-mono font-black text-rose-400">
                    {currentHourStr}
                  </span>
                </div>
              </div>

              {/* CONTENEDOR DEL GANTT CON REGLA DE HORAS Y PISTAS POR CADA ORDEN */}
              <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-x-auto space-y-3">
                <div className="min-w-[700px] relative pb-2 pt-2">

                  {/* 1. REGLA HORARIA (08:00 a 21:00) */}
                  <div className="flex justify-between border-b border-slate-200 pb-2 mb-3 text-[11px] font-mono font-bold text-slate-500 select-none">
                    {hoursArray.map((h) => (
                      <span key={h} className="text-center w-8">
                        {String(h).padStart(2, "0")}:00
                      </span>
                    ))}
                  </div>

                  {/* 2. LÍNEA ROJA DE HORA ACTUAL EN VIVO */}
                  {currentPercent >= 0 && currentPercent <= 100 && (
                    <div
                      className="absolute top-0 bottom-0 z-30 flex flex-col items-center pointer-events-none"
                      style={{ left: `${currentPercent}%` }}
                    >
                      <div className="bg-rose-600 text-white text-[10px] font-mono font-black px-1.5 py-0.5 rounded shadow-md border border-rose-400">
                        {currentHourStr}
                      </div>
                      <div className="w-0.5 flex-1 bg-rose-500/90 shadow-[0_0_8px_rgba(244,63,94,0.6)]"></div>
                    </div>
                  )}

                  {/* 3. LÍNEAS VERTICALES GUÍA DE CADA HORA */}
                  <div className="absolute inset-x-0 top-9 bottom-2 flex justify-between pointer-events-none opacity-25">
                    {hoursArray.map((h) => (
                      <div key={h} className="w-px h-full border-r border-dashed border-slate-400"></div>
                    ))}
                  </div>

                  {/* 4. PISTAS DE CADA ORDEN EN EL GANTT */}
                  <div className="space-y-3 relative z-10 py-1">
                    {timelineOrders.map((o, idx) => {
                      const isCurrent = o.id === current.id || o.ot === current.ot;
                      const { startM, endM } = calculateGanttTimeRange(o, idx);

                      const leftPct = Math.max(0, Math.min(92, ((startM - startHour * 60) / totalMinutes) * 100));
                      const rawWidthPct = ((endM - startM) / totalMinutes) * 100;
                      const widthPct = Math.max(10, Math.min(100 - leftPct, rawWidthPct));

                      const tag = getTramoTag(o.tramo);
                      const isFinalizada = (o.status || "").toLowerCase().includes("finaliz");
                      const isIniciada = (o.status || "").toLowerCase().includes("inicia") || (o.status || "").toLowerCase().includes("camino");
                      const isCancelada = (o.status || "").toLowerCase().includes("cancel") || (o.status || "").toLowerCase().includes("regestion") || (o.status || "").toLowerCase().includes("observ");

                      // 🚀 Progreso real de tareas de Fénix sincronizado
                      const taskProgress = tasksProgressMap[String(o.id)] || 
                                           tasksProgressMap[String(o.ot || "")] || 
                                           tasksProgressMap[String(o.ticket || "")] || 
                                           tasksProgressMap[String(o.numeroOrden || "")];

                      // Cálculo de tiempo transcurrido en vivo
                      const elapsedMinutes = Math.max(0, currentMinutes - startM);
                      const totalEstimatedMinutes = Math.max(1, endM - startM);
                      const timeElapsedPct = Math.min(100, Math.max(0, Math.round((elapsedMinutes / totalEstimatedMinutes) * 100)));

                      // 🎯 Porcentaje a mostrar: Tareas (si existe) o Tiempo transcurrido
                      const displayPct = taskProgress && taskProgress.total > 0 ? taskProgress.pct : timeElapsedPct;
                      const fillWidthPct = Math.min(100, Math.max(12, timeElapsedPct));

                      // Color del bloque según estado
                      let blockBg = "bg-slate-700 hover:bg-slate-600 text-white";
                      if (isFinalizada) blockBg = "bg-[#5b9bd5] hover:bg-[#4f88c2] text-slate-950 font-bold";
                      else if (isIniciada) blockBg = "bg-[#436a28] hover:bg-[#4d792f] text-white";
                      else if (isCancelada) blockBg = "bg-[#ffff00] hover:bg-[#e6e600] text-slate-950 font-bold";

                      const startLabel = o.horaInicio || o.horaEnCamino || (o.tramo ? o.tramo.split("-")[0].trim() : minutesToHourStr(startM));
                      const endLabel = o.horaFin || (o.tramo ? o.tramo.split("-")[1]?.trim() : minutesToHourStr(endM));

                      return (
                        <div
                          key={o.id || idx}
                          onClick={() => setActiveOrder(o)}
                          className={`relative h-13 flex items-center p-1.5 rounded-xl border transition-all cursor-pointer ${
                            isCurrent
                              ? "bg-indigo-50/80 border-indigo-300 ring-2 ring-indigo-500 ring-offset-1"
                              : "bg-slate-50/60 border-slate-200/80 hover:bg-slate-100/80"
                          }`}
                        >
                          {/* BLOQUE DE LA ORDEN EN EL TRACK */}
                          <div
                            className={`absolute h-10 rounded-xl px-2.5 py-1 flex items-center justify-between text-xs font-bold shadow-md transition-transform hover:scale-101 select-none overflow-hidden ${blockBg}`}
                            style={{
                              left: `${leftPct}%`,
                              width: `${widthPct}%`,
                              minWidth: "135px",
                            }}
                            title={`OT: ${o.ot || o.ticket}\nCliente: ${o.cliente}\nEstado: ${o.status}\nTramo: ${o.tramo || "-"}\nHorario: ${startLabel} a ${endLabel || "-"}\n${taskProgress ? `Tareas: ${taskProgress.done} de ${taskProgress.total} completadas (${taskProgress.pct}%)\n` : ""}Tiempo transcurrido: ${formatDuration(elapsedMinutes)}\n(Clic para ver detalles de esta orden)`}
                          >
                            {/* 🚀 CAPA DE LLENADO EN TIEMPO REAL (COLOR VERDE FÉNIX VIBRANTE) */}
                            {isIniciada && (
                              <div
                                className="absolute inset-y-0 left-0 bg-[#70ad47] rounded-xl overflow-hidden pointer-events-none transition-all duration-700 ease-out"
                                style={{ width: `${fillWidthPct}%` }}
                              >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
                              </div>
                            )}

                            <div className="relative z-10 flex items-center gap-1.5 truncate">
                              <span className="bg-black/35 px-1.5 py-0.5 rounded text-[10px] font-black shrink-0">
                                {tag}
                              </span>
                              <span className="truncate text-[11px] font-bold">
                                {o.ot ? `#${o.ot}` : o.ticket}
                              </span>
                            </div>

                            {/* INDICADOR DE AVANCE EN VIVO Y TIEMPO */}
                            {isIniciada ? (
                              <div className="relative z-10 flex items-center gap-1 shrink-0 ml-1">
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-80"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-300"></span>
                                </span>
                                <span className="text-[10px] font-black text-white bg-black/40 px-1.5 py-0.5 rounded font-mono shadow-2xs whitespace-nowrap">
                                  {displayPct}% ({formatDuration(elapsedMinutes)})
                                </span>
                              </div>
                            ) : isFinalizada ? (
                              <div className="relative z-10 flex items-center gap-1 shrink-0 ml-1">
                                <span className="text-[10px] font-black text-sky-100 bg-sky-950/40 px-1.5 py-0.5 rounded font-mono">
                                  ✓ 100% {o.horaFin ? `(${o.horaFin})` : ""}
                                </span>
                              </div>
                            ) : (
                              <span className="relative z-10 text-[10px] font-mono opacity-90 shrink-0 ml-1 font-bold">
                                {startLabel}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                </div>
              </div>

              {/* LEYENDA DEL GANTT */}
              <div className="flex flex-wrap items-center justify-between p-3.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 gap-2 shadow-2xs">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-3 h-3 rounded-full bg-[#5b9bd5] border border-[#3c78b0]"></span> Finalizada
                  </span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-3 h-3 rounded-full bg-[#70ad47] border border-[#568735]"></span> En Curso / Iniciada
                  </span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-3 h-3 rounded-full bg-[#ffff00] border border-amber-500"></span> Regestión / Cancelada
                  </span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-3 h-3 rounded-full bg-[#d4d8df] border border-slate-500"></span> Agendada / Pendiente
                  </span>
                </div>
                <div className="text-[11px] font-bold text-indigo-700 flex items-center gap-1">
                  <span>💡 Haz clic en cualquier barra para ver el detalle de esa orden</span>
                </div>
              </div>

              {/* ============================================================ */}
              {/* TABLA DESGLOSE DE TODAS LAS ÓRDENES DEL DÍA                  */}
              {/* ============================================================ */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-indigo-600" />
                    <span>Todas las Órdenes del Día de la Cuadrilla ({timelineOrders.length})</span>
                  </h4>
                  <span className="text-xs text-slate-500">
                    Fecha: <strong>{current.fecha ? current.fecha.split(" ")[0].split("T")[0] : "Hoy"}</strong>
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-[#1e4b8a] text-white text-[10px] font-bold uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Estado</th>
                        <th className="py-2.5 px-3">OT / Ticket</th>
                        <th className="py-2.5 px-3">Cliente</th>
                        <th className="py-2.5 px-3">Tramo</th>
                        <th className="py-2.5 px-3 text-center">Asignación</th>
                        <th className="py-2.5 px-3 text-center">En Camino</th>
                        <th className="py-2.5 px-3 text-center">Inicio</th>
                        <th className="py-2.5 px-3 text-center">Fin</th>
                        <th className="py-2.5 px-3 text-center bg-indigo-900/80">Camino ➔ Fin</th>
                        <th className="py-2.5 px-3 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/80">
                      {timelineOrders.map((o, idx) => {
                        const isCurrent = o.id === current.id || o.ot === current.ot;
                        const rowBg = getRowColorByStatus(o.status);
                        const badgeBg = getBadgeColorByStatus(o.status);
                        const durOp = diffMinutes(o.horaEnCamino, o.horaFin);

                        return (
                          <tr
                            key={o.id || idx}
                            onClick={() => setActiveOrder(o)}
                            className={`transition-colors cursor-pointer ${rowBg} ${
                              isCurrent ? "ring-2 ring-indigo-600 font-bold" : ""
                            }`}
                          >
                            <td className="py-2.5 px-3 font-mono font-bold">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${badgeBg}`}>
                                {o.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold">
                              {o.ot ? `#${o.ot}` : o.ticket}
                            </td>
                            <td className="py-2.5 px-3 font-semibold max-w-[200px] truncate" title={o.cliente}>
                              {o.cliente}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-indigo-900">
                              {o.tramo || "-"}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-center">
                              {o.horaAsignacion || "-"}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-center">
                              {o.horaEnCamino || "-"}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-center font-bold text-emerald-900">
                              {o.horaInicio || "-"}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-center font-bold text-sky-900">
                              {o.horaFin || "-"}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-center font-bold">
                              {durOp !== null ? (
                                <span className="bg-indigo-100/90 text-indigo-900 px-2 py-0.5 rounded border border-indigo-300 font-bold text-[11px] whitespace-nowrap shadow-2xs">
                                  {formatDuration(durOp)}
                                </span>
                              ) : (
                                <span className="text-slate-400 font-normal">-</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveOrder(o);
                                    setActiveTab("orden");
                                  }}
                                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-[11px] font-bold inline-flex items-center gap-1 transition-all cursor-pointer"
                                  title="Ver detalles e hitos de esta orden"
                                >
                                  <span>Hitos</span>
                                </button>
                                {onViewTasks && (
                                  <button
                                    type="button"
                                    onClick={() => onViewTasks(o)}
                                    className="px-2 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded-md text-[11px] font-bold inline-flex items-center gap-1 transition-all cursor-pointer"
                                    title="Ver tareas Fénix en tiempo real"
                                  >
                                    <Activity size={12} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          ) : (
            /* ============================================================ */
            /* VISTA DE TIEMPOS Y HITOS DE LA ORDEN ACTIVA                  */
            /* ============================================================ */
            <div className="space-y-4">
              
              {/* SELECTOR RÁPIDO DE OTRA ORDEN DEL DÍA */}
              {timelineOrders.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  <span className="text-xs font-bold text-slate-500 shrink-0">Cambiar Orden:</span>
                  {timelineOrders.map((o, idx) => (
                    <button
                      key={o.id || idx}
                      type="button"
                      onClick={() => setActiveOrder(o)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer border ${
                        (o.id === current.id || o.ot === current.ot)
                          ? "bg-indigo-600 text-white border-indigo-700 shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {o.ot ? `#${o.ot}` : o.ticket} ({o.status})
                    </button>
                  ))}
                </div>
              )}

              {/* 1. TARJETAS DE INFORMACIÓN DE LA ORDEN Y CUADRILLA */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-0.5 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <User size={11} /> Técnico
                  </span>
                  <p className="text-xs font-bold text-slate-800 truncate" title={current.tecnico}>
                    {current.tecnico || "Sin asignar"}
                  </p>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-0.5 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Users size={11} /> Cuadrilla
                  </span>
                  <p className="text-xs font-bold text-slate-800 truncate" title={current.cuadrilla}>
                    {current.cuadrilla || "-"}
                  </p>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-0.5 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <FileText size={11} /> OT / Pedido
                  </span>
                  <p className="text-xs font-bold text-slate-800 truncate">
                    {current.ot || "-"} / {current.codigoPedido || "-"}
                  </p>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-0.5 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Calendar size={11} /> Tramo
                  </span>
                  <p className="text-xs font-bold text-indigo-700 truncate">
                    {current.tramo || "-"}
                  </p>
                </div>
              </div>

              {/* 2. LÍNEA DE TIEMPO INTERACTIVA (TIMELINE CON DEMORAS) */}
              <div className="p-4 bg-gradient-to-br from-indigo-50/40 via-white to-slate-50 border border-indigo-100 rounded-2xl space-y-3 shadow-2xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-indigo-600" />
                    Línea de Tiempo de Atención de la Orden
                  </h4>
                  {cumplimientoTramo.cumplio !== null && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                        cumplimientoTramo.cumplio
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          : "bg-rose-100 text-rose-800 border border-rose-300"
                      }`}
                    >
                      {cumplimientoTramo.cumplio ? (
                        <CheckCircle2 size={11} />
                      ) : (
                        <AlertTriangle size={11} />
                      )}
                      {cumplimientoTramo.mensaje}
                    </span>
                  )}
                </div>

                {/* DIAGRAMA DE HITOS CON DEMORAS INTERMEDIAS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pt-2">
                  
                  {/* HITO 1: ASIGNACIÓN */}
                  <div className="relative p-3 bg-white border border-slate-200 rounded-xl shadow-2xs flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">1. Asignación</span>
                      <Clock size={14} className="text-slate-500" />
                    </div>
                    <div className="text-sm font-black text-slate-900 font-mono">
                      {current.horaAsignacion || "-"}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">
                      Hora de agendamiento
                    </div>
                  </div>

                  {/* HITO 2: EN CAMINO */}
                  <div className="relative p-3 bg-white border border-slate-200 rounded-xl shadow-2xs flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-indigo-600 uppercase">2. En Camino</span>
                      <Navigation size={14} className="text-indigo-600" />
                    </div>
                    <div className="text-sm font-black text-slate-900 font-mono">
                      {current.horaEnCamino || "-"}
                    </div>
                    <div className="text-[10px] text-slate-600 mt-1 font-semibold">
                      {tiempoSalida !== null ? (
                        <span className={tiempoSalida > 60 ? "text-amber-600 font-bold" : "text-emerald-600 font-bold"}>
                          Demora: {formatDuration(tiempoSalida)}
                        </span>
                      ) : (
                        "Pendiente"
                      )}
                    </div>
                  </div>

                  {/* HITO 3: INICIO */}
                  <div className="relative p-3 bg-white border border-slate-200 rounded-xl shadow-2xs flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-emerald-600 uppercase">3. Inicio Visita</span>
                      <PlayCircle size={14} className="text-emerald-600" />
                    </div>
                    <div className="text-sm font-black text-slate-900 font-mono">
                      {current.horaInicio || "-"}
                    </div>
                    <div className="text-[10px] text-slate-600 mt-1 font-semibold">
                      {tiempoTraslado !== null ? (
                        <span className={tiempoTraslado > 45 ? "text-amber-600 font-bold" : "text-emerald-600 font-bold"}>
                          Traslado: {formatDuration(tiempoTraslado)}
                        </span>
                      ) : (
                        "Pendiente"
                      )}
                    </div>
                  </div>

                  {/* HITO 4: FIN */}
                  <div className="relative p-3 bg-white border border-slate-200 rounded-xl shadow-2xs flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-sky-600 uppercase">4. Fin Visita</span>
                      <CheckCircle2 size={14} className="text-sky-600" />
                    </div>
                    <div className="text-sm font-black text-slate-900 font-mono">
                      {current.horaFin || "-"}
                    </div>
                    <div className="text-[10px] text-slate-600 mt-1 font-semibold space-y-1">
                      {tiempoTrabajo !== null && (
                        <div className="text-sky-700 font-bold flex items-center justify-between">
                          <span>Trabajo:</span>
                          <span>{formatDuration(tiempoTrabajo)}</span>
                        </div>
                      )}
                      {tiempoOperativo !== null && (
                        <div className="text-indigo-700 font-bold bg-indigo-50/80 px-1.5 py-0.5 rounded border border-indigo-200 flex items-center justify-between text-[9.5px]">
                          <span>Camino ➔ Fin:</span>
                          <span>{formatDuration(tiempoOperativo)}</span>
                        </div>
                      )}
                      {tiempoTrabajo === null && tiempoOperativo === null && (
                        <span>Pendiente</span>
                      )}
                    </div>
                  </div>

                </div>
              </div>

              {/* 3. RESUMEN ESTADÍSTICO DE TIEMPOS Y EFICIENCIA */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                
                {/* TIEMPO TRASLADO */}
                <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-1 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                    <Navigation size={12} /> Tiempo en Traslado
                  </span>
                  <div className="text-lg font-black text-emerald-950">
                    {formatDuration(tiempoTraslado)}
                  </div>
                  <p className="text-[10px] text-emerald-700 font-medium">
                    {tiempoTraslado === null
                      ? "Aún no inicia visita"
                      : tiempoTraslado <= 30
                      ? "🟢 Traslado rápido y óptimo"
                      : tiempoTraslado <= 50
                      ? "🔵 Traslado en rango promedio"
                      : "🟡 Traslado con demora / tráfico"}
                  </p>
                </div>

                {/* TIEMPO TRABAJO EN SITIO */}
                <div className="p-3.5 bg-sky-50/60 border border-sky-200 rounded-xl space-y-1 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-800 flex items-center gap-1">
                    <Activity size={12} /> Trabajo en Sitio
                  </span>
                  <div className="text-lg font-black text-sky-950">
                    {formatDuration(tiempoTrabajo)}
                  </div>
                  <p className="text-[10px] text-sky-700 font-medium">
                    {tiempoTrabajo === null
                      ? "Aún no finaliza visita"
                      : tiempoTrabajo <= 45
                      ? "🟢 Labor técnica rápida"
                      : tiempoTrabajo <= 90
                      ? "🔵 Tiempo de labor estándar"
                      : "🟡 Atención técnica extensa"}
                  </p>
                </div>

                {/* 🚀 TIEMPO OPERATIVO (EN CAMINO ➔ FIN) */}
                <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-1 shadow-2xs ring-1 ring-indigo-400/30">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-900 flex items-center gap-1">
                    <Clock size={12} className="text-indigo-600" /> En Camino ➔ Fin
                  </span>
                  <div className="text-lg font-black text-indigo-950">
                    {formatDuration(tiempoOperativo)}
                  </div>
                  <p className="text-[10px] text-indigo-700 font-medium">
                    {tiempoOperativo === null
                      ? "En ejecución o pendiente"
                      : tiempoOperativo <= 60
                      ? "🟢 Duración operativa ágil"
                      : tiempoOperativo <= 120
                      ? "🔵 Tiempo total estándar"
                      : "🟡 Duración total extendida"}
                  </p>
                </div>

                {/* TIEMPO TOTAL DE GESTIÓN */}
                <div className="p-3.5 bg-slate-100/80 border border-slate-200 rounded-xl space-y-1 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1">
                    <TrendingUp size={12} /> Tiempo Total Gestión
                  </span>
                  <div className="text-lg font-black text-slate-900">
                    {formatDuration(tiempoTotal)}
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium">
                    Desde asignación hasta fin
                  </p>
                </div>

              </div>

              {/* 4. INFORMACIÓN DE LA DIRECCIÓN Y AVERÍA */}
              <div className="p-3.5 bg-white border border-slate-200 rounded-xl text-xs space-y-2 text-slate-700 shadow-2xs">
                <div className="flex items-start gap-2">
                  <MapPin size={14} className="text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-800 block">Dirección & Distrito:</span>
                    <span>{current.direccion || "-"} • <strong>{current.distrito || "-"}</strong></span>
                    {current.cto && <span className="ml-2 text-indigo-600 font-bold">CTO: {current.cto}</span>}
                  </div>
                </div>
                {(current.tipoAveria || current.tipoTrabajoAsignado) && (
                  <div className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Tipo de Avería:</span>
                    <span className="font-semibold text-slate-800">{current.tipoAveria || "-"}</span>
                    <span className="text-slate-400">•</span>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Tipo Trabajo:</span>
                    <span className="font-semibold text-slate-800">{current.tipoTrabajoAsignado || current.tipoTrabajo || "-"}</span>
                  </div>
                )}
                {(current.motivoFinalizacion || current.motivoCancelacion || current.motivoRegestion) && (
                  <div className="pt-2 border-t border-slate-200/80 flex items-start gap-1.5 text-[11px]">
                    <span className="font-bold text-slate-800 shrink-0">Motivo Liquidación:</span>
                    <span className="text-indigo-900 font-semibold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                      {current.motivoFinalizacion || current.motivoCancelacion || current.motivoRegestion}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* FOOTER DEL MODAL */}
        <div className="px-6 py-3 border-t border-slate-200 bg-white flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={handleCopyReport}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
              copied
                ? "bg-slate-900 text-emerald-400 scale-105"
                : "bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {copied ? <Check size={14} className="text-emerald-400 stroke-[3]" /> : <Copy size={14} />}
            <span>{copied ? "¡Reporte Copiado!" : "Copiar Resumen"}</span>
          </button>

          <div className="flex items-center gap-2">
            {/* BOTÓN TOGGLE TAB */}
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === "gantt" ? "orden" : "gantt")}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
            >
              <CalendarRange size={13} />
              <span>{activeTab === "gantt" ? "Ver Hitos de la Orden" : "Línea de Tiempo (Gantt)"}</span>
            </button>

            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default OrderStatsModal;
