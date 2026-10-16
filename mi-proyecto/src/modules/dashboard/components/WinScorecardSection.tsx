import React, { useState, useEffect, useCallback, useMemo } from "react";
import { API_URL } from "../../../config/api";
import {
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Target,
  Users,
  Calendar,
  Filter,
  RefreshCw,
  ExternalLink,
  Info,
  ChevronRight,
  ShieldCheck,
  Award,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine,
} from "recharts";
import { WinScorecardOrdersModal } from "./WinScorecardOrdersModal";

interface ScorecardKpis {
  total_ordenes: number;
  terminadas: number;
  canceladas: number;
  regestion: number;
  excluidas: number;
  total_evaluados: number;
  pct_efectividad: number;
  meta_efectividad: number;
  cumple_efectividad: boolean;
  vtr_casos: number;
  vtr_base: number;
  vtr_atendidas?: number;
  pct_vtr: number;
  meta_vtr: number;
  cumple_vtr: boolean;
}

interface DiaScorecard {
  fecha: string;
  dia: number;
  dia_nombre: string;
  label: string;
  total: number;
  terminadas: number;
  canceladas: number;
  regestion: number;
  evaluados: number;
  pct_efectividad: number;
  cumple_efectividad: boolean;
  vtr_casos: number;
  pct_vtr: number;
  cumple_vtr: boolean;
}

interface TopCancelacion {
  motivo: string;
  total: number;
}

interface TecnicoRendimiento {
  tecnico: string;
  total: number;
  terminadas: number;
  canceladas: number;
  regestion: number;
  evaluados: number;
  pct_efectividad: number;
  cumple_efectividad: boolean;
  vtr_casos: number;
  pct_vtr: number;
}

export const WinScorecardSection: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  
  // Filtros de fecha (Perú UTC-5 seguro)
  const hoy = useMemo(() => new Date(), []);
  const defaultDesde = useMemo(() => {
    const y = hoy.getFullYear();
    const m = String(hoy.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}-01`;
  }, [hoy]);
  
  const defaultHasta = useMemo(() => {
    const y = hoy.getFullYear();
    const m = String(hoy.getMonth() + 1).padStart(2, "0");
    const ult = new Date(y, hoy.getMonth() + 1, 0).getDate();
    return `${y}-${m}-${String(ult).padStart(2, "0")}`;
  }, [hoy]);

  const [desde, setDesde] = useState<string>(defaultDesde);
  const [hasta, setHasta] = useState<string>(defaultHasta);
  const [periodoQuick, setPeriodoQuick] = useState<"mes" | "mes_ant" | "hoy" | "semana">("mes");

  // Datos
  const [kpis, setKpis] = useState<ScorecardKpis | null>(null);
  const [tendencia, setTendencia] = useState<DiaScorecard[]>([]);
  const [cancelaciones, setCancelaciones] = useState<TopCancelacion[]>([]);
  const [tecnicos, setTecnicos] = useState<TecnicoRendimiento[]>([]);

  // Modal drill-down
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [modalTipo, setModalTipo] = useState<"terminadas" | "canceladas" | "regestion" | "vtr" | "excluidas" | "todos">("todos");
  const [modalTitle, setModalTitle] = useState<string>("");

  const handleOpenModal = (tipo: "terminadas" | "canceladas" | "regestion" | "vtr" | "excluidas" | "todos", title: string) => {
    setModalTipo(tipo);
    setModalTitle(title);
    setModalOpen(true);
  };

  const cargarScorecard = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`${API_URL}/api/dashboard/win-scorecard?desde=${desde}&hasta=${hasta}`);
      const json = await res.json();
      if (json && json.success) {
        setKpis(json.kpis);
        setTendencia(json.tendencia_diaria || []);
        setCancelaciones(json.top_cancelaciones || []);
        setTecnicos(json.ranking_tecnicos || []);
      }
    } catch (err) {
      console.error("Error al cargar scorecard WIN:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [desde, hasta]);

  useEffect(() => {
    cargarScorecard();
  }, [cargarScorecard]);

  // Manejar cambio de períodos rápidos
  const handleSelectQuick = (q: "mes" | "mes_ant" | "hoy" | "semana") => {
    setPeriodoQuick(q);
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    const fmt = (d: Date) => {
      const yy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yy}-${mm}-${dd}`;
    };

    if (q === "hoy") {
      setDesde(fmt(now));
      setHasta(fmt(now));
    } else if (q === "semana") {
      const lunes = new Date(now);
      lunes.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      const domingo = new Date(lunes);
      domingo.setDate(lunes.getDate() + 6);
      setDesde(fmt(lunes));
      setHasta(fmt(domingo));
    } else if (q === "mes") {
      const p = new Date(y, m, 1);
      const u = new Date(y, m + 1, 0);
      setDesde(fmt(p));
      setHasta(fmt(u));
    } else if (q === "mes_ant") {
      const p = new Date(y, m - 1, 1);
      const u = new Date(y, m, 0);
      setDesde(fmt(p));
      setHasta(fmt(u));
    }
  };

  const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0]?.payload as DiaScorecard;
      return (
        <div className="bg-white/95 backdrop-blur-md p-3 rounded-2xl border border-slate-200 shadow-xl text-xs space-y-1 z-50 min-w-[190px]">
          <p className="font-black text-slate-900 border-b border-slate-100 pb-1 flex items-center justify-between">
            <span>{item.fecha} ({item.dia_nombre})</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${item.cumple_efectividad ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-[#FF5500]'}`}>
              {item.cumple_efectividad ? 'En Meta' : 'Bajo Meta'}
            </span>
          </p>
          <div className="pt-1 space-y-0.5">
            <p className="flex justify-between font-bold text-slate-800">
              <span>% Efectividad:</span>
              <span className={`font-black ${item.cumple_efectividad ? 'text-emerald-600' : 'text-[#FF5500]'}`}>
                {item.pct_efectividad}%
              </span>
            </p>
            <p className="flex justify-between text-slate-600">
              <span>Terminadas:</span>
              <span className="font-bold text-slate-800">{item.terminadas}</span>
            </p>
            <p className="flex justify-between text-slate-600">
              <span>Canceladas:</span>
              <span className="font-bold text-slate-800">{item.canceladas}</span>
            </p>
            <p className="flex justify-between text-slate-600">
              <span>Regestión:</span>
              <span className="font-bold text-slate-800">{item.regestion}</span>
            </p>
            <p className="flex justify-between text-slate-600 border-t border-slate-100 pt-0.5">
              <span>Total Evaluados:</span>
              <span className="font-black text-slate-900">{item.evaluados}</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      
      {/* ─────────────────────────────────────────────────────────────
          1. HEADER CON CONTROLES DE FECHA Y FILTROS RÁPIDOS
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Título y Badge WIN */}
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#FF5500]/10 text-[#FF5500] border border-[#FF5500]/20 flex items-center justify-center shrink-0 shadow-2xs">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  Scorecard Oficial WIN: Efectividad & VTR
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-black uppercase tracking-wider bg-[#FF5500] text-white shadow-2xs">
                  Criterio WIN
                </span>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Tiempo Real
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Evaluación operativa 100% fiel al modelo WIN: Meta de Efectividad <strong className="text-emerald-700 font-black">≥ 80.0%</strong> y Meta de Reiteradas VTR <strong className="text-emerald-700 font-black">≤ 5.0%</strong>.
              </p>
            </div>
          </div>

          {/* Selectores de Período y Botón de Refresco */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => handleSelectQuick("hoy")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  periodoQuick === "hoy"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={() => handleSelectQuick("semana")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  periodoQuick === "semana"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Semana
              </button>
              <button
                type="button"
                onClick={() => handleSelectQuick("mes")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  periodoQuick === "mes"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Este Mes
              </button>
              <button
                type="button"
                onClick={() => handleSelectQuick("mes_ant")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  periodoQuick === "mes_ant"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Mes Anterior
              </button>
            </div>

            {/* Inputs de fecha específicos */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-2xl text-xs font-medium text-slate-700">
              <Calendar size={13} className="text-slate-400 shrink-0" />
              <input
                type="date"
                value={desde}
                onChange={(e) => {
                  setDesde(e.target.value);
                  setPeriodoQuick("mes");
                }}
                className="bg-transparent border-none text-xs font-bold text-slate-800 focus:outline-hidden cursor-pointer"
              />
              <span className="text-slate-400">al</span>
              <input
                type="date"
                value={hasta}
                onChange={(e) => {
                  setHasta(e.target.value);
                  setPeriodoQuick("mes");
                }}
                className="bg-transparent border-none text-xs font-bold text-slate-800 focus:outline-hidden cursor-pointer"
              />
            </div>

            <button
              type="button"
              onClick={cargarScorecard}
              disabled={refreshing}
              className="w-9 h-9 rounded-2xl bg-slate-100 hover:bg-slate-200/80 text-slate-600 border border-slate-200/80 flex items-center justify-center transition-colors cursor-pointer"
              title="Actualizar datos"
            >
              <RefreshCw size={15} className={refreshing ? "animate-spin text-[#FF5500]" : ""} />
            </button>
          </div>

        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. LAS 2 TARJETAS PRINCIPALES: % EFECTIVIDAD Y % VTR
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* TARJETA 1: % EFECTIVIDAD OPERATIVA */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Efectividad Operativa WIN
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10.5px] font-black uppercase tracking-wider ${
                    kpis?.cumple_efectividad
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      : "bg-orange-100 text-[#FF5500] border border-orange-200"
                  }`}
                >
                  {kpis?.cumple_efectividad ? "Meta Cumplida (≥80%)" : "Por Mejorar (<80%)"}
                </span>
              </div>
              <h3 className="text-xs text-slate-400 font-medium">
                Fórmula WIN: Terminadas / (Terminadas + Canceladas + Regestión)
              </h3>
            </div>
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
              <Target className="w-5 h-5" />
            </div>
          </div>

          {/* Gran Valor Porcentual y Comparativa */}
          <div className="flex items-baseline justify-between pt-1">
            <div className="flex items-baseline gap-2">
              <span
                className={`text-4xl sm:text-5xl font-black tracking-tight ${
                  kpis?.cumple_efectividad ? "text-emerald-600" : "text-[#FF5500]"
                }`}
              >
                {kpis ? `${kpis.pct_efectividad}%` : "0.0%"}
              </span>
              <span className="text-xs text-slate-400 font-bold">
                de efectividad
              </span>
            </div>

            <div className="text-right">
              <span className="text-xs text-slate-400 font-medium block">Meta Exigida WIN</span>
              <span className="text-base font-black text-slate-800">80.0%</span>
            </div>
          </div>

          {/* Barra de Progreso con Marcador de Meta a 80% */}
          <div className="space-y-1.5 pt-1">
            <div className="relative w-full h-3.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-700 rounded-full ${
                  kpis?.cumple_efectividad ? "bg-emerald-500" : "bg-[#FF5500]"
                }`}
                style={{ width: `${Math.min(100, kpis?.pct_efectividad || 0)}%` }}
              />
              {/* Línea indicadora del 80% */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-slate-900 z-10"
                style={{ left: "80%" }}
                title="Línea de Meta (80%)"
              />
            </div>
            <div className="flex items-center justify-between text-[10.5px] text-slate-400 font-bold">
              <span>0%</span>
              <span className="text-slate-900 font-black">Meta 80%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Desglose de Contadores Clicables */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => handleOpenModal("terminadas", "Órdenes Terminadas (Finalizadas / Liquidadas)")}
              className="p-2.5 rounded-2xl bg-emerald-50/70 hover:bg-emerald-100/70 border border-emerald-200/80 text-left transition-colors cursor-pointer group"
            >
              <span className="text-[10px] font-bold text-emerald-800 uppercase block">Terminadas</span>
              <span className="text-lg font-black text-emerald-700 block group-hover:scale-105 transition-transform">
                {kpis?.terminadas || 0}
              </span>
              <span className="text-[9.5px] text-emerald-600 font-semibold flex items-center gap-0.5">
                Ver detalle <ChevronRight size={10} />
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenModal("canceladas", "Órdenes Canceladas")}
              className="p-2.5 rounded-2xl bg-rose-50/70 hover:bg-rose-100/70 border border-rose-200/80 text-left transition-colors cursor-pointer group"
            >
              <span className="text-[10px] font-bold text-rose-800 uppercase block">Canceladas</span>
              <span className="text-lg font-black text-rose-700 block group-hover:scale-105 transition-transform">
                {kpis?.canceladas || 0}
              </span>
              <span className="text-[9.5px] text-rose-600 font-semibold flex items-center gap-0.5">
                Ver detalle <ChevronRight size={10} />
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenModal("regestion", "Órdenes en Regestión")}
              className="p-2.5 rounded-2xl bg-amber-50/70 hover:bg-amber-100/70 border border-amber-200/80 text-left transition-colors cursor-pointer group"
            >
              <span className="text-[10px] font-bold text-amber-800 uppercase block">Regestión</span>
              <span className="text-lg font-black text-amber-700 block group-hover:scale-105 transition-transform">
                {kpis?.regestion || 0}
              </span>
              <span className="text-[9.5px] text-amber-600 font-semibold flex items-center gap-0.5">
                Ver detalle <ChevronRight size={10} />
              </span>
            </button>

            <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-left">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Base Total</span>
              <span className="text-lg font-black text-slate-900 block">
                {kpis?.total_evaluados || 0}
              </span>
              <span className="text-[9.5px] text-slate-400 font-medium block">
                {kpis?.excluidas || 0} excluidas
              </span>
            </div>
          </div>
        </div>

        {/* TARJETA 2: % VTR REITERADAS */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Índice VTR (Reiteradas)
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10.5px] font-black uppercase tracking-wider ${
                    kpis?.cumple_vtr
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      : "bg-rose-100 text-rose-800 border border-rose-200"
                  }`}
                >
                  {kpis?.cumple_vtr ? "Meta Cumplida (≤5%)" : "Fuera de Meta (>5%)"}
                </span>
              </div>
              <h3 className="text-xs text-slate-400 font-medium">
                Fórmula WIN: Casos Reiterados en el Mes ({kpis?.vtr_casos || 0}) / Base Trabajos ({kpis?.vtr_base || 0})
              </h3>
            </div>
            <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center">
              <RotateCcw className="w-5 h-5" />
            </div>
          </div>

          {/* Gran Valor Porcentual y Comparativa */}
          <div className="flex items-baseline justify-between pt-1">
            <div className="flex items-baseline gap-2">
              <span
                className={`text-4xl sm:text-5xl font-black tracking-tight ${
                  kpis?.cumple_vtr ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {kpis ? `${kpis.pct_vtr}%` : "0.0%"}
              </span>
              <span className="text-xs text-slate-400 font-bold">
                de reiteradas
              </span>
            </div>

            <div className="text-right">
              <span className="text-xs text-slate-400 font-medium block">Meta Máxima WIN</span>
              <span className="text-base font-black text-slate-800">≤ 5.0%</span>
            </div>
          </div>

          {/* Barra de Progreso con Marcador de Meta a 5% */}
          <div className="space-y-1.5 pt-1">
            <div className="relative w-full h-3.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-700 rounded-full ${
                  kpis?.cumple_vtr ? "bg-emerald-500" : "bg-rose-500"
                }`}
                style={{ width: `${Math.min(100, ((kpis?.pct_vtr || 0) / 10) * 100)}%` }}
              />
              {/* Línea indicadora del 5% (en escala hasta 10%) */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-slate-900 z-10"
                style={{ left: "50%" }}
                title="Línea de Meta Máxima (5.0%)"
              />
            </div>
            <div className="flex items-center justify-between text-[10.5px] text-slate-400 font-bold">
              <span>0%</span>
              <span className="text-slate-900 font-black">Meta Máx 5.0%</span>
              <span>10.0%+</span>
            </div>
          </div>

          {/* Desglose de Contadores Clicables */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => handleOpenModal("vtr", "Caso VTR Oficial Penalizado a Octubre")}
              className="p-2.5 rounded-2xl bg-emerald-50/70 hover:bg-emerald-100/70 border border-emerald-200/80 text-left transition-colors cursor-pointer group"
            >
              <span className="text-[10px] font-bold text-emerald-800 uppercase block">VTR Penalizado</span>
              <span className="text-lg font-black text-emerald-700 block group-hover:scale-105 transition-transform">
                {kpis?.vtr_casos || 0}
              </span>
              <span className="text-[9.5px] text-emerald-600 font-semibold flex items-center gap-0.5">
                Ver caso oficial <ChevronRight size={10} />
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenModal("terminadas", "Base de Trabajos Evaluados WIN (Sin PEXT ni Reiteradas)")}
              className="p-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-colors cursor-pointer group"
            >
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Base Trabajos</span>
              <span className="text-lg font-black text-slate-900 block group-hover:scale-105 transition-transform">
                {kpis?.vtr_base || 0}
              </span>
              <span className="text-[9.5px] text-slate-500 font-medium block">
                Sin PEXT ni Reiteradas
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenModal("vtr", "Total Órdenes con Ticket VTR Atendidas")}
              className="p-2.5 rounded-2xl bg-rose-50/70 hover:bg-rose-100/70 border border-rose-200/80 text-left transition-colors cursor-pointer group"
            >
              <span className="text-[10px] font-bold text-rose-800 uppercase block">VTR Atendidas</span>
              <span className="text-lg font-black text-rose-700 block group-hover:scale-105 transition-transform">
                {kpis?.vtr_atendidas || 0}
              </span>
              <span className="text-[9.5px] text-rose-600 font-semibold flex items-center gap-0.5">
                Ver asistencias <ChevronRight size={10} />
              </span>
            </button>
          </div>
        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. GRÁFICO: TENDENCIA DIARIA DE EFECTIVIDAD VS META 80%
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#FF5500] flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">
                Tendencia Diaria de Efectividad Operativa (% vs Meta 80.0%)
              </h3>
              <p className="text-[11px] text-slate-500">
                Línea punteada verde representa la meta mínima corporativa WIN (80.0%)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-bold">
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-3 h-3 rounded-md bg-[#FF5500] inline-block"></span> % Efectividad
            </span>
            <span className="flex items-center gap-1.5 text-emerald-700">
              <span className="w-4 h-0.5 bg-emerald-500 inline-block"></span> Meta WIN (80%)
            </span>
          </div>
        </div>

        <div className="h-64 sm:h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={tendencia} margin={{ top: 15, right: 15, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} />
              <YAxis domain={[0, 100]} stroke="#64748b" fontSize={11} tickLine={false} unit="%" />
              <RechartsTooltip content={<CustomChartTooltip />} />
              <ReferenceLine y={80} stroke="#10b981" strokeDasharray="4 4" strokeWidth={2} label={{ value: "Meta 80%", fill: "#059669", fontSize: 11, position: "right" }} />
              <Bar dataKey="pct_efectividad" name="% Efectividad" fill="#FF5500" radius={[6, 6, 0, 0]} maxBarSize={28} />
              <Line type="monotone" dataKey="pct_efectividad" stroke="#1f2937" strokeWidth={2} dot={{ r: 3, fill: "#1f2937" }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. TABLAS DE ANÁLISIS: TOP CANCELACIONES & RANKING POR TÉCNICO
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* COLUMNA 1: TOP MOTIVOS DE CANCELACIÓN (WIN) */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Top Motivos de Cancelación
              </h3>
            </div>
            <span className="text-[11px] font-bold text-slate-400">
              {kpis?.canceladas || 0} en total
            </span>
          </div>

          <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
            {cancelaciones.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center font-medium">
                No hay cancelaciones registradas en este período.
              </p>
            ) : (
              cancelaciones.map((c, idx) => {
                const totalCanc = kpis?.canceladas || 1;
                const pct = ((c.total / totalCanc) * 100).toFixed(1);
                return (
                  <div key={idx} className="p-2.5 rounded-2xl bg-slate-50/70 border border-slate-100 space-y-1">
                    <div className="flex items-start justify-between gap-2 text-xs">
                      <span className="font-bold text-slate-800 line-clamp-2 leading-tight">
                        {idx + 1}. {c.motivo}
                      </span>
                      <span className="font-black text-rose-700 shrink-0">
                        {c.total} <span className="text-[10px] text-slate-400 font-normal">({pct}%)</span>
                      </span>
                    </div>
                    {/* Barra de proporción */}
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-rose-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* COLUMNA 2 Y 3: RANKING DE EFECTIVIDAD POR TÉCNICO */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Rendimiento y Cumplimiento por Técnico
                </h3>
                <p className="text-[10.5px] text-slate-400">
                  Técnicos con al menos 3 órdenes asignadas en el período
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-slate-500">
              {tecnicos.length} Técnicos evaluados
            </span>
          </div>

          <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 sticky top-0 text-[11px] text-slate-500 font-black uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-2 px-3">#</th>
                  <th className="py-2 px-3">Técnico</th>
                  <th className="py-2 px-3 text-center">Asignadas</th>
                  <th className="py-2 px-3 text-center">Terminadas</th>
                  <th className="py-2 px-3 text-center">Canceladas</th>
                  <th className="py-2 px-3 text-center">% Efectividad</th>
                  <th className="py-2 px-3 text-center">Casos VTR</th>
                  <th className="py-2 px-3 text-center">% VTR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tecnicos.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No hay técnicos con órdenes en este período.
                    </td>
                  </tr>
                ) : (
                  tecnicos.map((t, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2 px-3 font-mono font-bold text-slate-400">{idx + 1}</td>
                      <td className="py-2 px-3 font-bold text-slate-900 truncate max-w-[180px]">
                        {t.tecnico}
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-slate-700">{t.total}</td>
                      <td className="py-2 px-3 text-center font-black text-emerald-700">{t.terminadas}</td>
                      <td className="py-2 px-3 text-center font-bold text-rose-600">{t.canceladas}</td>
                      <td className="py-2 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10.5px] font-black inline-block ${
                            t.cumple_efectividad
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                              : "bg-orange-100 text-[#FF5500] border border-orange-200"
                          }`}
                        >
                          {t.pct_efectividad}%
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-slate-700">
                        {t.vtr_casos > 0 ? (
                          <span className="text-rose-600 font-black">{t.vtr_casos}</span>
                        ) : (
                          "0"
                        )}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10.5px] font-black inline-block ${
                            t.pct_vtr <= 5.0
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-rose-100 text-rose-800 border border-rose-300"
                          }`}
                        >
                          {t.pct_vtr}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          5. MODAL DRILL-DOWN DE ÓRDENES
      ───────────────────────────────────────────────────────────── */}
      <WinScorecardOrdersModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        desde={desde}
        hasta={hasta}
        initialTipo={modalTipo}
        title={modalTitle}
      />

    </div>
  );
};
