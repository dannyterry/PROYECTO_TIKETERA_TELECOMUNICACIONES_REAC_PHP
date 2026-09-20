import React, { useState, useEffect, useCallback, useMemo } from "react";
import { API_URL } from "../../../config/api";
import {
  Clock,
  Calendar,
  Search,
  RotateCw,
  Award,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Truck,
  TrendingDown,
  TrendingUp,
  Layers,
  ArrowUpDown,
  Filter,
  BarChart3,
  Users,
  LineChart as LineIcon,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Cell,
  ReferenceLine,
  Legend,
} from "recharts";
import {
  LatencyFirstLegModal,
  TecnicoRankingLatencia,
  DetalleOrdenLatencia,
} from "./LatencyFirstLegModal";

const NOMBRES_MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const NOMBRES_MESES_CORTO = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// Tooltip para el gráfico de barras
const CustomBarTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data: TecnicoRankingLatencia = payload[0].payload;
    return (
      <div className="bg-slate-900/95 backdrop-blur-md p-3.5 rounded-2xl border border-slate-700 text-white shadow-xl text-xs space-y-1.5 z-50">
        <div className="flex items-center justify-between gap-3">
          <p className="font-black text-sm text-slate-100">{data.tecnico}</p>
          <span
            className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
              data.semaforo === "verde"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : data.semaforo === "amarillo"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                : "bg-red-500/20 text-red-300 border border-red-500/30"
            }`}
          >
            {data.semaforo === "verde" ? "Puntual" : data.semaforo === "amarillo" ? "Aceptable" : "Crítico"}
          </span>
        </div>
        <p className="text-[11px] text-slate-400 font-medium">{data.cuadrilla}</p>
        <div className="pt-2 border-t border-slate-800 space-y-1">
          <p className="flex justify-between gap-4">
            <span className="text-slate-400">Latencia Promedio:</span>
            <span className="font-black text-amber-400">{data.latencia_promedio_min} min</span>
          </p>
          <p className="flex justify-between gap-4">
            <span className="text-slate-400">Hora Promedio Llegada:</span>
            <span className="font-bold text-slate-200">{data.hora_promedio_inicio}</span>
          </p>
          <p className="flex justify-between gap-4">
            <span className="text-slate-400">Días Evaluados:</span>
            <span className="font-bold text-slate-200">{data.dias_laborados}</span>
          </p>
          <p className="flex justify-between gap-4">
            <span className="text-slate-400">% Salida Puntual:</span>
            <span className="font-bold text-emerald-400">{data.porcentaje_puntual}%</span>
          </p>
        </div>
        <p className="text-[10px] text-indigo-300 pt-1 text-center font-bold">
          👉 Clic en la barra para ver detalle día a día
        </p>
      </div>
    );
  }
  return null;
};

export const LatencyFirstLegTab: React.FC = () => {
  // Selector inteligente de período
  const [periodMode, setPeriodMode] = useState<"dia" | "semana" | "mes" | "anio">("mes");
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // Datos
  const [kpis, setKpis] = useState<any>(null);
  const [ranking, setRanking] = useState<TecnicoRankingLatencia[]>([]);
  const [ordenes, setOrdenes] = useState<DetalleOrdenLatencia[]>([]);

  // Filtros internos
  const [busqueda, setBusqueda] = useState("");
  const [filtroSemaforo, setFiltroSemaforo] = useState<"todos" | "verde" | "amarillo" | "rojo">("todos");
  const [ordenAsc, setOrdenAsc] = useState<boolean>(true); // Ascendente = menor latencia primero

  // Modal drill-down
  const [selectedTecnicoModal, setSelectedTecnicoModal] = useState<TecnicoRankingLatencia | null>(null);

  // Opciones de período
  const opcionesDias = useMemo(() => {
    const list = [];
    const hoy = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(hoy);
      d.setDate(hoy.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const diaNum = d.getDate();
      const mesNombre = NOMBRES_MESES_CORTO[d.getMonth()];
      const label =
        i === 0
          ? `Hoy (${diaNum} ${mesNombre})`
          : i === 1
          ? `Ayer (${diaNum} ${mesNombre})`
          : `Hace ${i} días (${diaNum} ${mesNombre})`;
      list.push({ id: `dia-${i}`, label, desde: iso, hasta: iso });
    }
    return list;
  }, []);

  const opcionesSemanas = useMemo(() => {
    const list = [];
    for (let i = 0; i < 8; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i * 7);
      const dayOfWeek = d.getDay() || 7;
      const startOfWeek = new Date(d);
      startOfWeek.setDate(d.getDate() - dayOfWeek + 1);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      const fDesde = startOfWeek.toISOString().slice(0, 10);
      const fHasta = endOfWeek.toISOString().slice(0, 10);

      const label =
        i === 0
          ? `Esta Semana (${fDesde.slice(5)} al ${fHasta.slice(5)})`
          : i === 1
          ? `Semana Pasada (${fDesde.slice(5)} al ${fHasta.slice(5)})`
          : `Hace ${i} semanas (${fDesde.slice(5)} al ${fHasta.slice(5)})`;

      list.push({ id: `sem-${i}`, label, desde: fDesde, hasta: fHasta });
    }
    return list;
  }, []);

  const opcionesMeses = useMemo(() => {
    const listActual = [];
    const listAnterior = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthIdx = now.getMonth();

    for (let m = currentMonthIdx; m >= 0; m--) {
      const mm = String(m + 1).padStart(2, "0");
      const ultimoDia = new Date(currentYear, m + 1, 0).getDate();
      listActual.push({
        id: `mes-${currentYear}-${mm}`,
        label: `${NOMBRES_MESES[m]} ${currentYear}`,
        desde: `${currentYear}-${mm}-01`,
        hasta: `${currentYear}-${mm}-${String(ultimoDia).padStart(2, "0")}`,
      });
    }

    const prevYear = currentYear - 1;
    for (let m = 11; m >= 0; m--) {
      const mm = String(m + 1).padStart(2, "0");
      const ultimoDia = new Date(prevYear, m + 1, 0).getDate();
      listAnterior.push({
        id: `mes-${prevYear}-${mm}`,
        label: `${NOMBRES_MESES[m]} ${prevYear}`,
        desde: `${prevYear}-${mm}-01`,
        hasta: `${prevYear}-${mm}-${String(ultimoDia).padStart(2, "0")}`,
      });
    }

    return { todos: [...listActual, ...listAnterior] };
  }, []);

  const opcionesAnios = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return [
      { id: `anio-${currentYear}`, label: `Año ${currentYear} (En curso)`, desde: `${currentYear}-01-01`, hasta: `${currentYear}-12-31` },
      { id: `anio-${currentYear - 1}`, label: `Año ${currentYear - 1} (Histórico)`, desde: `${currentYear - 1}-01-01`, hasta: `${currentYear - 1}-12-31` },
    ];
  }, []);

  useEffect(() => {
    if (periodMode === "dia" && opcionesDias.length > 0) setSelectedOption(opcionesDias[0].id);
    else if (periodMode === "semana" && opcionesSemanas.length > 0) setSelectedOption(opcionesSemanas[0].id);
    else if (periodMode === "mes" && opcionesMeses.todos.length > 0) setSelectedOption(opcionesMeses.todos[0].id);
    else if (periodMode === "anio" && opcionesAnios.length > 0) setSelectedOption(opcionesAnios[0].id);
  }, [periodMode, opcionesDias, opcionesSemanas, opcionesMeses, opcionesAnios]);

  const currentPeriod = useMemo(() => {
    let target;
    if (periodMode === "dia") target = opcionesDias.find((o) => o.id === selectedOption);
    else if (periodMode === "semana") target = opcionesSemanas.find((o) => o.id === selectedOption);
    else if (periodMode === "mes") target = opcionesMeses.todos.find((o) => o.id === selectedOption);
    else target = opcionesAnios.find((o) => o.id === selectedOption);

    return target || { label: "Período actual", desde: "", hasta: "" };
  }, [periodMode, selectedOption, opcionesDias, opcionesSemanas, opcionesMeses, opcionesAnios]);

  const cargarDatos = useCallback(async () => {
    if (!currentPeriod.desde || !currentPeriod.hasta) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/api/dashboard/latencia-primer-tramo?desde=${currentPeriod.desde}&hasta=${currentPeriod.hasta}`
      );
      const json = await res.json();
      if (json.success) {
        setKpis(json.kpis);
        setRanking(json.ranking_tecnicos || []);
        setOrdenes(json.detalle_ordenes || []);
      }
    } catch (e) {
      console.error("Error al cargar latencia primer tramo:", e);
    } finally {
      setLoading(false);
    }
  }, [currentPeriod]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // Vista de Gráfico: 'barras' (Barras Horizontales con scroll) | 'tendencia' (Evolución temporal día a día con curvas y áreas)
  const [modoGrafico, setModoGrafico] = useState<"barras" | "tendencia">("barras");

  // Filtrado de técnicos para la tabla y gráfico
  const rankingFiltrado = useMemo(() => {
    let list = [...ranking];

    if (filtroSemaforo !== "todos") {
      list = list.filter((t) => t.semaforo === filtroSemaforo);
    }

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      list = list.filter(
        (t) => t.tecnico.toLowerCase().includes(q) || t.cuadrilla.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      const diff = a.latencia_promedio_min - b.latencia_promedio_min;
      return ordenAsc ? diff : -diff;
    });

    return list;
  }, [ranking, filtroSemaforo, busqueda, ordenAsc]);

  // Datos para el gráfico de barras horizontales (Técnicos filtrados para verlos todos con claridad)
  const chartData = useMemo(() => {
    return [...rankingFiltrado];
  }, [rankingFiltrado]);

  // Datos para el gráfico de tendencia temporal (Día por día a lo largo del período seleccionado)
  const evolucionTemporalData = useMemo(() => {
    if (!Array.isArray(ordenes) || ordenes.length === 0) return [];

    // Agrupar por fecha
    const mapaPorFecha = new Map<string, { totalMin: number; conteo: number; ordenesDia: DetalleOrdenLatencia[] }>();

    for (const ord of ordenes) {
      if (!ord || !ord.fecha) continue;
      const f = ord.fecha;
      if (!mapaPorFecha.has(f)) {
        mapaPorFecha.set(f, { totalMin: 0, conteo: 0, ordenesDia: [] });
      }
      const entry = mapaPorFecha.get(f)!;
      entry.totalMin += Number(ord.latencia_demora) || 0;
      entry.conteo += 1;
      entry.ordenesDia.push(ord);
    }

    // Ordenar fechas cronológicamente
    const fechasOrdenadas = Array.from(mapaPorFecha.keys()).sort();

    return fechasOrdenadas.map((fecha) => {
      const entry = mapaPorFecha.get(fecha)!;
      const promedio = entry.conteo > 0 ? Math.round(entry.totalMin / entry.conteo) : 0;
      const puntual = entry.ordenesDia.filter((o) => o.semaforo === "verde").length;
      const pctPuntual = entry.conteo > 0 ? Math.round((puntual / entry.conteo) * 100) : 0;

      // Etiqueta legible (ej. "01 Sep", "15 Ago")
      const partes = fecha.split("-");
      const diaNum = partes[2] || fecha;
      const mesNum = parseInt(partes[1] || "1", 10) - 1;
      const mesNom = NOMBRES_MESES_CORTO[mesNum] || "";
      const label = `${diaNum} ${mesNom}`;

      let semaforoDia: "verde" | "amarillo" | "rojo" = "verde";
      if (promedio > 50) semaforoDia = "rojo";
      else if (promedio > 30) semaforoDia = "amarillo";

      return {
        fecha,
        label,
        latencia_promedio: promedio,
        conteo_tecnicos: entry.conteo,
        pct_puntual: pctPuntual,
        semaforo: semaforoDia,
      };
    });
  }, [ordenes]);

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* ─────────────────────────────────────────────────────────────
          1. BARRA DE CONTROL DE PERÍODO & ACCIONES
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shadow-2xs">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-slate-900 tracking-tight">
                Control de Latencia: Primer Tramo (08:00 AM)
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">
                Jornada Matutina
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Mide el tiempo transcurrido desde las 08:00 AM hasta la llegada/inicio de la 1ra visita.
            </p>
          </div>
        </div>

        {/* SELECTOR DE PERÍODO */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-end">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80">
            {(["dia", "semana", "mes", "anio"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setPeriodMode(m)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                  periodMode === m
                    ? "bg-white text-slate-900 shadow-2xs border border-slate-200/80"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {m === "dia" ? "Día" : m === "semana" ? "Semana" : m === "mes" ? "Mes" : "Año"}
              </button>
            ))}
          </div>

          <select
            value={selectedOption}
            onChange={(e) => setSelectedOption(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200/90 bg-white text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-2xs"
          >
            {periodMode === "dia" &&
              opcionesDias.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            {periodMode === "semana" &&
              opcionesSemanas.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            {periodMode === "mes" &&
              opcionesMeses.todos.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            {periodMode === "anio" &&
              opcionesAnios.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
          </select>

          <button
            type="button"
            onClick={cargarDatos}
            disabled={loading}
            className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-all cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
            title="Recargar datos"
          >
            <RotateCw size={14} className={loading ? "animate-spin text-indigo-600" : ""} />
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. TARJETAS KPIS GENERALES DE FLOTA
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* KPI 1: Latencia Promedio */}
        <div className="bg-white border border-slate-200/80 p-4 rounded-3xl shadow-xs relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Latencia Promedio Flota</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl lg:text-3xl font-black text-slate-900 mt-2">
            {kpis?.latencia_promedio_general ?? 0} <span className="text-sm font-bold text-slate-500">min</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-600">
            <span>Hora promedio de inicio:</span>
            <span className="font-mono font-black text-indigo-600">{kpis?.hora_promedio_general || "08:00"}</span>
          </div>
        </div>

        {/* KPI 2: % Puntualidad */}
        <div className="bg-white border border-slate-200/80 p-4 rounded-3xl shadow-xs relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">% Puntualidad (≤30m)</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl lg:text-3xl font-black text-emerald-700 mt-2">
            {kpis?.porcentaje_puntual_general ?? 0}%
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {kpis?.total_jornadas_evaluadas ?? 0} primeras órdenes evaluadas
          </div>
        </div>

        {/* KPI 3: Técnico Más Puntual */}
        <div
          onClick={() => {
            if (kpis?.tecnico_mas_puntual) {
              setSelectedTecnicoModal(kpis.tecnico_mas_puntual);
            }
          }}
          className="bg-white border border-slate-200/80 p-4 rounded-3xl shadow-xs relative overflow-hidden group cursor-pointer hover:border-emerald-300 hover:shadow-sm transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Técnico Más Puntual</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="text-base font-black text-slate-900 mt-2 truncate">
            {kpis?.tecnico_mas_puntual?.tecnico || "N/A"}
          </div>
          <div className="text-[11px] text-emerald-600 font-bold mt-1">
            {kpis?.tecnico_mas_puntual?.latencia_promedio_min ?? 0} min prom. ({kpis?.tecnico_mas_puntual?.hora_promedio_inicio || "08:00"}) →
          </div>
        </div>

        {/* KPI 4: Mayor Latencia */}
        <div
          onClick={() => {
            if (kpis?.tecnico_mayor_latencia) {
              setSelectedTecnicoModal(kpis.tecnico_mayor_latencia);
            }
          }}
          className="bg-white border border-slate-200/80 p-4 rounded-3xl shadow-xs relative overflow-hidden group cursor-pointer hover:border-red-300 hover:shadow-sm transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-red-700">Mayor Latencia</span>
            <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-base font-black text-slate-900 mt-2 truncate">
            {kpis?.tecnico_mayor_latencia?.tecnico || "N/A"}
          </div>
          <div className="text-[11px] text-red-600 font-bold mt-1">
            {kpis?.tecnico_mayor_latencia?.latencia_promedio_min ?? 0} min prom. ({kpis?.tecnico_mayor_latencia?.hora_promedio_inicio || "11:00"}) →
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. GRÁFICO DUAL: BARRAS HORIZONTALES LEGIBLES vs TENDENCIA TEMPORAL (LÍNEAS)
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              {modoGrafico === "barras" ? <BarChart3 className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">
                {modoGrafico === "barras"
                  ? "Ranking Visual de Latencia por Técnico (Barras Horizontales)"
                  : "Evolución Temporal de Latencia en la Jornada Matutina"}
              </h3>
              <p className="text-[11px] text-slate-500">
                {modoGrafico === "barras"
                  ? "Nombres completos legibles en el eje vertical. Haz clic en cualquier barra para ver el desglose diario."
                  : "Tendencia día a día del promedio de latencia y porcentaje de puntualidad de la flota."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap justify-end">
            {/* 🔀 SELECTOR DUAL DE MODO DE GRÁFICO */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setModoGrafico("barras")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  modoGrafico === "barras"
                    ? "bg-white text-indigo-700 shadow-2xs border border-slate-200/80"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <BarChart3 size={13} />
                <span>Barras por Técnico</span>
              </button>
              <button
                type="button"
                onClick={() => setModoGrafico("tendencia")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  modoGrafico === "tendencia"
                    ? "bg-white text-indigo-700 shadow-2xs border border-slate-200/80"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <TrendingUp size={13} />
                <span>Evolución Temporal</span>
              </button>
            </div>

            {/* LEYENDA SEMÁFOROS */}
            <div className="hidden lg:flex items-center gap-2.5 text-xs font-bold bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200/60">
              <span className="flex items-center gap-1 text-emerald-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> ≤30m
              </span>
              <span className="flex items-center gap-1 text-amber-700">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span> 31-50m
              </span>
              <span className="flex items-center gap-1 text-red-700">
                <span className="w-2 h-2 rounded-full bg-red-500"></span> &gt;50m
              </span>
            </div>
          </div>
        </div>

        {/* ── MODO 1: BARRAS HORIZONTALES CON SCROLL INTERNO (NOMBRES PERFECTAMENTE LEGIBLES) ── */}
        {modoGrafico === "barras" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 px-1 font-semibold">
              <span>Técnico (Total: {chartData.length})</span>
              <span>Minutos de Latencia promedio desde 08:00 AM</span>
            </div>

            <div className="max-h-[460px] overflow-y-auto pr-2 divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-slate-50/30 p-2">
              {chartData.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No hay técnicos registrados para este período o filtro.
                </div>
              ) : (
                chartData.map((tec, idx) => {
                  const maxVal = Math.max(...chartData.map((t) => t.latencia_promedio_min), 60);
                  const barWidthPct = Math.min(100, Math.max(3, (tec.latencia_promedio_min / maxVal) * 100));
                  const bgBarColor =
                    tec.semaforo === "verde"
                      ? "bg-emerald-500"
                      : tec.semaforo === "amarillo"
                      ? "bg-amber-500"
                      : "bg-red-500";
                  const textBadgeColor =
                    tec.semaforo === "verde"
                      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                      : tec.semaforo === "amarillo"
                      ? "text-amber-700 bg-amber-50 border-amber-200"
                      : "text-red-700 bg-red-50 border-red-200";

                  return (
                    <div
                      key={tec.tecnico}
                      onClick={() => setSelectedTecnicoModal(tec)}
                      className="py-2 px-2.5 rounded-xl hover:bg-white hover:shadow-xs transition-all cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      title="Clic para ver detalle de órdenes"
                    >
                      {/* Lado Izquierdo: Nombre + Cuadrilla */}
                      <div className="w-full sm:w-64 shrink-0 flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-slate-400 w-6 text-right shrink-0">
                          {idx + 1}.
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                            {tec.tecnico}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate">
                            {tec.cuadrilla || "Sin cuadrilla"} • {tec.dias_laborados} días
                          </p>
                        </div>
                      </div>

                      {/* Centro: Barra Horizontal Proporcional */}
                      <div className="flex-1 flex items-center gap-3">
                        <div className="flex-1 bg-slate-200/70 h-3 rounded-full overflow-hidden relative">
                          {/* Línea de meta de 30m */}
                          <div
                            className="absolute top-0 bottom-0 w-0.5 bg-emerald-700 z-10 opacity-70"
                            style={{ left: `${Math.min(100, (30 / maxVal) * 100)}%` }}
                            title="Meta 30 min"
                          />
                          {/* Barra de progreso del técnico */}
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${bgBarColor} group-hover:brightness-110`}
                            style={{ width: `${barWidthPct}%` }}
                          />
                        </div>

                        {/* Valor en Minutos */}
                        <div className="w-20 shrink-0 text-right">
                          <span
                            className={`inline-block font-mono font-black text-xs px-2 py-0.5 rounded-md border ${textBadgeColor}`}
                          >
                            {tec.latencia_promedio_min} min
                          </span>
                        </div>
                      </div>

                      {/* Lado Derecho: Hora estimada y Botón */}
                      <div className="hidden md:flex items-center gap-2 shrink-0 pl-2">
                        <span className="text-[11px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                          Llegada: {tec.hora_promedio_inicio}
                        </span>
                        <span className="text-[11px] font-bold text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
                          Detalle →
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ── MODO 2: EVOLUCIÓN TEMPORAL DÍA A DÍA (CURVAS / SPLINES TIPO FACTORES CULTURA) ── */}
        {modoGrafico === "tendencia" && (
          <div className="space-y-3">
            <div className="h-80 w-full pt-1">
              {evolucionTemporalData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  No hay datos temporales suficientes para graficar la evolución.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={evolucionTemporalData} margin={{ top: 15, right: 15, left: -15, bottom: 20 }}>
                    <defs>
                      <linearGradient id="colorLatencia" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="label"
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      unit="m"
                      domain={[0, "auto"]}
                    />
                    <RechartsTooltip
                      content={({ active, payload }: any) => {
                        if (active && payload && payload.length) {
                          const d = payload[0].payload;
                          return (
                            <div className="bg-slate-900/95 backdrop-blur-md p-3.5 rounded-2xl border border-slate-700 text-white shadow-xl text-xs space-y-1.5 z-50">
                              <p className="font-black text-sm text-slate-100 flex items-center justify-between gap-3">
                                <span>{d.fecha} ({d.label})</span>
                                <span
                                  className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                    d.semaforo === "verde"
                                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                      : d.semaforo === "amarillo"
                                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                      : "bg-red-500/20 text-red-300 border border-red-500/30"
                                  }`}
                                >
                                  {d.semaforo === "verde" ? "Puntual" : d.semaforo === "amarillo" ? "Aceptable" : "Crítico"}
                                </span>
                              </p>
                              <div className="pt-2 border-t border-slate-800 space-y-1">
                                <p className="flex justify-between gap-4">
                                  <span className="text-slate-400">Latencia Promedio Flota:</span>
                                  <span className="font-black text-indigo-400">{d.latencia_promedio} min</span>
                                </p>
                                <p className="flex justify-between gap-4">
                                  <span className="text-slate-400">Técnicos Evaluados:</span>
                                  <span className="font-bold text-slate-200">{d.conteo_tecnicos}</span>
                                </p>
                                <p className="flex justify-between gap-4">
                                  <span className="text-slate-400">% Salida Puntual (≤30m):</span>
                                  <span className="font-bold text-emerald-400">{d.pct_puntual}%</span>
                                </p>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <ReferenceLine
                      y={30}
                      stroke="#10b981"
                      strokeDasharray="4 4"
                      label={{ value: "Meta 30m", position: "top", fill: "#10b981", fontSize: 10, fontWeight: 700 }}
                    />
                    <ReferenceLine
                      y={50}
                      stroke="#ef4444"
                      strokeDasharray="4 4"
                      label={{ value: "Límite 50m", position: "top", fill: "#ef4444", fontSize: 10, fontWeight: 700 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="latencia_promedio"
                      name="Latencia Promedio"
                      stroke="#6366f1"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorLatencia)"
                      dot={{ r: 3, fill: "#4f46e5", strokeWidth: 1, stroke: "#fff" }}
                      activeDot={{ r: 6, fill: "#6366f1" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 px-1">
              <span>Línea continua: Promedio diario en minutos de demora de los técnicos al llegar a su primera orden.</span>
              <span className="font-bold text-indigo-600">Referencia: 08:00 AM</span>
            </div>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. TABLA RANKING GENERAL DE TÉCNICOS CON AUDITORÍA
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">
                Ranking de Técnicos por Latencia Matutina
              </h3>
              <p className="text-[11px] text-slate-500">
                Selecciona cualquier fila para abrir el desglose de órdenes y exportar su historial a Excel.
              </p>
            </div>
          </div>

          {/* FILTROS DE TABLA */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-full sm:w-60">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Filtrar técnico o cuadrilla..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setFiltroSemaforo("todos")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filtroSemaforo === "todos"
                    ? "bg-slate-800 text-white shadow-2xs"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                Todos ({ranking.length})
              </button>
              <button
                type="button"
                onClick={() => setFiltroSemaforo("verde")}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  filtroSemaforo === "verde"
                    ? "bg-emerald-600 text-white shadow-2xs"
                    : "bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50"
                }`}
                title="≤ 30 min"
              >
                <CheckCircle2 size={12} />
                <span>Puntuales</span>
              </button>
              <button
                type="button"
                onClick={() => setFiltroSemaforo("rojo")}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  filtroSemaforo === "rojo"
                    ? "bg-red-600 text-white shadow-2xs"
                    : "bg-white text-red-700 border border-red-200 hover:bg-red-50"
                }`}
                title="> 50 min"
              >
                <XCircle size={12} />
                <span>Críticos</span>
              </button>

              <button
                type="button"
                onClick={() => setOrdenAsc(!ordenAsc)}
                className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 transition-all cursor-pointer ml-1"
                title={ordenAsc ? "De menor a mayor latencia" : "De mayor a menor latencia"}
              >
                <ArrowUpDown size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* TABLA */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200/90 shadow-2xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-3">#</th>
                <th className="p-3">Técnico</th>
                <th className="p-3">Cuadrilla</th>
                <th className="p-3 text-center">Días Evaluados</th>
                <th className="p-3 text-center">Hora Promedio Llegada</th>
                <th className="p-3 text-center">Latencia Promedio</th>
                <th className="p-3 text-center">% Puntual</th>
                <th className="p-3 text-center">Semáforo</th>
                <th className="p-3 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {rankingFiltrado.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-slate-400">
                    No se encontraron técnicos para los criterios seleccionados.
                  </td>
                </tr>
              ) : (
                rankingFiltrado.map((tec, idx) => (
                  <tr
                    key={tec.tecnico}
                    onClick={() => setSelectedTecnicoModal(tec)}
                    className="hover:bg-indigo-50/50 transition-colors cursor-pointer group"
                  >
                    <td className="p-3 font-mono font-bold text-slate-400">{idx + 1}</td>
                    <td className="p-3 font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      {tec.tecnico}
                    </td>
                    <td className="p-3 text-slate-500 max-w-[200px] truncate">{tec.cuadrilla || "-"}</td>
                    <td className="p-3 text-center font-mono font-bold text-slate-800">{tec.dias_laborados}</td>
                    <td className="p-3 text-center font-mono font-black text-slate-900">
                      {tec.hora_promedio_inicio}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`font-black font-mono px-2.5 py-1 rounded-lg text-xs ${
                          tec.semaforo === "verde"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : tec.semaforo === "amarillo"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-red-50 text-red-700 border border-red-200"
                        }`}
                      >
                        {tec.latencia_promedio_min} min
                      </span>
                    </td>
                    <td className="p-3 text-center font-bold text-slate-800">{tec.porcentaje_puntual}%</td>
                    <td className="p-3 text-center whitespace-nowrap">
                      {tec.semaforo === "verde" ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-[10px] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 size={11} />
                          <span>Puntual</span>
                        </span>
                      ) : tec.semaforo === "amarillo" ? (
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
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTecnicoModal(tec);
                        }}
                        className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-indigo-50 text-indigo-600 hover:text-indigo-700 font-bold text-[11px] border border-slate-200 hover:border-indigo-300 transition-all cursor-pointer shadow-2xs"
                      >
                        Ver Detalle →
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          5. MODAL DRILL-DOWN DEL TÉCNICO SELECCIONADO
      ───────────────────────────────────────────────────────────── */}
      <LatencyFirstLegModal
        isOpen={Boolean(selectedTecnicoModal)}
        onClose={() => setSelectedTecnicoModal(null)}
        tecnico={selectedTecnicoModal}
        ordenes={ordenes}
        periodoTexto={currentPeriod.label}
      />
    </div>
  );
};
