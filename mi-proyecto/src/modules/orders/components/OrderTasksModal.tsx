import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  X,
  Loader2,
  Camera,
  Gauge,
  UserCheck,
  Wrench,
  Activity,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  MapPin
} from "lucide-react";
import {
  OrderTask,
  TaskDetail,
  OrderStatusHistoryItem,
  getOrderTasks,
  getOrderStatusHistory,
  getCachedOrderTasks,
  getCachedOrderStatusHistory,
  saveTaskProgress,
  getTaskDetail
} from "../services/orderService";

interface OrderTasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderNumber: string;
  orderId?: number | string;
  orderClient?: string;
  orderCuadrilla?: string;
  orderEstado?: string;
  onProgressUpdate?: (key: string, progress: { total: number; done: number; pct: number }) => void;
}

export const OrderTasksModal: React.FC<OrderTasksModalProps> = ({
  isOpen,
  onClose,
  orderNumber,
  orderId,
  orderClient,
  orderCuadrilla,
  orderEstado,
  onProgressUpdate,
}) => {
  const [activeTab, setActiveTab] = useState<"tareas" | "historial">("tareas");
  const [tasks, setTasks] = useState<OrderTask[]>([]);
  const [history, setHistory] = useState<OrderStatusHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTask, setSearchTask] = useState<string>("");
  const [onlyWithObservations, setOnlyWithObservations] = useState<boolean>(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);
  const [taskDetailsMap, setTaskDetailsMap] = useState<Record<string, TaskDetail>>({});

  const handleToggleTask = async (task: OrderTask) => {
    if (expandedTaskId === task.id) {
      setExpandedTaskId(null);
      return;
    }

    setExpandedTaskId(task.id);

    // Si ya tiene campos o detalle en memoria o en el objeto task, no consultar
    const hasCampos = (task.campos && Object.keys(task.campos).length > 0) || Boolean(task.detalle);
    if (hasCampos || taskDetailsMap[task.id]) {
      return;
    }

    // Consultar detalle a la API (la API revisa MySQL primero a 0ms y si no está, Fénix y lo guarda)
    setLoadingDetailId(task.id);
    try {
      const det = await getTaskDetail(task.id, task.index, orderNumber);
      if (det) {
        setTaskDetailsMap((prev) => ({ ...prev, [task.id]: det }));
      }
    } catch (e) {
      // Silencioso
    } finally {
      setLoadingDetailId(null);
    }
  };

  const onProgressUpdateRef = useRef(onProgressUpdate);
  useEffect(() => {
    onProgressUpdateRef.current = onProgressUpdate;
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const notifyProgress = useCallback(
    (taskList: OrderTask[]) => {
      const done = taskList.filter((t) => {
        const raw = (t.estado || "").toLowerCase().trim();
        return raw.includes("finaliz") || raw.includes("realiz") || raw.includes("complet");
      }).length;
      const total = taskList.length;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      const prog = { total, done, pct };

      if (orderNumber) {
        saveTaskProgress(String(orderNumber), prog);
        onProgressUpdateRef.current?.(String(orderNumber), prog);
      }
      if (orderId) {
        saveTaskProgress(String(orderId), prog);
        onProgressUpdateRef.current?.(String(orderId), prog);
      }
    },
    [orderNumber, orderId]
  );

  // Auto-enriquecer en segundo plano las tareas que suelen tener cuestionarios/observaciones
  const enrichObservationCandidates = useCallback(
    (taskList: OrderTask[]) => {
      if (!orderNumber || !Array.isArray(taskList)) return;
      const candidates = taskList.filter((t) => {
        const isDone = !(t.estado || "").toLowerCase().includes("pend");
        const tit = (t.titulo || "").toLowerCase();
        const isCand = /motivo|diagn|observ|problema|disponible|metraje|resumen|justif|causa/i.test(tit);
        const yaTiene =
          (t.campos && Object.keys(t.campos).filter((k) => !k.includes("GD:") && !k.includes("GMS:")).length > 0) ||
          Boolean(t.observacion);
        return isDone && isCand && !yaTiene;
      });

      if (candidates.length > 0) {
        candidates.forEach(async (c) => {
          try {
            const det = await getTaskDetail(c.id, c.index, orderNumber);
            if (det) {
              setTaskDetailsMap((prev) => ({ ...prev, [c.id]: det }));
            }
          } catch {}
        });
      }
    },
    [orderNumber]
  );

  // Cargar lista de tareas e historial al abrir el modal (Apertura Instantánea con Stale-While-Revalidate)
  const loadData = useCallback(
    async (isManual = false) => {
      if (!orderNumber) return;

      // Cancelar petición anterior si estuviera en curso
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // ⚡ 1. Comprobar caché inmediato: si ya existen en memoria, mostrarlas AHORA MISMO
      const cachedTasks = getCachedOrderTasks(orderNumber);
      const cachedHistory = getCachedOrderStatusHistory(orderNumber);

      if (cachedTasks && cachedTasks.tareas.length > 0) {
        setTasks(cachedTasks.tareas);
        notifyProgress(cachedTasks.tareas);
        if (cachedHistory) setHistory(cachedHistory);
        setLoading(false); // 🚀 Cero spinner, renderizado instantáneo
        enrichObservationCandidates(cachedTasks.tareas);
      } else if (!isManual) {
        setLoading(true);
      }

      setError(null);

      try {
        const [tasksRes, historyRes] = await Promise.allSettled([
          getOrderTasks(orderNumber, { forceFresh: isManual, signal: controller.signal }),
          getOrderStatusHistory(orderNumber, { forceFresh: isManual, signal: controller.signal }),
        ]);

        if (tasksRes.status === "fulfilled") {
          const loadedTasks = tasksRes.value.tareas || [];
          setTasks(loadedTasks);
          notifyProgress(loadedTasks);
          enrichObservationCandidates(loadedTasks);
        }
        if (historyRes.status === "fulfilled") {
          setHistory(historyRes.value);
        }

        if (tasksRes.status === "rejected" && !cachedTasks) {
          if (tasksRes.reason?.name !== "AbortError") {
            setError(tasksRes.reason?.message || "Error al obtener las tareas de la orden.");
          }
        }
      } catch (err: any) {
        if (!cachedTasks && err?.name !== "AbortError") {
          setError(err?.message || "Error al obtener la información de Fénix.");
        }
      } finally {
        setLoading(false);
      }
    },
    [orderNumber, notifyProgress, enrichObservationCandidates]
  );

  useEffect(() => {
    if (isOpen && orderNumber) {
      // ⚡ Carga única exclusiva al abrir el modal (cero ráfagas ni intervalos)
      loadData(false);
    } else if (!isOpen) {
      abortControllerRef.current?.abort();
      setTasks([]);
      setHistory([]);
      setActiveTab("tareas");
      setSearchTask("");
      setOnlyWithObservations(false);
      setError(null);
    }

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [isOpen, orderNumber, loadData]);

  // Helper para asignar icono según el nombre de la tarea
  const getTaskIcon = (titulo: string) => {
    const t = titulo.toLowerCase();
    if (t.includes("foto") || t.includes("imagen") || t.includes("ont encontrada")) {
      return <Camera className="w-5 h-5 text-indigo-500" />;
    }
    if (t.includes("potencia") || t.includes("speed") || t.includes("test")) {
      return <Gauge className="w-5 h-5 text-emerald-500" />;
    }
    if (t.includes("cliente") || t.includes("disponible")) {
      return <UserCheck className="w-5 h-5 text-sky-500" />;
    }
    if (t.includes("diagn") || t.includes("configura") || t.includes("ont")) {
      return <Wrench className="w-5 h-5 text-amber-500" />;
    }
    if (t.includes("ping") || t.includes("traza")) {
      return <Activity className="w-5 h-5 text-purple-500" />;
    }
    return <CheckCircle2 className="w-5 h-5 text-blue-500" />;
  };

  // Helper para color del badge de estado de la tarea
  const getStatusBadge = (task: OrderTask) => {
    const rawEstado = (task.estado || "").toLowerCase().trim();

    if (rawEstado.includes("pend")) {
      return (
        <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
          Pendiente
        </span>
      );
    }

    if (
      rawEstado.includes("finaliz") ||
      rawEstado.includes("realiz") ||
      rawEstado.includes("complet")
    ) {
      return (
        <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
          Finalizada
        </span>
      );
    }

    return (
      <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
        {task.estado || "Registrado"}
      </span>
    );
  };

  // Tareas con observaciones detectadas
  const tareasConObservacion = tasks.filter((t) => {
    const det = taskDetailsMap[t.id] || t.detalle || (t.campos ? { campos: t.campos } : null);
    const cKeys =
      det && det.campos
        ? Object.keys(det.campos).filter(
            (k) => !k.includes("GD:") && !k.includes("GMS:") && !k.toLowerCase().includes("campoid")
          )
        : [];
    return cKeys.length > 0 || Boolean(t.observacion) || Boolean(t.valor_texto);
  });

  // Filtrado de tareas por buscador y por observación
  const filteredTasks = tasks.filter((t) => {
    const matchesSearch = t.titulo.toLowerCase().includes(searchTask.toLowerCase());
    if (!matchesSearch) return false;

    if (onlyWithObservations) {
      const det = taskDetailsMap[t.id] || t.detalle || (t.campos ? { campos: t.campos } : null);
      const cKeys =
        det && det.campos
          ? Object.keys(det.campos).filter(
              (k) => !k.includes("GD:") && !k.includes("GMS:") && !k.toLowerCase().includes("campoid")
            )
          : [];
      return cKeys.length > 0 || Boolean(t.observacion) || Boolean(t.valor_texto);
    }
    return true;
  });

  // Contadores y Porcentajes de Avance de Tareas
  const tareasFinalizadas = tasks.filter((t) => {
    const raw = (t.estado || "").toLowerCase().trim();
    return !raw.includes("pend");
  }).length;

  const totalTareas = tasks.length;
  const porcentajeAvance = totalTareas > 0 ? Math.round((tareasFinalizadas / totalTareas) * 100) : 0;
  const isActaCompletada = porcentajeAvance === 100;

  // Próxima tarea pendiente
  const proximaTarea = tasks.find((t) => {
    const raw = (t.estado || "").toLowerCase().trim();
    return raw.includes("pend");
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-100">
        {/* HEADER DEL MODAL */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h3 className="text-base font-bold text-slate-800 tracking-tight">
                Orden de Trabajo #{orderNumber}
              </h3>
              {orderEstado && (
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-slate-200 text-slate-700">
                  {orderEstado}
                </span>
              )}
            </div>
            {(orderClient || orderCuadrilla) && (
              <p className="text-xs text-slate-500 font-medium truncate max-w-xl">
                {orderClient} {orderCuadrilla ? `• ${orderCuadrilla}` : ""}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => loadData(true)}
              disabled={loading}
              title="Refrescar información de Fénix"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              <RefreshCw size={16} className={loading ? "animate-spin text-indigo-600" : ""} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* PESTAÑAS (TABS): TAREAS EN VIVO | HISTORIAL DE ESTADOS */}
        <div className="flex items-center justify-between px-6 border-b border-slate-100 bg-white">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab("tareas")}
              className={`py-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
                activeTab === "tareas"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              <Activity size={15} />
              <span>Tareas en Vivo</span>
              {tasks.length > 0 && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    activeTab === "tareas"
                      ? "bg-indigo-100 text-indigo-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {tasks.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("historial")}
              className={`py-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
                activeTab === "historial"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              <Clock size={15} />
              <span>Historial de Estados</span>
              {history.length > 0 && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    activeTab === "historial"
                      ? "bg-indigo-100 text-indigo-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {history.length}
                </span>
              )}
            </button>
          </div>

          {/* BUSCADOR DE TAREAS Y FILTRO CON OBSERVACIÓN */}
          {activeTab === "tareas" && tasks.length > 0 && (
            <div className="flex items-center gap-2 my-2">
              {tareasConObservacion.length > 0 && (
                <button
                  type="button"
                  onClick={() => setOnlyWithObservations(!onlyWithObservations)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border shrink-0 shadow-2xs ${
                    onlyWithObservations
                      ? "bg-sky-600 text-white border-sky-600 shadow-sky-200"
                      : "bg-white text-sky-700 border-sky-300 hover:bg-sky-50"
                  }`}
                  title="Mostrar solo las tareas que tienen observaciones registradas"
                >
                  <MessageSquare size={12} />
                  <span>Con Observación ({tareasConObservacion.length})</span>
                </button>
              )}

              <div className="relative w-40 sm:w-56">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar tarea..."
                  value={searchTask}
                  onChange={(e) => setSearchTask(e.target.value)}
                  className="w-full pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* CONTENIDO PRINCIPAL */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && tasks.length === 0 ? (
            /* ⚡ SKELETON UI FLUIDO MIENTRAS CARGAN ÓRDENES GRANDES */
            <div className="space-y-4 animate-pulse">
              {/* Skeleton Banner de Progreso */}
              <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="h-3.5 bg-slate-700 rounded-md w-48"></div>
                    <div className="h-2.5 bg-slate-800 rounded-md w-36"></div>
                  </div>
                  <div className="h-6 w-14 bg-slate-700 rounded-lg"></div>
                </div>
                <div className="h-2.5 bg-slate-800 rounded-full w-full"></div>
              </div>

              {/* Skeleton Listado de Tareas */}
              <div className="grid grid-cols-1 gap-2.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-9 h-9 rounded-xl bg-slate-200 shrink-0"></div>
                      <div className="space-y-1.5 flex-1">
                        <div className="h-3 bg-slate-200 rounded-md w-3/4"></div>
                        <div className="h-2 bg-slate-100 rounded-md w-1/3"></div>
                      </div>
                    </div>
                    <div className="h-6 w-20 bg-slate-200 rounded-full shrink-0"></div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-center gap-2 pt-2 text-slate-400 text-xs">
                <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                <span>Obteniendo tareas registradas en Base de Datos...</span>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
              <AlertCircle size={18} className="shrink-0" />
              <span>{error}</span>
            </div>
          ) : activeTab === "historial" ? (
            /* TAB HISTORIAL DE ESTADOS */
            history.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                No se encontró historial de transiciones de estado para esta orden.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100/80 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Fecha / Hora</th>
                      <th className="py-2.5 px-3">Estado</th>
                      <th className="py-2.5 px-3 text-center">Duración</th>
                      <th className="py-2.5 px-3">Usuario</th>
                      <th className="py-2.5 px-3">Observaciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {history.map((item, idx) => {
                      const est = (item.estado || "").toLowerCase();
                      const isCamino = est.includes("camino");
                      const isIniciada = est.includes("inicia");
                      const isFinalizada = est.includes("finaliz");
                      const isRegestion = est.includes("regestion");

                      return (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-semibold text-slate-800">
                            {item.fecha}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                isCamino
                                  ? "bg-indigo-100 text-indigo-700"
                                  : isIniciada
                                  ? "bg-emerald-100 text-emerald-700"
                                  : isFinalizada
                                  ? "bg-blue-100 text-blue-700"
                                  : isRegestion
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {item.estado}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                            {item.duracion || "-"}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 font-medium">
                            {item.usuario || "-"}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 max-w-[200px] truncate" title={item.observaciones}>
                            {item.observaciones || "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : filteredTasks.length === 0 ? (
            /* TAB TAREAS EN VIVO - VACÍO */
            <div className="text-center py-12 text-slate-400 text-xs">
              No se encontraron tareas registradas para esta orden en Fénix.
            </div>
          ) : (
            /* TAB TAREAS EN VIVO - PANEL DE PROGRESO Y LISTADO */
            <div className="space-y-3">
              {/* BANNER DE PROGRESO EN VIVO (PORCENTAJE Y ESTADO DE ACTA) */}
              <div className="p-4 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white rounded-2xl shadow-md border border-indigo-500/30 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="relative flex h-3 w-3">
                      {isActaCompletada ? (
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400"></span>
                      ) : (
                        <>
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                        </>
                      )}
                    </span>
                    <div>
                      <h4 className="text-xs font-black tracking-tight text-white flex items-center gap-2">
                        <span>
                          {isActaCompletada
                            ? "🎉 ¡Todas las tareas y Acta de Conformidad completadas!"
                            : "Progreso de Tareas Técnicas en Vivo"}
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-300">
                        {isActaCompletada
                          ? "La orden está lista para liquidar o ya se encuentra finalizada."
                          : proximaTarea
                          ? `📍 Siguiente hito pendiente: ${proximaTarea.titulo}`
                          : "Técnico trabajando en campo"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-slate-300 font-semibold">
                      <strong>{tareasFinalizadas}</strong> / <strong>{totalTareas}</strong> tareas
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-black font-mono shadow-xs ${
                        isActaCompletada
                          ? "bg-emerald-500 text-white shadow-emerald-500/30"
                          : porcentajeAvance >= 50
                          ? "bg-indigo-500 text-white"
                          : "bg-amber-400 text-slate-950"
                      }`}
                    >
                      {porcentajeAvance}%
                    </span>
                  </div>
                </div>

                {/* BARRA DE PROGRESO CON COLOR Y LLENADO DINÁMICO */}
                <div className="w-full bg-slate-800/90 rounded-full h-3 p-0.5 border border-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${
                      isActaCompletada
                        ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]"
                        : porcentajeAvance >= 60
                        ? "bg-gradient-to-r from-amber-400 via-emerald-400 to-indigo-400"
                        : "bg-gradient-to-r from-amber-500 to-emerald-400"
                    }`}
                    style={{ width: `${Math.max(5, porcentajeAvance)}%` }}
                  />
                </div>
              </div>

              {/* LISTADO DE TAREAS LIMPIO Y RÁPIDO */}
              <div className="grid grid-cols-1 gap-2">
                {filteredTasks.map((task) => {
                  const isExpanded = expandedTaskId === task.id;
                  const isLoadingDet = loadingDetailId === task.id;
                  const detail =
                    taskDetailsMap[task.id] ||
                    task.detalle ||
                    (task.campos
                      ? {
                          campos: task.campos,
                          descripcion: task.descripcion,
                          tiempos: task.tiempos,
                          coordenadas_inicio: task.coordenadas_inicio,
                          coordenadas_fin: task.coordenadas_fin,
                        }
                      : null);

                  const camposKeys =
                    detail && detail.campos
                      ? Object.keys(detail.campos).filter(
                          (k) => !k.includes("GD:") && !k.includes("GMS:") && !k.toLowerCase().includes("campoid")
                        )
                      : [];

                  // Extraer texto limpio de observación para el preview directo en la tarjeta
                  const observacionValores = camposKeys.length > 0 && detail?.campos
                    ? camposKeys.map((k) => `${k !== "1." ? `${k}: ` : ""}${detail.campos?.[k] ?? ""}`).join(" | ")
                    : null;
                  const observacionTexto = task.observacion || observacionValores || task.valor_texto || null;
                  const hasObservaciones = camposKeys.length > 0 || Boolean(task.observacion) || Boolean(task.valor_texto);

                  return (
                    <div
                      key={task.id}
                      className={`bg-white border rounded-xl transition-all overflow-hidden ${
                        isExpanded
                          ? "border-indigo-400 shadow-md ring-1 ring-indigo-100"
                          : hasObservaciones
                          ? "border-sky-300/90 hover:border-sky-400 hover:shadow-xs bg-gradient-to-r from-sky-50/25 via-white to-white"
                          : "border-slate-200 hover:border-slate-300 hover:shadow-2xs"
                      }`}
                    >
                      {/* CABECERA DE LA TAREA (CLIC PARA EXPANDIR OBSERVACIONES) */}
                      <div
                        onClick={() => handleToggleTask(task)}
                        className="flex items-center justify-between p-3 cursor-pointer gap-3 select-none"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div
                            className={`p-2 rounded-xl border shrink-0 ${
                              hasObservaciones
                                ? "bg-sky-50 border-sky-200 text-sky-600"
                                : "bg-slate-100/90 border-slate-200/60"
                            }`}
                          >
                            {getTaskIcon(task.titulo)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-bold text-slate-800 truncate" title={task.titulo}>
                                {task.titulo}
                              </h4>
                              {hasObservaciones && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-300 shrink-0 shadow-2xs animate-in fade-in duration-200">
                                  <MessageSquare size={11} className="text-sky-600" />
                                  <span>Observación</span>
                                </span>
                              )}
                            </div>

                            {(observacionTexto || task.metraje) && !isExpanded && (
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                {task.metraje && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                    📏 {task.metraje} metros
                                  </span>
                                )}
                                {observacionTexto && (
                                  <p
                                    className="text-[11px] text-slate-600 font-medium truncate max-w-lg bg-sky-50/80 px-2 py-0.5 rounded border border-sky-200/70"
                                    title={observacionTexto}
                                  >
                                    💬 <strong className="text-sky-950 font-semibold">{observacionTexto}</strong>
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {getStatusBadge(task)}
                          <button
                            type="button"
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                          >
                            {isLoadingDet ? (
                              <Loader2 size={14} className="animate-spin text-indigo-600" />
                            ) : isExpanded ? (
                              <ChevronUp size={15} />
                            ) : (
                              <ChevronDown size={15} />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* PANEL EXPANDIDO DE OBSERVACIONES (TABLA CAMPO / VALOR COMO EN FÉNIX) */}
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-1 border-t border-slate-100 bg-slate-50/50 space-y-3 animate-in fade-in duration-150 text-xs">
                          {isLoadingDet ? (
                            <div className="flex items-center justify-center gap-2 py-4 text-slate-400 text-xs">
                              <Loader2 size={14} className="animate-spin text-indigo-500" />
                              <span>Cargando detalle de la tarea desde BD local...</span>
                            </div>
                          ) : (
                            <>
                              {/* Descripción / Pregunta técnica */}
                              {(detail?.descripcion || task.descripcion) && (
                                <div className="p-2.5 bg-indigo-50/70 border border-indigo-200/60 rounded-xl text-indigo-900 font-semibold text-[11px] leading-relaxed">
                                  ❓ {detail?.descripcion || task.descripcion}
                                </div>
                              )}

                              {/* TABLA DE OBSERVACIONES: CAMPO / VALOR (IDÉNTICA A FÉNIX) */}
                              {camposKeys.length > 0 ? (
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-1.5 text-[11px] font-black uppercase text-slate-700 tracking-wider">
                                    <span>Observaciones</span>
                                  </div>
                                  <div className="overflow-hidden rounded-xl border border-slate-200 shadow-2xs">
                                    <table className="w-full text-xs text-left">
                                      <thead className="bg-sky-800 text-white font-bold uppercase text-[10px] tracking-wider">
                                        <tr>
                                          <th className="py-2 px-3 w-2/3">CAMPO</th>
                                          <th className="py-2 px-3 w-1/3">VALOR</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 bg-white">
                                        {camposKeys.map((k, i) => (
                                          <tr key={i} className="hover:bg-slate-50 transition-colors">
                                            <td className="py-2 px-3 text-slate-700 font-medium">{k}</td>
                                            <td className="py-2 px-3 font-bold text-slate-900 bg-sky-50/30">
                                              {(detail?.campos && detail.campos[k]) || "-"}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              ) : (task.observacion || task.valor_texto) ? (
                                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Observación Registrada</span>
                                  <p className="font-bold text-slate-800">{task.observacion || task.valor_texto}</p>
                                </div>
                              ) : (
                                <div className="text-center py-2 text-slate-400 text-[11px] italic">
                                  Esta tarea no contiene campos u observaciones adicionales registradas.
                                </div>
                              )}

                              {/* METRAJE SI APLICA */}
                              {task.metraje && (
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs">
                                  📏 Metraje utilizado: <strong>{task.metraje} metros</strong>
                                </div>
                              )}

                              {/* COORDENADAS Y TIEMPOS */}
                              {(detail?.coordenadas_inicio?.gd || detail?.tiempos?.inicio || task.fecha_inicio) && (
                                <div className="flex flex-wrap items-center gap-4 text-[10px] text-slate-500 pt-1 border-t border-slate-200/60 font-mono">
                                  {detail?.coordenadas_inicio?.gd && (
                                    <span className="flex items-center gap-1">
                                      <MapPin size={11} className="text-indigo-500" />
                                      <span>GPS: {detail.coordenadas_inicio.gd}</span>
                                    </span>
                                  )}
                                  {(detail?.tiempos?.inicio || task.fecha_inicio) && (
                                    <span className="flex items-center gap-1">
                                      <Clock size={11} className="text-slate-400" />
                                      <span>Inicio: {detail?.tiempos?.inicio || task.fecha_inicio}</span>
                                    </span>
                                  )}
                                  {(detail?.tiempos?.fin || task.fecha_fin) && (
                                    <span>Fin: {detail?.tiempos?.fin || task.fecha_fin}</span>
                                  )}
                                  {(detail?.tiempos?.duracion || task.duracion) && (
                                    <span className="font-bold text-slate-700">Duración: {detail?.tiempos?.duracion || task.duracion}</span>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>Total de tareas: {tasks.length}</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderTasksModal;
