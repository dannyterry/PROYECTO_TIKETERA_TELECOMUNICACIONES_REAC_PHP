import React, { useState, useEffect, useMemo, useCallback } from "react";
import { API_URL } from "../../../config/api";
import {
  Calendar,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  Download,
  Search,
  RotateCw,
  X,
  AlertTriangle,
  TrendingUp,
  Maximize2,
  Minimize2,
  Layers,
  ArrowUpDown,
  Check,
  Award
} from "lucide-react";
import * as XLSX from "xlsx";

export interface DailyTechData {
  id_tecnico: number;
  tecnico: string;
  cuadrilla: string;
  estado_usuario?: string;
  fechas: Record<
    string,
    {
      total: number;
      finalizadas: number;
      canceladas: number;
      asignadas: number;
      iniciadas: number;
      regestion: number;
      es_descanso?: boolean;
      es_falta?: boolean;
      estados: Record<string, number>;
    }
  >;
  totales: {
    total_ordenes: number;
    finalizadas: number;
    canceladas: number;
    asignadas: number;
    iniciadas: number;
    regestion: number;
    dias_trabajados: number;
    dias_sin_ordenes: number;
    dias_descanso?: number;
    dias_falta?: number;
    efectividad: number;
  };
}

export interface DailyMatrixResponse {
  success: boolean;
  filtros: {
    desde: string;
    hasta: string;
    periodo?: string;
    tecnico?: string;
    estado?: string;
  };
  fechas: string[];
  estados: string[];
  totales_por_fecha: Record<
    string,
    {
      total: number;
      finalizadas: number;
      canceladas: number;
      asignadas: number;
      iniciadas: number;
      regestion: number;
      tecnicos_activos: number;
    }
  >;
  tecnicos: DailyTechData[];
}

interface TechnicianDailyMatrixModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDesde?: string;
  initialHasta?: string;
  initialPeriodo?: string;
}

export const TechnicianDailyMatrixModal: React.FC<TechnicianDailyMatrixModalProps> = ({
  isOpen,
  onClose,
  initialDesde,
  initialHasta,
  initialPeriodo = "mes",
}) => {
  const getInitialDates = () => {
    const hoy = new Date();
    const fmt = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };
    if (initialDesde && initialHasta) {
      return { desde: initialDesde, hasta: initialHasta };
    }
    const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    return { desde: fmt(primero), hasta: fmt(hoy) };
  };

  const [fechas, setFechas] = useState(getInitialDates);
  const [periodoActivo, setPeriodoActivo] = useState<string>(initialPeriodo);
  const [filtroInactividad, setFiltroInactividad] = useState<"todos" | "solo_activos" | "solo_inactivos" | "solo_con_ordenes" | "con_dias_sin_orden">("todos");
  const [busqueda, setBusqueda] = useState<string>("");
  const [ordenarPor, setOrdenarPor] = useState<"tecnico" | "total" | "finalizadas" | "dias_trabajados" | "dias_sin_ordenes" | "dias_descanso" | "efectividad">("finalizadas");
  const [ordenAsc, setOrdenAsc] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<DailyMatrixResponse | null>(null);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);

  // Cargar datos desde la API
  const cargarDatos = useCallback(async (desdeOverride?: string, hastaOverride?: string, pOverride?: string) => {
    setLoading(true);
    try {
      const d = desdeOverride || fechas.desde;
      const h = hastaOverride || fechas.hasta;
      const p = pOverride !== undefined ? pOverride : periodoActivo;
      const url = `${API_URL}/api/dashboard/rendimiento-tecnicos-fechas?desde=${d}&hasta=${h}${p ? `&periodo=${p}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Error al obtener matriz diaria");
      const json: DailyMatrixResponse = await res.json();
      if (json && json.success) {
        setData(json);
      }
    } catch (err) {
      console.error("Error cargando matriz diaria:", err);
    } finally {
      setLoading(false);
    }
  }, [fechas.desde, fechas.hasta, periodoActivo]);

  useEffect(() => {
    if (isOpen) {
      cargarDatos();
    }
  }, [isOpen, cargarDatos]);

  // Manejar selector de periodos predeterminados
  const handlePeriodoChange = (p: string) => {
    setPeriodoActivo(p);
    const hoy = new Date();
    const fmt = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    let nDesde = fechas.desde;
    let nHasta = fechas.hasta;

    if (p === "hoy") {
      nDesde = fmt(hoy);
      nHasta = fmt(hoy);
    } else if (p === "ayer") {
      const ayer = new Date(hoy);
      ayer.setDate(hoy.getDate() - 1);
      nDesde = fmt(ayer);
      nHasta = fmt(ayer);
    } else if (p === "semana") {
      const lunes = new Date(hoy);
      lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
      const domingo = new Date(lunes);
      domingo.setDate(lunes.getDate() + 6);
      nDesde = fmt(lunes);
      nHasta = fmt(domingo);
    } else if (p === "mes") {
      const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      const ultimo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
      nDesde = fmt(primero);
      nHasta = fmt(ultimo);
    } else if (p === "mes_anterior") {
      const primeroAnt = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      const ultimoAnt = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
      nDesde = fmt(primeroAnt);
      nHasta = fmt(ultimoAnt);
    }

    setFechas({ desde: nDesde, hasta: nHasta });
    cargarDatos(nDesde, nHasta, p);
  };

  // Fechas y columnas procesadas
  const fechasProcesadas = useMemo(() => {
    if (!data || !data.fechas) return [];
    return data.fechas.map((fStr) => {
      const [y, m, d] = fStr.split("-").map(Number);
      const dateObj = new Date(y, m - 1, d);
      const diaNum = d;
      const diaSemana = dateObj.toLocaleDateString("es-ES", { weekday: "short" }).toUpperCase().replace(".", "");
      const isDomingo = dateObj.getDay() === 0;
      const isSabado = dateObj.getDay() === 6;
      const isFinDeSemana = isDomingo || isSabado;

      const hoyStr = new Date().toISOString().slice(0, 10);
      const isHoy = fStr === hoyStr;

      const totalDia = data.totales_por_fecha[fStr]?.total || 0;
      const tieneActividad = totalDia > 0;

      return {
        fechaStr: fStr,
        diaNum,
        diaSemana,
        isDomingo,
        isSabado,
        isFinDeSemana,
        isHoy,
        totalDia,
        tieneActividad
      };
    });
  }, [data]);

  // Columnas visibles (todas las fechas procesadas del rango)
  const columnasFechasVisibles = fechasProcesadas;

  // Filtrar y ordenar técnicos
  const tecnicosFiltrados = useMemo(() => {
    if (!data || !data.tecnicos) return [];
    let list = [...data.tecnicos];

    // Búsqueda por nombre o cuadrilla
    if (busqueda.trim()) {
      const term = busqueda.toLowerCase().trim();
      list = list.filter(
        (t) =>
          t.tecnico.toLowerCase().includes(term) ||
          (t.cuadrilla && t.cuadrilla.toLowerCase().includes(term))
      );
    }

    // Filtro de técnicos: Activos / Inactivos / Con Órdenes / Con Días sin Órdenes
    if (filtroInactividad === "solo_activos") {
      list = list.filter((t) => (t.estado_usuario || "activo").toLowerCase() === "activo");
    } else if (filtroInactividad === "solo_inactivos") {
      list = list.filter((t) => (t.estado_usuario || "").toLowerCase() === "inactivo");
    } else if (filtroInactividad === "solo_con_ordenes") {
      list = list.filter((t) => t.totales.total_ordenes > 0);
    } else if (filtroInactividad === "con_dias_sin_orden") {
      list = list.filter((t) => t.totales.dias_sin_ordenes > 0);
    }

    // Ordenamiento
    list.sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;

      if (ordenarPor === "tecnico") {
        valA = a.tecnico.toLowerCase();
        valB = b.tecnico.toLowerCase();
        return ordenAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else if (ordenarPor === "total") {
        valA = a.totales.total_ordenes;
        valB = b.totales.total_ordenes;
      } else if (ordenarPor === "finalizadas") {
        valA = a.totales.finalizadas;
        valB = b.totales.finalizadas;
      } else if (ordenarPor === "dias_trabajados") {
        valA = a.totales.dias_trabajados;
        valB = b.totales.dias_trabajados;
      } else if (ordenarPor === "dias_sin_ordenes") {
        valA = a.totales.dias_sin_ordenes;
        valB = b.totales.dias_sin_ordenes;
      } else if (ordenarPor === "dias_descanso") {
        valA = a.totales.dias_descanso || 0;
        valB = b.totales.dias_descanso || 0;
      } else if (ordenarPor === "efectividad") {
        valA = a.totales.efectividad;
        valB = b.totales.efectividad;
      }

      return ordenAsc ? (valA > valB ? 1 : -1) : valA < valB ? 1 : -1;
    });

    return list;
  }, [data, busqueda, filtroInactividad, ordenarPor, ordenAsc]);

  // Helper para obtener el valor a mostrar (siempre solo Finalizadas)
  const getValorDia = (diaData?: { total: number; finalizadas: number; canceladas: number; asignadas: number; iniciadas: number; regestion: number; estados: Record<string, number> }) => {
    if (!diaData) return 0;
    return diaData.finalizadas || 0;
  };

  // Totales de la matriz calculados en tiempo real según filtros (Solo Finalizadas)
  const totalesCalculados = useMemo(() => {
    const porFecha: Record<string, number> = {};
    let granTotal = 0;
    let totalFinalizadas = 0;
    let totalCanceladas = 0;
    let totalDiasTrabajados = 0;
    let totalDiasSinOrdenes = 0;
    let totalDiasDescanso = 0;

    columnasFechasVisibles.forEach((f) => {
      porFecha[f.fechaStr] = 0;
    });

    tecnicosFiltrados.forEach((t) => {
      totalFinalizadas += t.totales.finalizadas;
      totalCanceladas += t.totales.canceladas;

      let techTrab = 0;
      let techSinOrd = 0;
      let techDesc = 0;

      columnasFechasVisibles.forEach((f) => {
        const diaData = t.fechas[f.fechaStr];
        const val = diaData?.finalizadas || 0;
        const esDesc = Boolean(diaData?.es_descanso);

        if (val > 0) {
          techTrab++;
          porFecha[f.fechaStr] += val;
          granTotal += val;
        } else {
          techSinOrd++;
        }

        if (esDesc) {
          techDesc++;
        }
      });

      totalDiasTrabajados += techTrab;
      totalDiasSinOrdenes += techSinOrd;
      totalDiasDescanso += techDesc;
    });

    return {
      porFecha,
      granTotal,
      totalFinalizadas,
      totalCanceladas,
      totalDiasTrabajados,
      totalDiasSinOrdenes,
      totalDiasDescanso,
      tecnicosConProduccion: tecnicosFiltrados.filter((t) => t.totales.finalizadas > 0 || t.totales.total_ordenes > 0).length
    };
  }, [tecnicosFiltrados, columnasFechasVisibles]);

  // Exportar matriz a Excel
  const exportarExcel = () => {
    if (!data || tecnicosFiltrados.length === 0) return;

    const headers = [
      "ID",
      "Técnico",
      "Cuadrilla",
      ...columnasFechasVisibles.map((f) => `${f.diaSemana} ${f.diaNum}/${f.fechaStr.split("-")[1]}`),
      "Días Trabajados",
      "Días Sin Órdenes",
      "Descansos",
      "Finalizadas",
      "Total Órdenes",
      "% Efectividad"
    ];

    const rows = tecnicosFiltrados.map((t) => {
      const rowData: any[] = [
        t.id_tecnico,
        t.tecnico,
        t.cuadrilla,
      ];

      let tTrab = 0;
      let tSinOrd = 0;
      let tDesc = 0;

      columnasFechasVisibles.forEach((f) => {
        const diaData = t.fechas[f.fechaStr];
        const fin = diaData?.finalizadas || 0;
        const esDesc = Boolean(diaData?.es_descanso);

        if (esDesc) {
          rowData.push("D");
          tDesc++;
        } else if (fin > 0) {
          rowData.push(fin);
          tTrab++;
        } else {
          rowData.push(0);
          tSinOrd++;
        }
      });

      rowData.push(
        tTrab,
        tSinOrd,
        tDesc,
        t.totales.finalizadas,
        t.totales.total_ordenes,
        `${t.totales.efectividad}%`
      );

      return rowData;
    });

    // Fila de suma total
    const totalRow = [
      "",
      "SUMA TOTAL",
      "",
      ...columnasFechasVisibles.map((f) => totalesCalculados.porFecha[f.fechaStr] || 0),
      totalesCalculados.totalDiasTrabajados,
      totalesCalculados.totalDiasSinOrdenes,
      totalesCalculados.totalDiasDescanso,
      totalesCalculados.totalFinalizadas,
      totalesCalculados.granTotal,
      ""
    ];
    rows.push(totalRow);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Matriz_Diaria");
    XLSX.writeFile(wb, `Rendimiento_Diario_${fechas.desde}_a_${fechas.hasta}.xlsx`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className={`bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden transition-all duration-300 ${
          isFullScreen ? "w-full h-full rounded-none" : "w-full max-w-[96vw] max-h-[94vh]"
        }`}
      >
        {/* ── 1. HEADER MODAL ── */}
        <div className="p-4 sm:p-5 border-b border-slate-200/90 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 flex items-center justify-center font-bold shadow-inner shrink-0">
              <Calendar size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Matriz de Rendimiento Diario por Fechas
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-black font-mono">
                  {fechas.desde} al {fechas.hasta}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-[10px] font-bold">
                  {columnasFechasVisibles.length} Días
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                Auditoría diaria de órdenes por técnico, días trabajados y detección de inactividad.
              </p>
            </div>
          </div>

          {/* KPIs Resumen Rápido en Header */}
          <div className="flex items-center gap-2 sm:gap-4 self-end md:self-auto">
            <div className="hidden lg:flex items-center gap-4 bg-white/10 px-3.5 py-1.5 rounded-2xl border border-white/10 text-xs">
              <div className="text-center">
                <span className="text-[10px] text-slate-300 block font-bold">Total Órdenes</span>
                <span className="text-sm font-black font-mono text-white">{totalesCalculados.granTotal}</span>
              </div>
              <div className="w-px h-6 bg-white/20" />
              <div className="text-center">
                <span className="text-[10px] text-emerald-300 block font-bold">Finalizadas</span>
                <span className="text-sm font-black font-mono text-emerald-400">{totalesCalculados.totalFinalizadas}</span>
              </div>
              <div className="w-px h-6 bg-white/20" />
              <div className="text-center">
                <span className="text-[10px] text-amber-300 block font-bold">Técnicos Activos</span>
                <span className="text-sm font-black font-mono text-amber-300">
                  {totalesCalculados.tecnicosConProduccion} / {tecnicosFiltrados.length}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
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
        </div>

        {/* ── 2. BARRA DE HERRAMIENTAS Y FILTROS INTERACTIVOS ── */}
        <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200/90 space-y-2.5 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* A. Selector de Periodos */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs overflow-x-auto">
              {[
                { id: "hoy", label: "Hoy" },
                { id: "ayer", label: "Ayer" },
                { id: "semana", label: "Esta Semana" },
                { id: "mes", label: "Este Mes" },
                { id: "mes_anterior", label: "Mes Anterior" },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handlePeriodoChange(p.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    periodoActivo === p.id
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* B. Selector de Fechas Manual */}
            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs text-xs">
              <span className="text-slate-400 font-bold text-[10px] uppercase">Desde</span>
              <input
                type="date"
                value={fechas.desde}
                onChange={(e) => {
                  setPeriodoActivo("custom");
                  setFechas((prev) => ({ ...prev, desde: e.target.value }));
                }}
                className="font-mono text-xs font-bold text-slate-800 bg-transparent border-none focus:outline-none"
              />
              <span className="text-slate-400 font-bold text-[10px] uppercase">Hasta</span>
              <input
                type="date"
                value={fechas.hasta}
                onChange={(e) => {
                  setPeriodoActivo("custom");
                  setFechas((prev) => ({ ...prev, hasta: e.target.value }));
                }}
                className="font-mono text-xs font-bold text-slate-800 bg-transparent border-none focus:outline-none"
              />
              <button
                type="button"
                onClick={() => cargarDatos(fechas.desde, fechas.hasta, "custom")}
                disabled={loading}
                className="p-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors cursor-pointer"
                title="Actualizar rango"
              >
                <RotateCw size={13} className={loading ? "animate-spin" : ""} />
              </button>
            </div>

            {/* C. Botón de Exportar a Excel */}
            <button
              type="button"
              onClick={exportarExcel}
              disabled={loading || tecnicosFiltrados.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer ml-auto"
            >
              <Download size={13} />
              <span>Exportar Excel</span>
            </button>
          </div>

          {/* Fila 2 de Filtros: Filtro de Estado / Órdenes y Buscador */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 border-t border-slate-200/60">
            <div className="flex flex-wrap items-center gap-2">
              {/* Filtro de Técnicos: Activos / Inactivos / Con Órdenes */}
              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs text-xs">
                <span className="text-slate-500 font-bold text-[11px] flex items-center gap-1">
                  <Filter size={11} className="text-indigo-600" />
                  Estado / Filtro:
                </span>
                <select
                  value={filtroInactividad}
                  onChange={(e) => setFiltroInactividad(e.target.value as any)}
                  className="font-bold text-slate-800 bg-transparent border-none focus:outline-none cursor-pointer text-xs"
                >
                  <option value="todos">Todos ({data?.tecnicos?.length || 0})</option>
                  <option value="solo_activos">Solo Técnicos Activos</option>
                  <option value="solo_inactivos">Solo Técnicos Inactivos</option>
                  <option value="solo_con_ordenes">Solo con Órdenes</option>
                  <option value="con_dias_sin_orden">⚠️ Con Días Sin Órdenes</option>
                </select>
              </div>
            </div>

            {/* Buscador de Técnico */}
            <div className="relative w-full sm:w-64">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar técnico o cuadrilla..."
                className="w-full pl-7 pr-7 py-1 text-xs font-medium bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 shadow-2xs text-slate-800"
              />
              {busqueda && (
                <button
                  type="button"
                  onClick={() => setBusqueda("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X size={11} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── 3. CUERPO: MATRIZ DE TABLA DIARIA ── */}
        <div className="flex-1 overflow-auto bg-slate-100 p-2 sm:p-4">
          {loading ? (
            <div className="h-96 flex flex-col items-center justify-center gap-3 bg-white rounded-2xl border border-slate-200">
              <RotateCw size={28} className="animate-spin text-indigo-600" />
              <p className="text-xs font-bold text-slate-600">Calculando matriz de rendimiento diario...</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden">
              <div className="overflow-x-auto max-h-[60vh]">
                <table className="w-full border-collapse text-left text-xs select-none">
                  {/* CABECERA DE LA TABLA */}
                  <thead className="sticky top-0 z-20 bg-[#1f4e78] text-white shadow-xs">
                    <tr>
                      {/* Columna Técnico fija */}
                      <th className="py-2.5 px-3 border-r border-b border-[#2e75b6] font-black uppercase text-[10.5px] tracking-wider min-w-[200px] max-w-[240px] sticky left-0 z-30 bg-[#1f4e78]">
                        <div
                          className="flex items-center justify-between cursor-pointer hover:text-indigo-200"
                          onClick={() => {
                            setOrdenarPor("tecnico");
                            setOrdenAsc(!ordenAsc);
                          }}
                        >
                          <span>TÉCNICO</span>
                          <ArrowUpDown size={11} />
                        </div>
                      </th>

                      {/* Columnas de Días de la Fecha */}
                      {columnasFechasVisibles.map((f) => (
                        <th
                          key={f.fechaStr}
                          className={`py-1.5 px-1 text-center border-r border-b border-[#2e75b6] min-w-[42px] max-w-[48px] ${
                            f.isHoy
                              ? "bg-indigo-700 text-white ring-2 ring-indigo-400 ring-inset"
                              : f.isDomingo
                              ? "bg-[#1b4368] text-rose-300"
                              : f.isSabado
                              ? "bg-[#1b4368] text-amber-300"
                              : "bg-[#1f4e78]"
                          }`}
                          title={`${f.diaSemana} ${f.fechaStr}: Total ${f.totalDia} órdenes`}
                        >
                          <div className="text-[9px] font-black tracking-tighter opacity-80">
                            {f.diaSemana}
                          </div>
                          <div className="text-[12px] font-black font-mono leading-none my-0.5">
                            {f.diaNum}
                          </div>
                        </th>
                      ))}

                      {/* Columnas de Totales por Técnico */}
                      <th
                        className="py-2 px-2 text-center border-r border-b border-[#2e75b6] font-black uppercase text-[10px] min-w-[65px] bg-[#1a3d5e] cursor-pointer hover:text-indigo-200"
                        onClick={() => {
                          setOrdenarPor("dias_trabajados");
                          setOrdenAsc(!ordenAsc);
                        }}
                        title="Días con órdenes finalizadas"
                      >
                        DÍAS TRAB.
                      </th>
                      <th
                        className="py-2 px-2 text-center border-r border-b border-[#2e75b6] font-black uppercase text-[10px] min-w-[65px] bg-[#1a3d5e] cursor-pointer hover:text-indigo-200"
                        onClick={() => {
                          setOrdenarPor("dias_sin_ordenes");
                          setOrdenAsc(!ordenAsc);
                        }}
                        title="Días sin órdenes registradas"
                      >
                        DÍAS S/ORD.
                      </th>
                      <th
                        className="py-2 px-2 text-center border-r border-b border-[#2e75b6] font-black uppercase text-[10px] min-w-[65px] bg-[#1a3d5e] cursor-pointer hover:text-indigo-200"
                        onClick={() => {
                          setOrdenarPor("dias_descanso");
                          setOrdenAsc(!ordenAsc);
                        }}
                        title="Días de descanso registrados / programados en el rango de fechas"
                      >
                        DESCANSOS
                      </th>
                      <th
                        className="py-2 px-2 text-center border-r border-b border-[#2e75b6] font-black uppercase text-[10px] min-w-[55px] bg-[#1a3d5e] cursor-pointer hover:text-indigo-200"
                        onClick={() => {
                          setOrdenarPor("finalizadas");
                          setOrdenAsc(!ordenAsc);
                        }}
                        title="Órdenes finalizadas"
                      >
                        FINALIZ.
                      </th>
                      <th
                        className="py-2 px-2 text-center border-r border-b border-[#2e75b6] font-black uppercase text-[10px] min-w-[55px] bg-[#1a3d5e] cursor-pointer hover:text-indigo-200"
                        onClick={() => {
                          setOrdenarPor("total");
                          setOrdenAsc(!ordenAsc);
                        }}
                        title="Total de órdenes"
                      >
                        TOTAL
                      </th>
                      <th
                        className="py-2 px-2 text-center border-b border-[#2e75b6] font-black uppercase text-[10px] min-w-[60px] bg-[#15324e] cursor-pointer hover:text-indigo-200"
                        onClick={() => {
                          setOrdenarPor("efectividad");
                          setOrdenAsc(!ordenAsc);
                        }}
                        title="% Efectividad (Finalizadas / Total)"
                      >
                        % EFECT.
                      </th>
                    </tr>
                  </thead>

                  {/* CUERPO DE TÉCNICOS */}
                  <tbody className="divide-y divide-slate-200">
                    {tecnicosFiltrados.map((t, idx) => {
                      const rowBg = idx % 2 === 0 ? "bg-white" : "bg-slate-50/70";

                      let techTrab = 0;
                      let techSinOrd = 0;
                      let techDesc = 0;

                      return (
                        <tr
                          key={`tech-row-${t.id_tecnico || t.tecnico}`}
                          className={`${rowBg} hover:bg-indigo-50/40 transition-colors`}
                        >
                          {/* Columna Técnico Fija - Solo nombre del técnico */}
                          <td className={`py-2 px-3 border-r border-slate-300 sticky left-0 z-10 ${rowBg} shadow-xs`}>
                            <div className="font-black text-slate-900 truncate max-w-[220px] text-[11px]" title={t.tecnico}>
                              {t.tecnico}
                            </div>
                          </td>

                          {/* Celdas de Cada Día */}
                          {columnasFechasVisibles.map((f) => {
                            const diaData = t.fechas[f.fechaStr];
                            const esDescanso = Boolean(diaData?.es_descanso);
                            const fin = diaData?.finalizadas || 0;

                            if (fin > 0) {
                              techTrab++;
                            } else {
                              techSinOrd++;
                            }

                            if (esDescanso) {
                              techDesc++;
                            }

                            return (
                              <td
                                key={`cell-${t.id_tecnico}-${f.fechaStr}`}
                                className={`py-1 px-0.5 text-center border-r border-slate-200 font-mono text-[11px] font-bold ${
                                  f.isFinDeSemana ? "bg-slate-100/30" : ""
                                }`}
                                title={`${t.tecnico} - ${f.fechaStr}: ${
                                  esDescanso
                                    ? "Descanso Programado"
                                    : fin > 0
                                    ? `Finalizadas: ${fin}`
                                    : "Sin órdenes"
                                }`}
                              >
                                {esDescanso ? (
                                  <div
                                    className="inline-flex items-center justify-center min-w-[26px] h-6 px-1 rounded-md text-[11px] font-black bg-sky-100 text-sky-800 border border-sky-300 shadow-2xs"
                                    title="Descanso"
                                  >
                                    D
                                  </div>
                                ) : fin > 0 ? (
                                  <div
                                    className="inline-flex items-center justify-center min-w-[26px] h-6 px-1 rounded-md text-[11px] font-black bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold"
                                    title={`Finalizadas: ${fin}`}
                                  >
                                    {fin}
                                  </div>
                                ) : (
                                  <span className="text-slate-300 font-mono text-xs">-</span>
                                )}
                              </td>
                            );
                          })}

                          {/* Totales por Técnico */}
                          <td className="py-1 px-1.5 text-center border-r border-slate-300 font-mono text-[11px] font-black bg-slate-50 text-slate-800">
                            <span className="px-1.5 py-0.5 rounded-md bg-white border border-slate-200">
                              {techTrab}
                            </span>
                          </td>
                          <td className="py-1 px-1.5 text-center border-r border-slate-300 font-mono text-[11px] font-black bg-slate-50">
                            <span
                              className={`px-1.5 py-0.5 rounded-md ${
                                techSinOrd > 0
                                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                                  : "text-slate-400 bg-white border border-slate-200"
                              }`}
                            >
                              {techSinOrd}
                            </span>
                          </td>
                          <td className="py-1 px-1.5 text-center border-r border-slate-300 font-mono text-[11px] font-black bg-slate-50">
                            <span
                              className={`px-1.5 py-0.5 rounded-md ${
                                techDesc > 0
                                  ? "bg-sky-50 text-sky-700 border border-sky-200 font-bold"
                                  : "text-slate-400 bg-white border border-slate-200"
                              }`}
                              title={`${techDesc} descansos en el rango`}
                            >
                              {techDesc}
                            </span>
                          </td>
                          <td className="py-1 px-1.5 text-center border-r border-slate-300 font-mono text-[11px] font-black bg-emerald-50/50 text-emerald-800">
                            {t.totales.finalizadas}
                          </td>
                          <td className="py-1 px-1.5 text-center border-r border-slate-300 font-mono text-[11px] font-black bg-[#deebf7] text-[#1f4e78]">
                            {t.totales.total_ordenes}
                          </td>
                          <td className="py-1 px-1.5 text-center font-mono text-[11px] font-black bg-slate-50">
                            <span
                              className={`px-1.5 py-0.5 rounded-md ${
                                t.totales.efectividad >= 80
                                  ? "text-emerald-700 font-black"
                                  : t.totales.efectividad >= 60
                                  ? "text-amber-700 font-bold"
                                  : "text-slate-400 font-medium"
                              }`}
                            >
                              {t.totales.efectividad}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}

                    {tecnicosFiltrados.length === 0 && (
                      <tr>
                        <td
                          colSpan={columnasFechasVisibles.length + 7}
                          className="p-12 text-center text-slate-400 font-bold"
                        >
                          No se encontraron técnicos para este filtro.
                        </td>
                      </tr>
                    )}
                  </tbody>

                  {/* ── FILA INFERIOR DE SUMA TOTAL ── */}
                  {tecnicosFiltrados.length > 0 && (
                    <tfoot className="sticky bottom-0 z-20 bg-[#d9e1f2] text-[#1f3864] font-black border-t-2 border-slate-400">
                      <tr>
                        <td className="py-2 px-3 border-r border-slate-400 uppercase text-[10px] sticky left-0 z-30 bg-[#d9e1f2] font-black">
                          SUMA TOTAL ({tecnicosFiltrados.length} Técnicos)
                        </td>
                        {columnasFechasVisibles.map((f) => (
                          <td
                            key={`tot-f-${f.fechaStr}`}
                            className="py-1.5 px-0.5 text-center border-r border-slate-400 font-mono text-[11px] font-black bg-[#d9e1f2]"
                          >
                            {totalesCalculados.porFecha[f.fechaStr] || 0}
                          </td>
                        ))}
                        <td className="py-1.5 px-1.5 text-center border-r border-slate-400 font-mono text-[11px] font-black bg-[#c6d9f1]">
                          {totalesCalculados.totalDiasTrabajados}
                        </td>
                        <td className="py-1.5 px-1.5 text-center border-r border-slate-400 font-mono text-[11px] font-black bg-[#c6d9f1]">
                          {totalesCalculados.totalDiasSinOrdenes}
                        </td>
                        <td className="py-1.5 px-1.5 text-center border-r border-slate-400 font-mono text-[11px] font-black bg-[#c6d9f1] text-sky-950">
                          {totalesCalculados.totalDiasDescanso}
                        </td>
                        <td className="py-1.5 px-1.5 text-center border-r border-slate-400 font-mono text-[11px] font-black bg-[#b4c6e7] text-emerald-950">
                          {totalesCalculados.totalFinalizadas}
                        </td>
                        <td className="py-1.5 px-1.5 text-center border-r border-slate-400 font-mono text-[11px] font-black bg-[#8ea9db] text-slate-950">
                          {totalesCalculados.granTotal}
                        </td>
                        <td className="py-1.5 px-1.5 text-center font-mono text-[11px] font-black bg-[#c6d9f1]">
                          {totalesCalculados.granTotal > 0
                            ? `${((totalesCalculados.totalFinalizadas / totalesCalculados.granTotal) * 100).toFixed(1)}%`
                            : "0%"}
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
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-4 text-slate-600 font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-100 border border-emerald-400" />
              Finalizadas
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-sm bg-sky-100 border border-sky-300 text-sky-800 font-black text-[9px] flex items-center justify-center">D</span>
              Descanso
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-slate-400 font-mono font-bold">-</span>
              Sin órdenes
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
