import React, { useState, useMemo } from "react";
import {
  X,
  Clock,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileSpreadsheet,
  Search,
  ArrowUpDown,
  Truck,
} from "lucide-react";
import * as XLSX from "xlsx";

export interface DetalleOrdenLatencia {
  id_orden: number;
  numero: string;
  cliente: string;
  tipo_trabajo: string;
  cuadrilla: string;
  tecnico: string;
  id_tecnico: number;
  fecha: string;
  hora_inicio: string;
  hora_asignacion: string | null;
  hora_en_camino: string | null;
  estado: string;
  motivo_finalizacion: string | null;
  diff_minutos: number | string;
  latencia_demora: number;
  diff_real: number;
  semaforo: "verde" | "amarillo" | "rojo";
}

export interface TecnicoRankingLatencia {
  id_tecnico: number;
  tecnico: string;
  cuadrilla: string;
  dias_laborados: number;
  latencia_promedio_min: number;
  hora_promedio_inicio: string;
  min_latencia: number;
  max_latencia: number;
  conteo_verde: number;
  conteo_amarillo: number;
  conteo_rojo: number;
  porcentaje_puntual: number;
  semaforo: "verde" | "amarillo" | "rojo";
}

interface LatencyFirstLegModalProps {
  isOpen: boolean;
  onClose: () => void;
  tecnico: TecnicoRankingLatencia | null;
  ordenes: DetalleOrdenLatencia[];
  periodoTexto: string;
}

export const LatencyFirstLegModal: React.FC<LatencyFirstLegModalProps> = ({
  isOpen,
  onClose,
  tecnico,
  ordenes,
  periodoTexto,
}) => {
  const [busqueda, setBusqueda] = useState("");
  const [filtroSemaforo, setFiltroSemaforo] = useState<"todos" | "verde" | "amarillo" | "rojo">("todos");
  const [ordenAsc, setOrdenAsc] = useState<boolean>(true);

  const ordenesTecnico = useMemo(() => {
    if (!isOpen || !tecnico || !Array.isArray(ordenes)) return [];
    const tecNombre = (tecnico?.tecnico || "").trim().toLowerCase();
    return ordenes.filter((o) => {
      if (!o) return false;
      const oTec = (o.tecnico || "").trim().toLowerCase();
      if (tecNombre && oTec === tecNombre) return true;
      if (tecnico?.id_tecnico && Number(tecnico.id_tecnico) > 0 && Number(o.id_tecnico) === Number(tecnico.id_tecnico)) return true;
      return false;
    });
  }, [isOpen, ordenes, tecnico]);

  const ordenesFiltradas = useMemo(() => {
    if (!isOpen || !tecnico) return [];
    let list = [...ordenesTecnico];

    if (filtroSemaforo !== "todos") {
      list = list.filter((o) => o?.semaforo === filtroSemaforo);
    }

    if (busqueda && busqueda.trim()) {
      const q = busqueda.toLowerCase().trim();
      list = list.filter(
        (o) =>
          String(o.numero || "").toLowerCase().includes(q) ||
          String(o.cliente || "").toLowerCase().includes(q) ||
          String(o.tipo_trabajo || "").toLowerCase().includes(q) ||
          String(o.fecha || "").toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      const fA = String(a?.fecha || "");
      const fB = String(b?.fecha || "");
      const dateComp = fA.localeCompare(fB);
      return ordenAsc ? dateComp : -dateComp;
    });

    return list;
  }, [isOpen, tecnico, ordenesTecnico, filtroSemaforo, busqueda, ordenAsc]);

  const exportarExcel = () => {
    if (!tecnico) return;
    const dataParaExportar = ordenesFiltradas.map((o) => ({
      Fecha: o.fecha,
      "N° Orden": o.numero,
      Cliente: o.cliente,
      Técnico: o.tecnico,
      Cuadrilla: o.cuadrilla,
      "Tipo de Trabajo": o.tipo_trabajo,
      "Hora Asignación": o.hora_asignacion || "-",
      "Hora En Camino": o.hora_en_camino || "-",
      "Hora Inicio": o.hora_inicio || "-",
      "Latencia (Minutos)": o.latencia_demora,
      "Diferencia Real (Min)": o.diff_real,
      Semáforo:
        o.semaforo === "verde"
          ? "Puntual (<=30 min)"
          : o.semaforo === "amarillo"
            ? "Aceptable (31-50 min)"
            : "Crítico (>50 min)",
      Estado: o.estado,
    }));

    const ws = XLSX.utils.json_to_sheet(dataParaExportar);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Latencia Primer Tramo");
    const tecClean = String(tecnico?.tecnico || "tecnico").replace(/\s+/g, "_");
    XLSX.writeFile(
      wb,
      `Latencia_1er_Tramo_${tecClean}_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  if (!isOpen || !tecnico) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* ENCABEZADO */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-5 sm:p-6 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Cerrar ventana"
          >
            <X size={20} />
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pr-10">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-black tracking-tight">{tecnico.tecnico || "Técnico"}</h2>
                  <span
                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${tecnico.semaforo === "verde"
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : tecnico.semaforo === "amarillo"
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                          : "bg-red-500/20 text-red-300 border-red-500/40"
                      }`}
                  >
                    {tecnico.semaforo === "verde"
                      ? "Puntual"
                      : tecnico.semaforo === "amarillo"
                        ? "Aceptable"
                        : "Crítico"}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                  <Truck size={13} className="text-slate-400" />
                  <span>{tecnico.cuadrilla || "Cuadrilla sin asignar"}</span>
                  <span className="text-slate-500">•</span>
                  <Calendar size={13} className="text-slate-400" />
                  <span>{periodoTexto || "Período actual"}</span>
                </p>
              </div>
            </div>

            {/* BOTÓN EXPORTAR EXCEL */}
            <button
              type="button"
              onClick={exportarExcel}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs shadow-md transition-all cursor-pointer shrink-0 self-start sm:self-auto"
            >
              <FileSpreadsheet size={15} />
              <span>Exportar Excel</span>
            </button>
          </div>

          {/* TARJETAS RESUMEN DEL TÉCNICO */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5">
            <div className="bg-white/5 border border-white/10 p-3 rounded-2xl">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Latencia Promedio</span>
              <span className="text-xl font-black text-white">{tecnico.latencia_promedio_min ?? 0} min</span>
              <span className="text-[10px] text-indigo-300 block mt-0.5">Desde 08:00 AM</span>
            </div>

            <div className="bg-white/5 border border-white/10 p-3 rounded-2xl">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Hora Promedio Inicio</span>
              <span className="text-xl font-black text-white">{tecnico.hora_promedio_inicio || "08:00"}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">{tecnico.dias_laborados ?? 0} días evaluados</span>
            </div>

            <div className="bg-white/5 border border-white/10 p-3 rounded-2xl">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">% Puntualidad</span>
              <span className="text-xl font-black text-emerald-400">{tecnico.porcentaje_puntual ?? 0}%</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">≤ 30 min retraso</span>
            </div>

            <div className="bg-white/5 border border-white/10 p-3 rounded-2xl">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Rango Min / Max</span>
              <span className="text-xl font-black text-white">
                {Number.isFinite(Number(tecnico.min_latencia)) ? Number(tecnico.min_latencia) : 0}m /{" "}
                {Number.isFinite(Number(tecnico.max_latencia)) ? Number(tecnico.max_latencia) : 0}m
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Variación del período</span>
            </div>
          </div>
        </div>

        {/* BARRA DE FILTROS */}
        <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por orden, cliente..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
            <button
              type="button"
              onClick={() => setFiltroSemaforo("todos")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${filtroSemaforo === "todos"
                  ? "bg-slate-800 text-white shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
            >
              Todos ({ordenesTecnico.length})
            </button>
            <button
              type="button"
              onClick={() => setFiltroSemaforo("verde")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${filtroSemaforo === "verde"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50"
                }`}
            >
              <CheckCircle2 size={12} />
              <span>≤ 30m ({tecnico.conteo_verde ?? 0})</span>
            </button>
            <button
              type="button"
              onClick={() => setFiltroSemaforo("amarillo")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${filtroSemaforo === "amarillo"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-white text-amber-700 border border-amber-200 hover:bg-amber-50"
                }`}
            >
              <AlertTriangle size={12} />
              <span>31-50m ({tecnico.conteo_amarillo ?? 0})</span>
            </button>
            <button
              type="button"
              onClick={() => setFiltroSemaforo("rojo")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${filtroSemaforo === "rojo"
                  ? "bg-red-600 text-white shadow-xs"
                  : "bg-white text-red-700 border border-red-200 hover:bg-red-50"
                }`}
            >
              <XCircle size={12} />
              <span>&gt; 50m ({tecnico.conteo_rojo ?? 0})</span>
            </button>

            <button
              type="button"
              onClick={() => setOrdenAsc(!ordenAsc)}
              className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 transition-all cursor-pointer ml-1"
              title="Cambiar orden de fecha"
            >
              <ArrowUpDown size={14} />
            </button>
          </div>
        </div>

        {/* TABLA DE DETALLE */}
        <div className="flex-1 overflow-y-auto p-4">
          {ordenesFiltradas.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              No se encontraron registros de primeras visitas para este filtro.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-3">Fecha</th>
                    <th className="p-3">N° Orden</th>
                    <th className="p-3">Cliente / Tipo</th>
                    <th className="p-3 text-center">Asignación</th>
                    <th className="p-3 text-center">En Camino</th>
                    <th className="p-3 text-center">Hora Inicio</th>
                    <th className="p-3 text-center">Latencia Real</th>
                    <th className="p-3 text-center">Semáforo</th>
                    <th className="p-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {ordenesFiltradas.map((ord) => {
                    const esAnticipado = ord.diff_real < 0;
                    return (
                      <tr key={ord.id_orden} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 font-mono font-bold whitespace-nowrap text-slate-900">{ord.fecha}</td>
                        <td className="p-3 font-mono font-black text-indigo-600 whitespace-nowrap">{ord.numero}</td>
                        <td className="p-3 max-w-[200px] truncate">
                          <span className="font-bold text-slate-900 block truncate">{ord.cliente}</span>
                          <span className="text-[10px] text-slate-500 font-semibold">{ord.tipo_trabajo}</span>
                        </td>
                        <td className="p-3 text-center font-mono text-slate-600">
                          {ord.hora_asignacion ? String(ord.hora_asignacion).slice(0, 5) : "-"}
                        </td>
                        <td className="p-3 text-center font-mono text-slate-600">
                          {ord.hora_en_camino ? String(ord.hora_en_camino).slice(0, 5) : "-"}
                        </td>
                        <td className="p-3 text-center font-mono font-black text-slate-900">
                          {ord.hora_inicio ? String(ord.hora_inicio).slice(0, 5) : "-"}
                        </td>
                        <td className="p-3 text-center">
                          <div className="inline-flex flex-col items-center">
                            <span
                              className={`font-black font-mono px-2 py-0.5 rounded-md text-[11px] ${ord.semaforo === "verde"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : ord.semaforo === "amarillo"
                                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                                    : "bg-red-50 text-red-700 border border-red-200"
                                }`}
                            >
                              {ord.latencia_demora} min
                            </span>
                            {esAnticipado && (
                              <span className="text-[9px] text-emerald-600 font-semibold">
                                ({Math.abs(ord.diff_real)}m antes)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          {ord.semaforo === "verde" ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-[10px] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 size={11} />
                              <span>Puntual</span>
                            </span>
                          ) : ord.semaforo === "amarillo" ? (
                            <span className="inline-flex items-center gap-1 text-amber-700 font-bold text-[10px] bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              <AlertTriangle size={11} />
                              <span>Aceptable</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-700 font-bold text-[10px] bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                              <XCircle size={11} />
                              <span>Crítico</span>
                            </span>
                          )}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {ord.estado}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* PIE DE PÁGINA */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>
            Mostrando <b>{ordenesFiltradas.length}</b> de <b>{ordenesTecnico.length}</b> órdenes matutinas evaluadas.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 active:scale-95 text-slate-800 font-bold transition-all cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
