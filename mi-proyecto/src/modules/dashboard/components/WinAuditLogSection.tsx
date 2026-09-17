import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ShieldCheck,
  Search,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Layers,
  Wrench,
  ShoppingBag,
  Filter,
  Calendar,
  Sparkles,
  HelpCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import * as XLSX from "xlsx";
import { API_URL } from "../../../config/api";

interface AuditException {
  id_auditoria: number;
  id_orden: number;
  numero: string;
  cliente: string;
  fecha_visita: string;
  fecha_formateada: string;
  anio: number;
  mes: number;
  cuadrilla: string;
  tipo_trabajo_original: string;
  tipo_trabajo_asignado: string;
  motivo_finalizacion: string;
  producto: string;
  estado_original: string;
  categoria_win: string;
  es_asignada_win: number;
  es_finalizada_win: number;
  regla_aplicada: string;
  tipo_excepcion: string;
  sustento_tecnico: string;
  direccion?: string;
  region_zona?: string;
  tecnico_asignado?: string;
}

interface WinAuditLogSectionProps {
  anio: number;
}

export const WinAuditLogSection: React.FC<WinAuditLogSectionProps> = ({ anio }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [mesFiltro, setMesFiltro] = useState<string>("ALL");
  const [tipoFiltro, setTipoFiltro] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [excepciones, setExcepciones] = useState<AuditException[]>([]);

  const mesesNombres = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const cargarBitacora = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/api/dashboard/bitacora-excepciones-win?anio=${anio}`;
      if (mesFiltro !== "ALL") {
        url += `&mes=${mesFiltro}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error("Error al consultar bitácora de auditoría");
      const json = await res.json();
      if (json && json.success) {
        setExcepciones(json.excepciones || []);
      }
    } catch (err) {
      console.error("Error al cargar bitácora WIN:", err);
    } finally {
      setLoading(false);
    }
  }, [anio, mesFiltro]);

  useEffect(() => {
    cargarBitacora();
  }, [cargarBitacora]);

  // Filtrado
  const filteredList = useMemo(() => {
    return excepciones.filter((e) => {
      // Filtro tipo
      if (tipoFiltro !== "ALL") {
        if (tipoFiltro === "CIERRE_MES" && e.tipo_excepcion !== "CIERRE_MES_AGENDADA_FIN") return false;
        if (tipoFiltro === "PEXT" && e.categoria_win !== "PEXT_EXCLUIDO") return false;
        if (tipoFiltro === "ORDENAMIENTO" && e.categoria_win !== "ORDENAMIENTO_EXCLUIDO") return false;
        if (tipoFiltro === "POSTVENTA_TRASLADO" && e.tipo_excepcion !== "POSTVENTA_CUADRILLA_TRASLADO") return false;
        if (tipoFiltro === "AVERIA_TRASLADO" && e.tipo_excepcion !== "AVERIA_EN_CUADRILLA_TRASLADO") return false;
      }

      // Filtro de texto
      if (!searchTerm.trim()) return true;
      const t = searchTerm.toLowerCase();
      return (
        (e.numero && e.numero.toLowerCase().includes(t)) ||
        (e.cliente && e.cliente.toLowerCase().includes(t)) ||
        (e.cuadrilla && e.cuadrilla.toLowerCase().includes(t)) ||
        (e.tipo_trabajo_original && e.tipo_trabajo_original.toLowerCase().includes(t)) ||
        (e.motivo_finalizacion && e.motivo_finalizacion.toLowerCase().includes(t)) ||
        (e.sustento_tecnico && e.sustento_tecnico.toLowerCase().includes(t)) ||
        (e.direccion && e.direccion.toLowerCase().includes(t))
      );
    });
  }, [excepciones, tipoFiltro, searchTerm]);

  // Contadores para KPIs
  const conteos = useMemo(() => {
    return {
      cierreMes: excepciones.filter((e) => e.tipo_excepcion === "CIERRE_MES_AGENDADA_FIN").length,
      pext: excepciones.filter((e) => e.categoria_win === "PEXT_EXCLUIDO").length,
      ordenamiento: excepciones.filter((e) => e.categoria_win === "ORDENAMIENTO_EXCLUIDO").length,
      pvTraslado: excepciones.filter((e) => e.tipo_excepcion === "POSTVENTA_CUADRILLA_TRASLADO").length,
      avTraslado: excepciones.filter((e) => e.tipo_excepcion === "AVERIA_EN_CUADRILLA_TRASLADO").length,
    };
  }, [excepciones]);

  // Exportar Excel
  const handleExportExcel = () => {
    if (filteredList.length === 0) return;

    const dataRows = filteredList.map((e) => ({
      OT: e.numero,
      Mes: mesesNombres[e.mes - 1] || `Mes ${e.mes}`,
      Fecha: e.fecha_formateada || e.fecha_visita,
      Cliente: e.cliente,
      Cuadrilla: e.cuadrilla,
      "Técnico Asignado": e.tecnico_asignado || "-",
      "Tipo Trabajo": e.tipo_trabajo_original || "-",
      "Motivo Finalización": e.motivo_finalizacion || "-",
      "Estado en Fénix": e.estado_original,
      "Categoría Auditada WIN": e.categoria_win,
      "Asignada WIN": e.es_asignada_win === 1 ? "SI" : "NO",
      "Finalizada WIN": e.es_finalizada_win === 1 ? "SI" : "NO",
      "Tipo de Regla": e.tipo_excepcion,
      "Sustento Técnico Oficial": e.sustento_tecnico,
      Dirección: e.direccion || "-",
      Distrito: e.region_zona || "-",
    }));

    const ws = XLSX.utils.json_to_sheet(dataRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bitacora_WIN");
    XLSX.writeFile(wb, `Bitacora_Auditoria_WIN_${anio}.xlsx`);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden text-slate-800">
      {/* ── HEADER DE LA BITÁCORA ── */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-wrap items-center justify-between gap-3 border-b border-indigo-900/50">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 rounded-2xl shadow-inner">
            <ShieldCheck size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-black tracking-tight text-white flex items-center gap-2">
                Bitácora de Auditoría y Excepciones WIN
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 font-mono">
                Año {anio}
              </span>
            </div>
            <p className="text-xs text-slate-300 font-medium mt-0.5">
              Sustento técnico formal y justificación documentada ante la supervisión de WIN para órdenes con reglas especiales.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-emerald-950/30 cursor-pointer"
            title="Descargar bitácora completa en Excel"
          >
            <FileSpreadsheet size={15} />
            <span>Exportar Bitácora ({filteredList.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer"
            title={isExpanded ? "Ocultar panel" : "Mostrar panel"}
          >
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 sm:p-5 space-y-4">
          {/* ── KPI CARDS DE REGLAS ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 block">Total en Bitácora:</span>
              <span className="text-lg font-black font-mono text-slate-900">{excepciones.length}</span>
            </div>

            <div className="bg-amber-50/80 p-3 rounded-2xl border border-amber-200 shadow-2xs">
              <span className="text-[11px] font-bold text-amber-800 block">Cierres Fin de Mes:</span>
              <span className="text-lg font-black font-mono text-amber-950">{conteos.cierreMes}</span>
            </div>

            <div className="bg-rose-50/80 p-3 rounded-2xl border border-rose-200 shadow-2xs">
              <span className="text-[11px] font-bold text-rose-800 block">Exclusiones PEXT:</span>
              <span className="text-lg font-black font-mono text-rose-950">{conteos.pext}</span>
            </div>

            <div className="bg-purple-50/80 p-3 rounded-2xl border border-purple-200 shadow-2xs">
              <span className="text-[11px] font-bold text-purple-800 block">Exclusiones Ordenamiento:</span>
              <span className="text-lg font-black font-mono text-purple-950">{conteos.ordenamiento}</span>
            </div>

            <div className="bg-indigo-50/80 p-3 rounded-2xl border border-indigo-200 shadow-2xs col-span-2 sm:col-span-1">
              <span className="text-[11px] font-bold text-indigo-800 block">Traslados/Equipos:</span>
              <span className="text-lg font-black font-mono text-indigo-950">
                {conteos.pvTraslado + conteos.avTraslado}
              </span>
            </div>
          </div>

          {/* ── BARRA DE FILTROS ── */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 p-3 rounded-2xl border border-slate-200">
            {/* Buscador */}
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por OT, Cliente, Cuadrilla o Sustento..."
                className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Filtro Mes */}
              <select
                value={mesFiltro}
                onChange={(e) => setMesFiltro(e.target.value)}
                className="py-1.5 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="ALL">Todos los Meses</option>
                {mesesNombres.map((m, idx) => (
                  <option key={idx + 1} value={String(idx + 1)}>
                    {m}
                  </option>
                ))}
              </select>

              {/* Filtro Tipo de Excepción */}
              <select
                value={tipoFiltro}
                onChange={(e) => setTipoFiltro(e.target.value)}
                className="py-1.5 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="ALL">Todas las Reglas</option>
                <option value="CIERRE_MES">Cierres Fin de Mes (Auditadas Fin)</option>
                <option value="PEXT">Exclusiones PEXT / Normalización</option>
                <option value="ORDENAMIENTO">Exclusiones Cuadrillas Ordenamiento (O)</option>
                <option value="POSTVENTA_TRASLADO">Postventa en Cuadrilla Traslado</option>
                <option value="AVERIA_TRASLADO">Avería Técnica Protegida</option>
              </select>
            </div>
          </div>

          {/* ── TABLA DE BITÁCORA ── */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-96 overflow-y-auto shadow-2xs">
            {loading ? (
              <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-400">
                <div className="w-7 h-7 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs font-bold">Cargando bitácora de auditoría...</span>
              </div>
            ) : filteredList.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No se encontraron registros de excepciones para los filtros seleccionados.
              </div>
            ) : (
              <table className="w-full text-left text-xs border-separate border-spacing-0">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 text-[11px] font-black uppercase sticky top-0 z-10 shadow-xs">
                    <th className="py-2.5 px-3 border-b border-slate-200">OT</th>
                    <th className="py-2.5 px-3 border-b border-slate-200">Mes / Fecha</th>
                    <th className="py-2.5 px-3 border-b border-slate-200">Cliente / Cuadrilla</th>
                    <th className="py-2.5 px-3 text-center border-b border-slate-200">Estado Fénix</th>
                    <th className="py-2.5 px-3 text-center border-b border-slate-200">Auditoría WIN</th>
                    <th className="py-2.5 px-3 border-b border-slate-200">Sustento Técnico Oficial (WIN)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredList.map((e) => {
                    const isFin = e.es_finalizada_win === 1;

                    return (
                      <tr key={e.id_auditoria || e.id_orden} className="hover:bg-slate-50/90 transition-colors">
                        <td className="py-2 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                          {e.numero}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap text-[11px] text-slate-600">
                          <span className="font-bold text-slate-800 block">
                            {mesesNombres[e.mes - 1] || `Mes ${e.mes}`}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {e.fecha_formateada || String(e.fecha_visita).slice(0, 16)}
                          </span>
                        </td>
                        <td className="py-2 px-3 max-w-[200px]">
                          <div className="font-bold text-slate-900 truncate" title={e.cliente}>
                            {e.cliente || "SIN NOMBRE"}
                          </div>
                          <div className="text-[10.5px] text-slate-500 truncate" title={e.cuadrilla}>
                            {e.cuadrilla || "-"}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              e.estado_original === "Finalizada"
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                : e.estado_original === "Cancelada"
                                ? "bg-rose-100 text-rose-800 border border-rose-300"
                                : e.estado_original === "Agendada"
                                ? "bg-amber-100 text-amber-800 border border-amber-300"
                                : "bg-slate-100 text-slate-700 border border-slate-300"
                            }`}
                          >
                            {e.estado_original}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          <div className="space-y-0.5">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                                e.categoria_win === "POSTVENTA"
                                  ? "bg-indigo-100 text-indigo-900 border border-indigo-300"
                                  : e.categoria_win === "AVERIAS"
                                  ? "bg-sky-100 text-sky-900 border border-sky-300"
                                  : "bg-amber-100 text-amber-900 border border-amber-300"
                              }`}
                            >
                              {e.categoria_win}
                            </span>
                            <span
                              className={`block text-[9.5px] font-bold ${
                                isFin ? "text-emerald-700" : e.es_asignada_win === 1 ? "text-slate-600" : "text-slate-400"
                              }`}
                            >
                              {isFin ? "✓ Finalizada" : e.es_asignada_win === 1 ? "Asignada" : "Excluida"}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-slate-700 text-[11px] leading-relaxed">
                          <div className="bg-slate-50/90 p-2 rounded-xl border border-slate-200/80">
                            <span className="font-black text-indigo-900 block text-[10.5px]">
                              {e.regla_aplicada}
                            </span>
                            <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                              {e.sustento_tecnico}
                            </p>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
