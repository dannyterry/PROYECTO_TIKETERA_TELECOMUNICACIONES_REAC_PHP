import React, { useState } from "react";
import {
  X,
  AlertTriangle,
  Clock,
  UserX,
  CheckCircle2,
  Copy,
  ExternalLink,
  RefreshCw,
  MessageSquare,
  Search,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import {
  OrderAlertsResponse,
  TecnicoSinOrdenAlert,
  ActaPendienteAlert,
  TramoRiesgoAlert,
} from "../services/orderService";

interface GestorAlertsModalProps {
  isOpen: boolean;
  onClose: () => void;
  alertsData: OrderAlertsResponse | null;
  loading: boolean;
  onRefresh: () => void;
  onSelectOrderForTasks?: (numeroOrden: string) => void;
  onFilterBySearch?: (term: string) => void;
}

export const GestorAlertsModal: React.FC<GestorAlertsModalProps> = ({
  isOpen,
  onClose,
  alertsData,
  loading,
  onRefresh,
  onSelectOrderForTasks,
  onFilterBySearch,
}) => {
  const [activeTab, setActiveTab] = useState<"tecnicos" | "actas" | "tramos">("tecnicos");
  const [subFilterTecnicos, setSubFilterTecnicos] = useState<"todos" | "desocupados" | "sin_orden">("todos");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const tecnicos = alertsData?.alertas.tecnicos_sin_orden || [];
  const actas = alertsData?.alertas.actas_pendientes || [];
  const tramos = (alertsData?.alertas.tramos_riesgo || []).filter((tr) => {
    const est = (tr.estado_orden || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return (
      !est.includes("cancel") &&
      !est.includes("regest") &&
      !est.includes("anul") &&
      !est.includes("fin") &&
      !est.includes("liquid")
    );
  });
  const total = tecnicos.length + actas.length + tramos.length;

  const countDesocupados = tecnicos.filter((t) => t.tipo_alerta === "desocupado").length;
  const countSinOrden = tecnicos.filter((t) => t.tipo_alerta !== "desocupado").length;

  const tecnicosFiltrados = tecnicos.filter((t) => {
    if (subFilterTecnicos === "desocupados") return t.tipo_alerta === "desocupado";
    if (subFilterTecnicos === "sin_orden") return t.tipo_alerta !== "desocupado";
    return true;
  });

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleSearchOrder = (term: string) => {
    if (onFilterBySearch) {
      onFilterBySearch(term);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200/80">
        
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
              <ShieldAlert size={22} className={total > 0 ? "animate-pulse" : ""} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight text-white">
                  Alertas Operativas de Gestión
                </h3>
                {total > 0 ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-red-500 text-white shadow-xs animate-pulse">
                    {total} {total === 1 ? "alerta activa" : "alertas activas"}
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/30 text-emerald-300 border border-emerald-400/30">
                    Operación sin incidencias
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                Monitoreo continuo de técnicos desocupados, actas pendientes y cumplimiento de tramos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white transition-all cursor-pointer disabled:opacity-50"
              title="Actualizar alertas ahora"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* TABS DE NAVEGACIÓN */}
        <div className="flex items-center gap-2 px-6 pt-3 pb-2 border-b border-slate-100 bg-slate-50/70 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("tecnicos")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 ${
              activeTab === "tecnicos"
                ? "bg-amber-500 text-white shadow-md shadow-amber-500/25"
                : "bg-white hover:bg-slate-100 text-slate-600 border border-slate-200/80"
            }`}
          >
            <UserX size={15} />
            <span>Técnicos sin Órdenes / Desocupados</span>
            <span
              className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                activeTab === "tecnicos"
                  ? "bg-white/25 text-white"
                  : tecnicos.length > 0
                  ? "bg-amber-100 text-amber-800"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {tecnicos.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("actas")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 ${
              activeTab === "actas"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                : "bg-white hover:bg-slate-100 text-slate-600 border border-slate-200/80"
            }`}
          >
            <Clock size={15} />
            <span>Actas Pendientes (&gt; 10 min)</span>
            <span
              className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                activeTab === "actas"
                  ? "bg-white/25 text-white"
                  : actas.length > 0
                  ? "bg-indigo-100 text-indigo-800"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {actas.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("tramos")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 ${
              activeTab === "tramos"
                ? "bg-rose-600 text-white shadow-md shadow-rose-600/25"
                : "bg-white hover:bg-slate-100 text-slate-600 border border-slate-200/80"
            }`}
          >
            <AlertTriangle size={15} />
            <span>Riesgo de Tramo</span>
            <span
              className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                activeTab === "tramos"
                  ? "bg-white/25 text-white"
                  : tramos.length > 0
                  ? "bg-rose-100 text-rose-800"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {tramos.length}
            </span>
          </button>
        </div>

        {/* CONTENIDO SCROLLABLE */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/40 min-h-[350px]">
          {/* TAB 1: TÉCNICOS SIN ÓRDENES / DESOCUPADOS */}
          {activeTab === "tecnicos" && (
            <div className="space-y-3">
              {tecnicos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                    <CheckCircle2 size={30} />
                  </div>
                  <h4 className="text-sm font-black text-slate-800">
                    ¡Todos los técnicos tienen trabajo en curso!
                  </h4>
                  <p className="text-xs text-slate-500 max-w-sm mt-1">
                    No hay ningún técnico activo que se encuentre desocupado o sin órdenes asignadas en este momento.
                  </p>
                </div>
              ) : (
                <>
                  {/* BANNER INFORMATIVO CON SUBFILTROS */}
                  <div className="bg-gradient-to-r from-amber-50/90 via-emerald-50/60 to-teal-50/40 border border-amber-200/90 rounded-2xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-slate-800 font-medium">
                          Se detectaron <strong>{tecnicos.length} técnicos disponibles</strong> para asignación de trabajo:
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {countDesocupados > 0 && (
                            <span className="text-[11px] font-bold text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded-lg border border-emerald-300/80">
                              ⚡ {countDesocupados} completaron sus órdenes (Libres)
                            </span>
                          )}
                          {countSinOrden > 0 && (
                            <span className="text-[11px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-lg border border-amber-300/80">
                              ⏳ {countSinOrden} sin órdenes hoy
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* BOTONES DE SUBFILTRO */}
                    {(countDesocupados > 0 && countSinOrden > 0) && (
                      <div className="flex items-center gap-1 bg-white/90 p-1 rounded-xl border border-slate-200 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => setSubFilterTecnicos("todos")}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                            subFilterTecnicos === "todos"
                              ? "bg-slate-800 text-white shadow-xs"
                              : "text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          Todos ({tecnicos.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setSubFilterTecnicos("desocupados")}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                            subFilterTecnicos === "desocupados"
                              ? "bg-emerald-600 text-white shadow-xs"
                              : "text-emerald-800 hover:bg-emerald-50"
                          }`}
                        >
                          ⚡ Libres ({countDesocupados})
                        </button>
                        <button
                          type="button"
                          onClick={() => setSubFilterTecnicos("sin_orden")}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                            subFilterTecnicos === "sin_orden"
                              ? "bg-amber-600 text-white shadow-xs"
                              : "text-amber-800 hover:bg-amber-50"
                          }`}
                        >
                          ⏳ Sin Órdenes ({countSinOrden})
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    {tecnicosFiltrados.map((t) => {
                      const idStr = `tec-${t.id_usuario}`;
                      const isCopied = copiedId === idStr;
                      const isDesocupado = t.tipo_alerta === "desocupado";

                      const whatsappMsg = t.whatsapp_msg || (isDesocupado
                        ? `🚨 *AVISO DE GESTIÓN*: El técnico *${t.nombre_completo}* (Cuadrilla: ${t.cuadrilla || "S/C"}) ya culminó sus órdenes asignadas y se encuentra *DISPONIBLE* para asignación en el tramo de la tarde (${t.proximo_tramo || "16:00 - 20:00"}).`
                        : `🚨 *AVISO DE GESTIÓN*: El técnico *${t.nombre_completo}* (DNI: ${t.documento || "S/D"}, Cuadrilla: ${t.cuadrilla}) ${t.asistio_hoy ? `marcó asistencia a las ${t.hora_entrada?.slice(0, 5) || "07:30"}` : "tiene turno activo hoy"} pero *NO TIENE ÓRDENES ASIGNADAS* en el sistema. Favor de verificar y asignarle trabajo.`);

                      return (
                        <div
                          key={t.id_usuario}
                          className={`rounded-2xl p-4 transition-all flex flex-col justify-between gap-3 ${
                            isDesocupado
                              ? "bg-gradient-to-br from-emerald-50/50 via-white to-teal-50/30 border-2 border-emerald-400/90 shadow-xs hover:border-emerald-500 hover:shadow-md ring-1 ring-emerald-400/20"
                              : "bg-white border border-slate-200/90 shadow-2xs hover:border-amber-400 hover:shadow-sm"
                          }`}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h5 className="text-xs font-black text-slate-900 leading-tight">
                                    {t.nombre_completo}
                                  </h5>
                                  {isDesocupado && (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                                      ⚡ LIBRE
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
                                  <span>DNI: <strong className="font-mono text-slate-700">{t.documento || "-"}</strong></span>
                                  <span>•</span>
                                  <span className="font-semibold text-slate-700">{t.cuadrilla}</span>
                                </div>
                              </div>

                              {isDesocupado ? (
                                <span className="px-2.5 py-1 rounded-xl text-[10px] font-black bg-emerald-600 text-white shadow-xs flex items-center gap-1 shrink-0">
                                  <CheckCircle2 size={12} />
                                  <span>Completó {t.ordenes_finalizadas || 1} {(t.ordenes_finalizadas || 1) === 1 ? 'orden' : 'órdenes'}</span>
                                </span>
                              ) : t.asistio_hoy ? (
                                <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                                  Asistió {t.hora_entrada ? t.hora_entrada.slice(0, 5) : "07:30"}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                                  Turno Regular
                                </span>
                              )}
                            </div>

                            <p className={`text-xs font-medium mt-2 p-2.5 rounded-xl border leading-relaxed ${
                              isDesocupado
                                ? "bg-emerald-50/90 text-emerald-950 border-emerald-200/90"
                                : "bg-slate-50 text-slate-600 border-slate-100"
                            }`}>
                              {t.mensaje}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => handleCopyText(whatsappMsg, idStr)}
                              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                isCopied
                                  ? "bg-emerald-700 text-white"
                                  : isDesocupado
                                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs shadow-emerald-600/25"
                                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                              }`}
                            >
                              {isCopied ? (
                                <>
                                  <CheckCircle2 size={13} />
                                  <span>¡Copiado para WhatsApp!</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={13} />
                                  <span>{isDesocupado ? "Copiar Aviso al Gestor" : "Copiar Aviso"}</span>
                                </>
                              )}
                            </button>

                            {onFilterBySearch && (
                              <button
                                type="button"
                                onClick={() => handleSearchOrder(t.nombre_completo.split(" ")[0])}
                                className={`py-1.5 px-3 rounded-xl text-xs font-bold border transition-all flex items-center gap-1 cursor-pointer ${
                                  isDesocupado
                                    ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200"
                                    : "bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200"
                                }`}
                                title="Buscar en órdenes"
                              >
                                <Search size={13} />
                                <span>Ver Órdenes</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 2: ACTAS DE CONFORMIDAD PENDIENTES */}
          {activeTab === "actas" && (
            <div className="space-y-3">
              {actas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                    <CheckCircle2 size={30} />
                  </div>
                  <h4 className="text-sm font-black text-slate-800">
                    ¡Sin actas demoradas ni pendientes!
                  </h4>
                  <p className="text-xs text-slate-500 max-w-sm mt-1">
                    Todas las órdenes en campo tienen su acta al día o aún están en fases iniciales de instalación.
                  </p>
                </div>
              ) : (
                <>
                  <div className="bg-indigo-50/80 border border-indigo-200/80 rounded-2xl p-3 flex items-start gap-3">
                    <Clock size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-indigo-950 font-medium">
                      Se detectaron <strong>{actas.length} órdenes</strong> que ya figuran en estado <strong>Finalizada</strong> pero su <strong>Acta de Conformidad</strong> continúa pendiente de cierre en el sistema.
                    </p>
                  </div>

                  <div className="space-y-2.5 pt-1">
                    {actas.map((a) => {
                      const idStr = `acta-${a.numero_orden}`;
                      const isCopied = copiedId === idStr;
                      const whatsappMsg = `⏱️ *RECORDATORIO DE GESTIÓN*: Hola *${a.tecnico}*, la *Orden #${a.numero_orden}* (${a.cliente}) ya figura *FINALIZADA*, pero el *ACTA DE CONFORMIDAD* sigue figurando *PENDIENTE*. Por favor regularizar y subir el acta correspondiente para su cierre formal.`;

                      return (
                        <div
                          key={a.numero_orden}
                          className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs hover:border-indigo-400 hover:shadow-sm transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <span className="font-mono font-black text-slate-900 text-xs px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">
                                OT #{a.numero_orden}
                              </span>
                              <span className="font-extrabold text-xs text-slate-800 truncate max-w-[280px]">
                                {a.cliente}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200">
                                Acta Pendiente
                              </span>
                              {a.minutos_espera > 0 && (
                                <span className="text-[10px] font-mono font-bold text-slate-400">
                                  ⏳ Espera: {a.minutos_espera} min
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-xs text-slate-600">
                              <span>Técnico: <strong className="text-slate-900">{a.tecnico}</strong></span>
                              {a.cuadrilla && (
                                <>
                                  <span>•</span>
                                  <span className="text-slate-500">{a.cuadrilla}</span>
                                </>
                              )}
                            </div>

                            {/* Barra de progreso de tareas */}
                            <div className="flex items-center gap-3 pt-1 max-w-md">
                              <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                                <div
                                  className="h-full bg-emerald-500 rounded-full transition-all"
                                  style={{ width: `${Math.max(5, a.porcentaje_avance)}%` }}
                                />
                              </div>
                              <span className="text-[10px] font-mono font-black text-slate-600 shrink-0">
                                {a.tareas_finalizadas}/{a.total_tareas} tareas ({a.porcentaje_avance}%)
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleCopyText(whatsappMsg, idStr)}
                              className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                isCopied
                                  ? "bg-emerald-600 text-white"
                                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                              }`}
                              title="Copiar mensaje WhatsApp para el técnico"
                            >
                              {isCopied ? (
                                <>
                                  <CheckCircle2 size={13} />
                                  <span>¡Copiado!</span>
                                </>
                              ) : (
                                <>
                                  <MessageSquare size={13} />
                                  <span>Avisar WhatsApp</span>
                                </>
                              )}
                            </button>

                            {onSelectOrderForTasks && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectOrderForTasks(a.numero_orden);
                                  onClose();
                                }}
                                className="py-2 px-3.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-indigo-600/20"
                                title="Ver modal de tareas en vivo"
                              >
                                <span>Ver Tareas</span>
                                <ExternalLink size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 3: RIESGO DE TRAMO HORARIO */}
          {activeTab === "tramos" && (
            <div className="space-y-3">
              {tramos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                    <CheckCircle2 size={30} />
                  </div>
                  <h4 className="text-sm font-black text-slate-800">
                    ¡Todos los tramos horarios al día!
                  </h4>
                  <p className="text-xs text-slate-500 max-w-sm mt-1">
                    No hay órdenes con retrasos o que estén por vencer su ventana horaria de atención.
                  </p>
                </div>
              ) : (
                <>
                  <div className="bg-rose-50/80 border border-rose-200/80 rounded-2xl p-3 flex items-start gap-3">
                    <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-rose-950 font-medium">
                      Se detectaron <strong>{tramos.length} órdenes</strong> cuyo tramo horario pactado con el cliente ya venció o está a menos de 30 minutos de vencer sin haber sido iniciadas.
                    </p>
                  </div>

                  <div className="space-y-2.5 pt-1">
                    {tramos.map((tr) => {
                      const idStr = `tramo-${tr.numero_orden}`;
                      const isCopied = copiedId === idStr;
                      const whatsappMsg = `⏳ *ALERTA DE TRAMO HORARIO*: La *Orden #${tr.numero_orden}* (${tr.cliente}) asignada a *${tr.tecnico}* en el *Tramo ${tr.tramo}* ${tr.vencido ? `ya venció hace ${tr.minutos_diferencia} minutos` : `está por vencer en ${tr.minutos_diferencia} minutos`} y no figura iniciada en campo. Por favor gestionar con el cliente o técnico urgente.`;

                      return (
                        <div
                          key={tr.numero_orden}
                          className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs hover:border-rose-400 hover:shadow-sm transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <span className="font-mono font-black text-slate-900 text-xs px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">
                                OT #{tr.numero_orden}
                              </span>
                              <span className="font-extrabold text-xs text-slate-800 truncate max-w-[280px]">
                                {tr.cliente}
                              </span>
                              <span className="text-[10px] font-mono font-black px-2.5 py-0.5 rounded-md bg-slate-800 text-white">
                                {tr.tramo}
                              </span>
                              {tr.vencido ? (
                                <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-red-100 text-red-700 border border-red-200 animate-pulse">
                                  Venció hace {tr.minutos_diferencia} min
                                </span>
                              ) : (
                                <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                                  Vence en {tr.minutos_diferencia} min
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-xs text-slate-600">
                              <span>Técnico: <strong className="text-slate-900">{tr.tecnico}</strong></span>
                              {tr.cuadrilla && (
                                <>
                                  <span>•</span>
                                  <span className="text-slate-500">{tr.cuadrilla}</span>
                                </>
                              )}
                              <span>•</span>
                              <span className="text-slate-500">Estado: {tr.estado_orden}</span>
                            </div>

                            <p className="text-xs text-slate-600 font-medium">
                              {tr.mensaje}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleCopyText(whatsappMsg, idStr)}
                              className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                isCopied
                                  ? "bg-emerald-600 text-white"
                                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                              }`}
                              title="Copiar mensaje WhatsApp"
                            >
                              {isCopied ? (
                                <>
                                  <CheckCircle2 size={13} />
                                  <span>¡Copiado!</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={13} />
                                  <span>Copiar Aviso</span>
                                </>
                              )}
                            </button>

                            {onFilterBySearch && (
                              <button
                                type="button"
                                onClick={() => handleSearchOrder(tr.numero_orden)}
                                className="py-2 px-3 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 transition-all flex items-center gap-1 cursor-pointer"
                              >
                                <Search size={13} />
                                <span>Ver OT</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between text-xs text-slate-500 font-medium">
          <span>Actualización automática en cada sincronización de órdenes</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Entendido / Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
