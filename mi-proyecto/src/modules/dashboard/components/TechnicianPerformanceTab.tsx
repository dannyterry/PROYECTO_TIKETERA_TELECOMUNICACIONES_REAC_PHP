import React, { useState, useEffect, useCallback, useMemo } from "react";
import { API_URL } from "../../../config/api";
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCw,
  Search,
  Calendar,
  Layers,
  Target,
  ArrowUpDown,
  Download,
  Filter,
  BarChart2,
  Table as TableIcon,
  Award,
  ChevronRight,
  ChevronDown,
  CheckSquare,
  Square,
  TrendingUp,
  Activity,
  ShieldCheck,
  PieChart as PieIcon,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend
} from "recharts";

export interface TechnicianStats {
  id_tecnico: number;
  tecnico: string;
  cuadrilla: string;
  total: number;
  finalizadas: number;
  canceladas: number;
  reagendadas: number;
  iniciadas: number;
  otras: number;
  efectividad: number;
  tipos_trabajo: Record<string, number>;
  estados: Record<string, number>;
}

export interface PerformanceData {
  filtros: { desde: string; hasta: string; periodo?: string; tecnico?: string };
  kpis: {
    total_tecnicos: number;
    total_ordenes: number;
    total_finalizadas: number;
    total_canceladas: number;
    total_reagendadas: number;
    total_iniciadas: number;
    tasa_efectividad_global: number;
    tecnico_top: { nombre: string; total: number; finalizadas: number; efectividad: number } | null;
  };
  tipos_trabajo_columnas: string[];
  totales_columnas_tipo: Record<string, number>;
  totales_estados: Record<string, number>;
  tecnicos: TechnicianStats[];
}

interface TechnicianPerformanceTabProps {
  activeMainTab?: "resumen" | "tecnicos" | "auditoria";
  setActiveMainTab?: (tab: "resumen" | "tecnicos" | "auditoria") => void;
  totalGestoresOnline?: number;
}

export const TechnicianPerformanceTab: React.FC<TechnicianPerformanceTabProps> = ({
  activeMainTab = "tecnicos",
  setActiveMainTab,
  totalGestoresOnline = 0,
}) => {
  // ── ESTADOS DE FILTROS ──
  const getInitialDates = () => {
    const hoy = new Date();
    const fmt = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };
    const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    return { desde: fmt(primero), hasta: fmt(hoy) };
  };

  const [fechas, setFechas] = useState(getInitialDates);
  const [periodoActivo, setPeriodoActivo] = useState<string>("mes");
  const [busquedaTecnico, setBusquedaTecnico] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<PerformanceData | null>(null);
  const [tipoGrafico, setTipoGrafico] = useState<"apiladas" | "agrupadas">("apiladas");
  const [ordenarPor, setOrdenarPor] = useState<"total" | "finalizadas" | "efectividad" | "nombre">("finalizadas");
  const [ordenAsc, setOrdenAsc] = useState<boolean>(false);
  const [tiposSeleccionados, setTiposSeleccionados] = useState<string[]>([]);
  const [menuTiposAbierto, setMenuTiposAbierto] = useState<boolean>(false);
  const [tipoVisualizacionTipos, setTipoVisualizacionTipos] = useState<"dona" | "barras">("dona");
  const [modoTopGrafico, setModoTopGrafico] = useState<"finalizadas" | "todos">("finalizadas");

  // Paleta de colores para los tipos de trabajo en el gráfico
  const coloresTipos: Record<string, string> = {
    "ADICIONAL": "#3b82f6",
    "GARANTIA": "#10b981",
    "GARANTIA NO REALIZADA": "#ef4444",
    "NORMALIZACIÓN": "#8b5cf6",
    "PEX": "#f59e0b",
    "RECABLEADO": "#06b6d4",
    "RECABLEADO EN CONDOMINIO": "#0284c7",
    "REUBICACIÓN CON RESERVA": "#6366f1",
    "REUBICACIÓN SIN RESERVA": "#ec4899",
    "TRASALDO EN CONDOMINIO": "#14b8a6",
    "TRASLADO": "#f97316",
    "VISITA EXTERNA": "#64748b",
  };

  // Abreviaturas cortas y legibles para que la matriz no use scroll horizontal
  const abreviaturasTipo: Record<string, string> = {
    "ADICIONAL": "ADICIONAL",
    "GARANTIA": "GARANTÍA",
    "GARANTIA NO REALIZADA": "GAR. NO REAL.",
    "NORMALIZACIÓN": "NORMALIZ.",
    "PEX": "PEX",
    "RECABLEADO": "RECABLEADO",
    "RECABLEADO EN CONDOMINIO": "RECAB. COND.",
    "REUBICACIÓN CON RESERVA": "REUB. C/RES.",
    "REUBICACIÓN SIN RESERVA": "REUB. S/RES.",
    "TRASALDO EN CONDOMINIO": "TRASL. COND.",
    "TRASLADO": "TRASLADO",
    "VISITA EXTERNA": "VIS. EXT.",
  };

  // Cargar datos desde API
  const cargarDatos = useCallback(async (desdeOverride?: string, hastaOverride?: string, pOverride?: string) => {
    setLoading(true);
    try {
      const d = desdeOverride || fechas.desde;
      const h = hastaOverride || fechas.hasta;
      const p = pOverride !== undefined ? pOverride : periodoActivo;
      const url = `${API_URL}/api/dashboard/rendimiento-tecnicos?desde=${d}&hasta=${h}${p ? `&periodo=${p}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Error al obtener datos de rendimiento");
      const json: PerformanceData = await res.json();
      if (json && json.tecnicos) {
        setData(json);
      }
    } catch (err) {
      console.error("Error al cargar rendimiento de técnicos:", err);
    } finally {
      setLoading(false);
    }
  }, [fechas, periodoActivo]);

  useEffect(() => {
    cargarDatos();
  }, []);

  // Manejar cambio de atajos rápidos de período
  const handleShortcutPeriodo = (tipo: "hoy" | "ayer" | "semana" | "mes" | "mes_anterior") => {
    setPeriodoActivo(tipo);
    const hoy = new Date();
    const fmt = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    let dStr = "";
    let hStr = "";

    if (tipo === "hoy") {
      dStr = fmt(hoy);
      hStr = fmt(hoy);
    } else if (tipo === "ayer") {
      const ayer = new Date(hoy);
      ayer.setDate(hoy.getDate() - 1);
      dStr = fmt(ayer);
      hStr = fmt(ayer);
    } else if (tipo === "semana") {
      const lunes = new Date(hoy);
      lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
      const domingo = new Date(lunes);
      domingo.setDate(lunes.getDate() + 6);
      dStr = fmt(lunes);
      hStr = fmt(domingo);
    } else if (tipo === "mes") {
      const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      dStr = fmt(primero);
      hStr = fmt(hoy);
    } else if (tipo === "mes_anterior") {
      const primeroAnt = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      const ultimoAnt = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
      dStr = fmt(primeroAnt);
      hStr = fmt(ultimoAnt);
    }

    setFechas({ desde: dStr, hasta: hStr });
    cargarDatos(dStr, hStr, tipo);
  };

  const columnasTipo = data?.tipos_trabajo_columnas || [];

  const toggleTipoTrabajo = (tipo: string) => {
    setTiposSeleccionados((prev) =>
      prev.includes(tipo) ? prev.filter((t) => t !== tipo) : [...prev, tipo]
    );
  };

  const seleccionarTodosTipos = () => {
    if (tiposSeleccionados.length === columnasTipo.length) {
      setTiposSeleccionados([]);
    } else {
      setTiposSeleccionados([...columnasTipo]);
    }
  };

  const columnasVisibles = useMemo(() => {
    return tiposSeleccionados.length === 0
      ? columnasTipo
      : columnasTipo.filter((c) => tiposSeleccionados.includes(c));
  }, [columnasTipo, tiposSeleccionados]);

  // Filtrar técnicos en memoria por búsqueda reactiva y ordenamiento coordinado con columnas visibles
  const tecnicosFiltrados = useMemo(() => {
    if (!data || !data.tecnicos) return [];
    let list = [...data.tecnicos];

    if (busquedaTecnico.trim()) {
      const term = busquedaTecnico.toLowerCase().trim();
      list = list.filter(
        (t) =>
          t.tecnico.toLowerCase().includes(term) ||
          t.cuadrilla.toLowerCase().includes(term)
      );
    }

    list.sort((a, b) => {
      let valA: any = ordenarPor === "nombre" ? a.tecnico.toLowerCase() : a[ordenarPor as keyof TechnicianStats];
      let valB: any = ordenarPor === "nombre" ? b.tecnico.toLowerCase() : b[ordenarPor as keyof TechnicianStats];

      // Si se ordena por finalizadas y hay filtro activo de columnas, ordenar por las visibles
      if (ordenarPor === "finalizadas" && tiposSeleccionados.length > 0) {
        valA = columnasVisibles.reduce((acc, c) => acc + (a.tipos_trabajo[c] || 0), 0);
        valB = columnasVisibles.reduce((acc, c) => acc + (b.tipos_trabajo[c] || 0), 0);
      }

      if (valA < valB) return ordenAsc ? -1 : 1;
      if (valA > valB) return ordenAsc ? 1 : -1;
      return 0;
    });

    return list;
  }, [data, busquedaTecnico, ordenarPor, ordenAsc, columnasVisibles, tiposSeleccionados]);

  // Totales dinámicos de la matriz de cruce coordinados según las columnas visibles y técnicos filtrados
  const totalesMatriz = useMemo(() => {
    const porColumna: Record<string, number> = {};
    let granTotal = 0;

    columnasVisibles.forEach((col) => {
      const sumaCol = tecnicosFiltrados.reduce(
        (acc, t) => acc + (t.tipos_trabajo[col] || 0),
        0
      );
      porColumna[col] = sumaCol;
      granTotal += sumaCol;
    });

    return { porColumna, granTotal };
  }, [columnasVisibles, tecnicosFiltrados]);

  // Datos para Gráfico 1: Comparativa de Estados (Top 12 técnicos)
  const chartData = useMemo(() => {
    return tecnicosFiltrados.slice(0, 12).map((t) => {
      const partes = t.tecnico.trim().split(" ");
      const nombreCorto = partes.length >= 2 ? `${partes[0]} ${partes[1].charAt(0)}.` : t.tecnico;
      return {
        name: nombreCorto,
        nombreCompleto: t.tecnico,
        Finalizadas: t.finalizadas,
        Iniciadas: t.iniciadas,
        Reagendadas: t.reagendadas,
        Canceladas: t.canceladas,
        Total: t.total,
        Efectividad: t.efectividad,
      };
    });
  }, [tecnicosFiltrados]);

  // Tipos activos (con al menos 1 orden finalizada en el período) para el gráfico y filtro
  const tiposActivosGrafico = useMemo(() => {
    if (!data?.totales_columnas_tipo) return [];
    return columnasTipo.filter((c) => (data.totales_columnas_tipo[c] || 0) > 0);
  }, [columnasTipo, data]);

  // Datos para Gráfico 2: Técnicos vs Tipo de Trabajo (Solo Finalizadas)
  const chartTiposData = useMemo(() => {
    return [...tecnicosFiltrados]
      .sort((a, b) => b.finalizadas - a.finalizadas)
      .slice(0, 12)
      .map((t) => {
        const partes = t.tecnico.trim().split(" ");
        const nombreCorto = partes.length >= 2 ? `${partes[0]} ${partes[1].charAt(0)}.` : t.tecnico;
        const row: any = {
          name: nombreCorto,
          nombreCompleto: t.tecnico,
          totalFinalizadas: t.finalizadas,
        };
        tiposActivosGrafico.forEach((tipo) => {
          row[tipo] = t.tipos_trabajo[tipo] || 0;
        });
        return row;
      });
  }, [tecnicosFiltrados, tiposActivosGrafico]);

  // Datos para Gráfico de Dona / Pastel de Tipos de Trabajo
  const pieTiposData = useMemo(() => {
    if (!data?.totales_columnas_tipo) return [];
    return Object.entries(data.totales_columnas_tipo)
      .filter(([_, cant]) => cant > 0)
      .map(([tipo, cant]) => ({
        name: tipo,
        shortName: abreviaturasTipo[tipo] || tipo,
        value: cant,
        color: coloresTipos[tipo] || "#6366f1",
      }))
      .sort((a, b) => b.value - a.value);
  }, [data, abreviaturasTipo, coloresTipos]);

  // Exportar a CSV / Excel
  const handleExportCSV = () => {
    if (!data || tecnicosFiltrados.length === 0) return;

    // Encabezados
    const headers = [
      "Técnico",
      "Cuadrilla",
      "Total Asignadas",
      "Finalizadas",
      "Canceladas",
      "Reagendadas",
      "Iniciadas",
      "% Efectividad",
      ...columnasVisibles.map((c) => `Tipo: ${c}`)
    ];

    const rows = tecnicosFiltrados.map((t) => [
      `"${t.tecnico}"`,
      `"${t.cuadrilla}"`,
      t.total,
      t.finalizadas,
      t.canceladas,
      t.reagendadas,
      t.iniciadas,
      `${t.efectividad}%`,
      ...columnasVisibles.map((c) => t.tipos_trabajo[c] || 0)
    ]);

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Rendimiento_Tecnicos_${fechas.desde}_al_${fechas.hasta}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const kpis = data?.kpis || {
    total_tecnicos: 0,
    total_ordenes: 0,
    total_finalizadas: 0,
    total_canceladas: 0,
    total_reagendadas: 0,
    total_iniciadas: 0,
    tasa_efectividad_global: 0,
    tecnico_top: null
  };

  return (
    <div className="space-y-3">
      {/* ─────────────────────────────────────────────────────────────
          CABECERA ÚNICA ESTÁTICA INTEGRADA (TÍTULO + TABS + FILTROS + KPIS + ESTADOS)
      ───────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-slate-100/95 backdrop-blur-xs pb-1">
        <div className="bg-white px-4 py-3 rounded-2xl border border-slate-200/90 shadow-xs space-y-2.5">
          {/* Fila 1: Título del módulo y Selector de pestañas */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center shadow-xs shrink-0">
                <Activity className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-none">
                    Análisis & Visualización
                  </h1>
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                    24/7 EN VIVO
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium hidden md:block">
                  Inteligencia operativa, rendimiento técnico y trazabilidad en tiempo real.
                </p>
              </div>
            </div>

            {/* Selector de pestañas de navegación */}
            {setActiveMainTab && (
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 overflow-x-auto self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setActiveMainTab("resumen")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeMainTab === "resumen"
                      ? "bg-white text-slate-900 shadow-xs border border-slate-200/80"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                  }`}
                >
                  <Activity size={13} className={activeMainTab === "resumen" ? "text-sky-600" : "text-slate-400"} />
                  <span>Resumen Ejecutivo</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveMainTab("tecnicos")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeMainTab === "tecnicos"
                      ? "bg-white text-slate-900 shadow-xs border border-slate-200/80"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                  }`}
                >
                  <Users size={13} className={activeMainTab === "tecnicos" ? "text-emerald-600" : "text-slate-400"} />
                  <span>Rendimiento Técnicos</span>
                  <span className="px-1 py-0.2 rounded-full text-[8px] font-black uppercase tracking-wider bg-emerald-500 text-white shadow-2xs">
                    NUEVO
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveMainTab("auditoria")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeMainTab === "auditoria"
                      ? "bg-white text-slate-900 shadow-xs border border-slate-200/80"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                  }`}
                >
                  <ShieldCheck size={13} className={activeMainTab === "auditoria" ? "text-sky-600" : "text-slate-400"} />
                  <span>Auditoría & Personal</span>
                  <span className="px-1 py-0.2 rounded-full text-[8px] font-bold bg-sky-100 text-sky-700">
                    {totalGestoresOnline} online
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Fila 2: Filtros de Fecha, Atajos, Búsqueda y Exportación */}
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
            {/* Atajos Rápidos */}
            <div className="flex flex-wrap items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => handleShortcutPeriodo("hoy")}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                  periodoActivo === "hoy"
                    ? "bg-sky-600 text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                }`}
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={() => handleShortcutPeriodo("ayer")}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                  periodoActivo === "ayer"
                    ? "bg-sky-600 text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                }`}
              >
                Ayer
              </button>
              <button
                type="button"
                onClick={() => handleShortcutPeriodo("semana")}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                  periodoActivo === "semana"
                    ? "bg-sky-600 text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                }`}
              >
                Esta Semana
              </button>
              <button
                type="button"
                onClick={() => handleShortcutPeriodo("mes")}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                  periodoActivo === "mes"
                    ? "bg-sky-600 text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                }`}
              >
                Este Mes
              </button>
              <button
                type="button"
                onClick={() => handleShortcutPeriodo("mes_anterior")}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                  periodoActivo === "mes_anterior"
                    ? "bg-sky-600 text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                }`}
              >
                Mes Anterior
              </button>
            </div>

            {/* Rango de Fechas + Buscador + Botones de Acción */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl shadow-2xs">
                <Calendar size={13} className="text-slate-400" />
                <span className="text-[10px] font-bold text-slate-500 uppercase">Del</span>
                <input
                  type="date"
                  value={fechas.desde}
                  onChange={(e) => {
                    setPeriodoActivo("personalizado");
                    setFechas((prev) => ({ ...prev, desde: e.target.value }));
                  }}
                  className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
                />
                <span className="text-[10px] font-bold text-slate-500 uppercase">al</span>
                <input
                  type="date"
                  value={fechas.hasta}
                  onChange={(e) => {
                    setPeriodoActivo("personalizado");
                    setFechas((prev) => ({ ...prev, hasta: e.target.value }));
                  }}
                  className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
                />
              </div>

              <div className="relative min-w-[180px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar técnico..."
                  value={busquedaTecnico}
                  onChange={(e) => setBusquedaTecnico(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 shadow-2xs transition-all"
                />
              </div>

              <button
                type="button"
                onClick={() => cargarDatos()}
                disabled={loading}
                className="p-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                title="Refrescar datos"
              >
                <RotateCw size={14} className={loading ? "animate-spin text-sky-600" : "text-slate-500"} />
              </button>

              <button
                type="button"
                onClick={handleExportCSV}
                disabled={loading || tecnicosFiltrados.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                title="Exportar matriz completa a Excel (CSV)"
              >
                <Download size={13} />
                <span>Excel</span>
              </button>
            </div>
          </div>

          {/* Fila 3: Grid de 4 KPIs Compactos */}
          <div className="pt-2 border-t border-slate-100 grid grid-cols-2 lg:grid-cols-4 gap-2.5 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
            {/* KPI 1: Técnicos Activos */}
            <div className="flex items-center justify-between px-2 pt-1 sm:pt-0">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Técnicos Activos</span>
                <div className="text-xl font-black text-slate-900 leading-tight">
                  {kpis.total_tecnicos}
                </div>
                <span className="text-[10px] text-slate-400">Con órdenes en rango</span>
              </div>
              <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100 shadow-2xs shrink-0">
                <Users size={16} />
              </div>
            </div>

            {/* KPI 2: Órdenes Asignadas */}
            <div className="flex items-center justify-between px-2 pt-1 sm:pt-0">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Órdenes Asignadas</span>
                <div className="text-xl font-black text-slate-900 leading-tight">
                  {kpis.total_ordenes}
                </div>
                <span className="text-[10px] text-blue-600 font-bold">
                  ✓ {kpis.total_finalizadas} Finalizadas
                </span>
              </div>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-2xs shrink-0">
                <CheckCircle2 size={16} />
              </div>
            </div>

            {/* KPI 3: Efectividad Global */}
            <div className="flex items-center justify-between px-2 pt-1 sm:pt-0">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Efectividad Global</span>
                <div className="text-xl font-black text-slate-900 leading-tight">
                  {kpis.tasa_efectividad_global}%
                </div>
                <span className="text-[10px] text-slate-400">Ratio de éxito en cierre</span>
              </div>
              <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center border border-violet-100 shadow-2xs shrink-0">
                <Target size={16} />
              </div>
            </div>

            {/* KPI 4: Técnico Top */}
            <div className="flex items-center justify-between px-2 pt-1 sm:pt-0 min-w-0">
              <div className="min-w-0 pr-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1">
                  <Award size={12} /> Técnico Top
                </span>
                <div className="text-xs font-black text-slate-900 leading-tight truncate" title={kpis.tecnico_top?.nombre || "Sin datos"}>
                  {kpis.tecnico_top?.nombre || "Sin datos"}
                </div>
                <span className="text-[10px] text-slate-500">
                  {kpis.tecnico_top ? `${kpis.tecnico_top.finalizadas} fin. (${kpis.tecnico_top.efectividad}%)` : "—"}
                </span>
              </div>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 shadow-2xs shrink-0">
                <Award size={16} />
              </div>
            </div>
          </div>

          {/* Fila 4: Resumen de Estados Oficiales con Colores Institucionales Suaves */}
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
              <span>Total:</span>
              <span className="font-mono font-black">{kpis.total_ordenes}</span>
            </span>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white text-[#1f3864] border border-[#bdd7ee] shadow-2xs">
              <span className="w-2.5 h-2.5 rounded-full border border-[#8ea9db] bg-white inline-block"></span>
              <span>Agendadas / Asignadas:</span>
              <span className="font-mono font-black">
                {kpis.total_ordenes - (kpis.total_finalizadas + kpis.total_iniciadas + kpis.total_reagendadas + kpis.total_canceladas) > 0
                  ? kpis.total_ordenes - (kpis.total_finalizadas + kpis.total_iniciadas + kpis.total_reagendadas + kpis.total_canceladas)
                  : 0}
              </span>
            </span>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#e2efda] text-[#375623] border border-[#a9d18e] shadow-2xs">
              <span className="w-2.5 h-2.5 rounded-full bg-[#70ad47] inline-block"></span>
              <span>Iniciadas / Proceso:</span>
              <span className="font-mono font-black">{kpis.total_iniciadas}</span>
            </span>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#deebf7] text-[#1f4e78] border border-[#bdd7ee] shadow-2xs">
              <span className="w-2.5 h-2.5 rounded-full bg-[#5b9bd5] inline-block"></span>
              <span>Finalizadas:</span>
              <span className="font-mono font-black">{kpis.total_finalizadas}</span>
            </span>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#fff2cc] text-[#833c0c] border border-[#ffe699] shadow-2xs">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ffc000] inline-block"></span>
              <span>Regestión / Canceladas:</span>
              <span className="font-mono font-black">{kpis.total_reagendadas + kpis.total_canceladas}</span>
            </span>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. ANÁLISIS POR TIPO DE TRABAJO:
             A. MATRIZ DE CRUCE | B. DISTRIBUCIÓN EN DONA / BARRAS
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
        {/* ── CARD 1: MATRIZ DE CRUCE TÉCNICO X TIPO DE TRABAJO ── */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                <TableIcon size={18} className="text-emerald-600" />
                Matriz de Cruce: Técnico x Tipo de Trabajo
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                Solo Finalizadas
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Total de órdenes finalizadas por cada categoría de trabajo para cada técnico.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Popover / Dropdown Filtro por Tipo de Trabajo */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuTiposAbierto((prev) => !prev)}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border ${
                  tiposSeleccionados.length > 0
                    ? "bg-indigo-600 text-white border-indigo-700 shadow-md shadow-indigo-600/20"
                    : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-2xs"
                }`}
                title="Filtrar tipos de trabajo visibles en la matriz"
              >
                <Filter size={13} />
                <span>
                  {tiposSeleccionados.length === 0
                    ? "Filtrar Tipos"
                    : `${tiposSeleccionados.length} selec.`}
                </span>
                <ChevronDown size={13} className={`transition-transform ${menuTiposAbierto ? "rotate-180" : ""}`} />
              </button>

              {/* Popover flotante con Checkboxes */}
              {menuTiposAbierto && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setMenuTiposAbierto(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 z-50 bg-white border border-slate-200 rounded-2xl shadow-2xl p-3 w-72 space-y-2 animate-fade-in">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight">
                        SELECCIONAR TIPOS DE TRABAJO
                      </span>
                      <button
                        type="button"
                        onClick={seleccionarTodosTipos}
                        className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer"
                      >
                        {tiposSeleccionados.length === columnasTipo.length
                          ? "Desmarcar todo"
                          : "Marcar todas"}
                      </button>
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-0.5 py-1 custom-scrollbar">
                      {columnasTipo.map((tipo) => {
                        const isChecked = tiposSeleccionados.includes(tipo);
                        const count = data?.totales_columnas_tipo[tipo] || 0;

                        return (
                          <label
                            key={tipo}
                            onClick={() => toggleTipoTrabajo(tipo)}
                            className="flex items-center justify-between p-2 rounded-xl hover:bg-indigo-50/60 cursor-pointer transition-colors select-none"
                          >
                            <div className="flex items-center gap-2">
                              {isChecked ? (
                                <CheckSquare size={16} className="text-indigo-600 shrink-0" />
                              ) : (
                                <Square size={16} className="text-slate-300 shrink-0" />
                              )}
                              <span className={`text-xs font-bold ${isChecked ? "text-indigo-950 font-black" : "text-slate-700"}`}>
                                {tipo}
                              </span>
                            </div>
                            <span className="text-[10px] font-bold text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded-md">
                              {count}
                            </span>
                          </label>
                        );
                      })}
                    </div>

                    {tiposSeleccionados.length > 0 && (
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[10px] text-slate-500 font-medium">
                          {tiposSeleccionados.length} de {columnasTipo.length} tipos
                        </span>
                        <button
                          type="button"
                          onClick={() => setTiposSeleccionados([])}
                          className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                        >
                          Mostrar todos
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <span className="text-xs font-bold text-slate-500">Ordenar:</span>
            <select
              value={ordenarPor}
              onChange={(e: any) => setOrdenarPor(e.target.value)}
              className="bg-white border border-slate-200 text-xs font-bold text-slate-700 px-2.5 py-1.5 rounded-xl shadow-2xs outline-none cursor-pointer"
            >
              <option value="finalizadas">Mayor Finalizadas</option>
              <option value="total">Mayor Asignadas</option>
              <option value="efectividad">% Efectividad</option>
              <option value="nombre">Nombre</option>
            </select>
            <button
              type="button"
              onClick={() => setOrdenAsc(!ordenAsc)}
              className="p-1.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-slate-900 transition-colors cursor-pointer shadow-2xs"
              title={ordenAsc ? "Ascendente" : "Descendente"}
            >
              <ArrowUpDown size={14} />
            </button>
          </div>
        </div>

        {/* Tabla Estilo Hoja de Cálculo Excel / Pivot Table: Centrada si es pequeña y adaptable si crece */}
        <div className="overflow-x-auto border-t border-slate-300 w-full p-2 bg-slate-50/20">
          <table className="w-auto mx-auto text-left text-xs border-separate border-spacing-0 shadow-2xs bg-white">
            {/* Encabezado Nivel 1 y 2 - Estilo Excel Pivot */}
            <thead>
              {/* Nivel 1: TIPO DE TRABAJO agrupado */}
              <tr className="bg-[#8ea9db] text-[#1f3864]">
                <th
                  rowSpan={2}
                  className="bg-[#8ea9db] py-1 px-1.5 border-b-2 border-r border-slate-300 text-left font-black tracking-wide text-[10px] w-[130px] min-w-[110px] max-w-[140px] align-middle"
                >
                  TECNICO
                </th>
                <th
                  colSpan={columnasVisibles.length}
                  className="bg-[#8ea9db] py-0.5 px-1 border-b border-r border-slate-300 text-center font-black tracking-wider text-[10px] uppercase italic"
                >
                  TIPO DE TRABAJO
                </th>
                <th
                  rowSpan={2}
                  className="bg-[#8ea9db] py-1 px-0.5 border-b-2 border-slate-300 text-center font-black tracking-tight text-[9px] w-[46px] min-w-[40px] max-w-[50px] leading-tight align-middle"
                >
                  Suma total
                </th>
              </tr>
              {/* Nivel 2: Columnas de cada tipo de trabajo con ajuste de texto abajo */}
              <tr className="bg-[#8ea9db] text-[#1f3864]">
                {columnasVisibles.map((col) => (
                  <th
                    key={col}
                    className="bg-[#8ea9db] py-1 px-0.5 border-b-2 border-r border-slate-300 text-center font-black text-[8.5px] leading-[1.05] uppercase tracking-tighter w-[50px] min-w-[42px] max-w-[58px] whitespace-normal break-words align-middle"
                    title={`${col} (Total: ${data?.totales_columnas_tipo[col] || 0})`}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>

            {/* Filas de Técnicos - Ultra compactas con cuadrícula Excel */}
            <tbody className="bg-white">
              {tecnicosFiltrados.map((t, idx) => (
                <tr
                  key={t.id_tecnico || idx}
                  className="hover:bg-blue-50/50 transition-colors group"
                >
                  {/* Nombre Técnico Fijo a la Izquierda (Sin Cuadrilla) */}
                  <td className="bg-white group-hover:bg-blue-50/90 py-0.5 px-1.5 border-b border-r border-slate-300 text-slate-800 w-[130px] min-w-[110px] max-w-[140px]">
                    <div className="font-bold text-[9.5px] uppercase truncate" title={t.tecnico}>
                      {t.tecnico}
                    </div>
                  </td>

                  {/* Celdas por Tipo de Trabajo (Si es 0 queda vacío como en Excel) */}
                  {columnasVisibles.map((col) => {
                    const cant = t.tipos_trabajo[col] || 0;
                    return (
                      <td
                        key={col}
                        className="py-0.5 px-0.5 text-center border-b border-r border-slate-300 text-[10px] font-mono leading-none w-[50px] min-w-[42px] max-w-[58px]"
                      >
                        {cant > 0 ? (
                          <span className="font-bold text-slate-900">{cant}</span>
                        ) : (
                          ""
                        )}
                      </td>
                    );
                  })}

                  {/* Suma Total Fila Técnico Dinámica según columnas visibles */}
                  {(() => {
                    const sumaFilaVisible = columnasVisibles.reduce(
                      (acc, col) => acc + (t.tipos_trabajo[col] || 0),
                      0
                    );
                    return (
                      <td className="py-0.5 px-0.5 text-center border-b border-r border-slate-300 bg-slate-50/80 font-mono font-black text-slate-900 text-[10px] leading-none w-[46px] min-w-[40px] max-w-[50px]">
                        {sumaFilaVisible > 0 ? sumaFilaVisible : ""}
                      </td>
                    );
                  })()}
                </tr>
              ))}

              {tecnicosFiltrados.length === 0 && (
                <tr>
                  <td
                    colSpan={columnasVisibles.length + 2}
                    className="p-8 text-center text-slate-400 font-semibold border-b border-slate-300"
                  >
                    No se encontraron técnicos para este filtro.
                  </td>
                </tr>
              )}
            </tbody>

            {/* Fila Resumen Inferior: Suma total dinámica */}
            {tecnicosFiltrados.length > 0 && (
              <tfoot>
                <tr className="bg-[#d9e1f2] text-[#1f3864] font-black">
                  <td className="bg-[#d9e1f2] py-1 px-1.5 border-t-2 border-r border-slate-400 font-black text-[9.5px] uppercase w-[130px] min-w-[110px] max-w-[140px]">
                    SUMA TOTAL
                  </td>
                  {columnasVisibles.map((col) => (
                    <td
                      key={col}
                      className="py-1 px-0.5 text-center border-t-2 border-r border-slate-400 font-black text-slate-900 font-mono text-[10px] bg-[#d9e1f2] leading-none w-[50px] min-w-[42px] max-w-[58px]"
                    >
                      {totalesMatriz.porColumna[col] || 0}
                    </td>
                  ))}
                  <td className="py-1 px-0.5 text-center border-t-2 border-r border-slate-400 font-black text-slate-950 font-mono text-[10px] bg-[#c6d9f1] leading-none w-[46px] min-w-[40px] max-w-[50px]">
                    {totalesMatriz.granTotal}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

        {/* B. Distribución por Tipo de Trabajo (Donona / Barras) */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-1.5">
                  <PieIcon size={18} className="text-indigo-600" />
                  Distribución por Tipo de Trabajo
                </h3>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-[#deebf7] text-[#1f4e78] border border-[#bdd7ee]">
                  Solo Finalizadas
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Proporción y volumen de órdenes completadas según categoría técnica.
              </p>
            </div>

            {/* Selector de Vista: Dona (Ordenada) vs Barras */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setTipoVisualizacionTipos("dona")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  tipoVisualizacionTipos === "dona"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                title="Ver en gráfico de dona circular ordenado"
              >
                <PieIcon size={12} />
                <span>Dona</span>
              </button>
              <button
                type="button"
                onClick={() => setTipoVisualizacionTipos("barras")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  tipoVisualizacionTipos === "barras"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                title="Ver desglose por técnico en barras"
              >
                <Layers size={12} />
                <span>Barras</span>
              </button>
            </div>
          </div>

          {pieTiposData.length > 0 ? (
            tipoVisualizacionTipos === "dona" ? (
              /* 🍩 VISTA DONA LIMPIA, GRANDE Y QUE APROVECHA TODA EL ÁREA */
              <div className="flex flex-col lg:flex-row items-center justify-between gap-6 pt-2 flex-1 min-h-[360px]">
                {/* Donut Chart Circular Amplio */}
                <div className="h-72 lg:h-80 w-full lg:w-1/2 relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieTiposData}
                        dataKey="value"
                        nameKey="shortName"
                        cx="50%"
                        cy="50%"
                        innerRadius={75}
                        outerRadius={115}
                        paddingAngle={3}
                        stroke="none"
                      >
                        {pieTiposData.map((entry, index) => (
                          <Cell key={`cell-tipo-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        content={({ active, payload }) => {
                          if (!active || !payload || !payload.length) return null;
                          const d = payload[0].payload;
                          const pct = kpis.total_finalizadas > 0
                            ? ((d.value / kpis.total_finalizadas) * 100).toFixed(1)
                            : "0.0";
                          return (
                            <div className="bg-white/95 backdrop-blur-md p-3 rounded-2xl border border-slate-200 shadow-xl text-xs space-y-1 z-50 min-w-[190px]">
                              <p className="font-black text-slate-900 border-b border-slate-100 pb-1 flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                                {d.name}
                              </p>
                              <div className="flex justify-between text-slate-700 font-bold">
                                <span>Órdenes:</span>
                                <span className="font-black text-slate-900 font-mono">{d.value}</span>
                              </div>
                              <div className="flex justify-between text-[#1f4e78] font-bold">
                                <span>Participación:</span>
                                <span className="font-black">{pct}%</span>
                              </div>
                            </div>
                          );
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Centro del Donut */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-3xl font-black text-slate-900 tracking-tight leading-none">
                      {kpis.total_finalizadas}
                    </span>
                    <span className="text-[10px] font-black text-[#1f4e78] uppercase tracking-wider mt-1.5 bg-[#deebf7] px-2 py-0.5 rounded-full border border-[#bdd7ee]">
                      FINALIZADAS
                    </span>
                  </div>
                </div>

                {/* Lista lateral limpia que aprovecha toda el área vertical */}
                <div className="w-full lg:w-1/2 flex flex-col justify-center space-y-1.5 pr-1">
                  {pieTiposData.map((item) => {
                    const pct = kpis.total_finalizadas > 0
                      ? ((item.value / kpis.total_finalizadas) * 100).toFixed(1)
                      : "0.0";
                    const pctNum = parseFloat(pct);
                    return (
                      <div
                        key={item.name}
                        className="relative overflow-hidden flex items-center justify-between p-2 rounded-xl bg-slate-50/80 hover:bg-slate-100/90 text-xs transition-all border border-slate-200/60 group"
                      >
                        {/* Barra de progreso de fondo muy sutil con el color institucional */}
                        <div
                          className="absolute left-0 top-0 bottom-0 opacity-15 rounded-xl pointer-events-none transition-all duration-500"
                          style={{ width: `${pctNum}%`, backgroundColor: item.color }}
                        />
                        <div className="flex items-center gap-2.5 min-w-0 pr-2 z-10">
                          <span
                            className="w-3 h-3 rounded-full shrink-0 shadow-2xs border border-white"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="font-bold text-slate-800 truncate text-[11.5px]" title={item.name}>
                            {item.shortName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0 z-10">
                          <span className="font-mono font-black text-slate-900 text-[11.5px] bg-white px-2 py-0.5 rounded-lg border border-slate-200 shadow-2xs">
                            {item.value}
                          </span>
                          <span className="font-black text-slate-500 text-[10.5px] w-12 text-right">
                            {pct}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* 📊 VISTA EN BARRAS ALTERNATIVA */
              <div className="h-80 w-full pt-1">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartTiposData} margin={{ top: 10, right: 10, left: -18, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#64748b", fontSize: 10, fontWeight: 700 }}
                      interval={0}
                      angle={-25}
                      textAnchor="end"
                      height={45}
                    />
                    <YAxis tick={{ fill: "#64748b", fontSize: 10, fontWeight: 700 }} />
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="bg-white/95 backdrop-blur-md p-3 rounded-2xl border border-slate-200 shadow-xl text-xs space-y-1.5 z-50 min-w-[200px]">
                            <p className="font-black text-slate-900 border-b border-slate-100 pb-1 flex justify-between items-center">
                              <span>{d.nombreCompleto}</span>
                              <span className="text-[#1f4e78] font-mono font-black bg-[#deebf7] px-1.5 py-0.5 rounded border border-[#bdd7ee]">
                                {d.totalFinalizadas} Fin.
                              </span>
                            </p>
                            <div className="max-h-48 overflow-y-auto space-y-1 py-0.5">
                              {tiposActivosGrafico.map((tipo) => {
                                const cant = d[tipo] || 0;
                                if (cant === 0) return null;
                                return (
                                  <div key={tipo} className="flex justify-between items-center text-[11px]">
                                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                                      <span
                                        className="w-2 h-2 rounded-full shrink-0"
                                        style={{ backgroundColor: coloresTipos[tipo] || "#6366f1" }}
                                      />
                                      {abreviaturasTipo[tipo] || tipo}:
                                    </span>
                                    <span className="font-black font-mono text-slate-900 bg-slate-100 px-1.5 py-0.2 rounded">
                                      {cant}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 10, fontWeight: 700, paddingBottom: 6 }}
                    />
                    {tiposActivosGrafico.map((tipo, idx) => (
                      <Bar
                        key={tipo}
                        dataKey={tipo}
                        stackId="tipos"
                        fill={coloresTipos[tipo] || "#6366f1"}
                        radius={idx === tiposActivosGrafico.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                        name={abreviaturasTipo[tipo] || tipo}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-400 text-xs font-semibold">
              No hay órdenes finalizadas registradas.
            </div>
          )}
        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. RANKING TOP TÉCNICOS: ÓRDENES FINALIZADAS
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                <BarChart2 size={18} className="text-sky-600" />
                Top Técnicos: {modoTopGrafico === "finalizadas" ? "Órdenes Finalizadas" : "Comparativa por Estado"}
              </h3>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-[#deebf7] text-[#1f4e78] border border-[#bdd7ee]">
                {modoTopGrafico === "finalizadas" ? "Solo Finalizadas" : "Todos los Estados"}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {modoTopGrafico === "finalizadas"
                ? "Ranking de técnicos con mayor volumen de órdenes completadas con éxito."
                : "Finalizadas (azul), iniciadas (verde), reagendadas (ámbar) y canceladas (rojo)."}
            </p>
          </div>

          {/* Selector: Solo Finalizadas vs Todos los Estados */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => setModoTopGrafico("finalizadas")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                modoTopGrafico === "finalizadas"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Solo Finalizadas
            </button>
            <button
              type="button"
              onClick={() => setModoTopGrafico("todos")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                modoTopGrafico === "todos"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Todos los Estados
            </button>
          </div>
        </div>

        {chartData.length > 0 ? (
          <div className="h-72 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -18, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "#64748b", fontSize: 10, fontWeight: 700 }}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={45}
                />
                <YAxis tick={{ fill: "#64748b", fontSize: 10, fontWeight: 700 }} />
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-white/95 backdrop-blur-md p-3 rounded-2xl border border-slate-200 shadow-xl text-xs space-y-1.5 z-50 min-w-[190px]">
                        <p className="font-black text-slate-900 border-b border-slate-100 pb-1 flex justify-between items-center">
                          <span>{d.nombreCompleto}</span>
                          <span className="text-[#1f4e78] font-mono font-black bg-[#deebf7] px-1.5 py-0.5 rounded border border-[#bdd7ee]">
                            {d.Finalizadas} Fin.
                          </span>
                        </p>
                        <div className="space-y-1 text-slate-600">
                          <div className="flex justify-between items-center">
                            <span className="flex items-center gap-1.5 text-slate-700 font-bold">
                              <span className="w-2 h-2 rounded-full bg-[#5b9bd5]" />
                              Finalizadas:
                            </span>
                            <span className="font-mono font-bold text-slate-900">{d.Finalizadas}</span>
                          </div>
                          {modoTopGrafico === "todos" && (
                            <>
                              <div className="flex justify-between items-center">
                                <span className="flex items-center gap-1.5 text-slate-700 font-bold">
                                  <span className="w-2 h-2 rounded-full bg-[#70ad47]" />
                                  Iniciadas:
                                </span>
                                <span className="font-mono font-bold text-slate-900">{d.Iniciadas}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="flex items-center gap-1.5 text-slate-700 font-bold">
                                  <span className="w-2 h-2 rounded-full bg-[#ffc000]" />
                                  Reagendadas:
                                </span>
                                <span className="font-mono font-bold text-slate-900">{d.Reagendadas}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="flex items-center gap-1.5 text-slate-700 font-bold">
                                  <span className="w-2 h-2 rounded-full bg-[#ef4444]" />
                                  Canceladas:
                                </span>
                                <span className="font-mono font-bold text-slate-900">{d.Canceladas}</span>
                              </div>
                            </>
                          )}
                          <div className="flex justify-between items-center pt-1 border-t border-slate-100 font-bold">
                            <span>Efectividad:</span>
                            <span className={`font-mono ${d.Efectividad >= 80 ? "text-emerald-600 font-black" : "text-slate-900"}`}>
                              {d.Efectividad}%
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  content={() => (
                    <div className="flex items-center justify-end gap-3 text-[11px] font-bold pb-2">
                      {modoTopGrafico === "finalizadas" ? (
                        <span className="flex items-center gap-1.5 text-[#1f4e78]">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#5b9bd5] inline-block shadow-2xs" />
                          <span>Órdenes Finalizadas</span>
                        </span>
                      ) : (
                        <>
                          <span className="flex items-center gap-1.5 text-[#c00000]">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] inline-block shadow-2xs" />
                            <span>Canceladas</span>
                          </span>
                          <span className="flex items-center gap-1.5 text-[#1f4e78]">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#5b9bd5] inline-block shadow-2xs" />
                            <span>Finalizadas</span>
                          </span>
                          <span className="flex items-center gap-1.5 text-[#375623]">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#70ad47] inline-block shadow-2xs" />
                            <span>Iniciadas</span>
                          </span>
                          <span className="flex items-center gap-1.5 text-[#833c0c]">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#ffc000] inline-block shadow-2xs" />
                            <span>Reagendadas</span>
                          </span>
                        </>
                      )}
                    </div>
                  )}
                />
                {modoTopGrafico === "finalizadas" ? (
                  <Bar
                    dataKey="Finalizadas"
                    fill="#5b9bd5"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={38}
                    name="Finalizadas"
                  />
                ) : (
                  <>
                    <Bar dataKey="Finalizadas" fill="#5b9bd5" radius={[4, 4, 0, 0]} name="Finalizadas" />
                    <Bar dataKey="Iniciadas" fill="#70ad47" radius={[4, 4, 0, 0]} name="Iniciadas" />
                    <Bar dataKey="Reagendadas" fill="#ffc000" radius={[4, 4, 0, 0]} name="Reagendadas" />
                    <Bar dataKey="Canceladas" fill="#ef4444" radius={[4, 4, 0, 0]} name="Canceladas" />
                  </>
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-48 flex items-center justify-center text-slate-400 text-xs font-semibold">
            No hay órdenes registradas.
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          5. GRID DE ESTADOS & RATIO DE EFECTIVIDAD
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-600" />
            Productividad de Cierre & Efectividad por Técnico
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Comparativa de órdenes Finalizadas vs Canceladas, Reagendadas e Iniciadas con indicador de rendimiento.
          </p>
        </div>

        <div className="overflow-auto max-h-[540px] relative border-t border-slate-200">
          <table className="w-full text-left text-xs border-separate border-spacing-0">
            <thead className="sticky top-0 z-20 bg-slate-100 shadow-xs">
              <tr>
                <th className="sticky top-0 z-20 bg-slate-100 p-3.5 pl-5 text-slate-700 font-bold border-b border-slate-200">
                  Técnico
                </th>
                <th className="sticky top-0 z-20 bg-slate-100 p-3 text-center text-slate-700 font-bold border-b border-slate-200">
                  Asignadas
                </th>
                <th className="sticky top-0 z-20 bg-slate-100 p-3 text-center text-[#1f4e78] font-black border-b border-slate-200">
                  Finalizadas
                </th>
                <th className="sticky top-0 z-20 bg-slate-100 p-3 text-center text-[#375623] font-black border-b border-slate-200">
                  Iniciadas
                </th>
                <th className="sticky top-0 z-20 bg-slate-100 p-3 text-center text-[#833c0c] font-black border-b border-slate-200">
                  Reagendadas
                </th>
                <th className="sticky top-0 z-20 bg-slate-100 p-3 text-center text-[#c00000] font-black border-b border-slate-200">
                  Canceladas
                </th>
                <th className="sticky top-0 z-20 bg-slate-100 p-3 text-center text-slate-700 font-bold min-w-[160px] border-b border-slate-200">
                  % Efectividad
                </th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {tecnicosFiltrados.map((t, idx) => {
                const colorBarra =
                  t.efectividad >= 75
                    ? "bg-[#70ad47]"
                    : t.efectividad >= 50
                    ? "bg-[#ffc000]"
                    : "bg-[#ef4444]";

                const colorTexto =
                  t.efectividad >= 75
                    ? "text-[#375623]"
                    : t.efectividad >= 50
                    ? "text-[#833c0c]"
                    : "text-[#c00000]";

                return (
                  <tr key={t.id_tecnico || idx} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3.5 pl-5 border-b border-slate-100">
                      <div className="font-bold text-slate-900">{t.tecnico}</div>
                      <div className="text-[10px] text-slate-400">{t.cuadrilla}</div>
                    </td>
                    <td className="p-3 text-center font-bold text-slate-900 border-b border-slate-100">{t.total}</td>
                    <td className="p-3 text-center font-black text-[#1f4e78] border-b border-slate-100">{t.finalizadas}</td>
                    <td className="p-3 text-center font-black text-[#375623] border-b border-slate-100">{t.iniciadas}</td>
                    <td className="p-3 text-center font-black text-[#833c0c] border-b border-slate-100">{t.reagendadas}</td>
                    <td className="p-3 text-center font-black text-[#c00000] border-b border-slate-100">{t.canceladas}</td>
                    <td className="p-3 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${colorBarra} transition-all duration-500`}
                            style={{ width: `${Math.min(t.efectividad, 100)}%` }}
                          />
                        </div>
                        <span className={`text-xs font-black min-w-[45px] text-right ${colorTexto}`}>
                          {t.efectividad}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {tecnicosFiltrados.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 font-semibold border-b border-slate-200">
                    No se encontraron técnicos para este filtro.
                  </td>
                </tr>
              )}
            </tbody>

            {/* Fila Resumen Inferior Estática */}
            {tecnicosFiltrados.length > 0 && (
              <tfoot className="sticky bottom-0 z-20 bg-slate-100/95 font-bold border-t-2 border-slate-300 shadow-xs">
                <tr>
                  <td className="p-3 pl-5 font-black text-slate-900 uppercase">
                    Total General
                  </td>
                  <td className="p-3 text-center font-black text-slate-900">
                    {kpis.total_ordenes}
                  </td>
                  <td className="p-3 text-center font-black text-[#1f4e78]">
                    {kpis.total_finalizadas}
                  </td>
                  <td className="p-3 text-center font-black text-[#375623]">
                    {kpis.total_iniciadas}
                  </td>
                  <td className="p-3 text-center font-black text-[#833c0c]">
                    {kpis.total_reagendadas}
                  </td>
                  <td className="p-3 text-center font-black text-[#c00000]">
                    {kpis.total_canceladas}
                  </td>
                  <td className="p-3 text-center font-black text-slate-900">
                    {kpis.tasa_efectividad_global}%
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
