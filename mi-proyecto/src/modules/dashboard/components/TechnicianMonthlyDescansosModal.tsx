import React, { useState, useEffect, useMemo, useCallback } from "react";
import { API_URL } from "../../../config/api";
import {
  Calendar,
  Coffee,
  Users,
  Search,
  Download,
  RotateCw,
  X,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import * as XLSX from "xlsx";
import { getMatrizAsistencias } from "../../../services/employeeService";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: Date;
}

export interface DescansoTecnicoRow {
  id_usuario: number;
  id_trabajador?: number;
  tecnico: string;
  cuadrilla: string;
  estado: string;
  descSem1: string | number;
  descSem2: string | number;
  domingo1: string | number;
  domingo2: string | number;
  totalD: number;
  dom: number;
  lunSab: number;
  todosDias: number[];
}

export const TechnicianMonthlyDescansosModal: React.FC<Props> = ({
  isOpen,
  onClose,
  initialDate = new Date(),
}) => {
  const [fechaMes, setFechaMes] = useState<Date>(initialDate);
  const [busqueda, setBusqueda] = useState<string>("");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [loading, setLoading] = useState<boolean>(true);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [matrizRaw, setMatrizRaw] = useState<{
    trabajadores: any[];
    asistencias: any[];
    descansos: any[];
  }>({ trabajadores: [], asistencias: [], descansos: [] });

  const cleanTechName = (name: string) => {
    let tn = String(name || "").trim();
    if (tn.includes("CESPEDES SGA")) {
      const parts = tn.split("CESPEDES SGA");
      tn = parts[parts.length - 1].trim();
    } else if (tn.includes("MOTOWIN CESPEDES")) {
      const parts = tn.split("MOTOWIN CESPEDES");
      tn = parts[parts.length - 1].trim();
    }
    return tn;
  };

  const cargarDatos = useCallback(async (dateRef: Date) => {
    setLoading(true);
    try {
      const y = dateRef.getFullYear();
      const m = dateRef.getMonth();
      const fDesde = `${y}-${String(m + 1).padStart(2, "0")}-01`;
      const ultDia = new Date(y, m + 1, 0).getDate();
      const fHasta = `${y}-${String(m + 1).padStart(2, "0")}-${String(ultDia).padStart(2, "0")}`;

      const res = await getMatrizAsistencias(fDesde, fHasta);
      setMatrizRaw({
        trabajadores: res.trabajadores || [],
        asistencias: res.asistencias || [],
        descansos: res.descansos || [],
      });
    } catch (error) {
      console.error("Error al cargar programación de descansos:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      cargarDatos(fechaMes);
    }
  }, [isOpen, fechaMes, cargarDatos]);

  // Procesar filas de descansos por técnico
  const { filas, kpis, nombreMesStr } = useMemo(() => {
    const y = fechaMes.getFullYear();
    const m = fechaMes.getMonth();
    const totalDiasMes = new Date(y, m + 1, 0).getDate();
    const nombreMes = fechaMes.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
    const nombreMesCapital = nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1);

    // Mapear descansos por id_usuario / id_trabajador
    const mapDescansos = new Map<string, Set<number>>();
    const addDescanso = (key: string, dia: number) => {
      if (!mapDescansos.has(key)) mapDescansos.set(key, new Set());
      mapDescansos.get(key)!.add(dia);
    };

    // Descansos programados
    for (const d of matrizRaw.descansos) {
      if (!d.fecha_inicio || !d.fecha_fin) continue;
      let cur = new Date(d.fecha_inicio + "T00:00:00");
      const end = new Date(d.fecha_fin + "T00:00:00");
      while (cur <= end) {
        if (cur.getFullYear() === y && cur.getMonth() === m) {
          const diaNum = cur.getDate();
          if (d.id_usuario) addDescanso(`u_${d.id_usuario}`, diaNum);
          if (d.id_trabajador) addDescanso(`t_${d.id_trabajador}`, diaNum);
        }
        cur.setDate(cur.getDate() + 1);
      }
    }

    // Asistencias marcadas como descanso
    for (const a of matrizRaw.asistencias) {
      if (a.fecha && (a.estado || "").toLowerCase() === "descanso") {
        const cur = new Date(a.fecha + "T00:00:00");
        if (cur.getFullYear() === y && cur.getMonth() === m) {
          const diaNum = cur.getDate();
          if (a.id_usuario) addDescanso(`u_${a.id_usuario}`, diaNum);
          if (a.id_trabajador) addDescanso(`t_${a.id_trabajador}`, diaNum);
        }
      }
    }

    // Construir filas
    const list: DescansoTecnicoRow[] = [];
    let totalDescansosGlobal = 0;
    let totalDomingosGlobal = 0;
    let totalSemanalesGlobal = 0;
    let tecnicosConDescanso = 0;

    for (const trab of matrizRaw.trabajadores) {
      const uKey = `u_${trab.id_usuario}`;
      const tKey = `t_${trab.id_trabajador}`;
      const setU = mapDescansos.get(uKey);
      const setT = mapDescansos.get(tKey);

      const combinedDias = Array.from(
        new Set([...(setU ? Array.from(setU) : []), ...(setT ? Array.from(setT) : [])])
      ).sort((a, b) => a - b);

      const domingos: number[] = [];
      const semanales: number[] = [];

      for (const d of combinedDias) {
        const dObj = new Date(y, m, d);
        if (dObj.getDay() === 0) {
          domingos.push(d);
        } else {
          semanales.push(d);
        }
      }

      const totalD = combinedDias.length;
      if (totalD > 0) tecnicosConDescanso++;
      totalDescansosGlobal += totalD;
      totalDomingosGlobal += domingos.length;
      totalSemanalesGlobal += semanales.length;

      const cleanNom = cleanTechName(trab.nombre_completo || "");

      list.push({
        id_usuario: trab.id_usuario,
        id_trabajador: trab.id_trabajador,
        tecnico: cleanNom,
        cuadrilla: trab.cuadrilla || "",
        estado: trab.estado || "Activo",
        descSem1: semanales[0] !== undefined ? semanales[0] : "-",
        descSem2:
          semanales[1] !== undefined
            ? semanales.length > 2
              ? semanales.slice(1).join(", ")
              : semanales[1]
            : "-",
        domingo1: domingos[0] !== undefined ? domingos[0] : "-",
        domingo2:
          domingos[1] !== undefined
            ? domingos.length > 2
              ? domingos.slice(1).join(", ")
              : domingos[1]
            : "-",
        totalD,
        dom: domingos.length,
        lunSab: semanales.length,
        todosDias: combinedDias,
      });
    }

    return {
      filas: list,
      nombreMesStr: nombreMesCapital,
      kpis: {
        totalTecnicos: list.length,
        tecnicosConDescanso,
        totalDescansosGlobal,
        totalDomingosGlobal,
        totalSemanalesGlobal,
        promedio: list.length > 0 ? (totalDescansosGlobal / list.length).toFixed(1) : "0",
      },
    };
  }, [matrizRaw, fechaMes]);

  // Filtrado
  const filasFiltradas = useMemo(() => {
    let res = filas;
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase().trim();
      res = res.filter(
        (f) =>
          f.tecnico.toLowerCase().includes(q) ||
          f.cuadrilla.toLowerCase().includes(q)
      );
    }
    if (filtroEstado === "con_descanso") {
      res = res.filter((f) => f.totalD > 0);
    } else if (filtroEstado === "sin_descanso") {
      res = res.filter((f) => f.totalD === 0);
    }
    return res;
  }, [filas, busqueda, filtroEstado]);

  // Exportar a Excel
  const exportarExcel = () => {
    if (filasFiltradas.length === 0) return;
    const rowsExport = filasFiltradas.map((f, idx) => ({
      "N°": idx + 1,
      "Técnico": f.tecnico,
      "Descanso Sem. 1": f.descSem1,
      "Descanso Sem. 2": f.descSem2,
      "Domingo 1": f.domingo1,
      "Domingo 2": f.domingo2,
      "Total D": f.totalD,
      "Dom": f.dom,
      "Lun-Sáb": f.lunSab,
      "Estado": f.estado,
    }));

    const ws = XLSX.utils.json_to_sheet(rowsExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Descansos_Mes");
    XLSX.writeFile(wb, `Programacion_Descansos_${nombreMesStr.replace(/\s+/g, "_")}.xlsx`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className={`bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden transition-all duration-300 animate-in zoom-in-95 duration-150 ${
          isFullScreen ? "w-full h-full max-w-none rounded-none" : "w-full max-w-5xl max-h-[92vh]"
        }`}
      >
        {/* ── 1. CABECERA MODAL ── */}
        <div className="bg-[#1b4368] text-white p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 border-b border-[#2e75b6]/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#2e75b6] flex items-center justify-center shadow-md shadow-black/20 text-white font-black">
              <Calendar size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight">
                  Programación Mensual de Descansos
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-sky-400/20 text-sky-200 border border-sky-400/30">
                  {nombreMesStr}
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium">
                Consolidado de días de descanso semanal y domingos programados por técnico
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Navegación de Mes */}
            <div className="flex items-center gap-1 bg-white/10 p-1 rounded-xl border border-white/20">
              <button
                type="button"
                onClick={() =>
                  setFechaMes((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                }
                className="p-1 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-all cursor-pointer"
                title="Mes anterior"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="font-bold text-xs px-2 min-w-[120px] text-center capitalize">
                {nombreMesStr}
              </span>
              <button
                type="button"
                onClick={() =>
                  setFechaMes((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                }
                className="p-1 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-all cursor-pointer"
                title="Mes siguiente"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
              title={isFullScreen ? "Restaurar tamaño" : "Pantalla completa"}
            >
              {isFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-300 hover:text-white hover:bg-rose-500/30 rounded-xl transition-all cursor-pointer"
              title="Cerrar modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── 2. KPIS Y BARRA DE FILTROS ── */}
        <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 space-y-3 shrink-0">
          {/* Mini Cards KPI */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-white p-2.5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 block uppercase">Total Personal</span>
              <div className="flex items-baseline justify-between mt-0.5">
                <span className="text-lg font-black text-slate-900 font-mono">{kpis.totalTecnicos}</span>
                <span className="text-[10px] font-bold text-slate-400">100%</span>
              </div>
            </div>

            <div className="bg-white p-2.5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] font-bold text-sky-700 block uppercase">Con Descansos</span>
              <div className="flex items-baseline justify-between mt-0.5">
                <span className="text-lg font-black text-sky-900 font-mono">{kpis.tecnicosConDescanso}</span>
                <span className="text-[10px] font-bold text-sky-600">
                  {kpis.totalTecnicos > 0
                    ? `${Math.round((kpis.tecnicosConDescanso / kpis.totalTecnicos) * 100)}%`
                    : "0%"}
                </span>
              </div>
            </div>

            <div className="bg-white p-2.5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] font-bold text-purple-700 block uppercase">Total Días D</span>
              <div className="flex items-baseline justify-between mt-0.5">
                <span className="text-lg font-black text-purple-950 font-mono">{kpis.totalDescansosGlobal}</span>
                <span className="text-[10px] font-bold text-purple-600">Prom: {kpis.promedio}/tec</span>
              </div>
            </div>

            <div className="bg-white p-2.5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] font-bold text-emerald-700 block uppercase">Domingos vs Sem.</span>
              <div className="flex items-baseline justify-between mt-0.5">
                <span className="text-lg font-black text-emerald-950 font-mono">
                  {kpis.totalDomingosGlobal} <span className="text-xs text-slate-400">/</span> {kpis.totalSemanalesGlobal}
                </span>
                <span className="text-[10px] font-bold text-emerald-600">Dom / Sem</span>
              </div>
            </div>
          </div>

          {/* Buscador y Exportación */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 border-t border-slate-200/60">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por técnico o cuadrilla..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-sky-500 shadow-2xs"
                />
                {busqueda && (
                  <button
                    type="button"
                    onClick={() => setBusqueda("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs text-xs">
                <Filter size={12} className="text-slate-400" />
                <select
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  className="bg-transparent font-bold text-slate-800 text-xs focus:outline-none cursor-pointer"
                >
                  <option value="todos">Todos ({filas.length})</option>
                  <option value="con_descanso">Con Descanso</option>
                  <option value="sin_descanso">Sin Descanso</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={exportarExcel}
              disabled={loading || filasFiltradas.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              <Download size={13} />
              <span>Exportar Excel</span>
            </button>
          </div>
        </div>

        {/* ── 3. TABLA DE PROGRAMACIÓN MENSUAL ── */}
        <div className="flex-1 overflow-auto bg-slate-100 p-2 sm:p-4">
          {loading ? (
            <div className="h-96 flex flex-col items-center justify-center gap-3 bg-white rounded-2xl border border-slate-200">
              <RotateCw size={28} className="animate-spin text-[#1b4368]" />
              <p className="text-xs font-bold text-slate-600">
                Cargando programación de descansos de {nombreMesStr}...
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden">
              <div className="overflow-x-auto max-h-[58vh]">
                <table className="w-full border-collapse text-left text-xs select-none">
                  {/* Cabecera de Tabla Estilo Excel Pro */}
                  <thead className="sticky top-0 z-20 bg-[#1f4e78] text-white shadow-xs">
                    <tr>
                      <th className="py-2.5 px-4 border-r border-b border-[#2e75b6] font-black uppercase text-[11px] min-w-[220px]">
                        TÉCNICO
                      </th>
                      <th className="py-2.5 px-3 text-center border-r border-b border-[#2e75b6] font-black uppercase text-[10.5px] min-w-[100px] bg-[#1a446c]">
                        Descanso Sem.1
                      </th>
                      <th className="py-2.5 px-3 text-center border-r border-b border-[#2e75b6] font-black uppercase text-[10.5px] min-w-[100px] bg-[#1a446c]">
                        Descanso Sem.2
                      </th>
                      <th className="py-2.5 px-3 text-center border-r border-b border-[#2e75b6] font-black uppercase text-[10.5px] min-w-[90px] bg-[#173e63]">
                        Domingo 1
                      </th>
                      <th className="py-2.5 px-3 text-center border-r border-b border-[#2e75b6] font-black uppercase text-[10.5px] min-w-[90px] bg-[#173e63]">
                        Domingo 2
                      </th>
                      <th className="py-2.5 px-3 text-center border-r border-b border-[#2e75b6] font-black uppercase text-[10.5px] min-w-[70px] bg-[#153758]">
                        Total D
                      </th>
                      <th className="py-2.5 px-2.5 text-center border-r border-b border-[#2e75b6] font-black uppercase text-[10.5px] min-w-[60px] bg-[#153758]">
                        Dom
                      </th>
                      <th className="py-2.5 px-2.5 text-center border-r border-b border-[#2e75b6] font-black uppercase text-[10.5px] min-w-[65px] bg-[#153758]">
                        Lun-Sáb
                      </th>
                      <th className="py-2.5 px-3 text-center border-b border-[#2e75b6] font-black uppercase text-[10.5px] min-w-[75px] bg-[#13304d]">
                        Estado
                      </th>
                    </tr>
                  </thead>

                  {/* Cuerpo de Filas */}
                  <tbody className="divide-y divide-slate-200">
                    {filasFiltradas.map((f, idx) => {
                      const rowBg = idx % 2 === 0 ? "bg-white" : "bg-slate-50/70";
                      return (
                        <tr
                          key={`row-desc-${f.id_usuario}-${idx}`}
                          className={`${rowBg} hover:bg-sky-50/40 transition-colors`}
                        >
                          {/* Columna Técnico (Solo nombre) */}
                          <td className="py-2 px-4 border-r border-slate-300">
                            <div className="font-black text-slate-900 text-[11px] truncate max-w-[260px]" title={f.tecnico}>
                              {f.tecnico}
                            </div>
                          </td>

                          {/* Descanso Sem. 1 */}
                          <td className="py-1.5 px-2 text-center border-r border-slate-200 font-mono text-[11px] font-bold">
                            {f.descSem1 !== "-" ? (
                              <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-1.5 rounded-lg bg-sky-100 text-sky-800 border border-sky-300 font-black shadow-2xs">
                                {f.descSem1}
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>

                          {/* Descanso Sem. 2 */}
                          <td className="py-1.5 px-2 text-center border-r border-slate-200 font-mono text-[11px] font-bold">
                            {f.descSem2 !== "-" ? (
                              <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-1.5 rounded-lg bg-sky-100 text-sky-800 border border-sky-300 font-black shadow-2xs">
                                {f.descSem2}
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>

                          {/* Domingo 1 */}
                          <td className="py-1.5 px-2 text-center border-r border-slate-200 font-mono text-[11px] font-bold">
                            {f.domingo1 !== "-" ? (
                              <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-1.5 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200 font-black shadow-2xs">
                                {f.domingo1}
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>

                          {/* Domingo 2 */}
                          <td className="py-1.5 px-2 text-center border-r border-slate-200 font-mono text-[11px] font-bold">
                            {f.domingo2 !== "-" ? (
                              <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-1.5 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200 font-black shadow-2xs">
                                {f.domingo2}
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>

                          {/* Total D */}
                          <td className="py-1.5 px-2 text-center border-r border-slate-200 font-mono text-[11px] font-black bg-slate-50">
                            <span
                              className={`px-2 py-0.5 rounded-md ${
                                f.totalD >= 4
                                  ? "bg-emerald-100 text-emerald-900 border border-emerald-300 font-black"
                                  : f.totalD > 0
                                  ? "bg-sky-100 text-sky-900 border border-sky-300 font-bold"
                                  : "text-slate-400"
                              }`}
                            >
                              {f.totalD}
                            </span>
                          </td>

                          {/* Dom */}
                          <td className="py-1.5 px-2 text-center border-r border-slate-200 font-mono text-[11px] font-bold text-slate-700 bg-slate-50/60">
                            {f.dom}
                          </td>

                          {/* Lun-Sáb */}
                          <td className="py-1.5 px-2 text-center border-r border-slate-200 font-mono text-[11px] font-bold text-slate-700 bg-slate-50/60">
                            {f.lunSab}
                          </td>

                          {/* Estado */}
                          <td className="py-1.5 px-2 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {f.estado || "Activo"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}

                    {filasFiltradas.length === 0 && (
                      <tr>
                        <td colSpan={9} className="p-12 text-center text-slate-400 font-bold">
                          No se encontraron técnicos para los filtros seleccionados.
                        </td>
                      </tr>
                    )}
                  </tbody>

                  {/* ── Fila de Suma Total ── */}
                  {filasFiltradas.length > 0 && (
                    <tfoot className="sticky bottom-0 z-20 bg-[#d9e1f2] text-[#1f3864] font-black border-t-2 border-slate-400">
                      <tr>
                        <td className="py-2 px-4 border-r border-slate-400 uppercase text-[10px] font-black">
                          SUMA TOTAL ({filasFiltradas.length} Técnicos)
                        </td>
                        <td className="py-1.5 px-2 text-center border-r border-slate-400 font-mono text-[11px] font-black">
                          -
                        </td>
                        <td className="py-1.5 px-2 text-center border-r border-slate-400 font-mono text-[11px] font-black">
                          -
                        </td>
                        <td className="py-1.5 px-2 text-center border-r border-slate-400 font-mono text-[11px] font-black">
                          -
                        </td>
                        <td className="py-1.5 px-2 text-center border-r border-slate-400 font-mono text-[11px] font-black">
                          -
                        </td>
                        <td className="py-1.5 px-2 text-center border-r border-slate-400 font-mono text-[11px] font-black bg-[#c6d9f1]">
                          {filasFiltradas.reduce((acc, cur) => acc + cur.totalD, 0)}
                        </td>
                        <td className="py-1.5 px-2 text-center border-r border-slate-400 font-mono text-[11px] font-black bg-[#c6d9f1]">
                          {filasFiltradas.reduce((acc, cur) => acc + cur.dom, 0)}
                        </td>
                        <td className="py-1.5 px-2 text-center border-r border-slate-400 font-mono text-[11px] font-black bg-[#c6d9f1]">
                          {filasFiltradas.reduce((acc, cur) => acc + cur.lunSab, 0)}
                        </td>
                        <td className="py-1.5 px-2 text-center font-mono text-[11px] font-black bg-[#b4c6e7]">
                          {filasFiltradas.length} Activos
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── 4. FOOTER MODAL ── */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-4 text-slate-500 font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-sky-100 border border-sky-300 text-sky-800 font-bold text-[9px] flex items-center justify-center">D</span>
              Descanso Semanal
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-indigo-50 border border-indigo-200 text-indigo-800 font-bold text-[9px] flex items-center justify-center">Dom</span>
              Descanso Domingo
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
