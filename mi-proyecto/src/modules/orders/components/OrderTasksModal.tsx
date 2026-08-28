import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import {
  OrderTask,
  OrderStatusHistoryItem,
  getOrderTasks,
  getOrderStatusHistory,
  getCachedOrderTasks,
  getCachedOrderStatusHistory,
} from "../services/orderService";

interface OrderTasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderNumber: string;
  orderClient?: string;
  orderCuadrilla?: string;
  orderEstado?: string;
}

export const OrderTasksModal: React.FC<OrderTasksModalProps> = ({
  isOpen,
  onClose,
  orderNumber,
  orderClient,
  orderCuadrilla,
  orderEstado,
}) => {
  const [activeTab, setActiveTab] = useState<"tareas" | "historial">("tareas");
  const [tasks, setTasks] = useState<OrderTask[]>([]);
  const [history, setHistory] = useState<OrderStatusHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTask, setSearchTask] = useState<string>("");

  // Cargar lista de tareas e historial al abrir el modal (Apertura Instantánea a 0ms con Stale-While-Revalidate)
  const loadData = async (isManual = false) => {
    if (!orderNumber) return;

    // ⚡ 1. Comprobar caché inmediato: si ya existen en memoria, mostrarlas AHORA MISMO
    const cachedTasks = getCachedOrderTasks(orderNumber);
    const cachedHistory = getCachedOrderStatusHistory(orderNumber);

    if (cachedTasks && cachedTasks.tareas.length > 0) {
      setTasks(cachedTasks.tareas);
      if (cachedHistory) setHistory(cachedHistory);
      setLoading(false); // 🚀 ¡Cero spinner, renderizado instantáneo!
    } else if (!isManual) {
      setLoading(true);
    }

    setError(null);
    try {
      const [tasksRes, historyRes] = await Promise.allSettled([
        getOrderTasks(orderNumber, { forceFresh: isManual }),
        getOrderStatusHistory(orderNumber, { forceFresh: isManual }),
      ]);

      if (tasksRes.status === "fulfilled") {
        setTasks(tasksRes.value.tareas);
      }
      if (historyRes.status === "fulfilled") {
        setHistory(historyRes.value);
      }
    } catch (err: any) {
      if (!cachedTasks) {
        setError(err?.message || "Error al obtener la información de Fénix.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && orderNumber) {
      loadData();
    } else if (!isOpen) {
      setTasks([]);
      setHistory([]);
      setActiveTab("tareas");
      setSearchTask("");
    }
  }, [isOpen, orderNumber]);

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

  // Filtrado de tareas por buscador
  const filteredTasks = tasks.filter((t) =>
    t.titulo.toLowerCase().includes(searchTask.toLowerCase())
  );

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

          {/* BUSCADOR DE TAREAS */}
          {activeTab === "tareas" && tasks.length > 0 && (
            <div className="relative my-2 w-48 sm:w-64">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar tarea..."
                value={searchTask}
                onChange={(e) => setSearchTask(e.target.value)}
                className="w-full pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* CONTENIDO PRINCIPAL */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              <span className="text-xs font-medium">
                Consultando datos en tiempo real desde Fénix...
              </span>
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
                {filteredTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-3.5 bg-white border border-slate-200 rounded-xl hover:border-slate-300 hover:shadow-2xs transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div className="p-2 rounded-xl bg-slate-100/90 border border-slate-200/60 shrink-0">
                        {getTaskIcon(task.titulo)}
                      </div>
                      <h4 className="text-xs font-bold text-slate-800 truncate" title={task.titulo}>
                        {task.titulo}
                      </h4>
                    </div>

                    <div className="shrink-0">
                      {getStatusBadge(task)}
                    </div>
                  </div>
                ))}
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
