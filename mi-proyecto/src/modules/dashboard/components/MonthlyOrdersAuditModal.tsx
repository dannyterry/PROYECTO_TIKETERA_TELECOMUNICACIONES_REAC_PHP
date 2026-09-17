import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  X,
  Search,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  Layers,
  Wrench,
  ShoppingBag,
  ExternalLink,
  ShieldCheck,
  Filter,
  ArrowUpDown,
  Sparkles,
} from "lucide-react";
import * as XLSX from "xlsx";
import { API_URL } from "../../../config/api";

interface AuditOrder {
  id_auditoria: number;
  id_orden: number;
  numero: string;
  codigo_seguimiento: string;
  cliente: string;
  fecha_visita: string;
  fecha_formateada: string;
  cuadrilla: string;
  tipo_trabajo_original: string;
  tipo_trabajo_asignado: string;
  motivo_finalizacion: string;
  producto: string;
  estado_original: string;
  categoria_win: "AVERIAS" | "POSTVENTA" | string;
  es_asignada_win: number;
  es_finalizada_win: number;
  regla_aplicada: string;
  direccion?: string;
  region_zona?: string;
  motivo_cancelacion?: string;
  tecnico_asignado?: string;
  movil?: string;
}

interface MonthlyOrdersAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  anio: number;
  mes: number;
  mesNombre: string;
  categoriaInicial?: "AVERIAS" | "POSTVENTA" | "ALL";
}

export const MonthlyOrdersAuditModal: React.FC<MonthlyOrdersAuditModalProps> = ({
  isOpen,
  onClose,
  anio,
  mes,
  mesNombre,
  categoriaInicial = "ALL",
}) => {
  const [categoria, setCategoria] = useState<"AVERIAS" | "POSTVENTA" | "ALL">(categoriaInicial);
  const [estadoFiltro, setEstadoFiltro] = useState<"TODAS" | "FINALIZADAS" | "NO_FINALIZADAS">("TODAS");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ordenes, setOrdenes] = useState<AuditOrder[]>([]);
  const [totales, setTotales] = useState({ total: 0, asignadas: 0, finalizadas: 0 });

  useEffect(() => {
    setCategoria(categoriaInicial);
  }, [categoriaInicial]);

  // Cargar datos de la API
  const cargarOrdenes = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/api/dashboard/ordenes-mes-auditadas?anio=${anio}&mes=${mes}&categoria=${categoria}`
      );
      if (!res.ok) throw new Error("Error al consultar órdenes auditadas");
      const json = await res.json();
      if (json && json.success) {
        setOrdenes(json.ordenes || []);
        setTotales({
          total: json.total || 0,
          asignadas: json.asignadas || 0,
          finalizadas: json.finalizadas || 0,
        });
      }
    } catch (err) {
      console.error("Error al cargar órdenes auditadas:", err);
    } finally {
      setLoading(false);
    }
  }, [isOpen, anio, mes, categoria]);

  useEffect(() => {
    cargarOrdenes();
  }, [cargarOrdenes]);

  // Manejador tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Filtrado en cliente por búsqueda y estado
  const filteredOrders = useMemo(() => {
    return ordenes.filter((o) => {
      // Filtro de estado
      if (estadoFiltro === "FINALIZADAS" && o.es_finalizada_win !== 1) return false;
      if (estadoFiltro === "NO_FINALIZADAS" && o.es_finalizada_win === 1) return false;

      // Filtro de búsqueda
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        (o.numero && o.numero.toLowerCase().includes(term)) ||
        (o.cliente && o.cliente.toLowerCase().includes(term)) ||
        (o.cuadrilla && o.cuadrilla.toLowerCase().includes(term)) ||
        (o.tipo_trabajo_original && o.tipo_trabajo_original.toLowerCase().includes(term)) ||
        (o.motivo_finalizacion && o.motivo_finalizacion.toLowerCase().includes(term)) ||
        (o.direccion && o.direccion.toLowerCase().includes(term)) ||
        (o.tecnico_asignado && o.tecnico_asignado.toLowerCase().includes(term))
      );
    });
  }, [ordenes, estadoFiltro, searchTerm]);

  // Exportar a Excel
  const handleExportExcel = () => {
    if (filteredOrders.length === 0) return;

    const dataRows = filteredOrders.map((o) => ({
      OT: o.numero,
      Cliente: o.cliente,
      Fecha: o.fecha_formateada || o.fecha_visita,
      Cuadrilla: o.cuadrilla,
      "Técnico Asignado": o.tecnico_asignado || "-",
      "Tipo Trabajo": o.tipo_trabajo_original,
      "Motivo Finalización": o.motivo_finalizacion || "-",
      "Estado Fénix": o.estado_original,
      "Categoría WIN": o.categoria_win,
      "Asignada WIN": o.es_asignada_win === 1 ? "SI" : "NO",
      "Finalizada WIN": o.es_finalizada_win === 1 ? "SI" : "NO",
      "Regla WIN": o.regla_aplicada,
      Dirección: o.direccion || "-",
      Distrito: o.region_zona || "-",
      Móvil: o.movil || "-",
    }));

    const ws = XLSX.utils.json_to_sheet(dataRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Audit_${mesNombre}_${anio}`);
    XLSX.writeFile(wb, `Auditoria_WIN_${mesNombre}_${anio}_${categoria}.xlsx`);
  };

  if (!isOpen) return null;

  const efectividadCalc =
    totales.asignadas > 0 ? ((totales.finalizadas / totales.asignadas) * 100).toFixed(2) : "0.00";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-6xl max-h-[92vh] rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden text-slate-800">
        {/* ── HEADER ── */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 rounded-2xl">
              <ShieldCheck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                  Auditoría Detallada de Órdenes
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  {mesNombre} {anio}
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium">
                Desglose orden por orden con clasificación maestra y reglas auditadas de WIN Looker Studio.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-emerald-950/30 cursor-pointer"
              title="Descargar listado en Excel"
            >
              <FileSpreadsheet size={15} />
              <span>Exportar ({filteredOrders.length})</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer"
              title="Cerrar ventana (ESC)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── KPIs RESUMEN DEL MES ── */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs font-bold text-slate-700">
              <Layers size={14} className="text-indigo-600" />
              <span>Total Mes:</span>
              <span className="font-mono font-black text-slate-900">{totales.total}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-sky-200 shadow-2xs font-bold text-sky-800">
              <span className="w-2 h-2 rounded-full bg-sky-500"></span>
              <span>Asignadas:</span>
              <span className="font-mono font-black text-sky-950">{totales.asignadas}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-emerald-200 shadow-2xs font-bold text-emerald-800">
              <CheckCircle2 size={14} className="text-emerald-600" />
              <span>Finalizadas:</span>
              <span className="font-mono font-black text-emerald-950">{totales.finalizadas}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-200 shadow-2xs font-bold text-indigo-900">
              <Sparkles size={14} className="text-indigo-600" />
              <span>Efectividad:</span>
              <span className="font-mono font-black text-indigo-950">{efectividadCalc}%</span>
            </div>
          </div>

          {/* Selector de Categoría */}
          <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setCategoria("ALL")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                categoria === "ALL"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => setCategoria("AVERIAS")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                categoria === "AVERIAS"
                  ? "bg-sky-600 text-white shadow-xs"
                  : "text-sky-800 hover:bg-sky-100"
              }`}
            >
              <Wrench size={12} />
              Averías
            </button>
            <button
              type="button"
              onClick={() => setCategoria("POSTVENTA")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                categoria === "POSTVENTA"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-indigo-800 hover:bg-indigo-100"
              }`}
            >
              <ShoppingBag size={12} />
              Postventa
            </button>
          </div>
        </div>

        {/* ── BARRA DE BÚSQUEDA Y FILTRO RÁPIDO ── */}
        <div className="px-5 py-3 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por OT, Cliente, Cuadrilla, Dirección..."
              className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-xs font-bold">
            <span className="text-slate-400 text-[11px] mr-1">Estado:</span>
            <button
              type="button"
              onClick={() => setEstadoFiltro("TODAS")}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                estadoFiltro === "TODAS"
                  ? "bg-slate-800 text-white font-bold"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Todas ({ordenes.length})
            </button>
            <button
              type="button"
              onClick={() => setEstadoFiltro("FINALIZADAS")}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                estadoFiltro === "FINALIZADAS"
                  ? "bg-emerald-600 text-white font-bold"
                  : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
              }`}
            >
              Finalizadas ({ordenes.filter((o) => o.es_finalizada_win === 1).length})
            </button>
            <button
              type="button"
              onClick={() => setEstadoFiltro("NO_FINALIZADAS")}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                estadoFiltro === "NO_FINALIZADAS"
                  ? "bg-rose-600 text-white font-bold"
                  : "bg-rose-50 text-rose-800 hover:bg-rose-100"
              }`}
            >
              No Finalizadas ({ordenes.filter((o) => o.es_finalizada_win === 0).length})
            </button>
          </div>
        </div>

        {/* ── TABLA CON SCROLL ── */}
        <div className="flex-1 overflow-y-auto overflow-x-auto relative bg-white custom-scrollbar">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs font-bold">Cargando órdenes auditadas del mes...</span>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <AlertCircle size={32} className="mx-auto text-slate-300" />
              <p className="text-xs font-bold text-slate-600">No se encontraron órdenes con los filtros actuales.</p>
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="text-xs text-indigo-600 hover:underline font-bold"
                >
                  Limpiar búsqueda
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-20 shadow-xs border-b border-slate-200 bg-slate-100">
                <tr className="bg-slate-100 text-slate-700 text-[11px] font-black uppercase tracking-wider">
                  <th className="py-3 px-3.5 bg-slate-100 border-b border-slate-200 whitespace-nowrap">OT</th>
                  <th className="py-3 px-3.5 bg-slate-100 border-b border-slate-200 whitespace-nowrap">Fecha</th>
                  <th className="py-3 px-3.5 bg-slate-100 border-b border-slate-200">Cliente / Dirección</th>
                  <th className="py-3 px-3.5 bg-slate-100 border-b border-slate-200">Cuadrilla</th>
                  <th className="py-3 px-3.5 bg-slate-100 border-b border-slate-200">Tipo Trabajo / Motivo</th>
                  <th className="py-3 px-3.5 bg-slate-100 border-b border-slate-200 text-center whitespace-nowrap">Estado Fénix</th>
                  <th className="py-3 px-3.5 bg-slate-100 border-b border-slate-200 text-center whitespace-nowrap">Categoría WIN</th>
                  <th className="py-3 px-3.5 bg-slate-100 border-b border-slate-200 text-center whitespace-nowrap">Auditoría</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredOrders.map((o) => {
                  const isFin = o.es_finalizada_win === 1;
                  const esPv = o.categoria_win === "POSTVENTA";

                  return (
                    <tr
                      key={o.id_auditoria || o.id_orden}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-2 px-3 font-mono font-bold text-slate-900">
                        {o.numero}
                      </td>
                      <td className="py-2 px-3 text-slate-600 text-[11px] whitespace-nowrap">
                        {o.fecha_formateada || String(o.fecha_visita).slice(0, 16)}
                      </td>
                      <td className="py-2 px-3 max-w-[220px]">
                        <div className="font-bold text-slate-900 truncate" title={o.cliente}>
                          {o.cliente || "SIN NOMBRE"}
                        </div>
                        <div className="text-[10.5px] text-slate-500 truncate" title={o.direccion}>
                          {o.region_zona || o.direccion || "-"}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-slate-700 font-medium max-w-[170px] truncate" title={o.cuadrilla}>
                        {o.cuadrilla || "-"}
                      </td>
                      <td className="py-2 px-3 max-w-[190px]">
                        <div className="font-semibold text-slate-800 text-[11px] truncate" title={o.tipo_trabajo_original}>
                          {o.tipo_trabajo_original || "-"}
                        </div>
                        {o.motivo_finalizacion && (
                          <div className="text-[10px] text-slate-500 truncate" title={o.motivo_finalizacion}>
                            {o.motivo_finalizacion}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10.5px] font-bold ${
                            o.estado_original === "Finalizada"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                              : o.estado_original === "Cancelada"
                              ? "bg-rose-100 text-rose-800 border border-rose-300"
                              : o.estado_original === "Agendada"
                              ? "bg-amber-100 text-amber-800 border border-amber-300"
                              : "bg-slate-100 text-slate-700 border border-slate-300"
                          }`}
                        >
                          {o.estado_original}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[10.5px] font-black uppercase tracking-wider ${
                            esPv
                              ? "bg-indigo-100 text-indigo-900 border border-indigo-300"
                              : o.categoria_win === "AVERIAS"
                              ? "bg-sky-100 text-sky-900 border border-sky-300"
                              : "bg-amber-100 text-amber-900 border border-amber-300"
                          }`}
                        >
                          {o.categoria_win}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold ${
                            isFin
                              ? "bg-emerald-500 text-white shadow-2xs"
                              : o.es_asignada_win === 1
                              ? "bg-slate-200 text-slate-700"
                              : "bg-slate-100 text-slate-400"
                          }`}
                          title={`Regla: ${o.regla_aplicada}`}
                        >
                          {isFin ? (
                            <>
                              <CheckCircle2 size={11} /> Finalizada
                            </>
                          ) : o.es_asignada_win === 1 ? (
                            <>
                              <XCircle size={11} className="text-slate-500" /> No Finalizada
                            </>
                          ) : (
                            "Excluida"
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── FOOTER ── */}
        <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span className="font-medium">
            Mostrando <b>{filteredOrders.length}</b> de <b>{ordenes.length}</b> órdenes encontradas
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
