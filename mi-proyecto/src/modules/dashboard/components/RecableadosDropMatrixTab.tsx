import React, { useState, useEffect, useMemo, useCallback } from "react";
import { API_URL } from "../../../config/api";
import {
  Cable,
  TrendingUp,
  Award,
  AlertTriangle,
  RefreshCw,
  Search,
  Calendar,
  Layers,
  BarChart3,
  PieChart as PieIcon,
  Filter,
  ArrowUpDown,
  CheckCircle2,
  Zap,
  Truck,
  Package,
  Activity,
  User,
  Flame,
  HelpCircle,
  Repeat
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from "recharts";

interface ResumenKPIs {
  total_ordenes: number;
  total_recableados: number;
  total_traslados: number;
  total_recableados_mas_traslados: number;
  pct_rec_mas_tras_general: number;
  total_altas: number;
  total_otras: number;
  pct_recableados_general: number;
  total_metros_bobina: number;
  total_metros_conectorizado: number;
  total_rollos_conectorizados: number;
  total_fibra_efectiva: number;
  prom_metros_por_recableado: number;
  tecnico_lider_recableado?: TecnicoMatrixRow | null;
}

interface TecnicoMatrixRow {
  id_tecnico: number;
  tecnico: string;
  foto_personal?: string | null;
  cuadrilla: string;
  total_ordenes: number;
  recableados: number;
  traslados: number;
  recableados_mas_traslados: number;
  pct_recableados_mas_traslados: number;
  altas: number;
  otras: number;
  ordenes_con_drop: number;
  pct_recableado: number;
  metros_bobina: number;
  metros_conectorizado: number;
  rollos_conectorizados: number;
  rollos_50: number;
  rollos_100: number;
  rollos_150: number;
  rollos_200: number;
  total_fibra_efectiva: number;
  prom_drop_por_recableado: number;
  nivel_recableado: string;
}

interface TopGraficoItem {
  tecnico: string;
  tecnico_completo: string;
  recableados: number;
  traslados: number;
  total_ordenes: number;
  metros_fibra: number;
}

interface DistribucionItem {
  name: string;
  value: number;
  color: string;
}

interface TimelineItem {
  fecha: string;
  fecha_corta: string;
  total_ordenes: number;
  recableados: number;
  traslados: number;
  metros_drop: number;
}

interface MatrixResponse {
  success: boolean;
  resumen: ResumenKPIs;
  ranking_tecnicos: TecnicoMatrixRow[];
  top_10_grafico: TopGraficoItem[];
  distribucion_tipos: DistribucionItem[];
  timeline: TimelineItem[];
}

const CustomChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/95 text-white backdrop-blur-md p-3.5 rounded-2xl border border-slate-700 shadow-2xl text-xs space-y-1 z-50">
        <p className="font-black text-slate-100 text-sm">{label || payload[0]?.name}</p>
        <div className="pt-1 space-y-1">
          {payload.map((p: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between gap-4 font-semibold">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: p.color || p.fill }} />
                {p.name}:
              </span>
              <span className="font-mono font-bold text-white">{p.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export const RecableadosDropMatrixTab: React.FC = () => {
  // Presets de fecha
  const [periodPreset, setPeriodPreset] = useState<"hoy" | "semana" | "mes_actual" | "mes_anterior" | "custom">("mes_actual");

  const getPresetDates = (preset: string) => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const format = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === "hoy") {
      const today = format(now);
      return { desde: today, hasta: today };
    }
    if (preset === "semana") {
      const first = new Date(now.setDate(now.getDate() - now.getDay() + 1));
      const last = new Date(now.setDate(now.getDate() - now.getDay() + 7));
      return { desde: format(first), hasta: format(last) };
    }
    if (preset === "mes_anterior") {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { desde: format(first), hasta: format(last) };
    }
    // mes_actual (default)
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { desde: format(first), hasta: format(last) };
  };

  const initialDates = getPresetDates("mes_actual");
  const [fechaDesde, setFechaDesde] = useState<string>(initialDates.desde);
  const [fechaHasta, setFechaHasta] = useState<string>(initialDates.hasta);

  const [data, setData] = useState<MatrixResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortField, setSortField] = useState<keyof TecnicoMatrixRow>("recableados");
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [chartView, setChartView] = useState<"top_recableados" | "evolucion" | "distribucion">("top_recableados");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL(`${API_URL}/api/dashboard/matriz-recableados-drop`);
      if (fechaDesde) url.searchParams.set("desde", fechaDesde);
      if (fechaHasta) url.searchParams.set("hasta", fechaHasta);

      const res = await fetch(url.toString(), {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token") || ""}`
        }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: MatrixResponse = await res.json();
      if (json && json.success) {
        setData(json);
      }
    } catch (err) {
      console.error("Error al cargar matriz de recableados y drop:", err);
    } finally {
      setLoading(false);
    }
  }, [fechaDesde, fechaHasta]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePresetChange = (preset: "hoy" | "semana" | "mes_actual" | "mes_anterior" | "custom") => {
    setPeriodPreset(preset);
    if (preset !== "custom") {
      const { desde, hasta } = getPresetDates(preset);
      setFechaDesde(desde);
      setFechaHasta(hasta);
    }
  };

  // Filtrado y ordenamiento de técnicos
  const filteredTecnicos = useMemo(() => {
    if (!data?.ranking_tecnicos) return [];
    let list = [...data.ranking_tecnicos];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (t) =>
          t.tecnico.toLowerCase().includes(q) ||
          t.cuadrilla.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      const vA = a[sortField] ?? 0;
      const vB = b[sortField] ?? 0;
      if (typeof vA === "string" && typeof vB === "string") {
        return sortAsc ? vA.localeCompare(vB) : vB.localeCompare(vA);
      }
      return sortAsc ? Number(vA) - Number(vB) : Number(vB) - Number(vA);
    });

    return list;
  }, [data, searchTerm, sortField, sortAsc]);

  const handleSort = (field: keyof TecnicoMatrixRow) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const resumen = data?.resumen;

  return (
    <div className="space-y-4 animate-fade-in text-slate-800 pb-10">
      
      {/* ─────────────────────────────────────────────────────────────
          1. HEADER Y BARRA DE CONTROL DELGADA (ESTILO CLARO)
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200/70">
            <Cable size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight truncate">
                Control de Consumo de Cable Drop & Recableados
              </h2>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                Fibra & Traslados
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium truncate max-w-xl">
              Medición de Recableados vs Traslados vs Drop consumido (bobina continua y rollos conectorizados).
            </p>
          </div>
        </div>

        {/* Filtros de Fecha Delgados */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto shrink-0">
          {/* Presets */}
          <div className="bg-slate-100/90 p-0.5 rounded-xl flex items-center gap-0.5 border border-slate-200/80 text-xs">
            <button
              type="button"
              onClick={() => handlePresetChange("hoy")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                periodPreset === "hoy"
                  ? "bg-white text-indigo-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange("semana")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                periodPreset === "semana"
                  ? "bg-white text-indigo-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              Semana
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange("mes_actual")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                periodPreset === "mes_actual"
                  ? "bg-white text-indigo-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              Este Mes
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange("mes_anterior")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                periodPreset === "mes_anterior"
                  ? "bg-white text-indigo-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              Mes Anterior
            </button>
          </div>

          {/* Rango de Fechas */}
          <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-xl border border-slate-200 text-xs">
            <Calendar size={13} className="text-slate-400 shrink-0" />
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => {
                setPeriodPreset("custom");
                setFechaDesde(e.target.value);
              }}
              className="bg-transparent text-slate-800 font-mono font-bold focus:outline-hidden text-xs cursor-pointer"
            />
            <span className="text-slate-400 text-[10px]">→</span>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => {
                setPeriodPreset("custom");
                setFechaHasta(e.target.value);
              }}
              className="bg-transparent text-slate-800 font-mono font-bold focus:outline-hidden text-xs cursor-pointer"
            />
            <button
              type="button"
              onClick={fetchData}
              title="Actualizar datos"
              className="p-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors cursor-pointer shadow-2xs"
            >
              <RefreshCw size={12} className={loading ? "animate-spin text-indigo-600" : ""} />
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. KPI CARDS RESUMEN (ESTILO CLARO Y COMPACTO)
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        
        {/* Recableado + Traslado Combinados */}
        <div className="p-3.5 rounded-2xl bg-white border border-indigo-200/80 shadow-xs flex items-center justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-50 rounded-full blur-xl -mr-6 -mt-6 pointer-events-none" />
          <div className="space-y-0.5 relative z-10">
            <span className="text-[10px] font-extrabold text-indigo-800 uppercase tracking-wider block">
              Recableados + Traslados
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-indigo-950 font-mono">
                {resumen?.total_recableados_mas_traslados || 0}
              </span>
              <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded-md border border-indigo-200">
                {resumen?.pct_rec_mas_tras_general || 0}%
              </span>
            </div>
            <span className="text-[10px] text-slate-400 block truncate">
              {resumen?.total_ordenes || 0} órdenes en total
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-200/70 shrink-0">
            <Repeat size={18} />
          </div>
        </div>

        {/* Solo Recableados */}
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
              Recableados Solos
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-orange-600 font-mono">
                {resumen?.total_recableados || 0}
              </span>
              <span className="text-[10px] font-bold text-orange-700 bg-orange-50 px-1.5 py-0.2 rounded-md border border-orange-200">
                {resumen?.pct_recableados_general || 0}%
              </span>
            </div>
            <span className="text-[10px] text-slate-400 block truncate">
              Averías por cambio drop
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-200/70 shrink-0">
            <Cable size={18} />
          </div>
        </div>

        {/* Solo Traslados */}
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
              Total Traslados
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-blue-600 font-mono">
                {resumen?.total_traslados || 0}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">traslados</span>
            </div>
            <span className="text-[10px] text-slate-400 block truncate">
              Traslado interno / externo
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200/70 shrink-0">
            <Truck size={18} />
          </div>
        </div>

        {/* Consumo de Fibra Drop */}
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
              Total Fibra Drop Usada
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-emerald-600 font-mono">
                {resumen?.total_fibra_efectiva || 0}
              </span>
              <span className="text-[10px] text-slate-500 font-bold">metros</span>
            </div>
            <div className="text-[9px] text-slate-400 font-mono truncate">
              Bobina: {resumen?.total_metros_bobina || 0}m • Conect: {resumen?.total_metros_conectorizado || 0}m
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200/70 shrink-0">
            <Package size={18} />
          </div>
        </div>

        {/* Técnico Líder */}
        <div className="p-3.5 rounded-2xl bg-amber-50/50 border border-amber-200/80 shadow-xs flex items-center justify-between">
          <div className="space-y-0.5 min-w-0">
            <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider flex items-center gap-1 block">
              <Award size={12} className="text-amber-600" />
              Líder en Recableados
            </span>
            <span className="text-xs font-black text-slate-900 block truncate" title={resumen?.tecnico_lider_recableado?.tecnico}>
              {resumen?.tecnico_lider_recableado?.tecnico || "Sin registros"}
            </span>
            <div className="flex items-center gap-1 text-[10px] text-amber-900 font-bold font-mono">
              <span>{resumen?.tecnico_lider_recableado?.recableados || 0} recab.</span>
              <span className="text-amber-700">({resumen?.tecnico_lider_recableado?.pct_recableado || 0}%)</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center border border-amber-300/60 shrink-0">
            <Flame size={18} className="text-amber-600" />
          </div>
        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. GRÁFICOS INTERACTIVOS (ESTILO CLARO)
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <BarChart3 size={16} className="text-indigo-600" />
            <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 uppercase tracking-wider">
              Análisis Visual & Comparativa
            </h3>
          </div>

          <div className="bg-slate-100 p-0.5 rounded-xl flex items-center gap-1 text-xs border border-slate-200/70">
            <button
              type="button"
              onClick={() => setChartView("top_recableados")}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                chartView === "top_recableados"
                  ? "bg-white text-indigo-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Top Técnicos (Recableados vs Traslados)
            </button>
            <button
              type="button"
              onClick={() => setChartView("evolucion")}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                chartView === "evolucion"
                  ? "bg-white text-indigo-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Evolución Diaria
            </button>
            <button
              type="button"
              onClick={() => setChartView("distribucion")}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                chartView === "distribucion"
                  ? "bg-white text-indigo-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Distribución de Tipos
            </button>
          </div>
        </div>

        {/* Contenedor del Gráfico */}
        <div className="h-72 w-full pt-2">
          {chartView === "top_recableados" && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data?.top_10_grafico || []}
                margin={{ top: 10, right: 20, left: -10, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="tecnico"
                  tick={{ fill: "#64748b", fontSize: 11, fontWeight: 600 }}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                <RechartsTooltip content={<CustomChartTooltip />} />
                <Legend wrapperStyle={{ paddingTop: 10, fontSize: 12, fontWeight: 700 }} />
                <Bar dataKey="recableados" name="Recableados" fill="#f97316" radius={[6, 6, 0, 0]} />
                <Bar dataKey="traslados" name="Traslados" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}

          {chartView === "evolucion" && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data?.timeline || []}
                margin={{ top: 10, right: 20, left: -10, bottom: 10 }}
              >
                <defs>
                  <linearGradient id="gradRecableados" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gradTraslados" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="fecha_corta" tick={{ fill: "#64748b", fontSize: 11 }} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                <RechartsTooltip content={<CustomChartTooltip />} />
                <Legend wrapperStyle={{ paddingTop: 10, fontSize: 12, fontWeight: 700 }} />
                <Area type="monotone" dataKey="recableados" name="Recableados" stroke="#f97316" fillOpacity={1} fill="url(#gradRecableados)" />
                <Area type="monotone" dataKey="traslados" name="Traslados" stroke="#3b82f6" fillOpacity={1} fill="url(#gradTraslados)" />
              </AreaChart>
            </ResponsiveContainer>
          )}

          {chartView === "distribucion" && (
            <div className="grid grid-cols-1 md:grid-cols-2 h-full items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data?.distribucion_tipos || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {(data?.distribucion_tipos || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<CustomChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 pr-4">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Proporción de Órdenes del Período
                </span>
                {(data?.distribucion_tipos || []).map((d, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                    <span className="flex items-center gap-2 font-bold text-slate-700">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                      {d.name}
                    </span>
                    <span className="font-mono font-black text-slate-900">
                      {d.value} <span className="text-slate-400 font-normal">({resumen?.total_ordenes ? ((d.value / resumen.total_ordenes) * 100).toFixed(1) : 0}%)</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. TABLA MATRIZ DETALLADA POR TÉCNICO
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-3">
        
        {/* Cabecera de la Tabla con Buscador */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-1">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <span>Matriz Detallada por Técnico</span>
              <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold text-[10px] border border-indigo-200">
                {filteredTecnicos.length} técnicos
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Haz clic en cualquier encabezado para ordenar de mayor a menor.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar técnico o cuadrilla..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 bg-slate-50/50"
            />
          </div>
        </div>

        {/* Tabla Responsiva */}
        <div className="overflow-x-auto rounded-xl border border-slate-200/90">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/90 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 cursor-pointer hover:bg-slate-100" onClick={() => handleSort("tecnico")}>
                  <div className="flex items-center gap-1">
                    <span>Técnico & Cuadrilla</span>
                    <ArrowUpDown size={10} className="text-slate-400" />
                  </div>
                </th>
                <th className="py-2.5 px-2 text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort("total_ordenes")}>
                  <div className="flex items-center justify-center gap-1">
                    <span>Total Órd.</span>
                    <ArrowUpDown size={10} className="text-slate-400" />
                  </div>
                </th>
                <th className="py-2.5 px-2 text-center cursor-pointer hover:bg-orange-50 text-orange-800 bg-orange-50/40" onClick={() => handleSort("recableados")}>
                  <div className="flex items-center justify-center gap-1">
                    <span>Recableados</span>
                    <ArrowUpDown size={10} className="text-orange-600" />
                  </div>
                </th>
                <th className="py-2.5 px-2 text-center cursor-pointer hover:bg-orange-50 text-orange-800 bg-orange-50/40" onClick={() => handleSort("pct_recableado")}>
                  <div className="flex items-center justify-center gap-1">
                    <span>% Recab.</span>
                    <ArrowUpDown size={10} className="text-orange-600" />
                  </div>
                </th>
                <th className="py-2.5 px-2 text-center cursor-pointer hover:bg-blue-50 text-blue-800 bg-blue-50/30" onClick={() => handleSort("traslados")}>
                  <div className="flex items-center justify-center gap-1">
                    <span>Traslados</span>
                    <ArrowUpDown size={10} className="text-blue-600" />
                  </div>
                </th>

                {/* 🌟 COLUMNAS INDIVIDUALES: RECABLEADO + TRASLADO & % INDIVIDUAL */}
                <th className="py-2.5 px-2 text-center cursor-pointer hover:bg-indigo-100 text-indigo-950 bg-indigo-50/70 border-l border-indigo-200/80" onClick={() => handleSort("recableados_mas_traslados")}>
                  <div className="flex items-center justify-center gap-1">
                    <Repeat size={10} className="text-indigo-600" />
                    <span>Recab.+Trasl.</span>
                    <ArrowUpDown size={10} className="text-indigo-600" />
                  </div>
                </th>

                <th className="py-2.5 px-2 text-center cursor-pointer hover:bg-indigo-100 text-indigo-950 bg-indigo-50/70 border-r border-indigo-200/80" onClick={() => handleSort("pct_recableados_mas_traslados")}>
                  <div className="flex items-center justify-center gap-1">
                    <span>% (Rec.+Tras.)</span>
                    <ArrowUpDown size={10} className="text-indigo-600" />
                  </div>
                </th>

                <th className="py-2.5 px-2 text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort("metros_bobina")}>
                  <div className="flex items-center justify-center gap-1">
                    <span>Bobina (m)</span>
                    <ArrowUpDown size={10} className="text-slate-400" />
                  </div>
                </th>
                <th className="py-2.5 px-2 text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort("rollos_conectorizados")}>
                  <div className="flex items-center justify-center gap-1">
                    <span>Conectorizado</span>
                    <ArrowUpDown size={10} className="text-slate-400" />
                  </div>
                </th>
                <th className="py-2.5 px-2 text-center cursor-pointer hover:bg-emerald-50 text-emerald-800 bg-emerald-50/40" onClick={() => handleSort("total_fibra_efectiva")}>
                  <div className="flex items-center justify-center gap-1">
                    <span>Fibra Total</span>
                    <ArrowUpDown size={10} className="text-emerald-600" />
                  </div>
                </th>
                <th className="py-2.5 px-2 text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort("prom_drop_por_recableado")}>
                  <div className="flex items-center justify-center gap-1">
                    <span>Prom. Drop</span>
                    <ArrowUpDown size={10} className="text-slate-400" />
                  </div>
                </th>
                <th className="py-2.5 px-2 text-center">Nivel</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={12} className="py-10 text-center text-slate-400 font-medium">
                    <RefreshCw size={20} className="animate-spin mx-auto mb-1.5 text-indigo-500" />
                    Cargando matriz de técnicos...
                  </td>
                </tr>
              ) : filteredTecnicos.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-10 text-center text-slate-400 font-medium">
                    No se encontraron registros de técnicos con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredTecnicos.map((t, idx) => {
                  const isLeader = idx === 0 && (sortField === "recableados" || sortField === "recableados_mas_traslados") && !sortAsc;
                  return (
                    <tr key={t.id_tecnico || idx} className="hover:bg-indigo-50/30 transition-colors">
                      {/* Técnico & Cuadrilla */}
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center text-slate-600 font-bold shrink-0 text-[11px]">
                            {t.foto_personal ? (
                              <img src={`${API_URL}/uploads/${t.foto_personal}`} alt={t.tecnico} className="w-full h-full object-cover" />
                            ) : (
                              <span>{t.tecnico.charAt(0)}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="font-extrabold text-slate-900 block leading-tight truncate max-w-[150px] flex items-center gap-1" title={t.tecnico}>
                              {t.tecnico}
                              {isLeader && (
                                <Flame size={12} className="text-orange-500 shrink-0 animate-pulse" />
                              )}
                            </span>
                            <span className="text-[10px] font-mono text-indigo-700 font-bold block truncate max-w-[140px]">
                              {t.cuadrilla}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Total Órdenes */}
                      <td className="py-2 px-2 text-center font-mono font-bold text-slate-900">
                        {t.total_ordenes}
                      </td>

                      {/* Recableados */}
                      <td className="py-2 px-2 text-center bg-orange-50/20">
                        <span className="px-2 py-0.5 rounded-lg bg-orange-100 text-orange-950 font-mono font-black text-xs border border-orange-200/80 inline-block">
                          {t.recableados}
                        </span>
                      </td>

                      {/* % Recableado */}
                      <td className="py-2 px-2 text-center font-mono font-bold text-slate-700">
                        <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${
                          t.pct_recableado >= 40
                            ? "bg-rose-100 text-rose-900 font-black"
                            : t.pct_recableado >= 25
                            ? "bg-amber-100 text-amber-900"
                            : "bg-slate-100 text-slate-700"
                        }`}>
                          {t.pct_recableado}%
                        </span>
                      </td>

                      {/* Traslados */}
                      <td className="py-2 px-2 text-center bg-blue-50/20">
                        <span className="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-900 font-mono font-bold text-xs border border-blue-200/80 inline-block">
                          {t.traslados}
                        </span>
                      </td>

                      {/* 🌟 COLUMNAS INDIVIDUALES: RECABLEADO + TRASLADO & % INDIVIDUAL */}
                      <td className="py-2 px-2 text-center bg-indigo-50/30 border-l border-indigo-100">
                        <span className="px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-950 font-mono font-black text-xs border border-indigo-200 shadow-2xs inline-block">
                          {t.recableados_mas_traslados ?? (t.recableados + t.traslados)}
                        </span>
                      </td>

                      <td className="py-2 px-2 text-center bg-indigo-50/30 border-r border-indigo-100 font-mono font-bold">
                        <span className={`px-1.5 py-0.5 rounded-md text-[10px] inline-block ${
                          (t.pct_recableados_mas_traslados ?? 0) >= 40
                            ? "bg-purple-100 text-purple-950 font-black border border-purple-200"
                            : (t.pct_recableados_mas_traslados ?? 0) >= 25
                            ? "bg-indigo-50 text-indigo-900 border border-indigo-200"
                            : "bg-slate-100 text-slate-700"
                        }`}>
                          {t.pct_recableados_mas_traslados ?? (t.total_ordenes > 0 ? (((t.recableados + t.traslados) / t.total_ordenes) * 100).toFixed(1) : 0)}%
                        </span>
                      </td>

                      {/* Metros Bobina */}
                      <td className="py-2 px-2 text-center font-mono font-medium text-slate-700">
                        {t.metros_bobina > 0 ? (
                          <span className="font-bold text-slate-900">{t.metros_bobina}m</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Rollos Conectorizados */}
                      <td className="py-2 px-2 text-center">
                        {t.rollos_conectorizados > 0 ? (
                          <span className="font-mono text-[10px] bg-emerald-50 text-emerald-900 border border-emerald-200 px-1.5 py-0.5 rounded-md font-bold inline-block">
                            {t.rollos_conectorizados} und ({t.metros_conectorizado}m)
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-xs">-</span>
                        )}
                      </td>

                      {/* Fibra Total Efectiva */}
                      <td className="py-2 px-2 text-center bg-emerald-50/20">
                        <span className="font-mono font-black text-emerald-900 text-xs">
                          {t.total_fibra_efectiva > 0 ? `${t.total_fibra_efectiva}m` : "-"}
                        </span>
                      </td>

                      {/* Promedio Drop por Recableado */}
                      <td className="py-2 px-2 text-center font-mono font-bold text-slate-700 text-xs">
                        {t.prom_drop_por_recableado > 0 ? `${t.prom_drop_por_recableado}m` : "-"}
                      </td>

                      {/* Nivel de Recableado */}
                      <td className="py-2 px-2 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${
                          t.nivel_recableado.includes("Alto")
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : t.nivel_recableado.includes("Medio")
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }`}>
                          {t.nivel_recableado}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
};
