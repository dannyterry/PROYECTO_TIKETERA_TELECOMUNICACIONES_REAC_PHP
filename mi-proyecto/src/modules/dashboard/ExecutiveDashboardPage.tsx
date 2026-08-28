import React, { useState, useEffect, useCallback, useMemo } from "react";
import { API_URL } from "../../config/api";
import {
  Activity,
  Users,
  CheckCircle2,
  Clock,
  ShieldCheck,
  TrendingUp,
  Package,
  PhoneCall,
  UserCheck,
  RefreshCw,
  Search,
  Calendar,
  AlertTriangle,
  Radio,
  FileSpreadsheet,
  Truck,
  Layers,
  ArrowUpRight,
  Filter,
  BarChart3,
  PieChart as PieIcon,
  Warehouse,
  Flame,
  MapPin,
  ChevronDown,
  Target,
  XCircle,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";

interface OnlineUser {
  id_usuario: number;
  documento: string;
  nombre_completo: string;
  email: string;
  id_rol: number;
  rol_nombre: string;
  area: string;
  distrito: string | null;
  distrito_conexion?: string | null;
  lat_conexion?: number | null;
  lng_conexion?: number | null;
  ip_conexion?: string | null;
  direccion: string | null;
  ultimo_acceso: string | null;
  ultima_accion: string | null;
  esta_online: number;
}

interface GestorMetric {
  id_usuario: number;
  usuario_nombre: string;
  rol_nombre: string;
  area: string;
  total_acciones: number;
  llamadas_gestionadas: number;
  ordenes_asignadas: number;
  cambios_estado: number;
  ultima_actividad: string | null;
}

interface AuditLog {
  id_log: number;
  id_usuario: number;
  usuario_nombre: string;
  rol_nombre: string;
  area: string;
  modulo: string;
  accion: string;
  id_referencia: string;
  descripcion: string;
  fecha_creacion: string;
}

interface DashboardStats {
  kpis: {
    total_ordenes: number;
    ordenes_finalizadas: number;
    ordenes_canceladas_observadas?: number;
    ordenes_en_proceso?: number;
    total_liquidaciones: number;
    total_productos: number;
    total_tecnicos: number;
    compras_mes: number;
    personal_online: number;
  };
  ordenes_por_estado: Array<{ estado: string; total: number }>;
  ordenes_por_mes: Array<{ mes: number; total: number; finalizadas: number }>;
  stock_almacen: Array<{
    almacen_nombre: string;
    producto_nombre: string;
    categoria: string;
    stock: number;
    stock_minimo: number;
    estado_stock: string;
  }>;
}

// Colores oficiales para los estados de órdenes
const COLOR_ESTADOS: Record<string, string> = {
  Finalizada: "#10b981", // Esmeralda
  Iniciada: "#3b82f6", // Azul
  "En proceso": "#3b82f6",
  "En camino": "#f59e0b", // Ámbar
  Agendada: "#64748b", // Slate
  Cancelada: "#ef4444", // Rojo
  Regestión: "#f97316", // Naranja
  Anulada: "#475569",
  Observada: "#dc2626",
};

const NOMBRES_MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const NOMBRES_MESES_CORTO = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// Tooltip oscuro personalizado para Recharts
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-950/95 backdrop-blur-md p-3 rounded-2xl border border-slate-700 shadow-2xl text-xs space-y-1 z-50">
        <p className="font-black text-white">{label || payload[0]?.name}</p>
        {payload.map((p: any, idx: number) => (
          <p key={idx} className="font-bold flex items-center gap-2" style={{ color: p.color || p.fill }}>
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: p.color || p.fill }}></span>
            <span>{p.name}:</span>
            <span className="font-black text-white">{p.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export const ExecutiveDashboardPage: React.FC = () => {
  // 1. Selector inteligente de período (Días, Semanas, Meses, Año)
  const [periodMode, setPeriodMode] = useState<"dia" | "semana" | "mes" | "anio">("mes");
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Estados de datos
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [usuariosOnline, setUsuariosOnline] = useState<OnlineUser[]>([]);
  const [metricasGestores, setMetricasGestores] = useState<GestorMetric[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [filtroModuloAudit, setFiltroModuloAudit] = useState<string>("Todos");
  const [busquedaAudit, setBusquedaAudit] = useState<string>("");

  // Generadores de opciones de período
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
    const listActual: Array<{ id: string; label: string; desde: string; hasta: string; anio: number }> = [];
    const listAnterior: Array<{ id: string; label: string; desde: string; hasta: string; anio: number }> = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthIdx = now.getMonth(); // 7 para Agosto

    // 1. Meses del año actual transcurridos (de mes actual hacia Enero, nunca futuros)
    for (let m = currentMonthIdx; m >= 0; m--) {
      const mm = String(m + 1).padStart(2, "0");
      const ultimoDia = new Date(currentYear, m + 1, 0).getDate();
      listActual.push({
        id: `mes-${currentYear}-${mm}`,
        label: `${NOMBRES_MESES[m]} ${currentYear}`,
        desde: `${currentYear}-${mm}-01`,
        hasta: `${currentYear}-${mm}-${String(ultimoDia).padStart(2, "0")}`,
        anio: currentYear,
      });
    }

    // 2. Meses del año anterior (Diciembre a Enero)
    const prevYear = currentYear - 1;
    for (let m = 11; m >= 0; m--) {
      const mm = String(m + 1).padStart(2, "0");
      const ultimoDia = new Date(prevYear, m + 1, 0).getDate();
      listAnterior.push({
        id: `mes-${prevYear}-${mm}`,
        label: `${NOMBRES_MESES[m]} ${prevYear}`,
        desde: `${prevYear}-${mm}-01`,
        hasta: `${prevYear}-${mm}-${String(ultimoDia).padStart(2, "0")}`,
        anio: prevYear,
      });
    }

    return { listActual, listAnterior, todos: [...listActual, ...listAnterior] };
  }, []);

  const opcionesAnios = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return [
      { id: `anio-${currentYear}`, label: `Año ${currentYear} (En curso)`, desde: `${currentYear}-01-01`, hasta: `${currentYear}-12-31`, anio: currentYear },
      { id: `anio-${currentYear - 1}`, label: `Año ${currentYear - 1} (Histórico)`, desde: `${currentYear - 1}-01-01`, hasta: `${currentYear - 1}-12-31`, anio: currentYear - 1 },
    ];
  }, []);

  // Seleccionar automáticamente la primera opción al cambiar el modo
  useEffect(() => {
    if (periodMode === "dia" && opcionesDias.length > 0) {
      setSelectedOption(opcionesDias[0].id);
    } else if (periodMode === "semana" && opcionesSemanas.length > 0) {
      setSelectedOption(opcionesSemanas[0].id);
    } else if (periodMode === "mes" && opcionesMeses.todos.length > 0) {
      setSelectedOption(opcionesMeses.todos[0].id);
    } else if (periodMode === "anio" && opcionesAnios.length > 0) {
      setSelectedOption(opcionesAnios[0].id);
    }
  }, [periodMode, opcionesDias, opcionesSemanas, opcionesMeses, opcionesAnios]);

  // Carga de datos unificada según el período
  const cargarDashboard = useCallback(async (isSilent = false) => {
    if (!selectedOption) return;

    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      let targetPeriod: { desde: string; hasta: string; anio?: number } | undefined;
      if (periodMode === "dia") targetPeriod = opcionesDias.find((o) => o.id === selectedOption);
      else if (periodMode === "semana") targetPeriod = opcionesSemanas.find((o) => o.id === selectedOption);
      else if (periodMode === "mes") targetPeriod = opcionesMeses.todos.find((o) => o.id === selectedOption);
      else targetPeriod = opcionesAnios.find((o) => o.id === selectedOption);

      const hoy = new Date().toISOString().split("T")[0];
      const desdeParam = targetPeriod?.desde ? `&desde=${targetPeriod.desde}` : "";
      const hastaParam = targetPeriod?.hasta ? `&hasta=${targetPeriod.hasta}` : "";
      const anioParam = targetPeriod?.anio ? `&anio=${targetPeriod.anio}` : "";

      // 1. Estadísticas Generales
      const resStats = await fetch(`${API_URL}/dashboard/estadisticas?${desdeParam}${hastaParam}${anioParam}`).then((r) => r.json());
      if (resStats.success) setStats(resStats);

      // 2. Personal Online
      const resOnline = await fetch(`${API_URL}/auditoria/usuarios-online`).then((r) => r.json());
      if (Array.isArray(resOnline)) setUsuariosOnline(resOnline);

      // 3. Métricas de Gestores
      const resMetricas = await fetch(`${API_URL}/auditoria/metricas-gestores?fecha=${targetPeriod?.desde || hoy}`).then((r) => r.json());
      if (Array.isArray(resMetricas)) setMetricasGestores(resMetricas);

      // 4. Logs de Auditoría
      const resLogs = await fetch(`${API_URL}/auditoria/logs?limite=50&modulo=${filtroModuloAudit}`).then((r) => r.json());
      if (Array.isArray(resLogs)) setAuditLogs(resLogs);
    } catch (err) {
      console.error("Error al cargar dashboard ejecutivo:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [periodMode, selectedOption, filtroModuloAudit, opcionesDias, opcionesSemanas, opcionesMeses, opcionesAnios]);

  // Carga inicial y por cambio de filtros
  useEffect(() => {
    cargarDashboard(false);
  }, [cargarDashboard]);

  // Polling automático cada 20 segundos para el monitor de usuarios online y auditoría
  useEffect(() => {
    const interval = setInterval(() => {
      cargarDashboard(true);
    }, 20000);
    return () => clearInterval(interval);
  }, [cargarDashboard]);

  // Filtrado local de logs
  const logsFiltrados = auditLogs.filter((l) => {
    if (!busquedaAudit.trim()) return true;
    const q = busquedaAudit.toLowerCase();
    return (
      (l.usuario_nombre || "").toLowerCase().includes(q) ||
      (l.descripcion || "").toLowerCase().includes(q) ||
      (l.accion || "").toLowerCase().includes(q) ||
      (l.modulo || "").toLowerCase().includes(q)
    );
  });

  const totalGestoresOnline = usuariosOnline.filter((u) => u.esta_online === 1).length;

  // Cálculos de KPIs de Liquidación & Efectividad
  const totalOrdenes = stats?.kpis?.total_ordenes || 0;
  const finalizadas = stats?.kpis?.ordenes_finalizadas || 0;
  const canceladasObs = stats?.kpis?.ordenes_canceladas_observadas || 0;
  const totalEvaluadas = finalizadas + canceladasObs;
  const porcentajeEfectividad = totalEvaluadas > 0 ? ((finalizadas / totalEvaluadas) * 100).toFixed(1) : "0.0";
  const porcentajeCanceladas = totalEvaluadas > 0 ? ((canceladasObs / totalEvaluadas) * 100).toFixed(1) : "0.0";

  // 1. Gráfico Donut de Efectividad Operativa (EXCLUSIVO: Finalizadas vs Canceladas/Observadas/Anuladas)
  const dataEfectividadPie = [
    { name: "Finalizadas (Liquidadas)", value: finalizadas, color: "#10b981" },
    { name: "Canceladas / Observadas / Anuladas", value: canceladasObs, color: "#ef4444" },
  ].filter((d) => d.value > 0);

  // 2. Gráfico Donut de Todos los Estados
  const dataEstadosPie = (stats?.ordenes_por_estado || []).map((e) => ({
    name: e.estado,
    value: Number(e.total),
    color: COLOR_ESTADOS[e.estado] || "#94a3b8",
  }));

  // 3. Gráfico de Barras de Producción Anual
  const dataMesesBar = Array.from({ length: 12 }, (_, i) => {
    const found = (stats?.ordenes_por_mes || []).find((m) => Number(m.mes) === i + 1);
    return {
      name: NOMBRES_MESES_CORTO[i],
      Total: found ? Number(found.total) : 0,
      Finalizadas: found ? Number(found.finalizadas) : 0,
    };
  });

  return (
    <div className="w-full min-h-screen bg-slate-900 text-slate-100 p-4 md:p-6 lg:p-8 space-y-6">
      
      {/* ─────────────────────────────────────────────────────────────
          1. HEADER EJECUTIVO & SELECTOR INTELIGENTE DE PERÍODO
      ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-slate-800/80 backdrop-blur-md p-5 rounded-3xl border border-slate-700/60 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Activity className="text-white w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
                Panel Ejecutivo & Torre de Control
              </h1>
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                24/7 EN VIVO
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Monitoreo y auditoría de personal, efectividad de órdenes y nivel de stock central.
            </p>
          </div>
        </div>

        {/* 📅 SELECTOR DE PERÍODO INTEGRADO (DÍAS | SEMANAS | MESES | AÑOS) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          
          {/* Pestañas de Modo */}
          <div className="bg-slate-900/90 p-1 rounded-2xl border border-slate-700/60 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPeriodMode("dia")}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                periodMode === "dia" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30" : "text-slate-400 hover:text-white"
              }`}
            >
              📅 Por Días
            </button>
            <button
              type="button"
              onClick={() => setPeriodMode("semana")}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                periodMode === "semana" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30" : "text-slate-400 hover:text-white"
              }`}
            >
              🗓️ Por Semanas
            </button>
            <button
              type="button"
              onClick={() => setPeriodMode("mes")}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                periodMode === "mes" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30" : "text-slate-400 hover:text-white"
              }`}
            >
              📊 Por Meses
            </button>
            <button
              type="button"
              onClick={() => setPeriodMode("anio")}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                periodMode === "anio" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30" : "text-slate-400 hover:text-white"
              }`}
            >
              📈 Anual
            </button>
          </div>

          {/* Dropdown de Rango Exacto */}
          <div className="flex items-center gap-2">
            <div className="relative min-w-[200px]">
              <select
                value={selectedOption}
                onChange={(e) => setSelectedOption(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/80 font-bold text-slate-100 text-xs rounded-2xl px-3.5 py-2 appearance-none focus:outline-none focus:border-indigo-500 shadow-sm pr-9 cursor-pointer"
              >
                {periodMode === "dia" &&
                  opcionesDias.map((op) => (
                    <option key={op.id} value={op.id} className="bg-slate-900 text-white">
                      {op.label}
                    </option>
                  ))}

                {periodMode === "semana" &&
                  opcionesSemanas.map((op) => (
                    <option key={op.id} value={op.id} className="bg-slate-900 text-white">
                      {op.label}
                    </option>
                  ))}

                {periodMode === "mes" && (
                  <>
                    <optgroup label={`📅 Año ${new Date().getFullYear()} (Meses Transcurridos)`} className="bg-slate-950 text-indigo-400 font-black">
                      {opcionesMeses.listActual.map((op) => (
                        <option key={op.id} value={op.id} className="bg-slate-900 text-white font-semibold">
                          {op.label}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label={`📂 Año ${new Date().getFullYear() - 1} (Histórico)`} className="bg-slate-950 text-slate-400 font-black">
                      {opcionesMeses.listAnterior.map((op) => (
                        <option key={op.id} value={op.id} className="bg-slate-900 text-slate-300 font-semibold">
                          {op.label}
                        </option>
                      ))}
                    </optgroup>
                  </>
                )}

                {periodMode === "anio" &&
                  opcionesAnios.map((op) => (
                    <option key={op.id} value={op.id} className="bg-slate-900 text-white">
                      {op.label}
                    </option>
                  ))}
              </select>
              <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            <button
              onClick={() => cargarDashboard(true)}
              disabled={refreshing}
              className="p-2 bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-700 rounded-2xl text-xs font-bold text-slate-200 transition-all cursor-pointer shadow-sm disabled:opacity-50"
              title="Refrescar datos del período"
            >
              <RefreshCw size={15} className={refreshing ? "animate-spin text-indigo-400" : "text-slate-400"} />
            </button>
          </div>

        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. TARJETAS DE KPIS PRINCIPALES (GRADIENTES MODERNOS)
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        
        {/* Total Órdenes */}
        <div className="bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-indigo-500/20 p-4 rounded-3xl shadow-lg relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300">Órdenes Totales</span>
            <Layers className="text-indigo-400 w-4 h-4" />
          </div>
          <div className="text-2xl lg:text-3xl font-black text-white mt-2">
            {totalOrdenes}
          </div>
          <span className="text-[10px] text-indigo-300/70 block mt-1 capitalize">En el período seleccionado</span>
        </div>

        {/* Órdenes Finalizadas */}
        <div className="bg-gradient-to-br from-emerald-950/40 to-slate-900 border border-emerald-500/20 p-4 rounded-3xl shadow-lg relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">Finalizadas</span>
            <CheckCircle2 className="text-emerald-400 w-4 h-4" />
          </div>
          <div className="text-2xl lg:text-3xl font-black text-emerald-400 mt-2">
            {finalizadas}
          </div>
          <span className="text-[10px] text-emerald-300/70 block mt-1 font-bold">
            {porcentajeEfectividad}% efectividad
          </span>
        </div>

        {/* Observadas / Canceladas */}
        <div className="bg-gradient-to-br from-rose-950/40 to-slate-900 border border-rose-500/20 p-4 rounded-3xl shadow-lg relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-300">Observadas / Canc.</span>
            <XCircle className="text-rose-400 w-4 h-4" />
          </div>
          <div className="text-2xl lg:text-3xl font-black text-rose-400 mt-2">
            {canceladasObs}
          </div>
          <span className="text-[10px] text-rose-300/70 block mt-1 font-bold">
            {porcentajeCanceladas}% no liquidadas
          </span>
        </div>

        {/* Personal Online */}
        <div className="bg-gradient-to-br from-teal-950/40 to-slate-900 border border-teal-500/20 p-4 rounded-3xl shadow-lg relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-teal-300">Personal Online</span>
            <Radio className="text-teal-400 w-4 h-4 animate-pulse" />
          </div>
          <div className="text-2xl lg:text-3xl font-black text-teal-300 mt-2 flex items-baseline gap-1.5">
            <span>{totalGestoresOnline}</span>
            <span className="text-xs text-slate-400 font-normal">/ {usuariosOnline.length}</span>
          </div>
          <span className="text-[10px] text-teal-300/70 block mt-1">Gestión, Almacén y RRHH</span>
        </div>

        {/* Compras del Mes */}
        <div className="bg-gradient-to-br from-amber-950/40 to-slate-900 border border-amber-500/20 p-4 rounded-3xl shadow-lg relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">Compras Mes</span>
            <TrendingUp className="text-amber-400 w-4 h-4" />
          </div>
          <div className="text-xl lg:text-2xl font-black text-amber-400 mt-2 truncate">
            S/ {Number(stats?.kpis?.compras_mes || 0).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-amber-300/70 block mt-1">Inversión en suministros</span>
        </div>

        {/* Flota Técnicos */}
        <div className="bg-gradient-to-br from-purple-950/40 to-slate-900 border border-purple-500/20 p-4 rounded-3xl shadow-lg relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-300">Técnicos Flota</span>
            <Truck className="text-purple-400 w-4 h-4" />
          </div>
          <div className="text-2xl lg:text-3xl font-black text-white mt-2">
            {stats?.kpis?.total_tecnicos ?? 0}
          </div>
          <span className="text-[10px] text-purple-300/70 block mt-1">Cuadrillas operativas</span>
        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. SECCIÓN DE ANÁLISIS VISUAL DE ÓRDENES (DOBLE DONUT + BARRAS)
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* 🎯 GRÁFICO 1: EFECTIVIDAD DIARIA / RATIO FINALIZADAS VS OBSERVADAS */}
        <div className="lg:col-span-6 bg-slate-800/80 backdrop-blur-md rounded-3xl border border-slate-700/60 p-5 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-700/60 mb-2">
            <div className="flex items-center gap-2">
              <Target className="text-emerald-400 w-5 h-5" />
              <div>
                <h2 className="text-sm font-black text-white">Efectividad: Finalizadas vs Observadas / Canceladas</h2>
                <p className="text-[11px] text-slate-400">Ratio de liquidación y cierre operativo de jornada</p>
              </div>
            </div>
            <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-xl">
              {porcentajeEfectividad}% Éxito
            </span>
          </div>

          <div className="h-64 w-full relative flex items-center justify-center">
            {totalEvaluadas === 0 ? (
              <div className="text-xs text-slate-500">Sin órdenes cerradas en este período</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dataEfectividadPie}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={5}
                    stroke="none"
                  >
                    {dataEfectividadPie.map((entry, index) => (
                      <Cell key={`cell-ef-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            )}
            
            {/* Texto central del Donut */}
            {totalEvaluadas > 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-black text-white tracking-tight">{porcentajeEfectividad}%</span>
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mt-0.5">Efectividad</span>
              </div>
            )}
          </div>

          {/* Leyenda y Comparativa de Liquidación */}
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-700/40">
            <div className="bg-emerald-950/30 border border-emerald-500/20 p-3 rounded-2xl text-center">
              <span className="text-[11px] text-emerald-300 font-bold block">Finalizadas (Liquidadas)</span>
              <span className="text-xl font-black text-emerald-400">{finalizadas}</span>
              <span className="text-[10px] text-emerald-300/80 font-bold block">{porcentajeEfectividad}% de efectividad</span>
            </div>

            <div className="bg-rose-950/30 border border-rose-500/20 p-3 rounded-2xl text-center">
              <span className="text-[11px] text-rose-300 font-bold block">Canceladas / Obs. / Anuladas</span>
              <span className="text-xl font-black text-rose-400">{canceladasObs}</span>
              <span className="text-[10px] text-rose-300/80 font-bold block">{porcentajeCanceladas}% no liquidadas</span>
            </div>
          </div>
        </div>

        {/* 🍩 GRÁFICO 2: DISTRIBUCIÓN DETALLADA POR TODOS LOS ESTADOS */}
        <div className="lg:col-span-6 bg-slate-800/80 backdrop-blur-md rounded-3xl border border-slate-700/60 p-5 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-700/60 mb-2">
            <div className="flex items-center gap-2">
              <PieIcon className="text-indigo-400 w-5 h-5" />
              <div>
                <h2 className="text-sm font-black text-white">Distribución de Órdenes por Estado</h2>
                <p className="text-[11px] text-slate-400">Desglose de estados operativos en el período</p>
              </div>
            </div>
            <span className="text-[10px] font-bold text-slate-300 bg-slate-900 border border-slate-700 px-2.5 py-1 rounded-xl">
              {totalOrdenes} Total
            </span>
          </div>

          <div className="h-64 w-full relative flex items-center justify-center">
            {dataEstadosPie.length === 0 ? (
              <div className="text-xs text-slate-500">Sin datos en este período</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dataEstadosPie}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={4}
                    stroke="none"
                  >
                    {dataEstadosPie.map((entry, index) => (
                      <Cell key={`cell-st-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            )}
            
            {/* Texto central del Donut */}
            {dataEstadosPie.length > 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-black text-white">{totalOrdenes}</span>
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">ÓRDENES</span>
              </div>
            )}
          </div>

          {/* Leyenda interactiva */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-3 border-t border-slate-700/40">
            {dataEstadosPie.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1.5 bg-slate-900/70 border border-slate-700/40 px-2.5 py-1 rounded-xl text-[11px]">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                <span className="text-slate-300 font-semibold">{item.name}:</span>
                <span className="font-black text-white">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. GRÁFICO DE BARRAS: EVOLUCIÓN ANUAL MES A MES
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-slate-800/80 backdrop-blur-md rounded-3xl border border-slate-700/60 p-5 shadow-xl">
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-700/60 mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="text-indigo-400 w-5 h-5" />
            <div>
              <h2 className="text-sm font-black text-white">Evolución de Producción Anual (Total vs Finalizadas)</h2>
              <p className="text-[11px] text-slate-400">Comparativa histórica mensual del rendimiento operativo</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-bold">
            <span className="flex items-center gap-1.5 text-indigo-400">
              <span className="w-3 h-3 rounded-md bg-indigo-500 inline-block"></span> Total
            </span>
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-3 h-3 rounded-md bg-emerald-400 inline-block"></span> Finalizadas
            </span>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dataMesesBar} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
              <RechartsTooltip content={<CustomTooltip />} />
              <Bar dataKey="Total" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={30} />
              <Bar dataKey="Finalizadas" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          5. MONITOR EN VIVO & PRODUCTIVIDAD DE GESTORES
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* 🟢 PANEL 1: MONITOR DE PERSONAL Y GESTORES ONLINE */}
        <div className="lg:col-span-5 bg-slate-800/80 backdrop-blur-md rounded-3xl border border-slate-700/60 p-5 shadow-xl flex flex-col">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-700/60 mb-3">
            <div className="flex items-center gap-2">
              <Users className="text-emerald-400 w-5 h-5" />
              <h2 className="text-sm font-black text-white">Personal y Gestores en Línea</h2>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold">
              🟢 {totalGestoresOnline} Activos
            </span>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[340px] space-y-2.5 pr-1">
            {usuariosOnline.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">No hay usuarios registrados</div>
            ) : (
              usuariosOnline.map((u) => {
                const isOnline = u.esta_online === 1;
                return (
                  <div
                    key={u.id_usuario}
                    className="flex items-center justify-between p-3 rounded-2xl bg-slate-900/60 hover:bg-slate-900 border border-slate-700/40 transition-all gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative">
                        <div className="w-9 h-9 rounded-xl bg-slate-700 flex items-center justify-center font-black text-xs text-white uppercase border border-slate-600">
                          {u.nombre_completo.substring(0, 2)}
                        </div>
                        <span
                          className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-slate-900 ${
                            isOnline ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
                          }`}
                        ></span>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="text-xs font-bold text-white truncate max-w-[150px]">
                            {u.nombre_completo}
                          </h3>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            {u.rol_nombre || u.area || "Personal"}
                          </span>
                          {(u.distrito_conexion || u.distrito) && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-0.5 font-mono" title={`Ubicación detectada: ${u.distrito_conexion || u.distrito}`}>
                              <MapPin size={9} className="text-emerald-400" />
                              {u.distrito_conexion || u.distrito}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate max-w-[220px] mt-0.5" title={u.ultima_accion || ""}>
                          {u.ultima_accion || (isOnline ? "En espera de acción..." : "Sin actividad reciente")}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-lg inline-block ${
                          isOnline
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : "bg-slate-800 text-slate-400 border border-slate-700"
                        }`}
                      >
                        {isOnline ? "🟢 Online" : "⚪ Offline"}
                      </span>
                      {u.ultimo_acceso && (
                        <span className="block text-[10px] text-slate-500 font-mono mt-1">
                          {u.ultimo_acceso.split(" ")[1]?.substring(0, 5) || u.ultimo_acceso.substring(11, 16)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 📊 PANEL 2: PRODUCTIVIDAD DIARIA DE GESTORES */}
        <div className="lg:col-span-7 bg-slate-800/80 backdrop-blur-md rounded-3xl border border-slate-700/60 p-5 shadow-xl flex flex-col">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-700/60 mb-3">
            <div className="flex items-center gap-2">
              <PhoneCall className="text-indigo-400 w-5 h-5" />
              <h2 className="text-sm font-black text-white">Productividad Diaria por Gestor (Hoy)</h2>
            </div>
            <span className="text-xs text-slate-400 font-bold">
              Llamadas, Asignaciones y Cambios
            </span>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[340px] space-y-2.5 pr-1">
            {metricasGestores.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                Aún no hay acciones registradas el día de hoy por los gestores.
              </div>
            ) : (
              metricasGestores.map((g, idx) => (
                <div
                  key={g.id_usuario}
                  className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-700/40 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-black text-slate-300">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-white truncate max-w-[170px]">{g.usuario_nombre}</h4>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                          {g.rol_nombre}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        Última acción: {g.ultima_actividad ? new Date(g.ultima_actividad).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Sin registro"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-bold">
                    <span className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-xl" title="Llamadas registradas">
                      📞 {g.llamadas_gestionadas} <span className="hidden sm:inline font-normal text-[10px]">llamadas</span>
                    </span>
                    <span className="flex items-center gap-1 text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded-xl" title="Órdenes asignadas a técnicos">
                      👤 {g.ordenes_asignadas} <span className="hidden sm:inline font-normal text-[10px]">asignadas</span>
                    </span>
                    <span className="flex items-center gap-1 text-white bg-slate-800 px-2.5 py-1 rounded-xl font-black">
                      {g.total_acciones} <span className="hidden sm:inline font-normal text-[10px] text-slate-400">total</span>
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          6. FEED EN VIVO DE LOGS DE AUDITORÍA Y TRAZABILIDAD
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-slate-800/80 backdrop-blur-md rounded-3xl border border-slate-700/60 p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-700/60">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="text-emerald-400 w-5 h-5" />
            <div>
              <h2 className="text-sm font-black text-white">Línea de Tiempo de Auditoría y Trazabilidad (24/7)</h2>
              <p className="text-[11px] text-slate-400">Registro inmutable de acciones realizadas por el personal</p>
            </div>
          </div>

          {/* Filtros de Auditoría */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar en logs..."
                value={busquedaAudit}
                onChange={(e) => setBusquedaAudit(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-48"
              />
            </div>

            <select
              value={filtroModuloAudit}
              onChange={(e) => setFiltroModuloAudit(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-300 font-bold focus:outline-none focus:border-indigo-500"
            >
              <option value="Todos">Todos los Módulos</option>
              <option value="ORDENES">Órdenes de Trabajo</option>
              <option value="GESTION">Gestión</option>
              <option value="ALMACEN">Almacén & Stock</option>
              <option value="PERSONAL">Recursos Humanos</option>
              <option value="MOVILIDAD">Movilidad</option>
              <option value="LOGIN">Autenticación</option>
            </select>
          </div>
        </div>

        {/* Tabla de Logs */}
        <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/80 text-slate-400 font-bold uppercase tracking-wider sticky top-0 border-b border-slate-700/60 z-10">
              <tr>
                <th className="py-2.5 px-3">Hora / Fecha</th>
                <th className="py-2.5 px-3">Usuario</th>
                <th className="py-2.5 px-3">Módulo</th>
                <th className="py-2.5 px-3">Acción</th>
                <th className="py-2.5 px-3">Detalle / Descripción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40 font-medium">
              {logsFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No se encontraron registros de auditoría con los filtros actuales.
                  </td>
                </tr>
              ) : (
                logsFiltrados.map((log) => (
                  <tr key={log.id_log} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {new Date(log.fecha_creacion).toLocaleString("es-PE", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                    <td className="py-2 px-3">
                      <span className="font-bold text-white">{log.usuario_nombre}</span>
                      <span className="text-[10px] text-slate-400 block">{log.rol_nombre}</span>
                    </td>
                    <td className="py-2 px-3">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono font-bold text-indigo-300 border border-slate-700">
                        {log.modulo}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-bold text-slate-200">
                      {log.accion}
                    </td>
                    <td className="py-2 px-3 text-slate-300 max-w-xs truncate" title={log.descripcion}>
                      {log.descripcion}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
