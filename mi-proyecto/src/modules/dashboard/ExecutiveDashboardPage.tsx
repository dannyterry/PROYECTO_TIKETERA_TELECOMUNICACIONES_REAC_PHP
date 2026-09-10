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
  Eye,
  X,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import { TechnicianPerformanceTab } from "./components/TechnicianPerformanceTab";
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

interface AuditLog {
  id_log: number;
  id_usuario: number;
  usuario_nombre: string;
  rol_nombre: string;
  area: string;
  modulo: string;
  accion: string;
  id_referencia: string;
  id_ticket?: string | number;
  descripcion: string;
  fecha_creacion: string;
}

interface GestionEvolucion {
  fecha: string;
  fecha_corta: string;
  llamadas_inconcert: number | string;
  observaciones_cliente: number | string;
  asignaciones_tecnico: number | string;
  total_interacciones: number;
}

interface GestorRendimiento {
  id_usuario: number;
  usuario_nombre: string;
  llamadas: number;
  observaciones: number;
  asignaciones: number;
  total: number;
  efectividad: number;
}

interface GestionData {
  evolucion: GestionEvolucion[];
  porGestor: GestorRendimiento[];
  resumen: {
    totalLlamadas: number;
    totalObservaciones: number;
    totalAsignaciones: number;
    totalInteracciones: number;
    tasaEfectividadGlobal: number;
  };
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

// Colores oficiales para los estados de órdenes (Paleta corporativa suave institucional)
const COLOR_ESTADOS: Record<string, string> = {
  Finalizada: "#5b9bd5", // Azul pastel institucional
  Iniciada: "#70ad47", // Verde pastel institucional
  "En proceso": "#70ad47",
  "En camino": "#ffc000", // Ámbar pastel institucional
  Agendada: "#64748b", // Slate
  Cancelada: "#ef4444", // Rojo
  Regestión: "#ffc000", // Ámbar pastel institucional
  Anulada: "#475569",
  Observada: "#ef4444",
};

const NOMBRES_MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const NOMBRES_MESES_CORTO = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// 🇵🇪 Formateador inteligente de Fecha y Hora oficial de Perú (ej: "Hoy, 16:02", "Ayer, 14:14", "04/09 16:29")
const formatearFechaHoraPE = (fechaStr?: string | null) => {
  if (!fechaStr) return "";
  try {
    const raw = String(fechaStr).trim();
    const dateObj = new Date(raw.includes("T") || raw.includes("Z") ? raw : raw.replace(" ", "T"));
    if (isNaN(dateObj.getTime())) {
      return raw;
    }

    const hora = dateObj.toLocaleTimeString("es-PE", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const now = new Date();
    const esHoy =
      dateObj.getDate() === now.getDate() &&
      dateObj.getMonth() === now.getMonth() &&
      dateObj.getFullYear() === now.getFullYear();

    if (esHoy) {
      return `Hoy, ${hora}`;
    }

    const ayer = new Date(now);
    ayer.setDate(now.getDate() - 1);
    const esAyer =
      dateObj.getDate() === ayer.getDate() &&
      dateObj.getMonth() === ayer.getMonth() &&
      dateObj.getFullYear() === ayer.getFullYear();

    if (esAyer) {
      return `Ayer, ${hora}`;
    }

    const dia = String(dateObj.getDate()).padStart(2, "0");
    const mes = String(dateObj.getMonth() + 1).padStart(2, "0");

    if (dateObj.getFullYear() === now.getFullYear()) {
      return `${dia}/${mes} ${hora}`;
    }

    return `${dia}/${mes}/${dateObj.getFullYear()} ${hora}`;
  } catch {
    return String(fechaStr);
  }
};

// Tooltip claro corporativo para Recharts
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 backdrop-blur-md p-3 rounded-2xl border border-slate-200 shadow-xl text-xs space-y-1 z-50">
        <p className="font-black text-slate-900">{label || payload[0]?.name}</p>
        {payload.map((p: any, idx: number) => (
          <p key={idx} className="font-bold flex items-center gap-2" style={{ color: p.color || p.fill }}>
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: p.color || p.fill }}></span>
            <span className="text-slate-700">{p.name}:</span>
            <span className="font-black text-slate-900">{p.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export const ExecutiveDashboardPage: React.FC = () => {
  // Pestaña principal activa: Resumen Ejecutivo | Rendimiento Técnicos | Auditoría & Personal
  const [activeMainTab, setActiveMainTab] = useState<"resumen" | "tecnicos" | "auditoria">("resumen");

  // 1. Selector inteligente de período (Días, Semanas, Meses, Año)
  const [periodMode, setPeriodMode] = useState<"dia" | "semana" | "mes" | "anio">("mes");
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Estados de datos
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [usuariosOnline, setUsuariosOnline] = useState<OnlineUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [filtroModuloAudit, setFiltroModuloAudit] = useState<string>("Todos");
  const [busquedaAudit, setBusquedaAudit] = useState<string>("");
  const [datosGestion, setDatosGestion] = useState<GestionData | null>(null);

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

      // 3. Logs de Auditoría
      const resLogs = await fetch(`${API_URL}/auditoria/logs?limite=100&modulo=${filtroModuloAudit}`).then((r) => r.json());
      if (Array.isArray(resLogs)) setAuditLogs(resLogs);

      // 4. Métricas y Gráficos de Rendimiento de Gestión (Llamadas & Contacto)
      try {
        const resGestion = await fetch(`${API_URL}/auditoria/grafico-gestion?${desdeParam}${hastaParam}`).then((r) => r.json());
        if (resGestion && resGestion.evolucion) setDatosGestion(resGestion);
      } catch (e) {
        console.error("Error al cargar datos de gestión:", e);
      }
    } catch (err) {
      console.error("Error al cargar dashboard ejecutivo:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedOption, filtroModuloAudit, opcionesDias, opcionesSemanas, opcionesMeses, opcionesAnios]);

  // Carga inicial y por cambio de filtros
  useEffect(() => {
    cargarDashboard(false);
  }, [cargarDashboard]);

  // Polling automático cada 20 segundos para usuarios online y auditoría
  useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden) {
        cargarDashboard(true);
      }
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
    { name: "Finalizadas (Liquidadas)", value: finalizadas, color: "#5b9bd5" },
    { name: "Canceladas / Observadas / Anuladas", value: canceladasObs, color: "#ffc000" },
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
    <div className="w-full min-h-screen bg-slate-100/70 text-slate-800 p-3 md:p-4 space-y-3">
      
      {/* ─────────────────────────────────────────────────────────────
          1. HEADER EJECUTIVO & NAVEGACIÓN PRINCIPAL (PARA RESUMEN Y AUDITORÍA)
      ───────────────────────────────────────────────────────────── */}
      {activeMainTab !== "tecnicos" && (
        <div className="sticky top-0 z-30 bg-white p-3.5 md:p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center shadow-xs">
              <Activity className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                  Análisis & Visualización
                </h1>
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold font-mono">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  24/7 EN VIVO
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Inteligencia operativa, rendimiento técnico y trazabilidad en tiempo real.
              </p>
            </div>
          </div>

          {/* 🗂️ SELECTOR DE PESTAÑAS PRINCIPALES */}
          {/* 🗂️ SELECTOR DE PESTAÑAS PRINCIPALES */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveMainTab("resumen")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeMainTab === "resumen"
                  ? "bg-white text-slate-900 shadow-sm border border-slate-200/80"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
              }`}
            >
              <Activity size={14} className={activeMainTab === "resumen" ? "text-sky-600" : "text-slate-400"} />
              <span>Resumen Ejecutivo</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMainTab("tecnicos")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                (activeMainTab as string) === "tecnicos"
                  ? "bg-white text-slate-900 shadow-sm border border-slate-200/80"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
              }`}
            >
              <Users size={14} className={(activeMainTab as string) === "tecnicos" ? "text-emerald-600" : "text-slate-400"} />
              <span>Rendimiento Técnicos</span>
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500 text-white shadow-xs animate-pulse">
                NUEVO
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMainTab("auditoria")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeMainTab === "auditoria"
                  ? "bg-white text-slate-900 shadow-sm border border-slate-200/80"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
              }`}
            >
              <ShieldCheck size={14} className={activeMainTab === "auditoria" ? "text-sky-600" : "text-slate-400"} />
              <span>Auditoría & Personal</span>
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-sky-100 text-sky-700">
                {totalGestoresOnline} online
              </span>
            </button>
          </div>
        </div>

        {/* 📅 SELECTOR DE PERÍODO INTEGRADO (PARA RESUMEN Y AUDITORÍA) */}
        {(activeMainTab === "resumen" || activeMainTab === "auditoria") && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            {/* Pestañas de Modo */}
            <div className="bg-slate-100 p-1 rounded-2xl border border-slate-200 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPeriodMode("dia")}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                  periodMode === "dia" ? "bg-sky-600 text-white shadow-sm shadow-sky-600/20" : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                }`}
              >
                📅 Por Días
              </button>
              <button
                type="button"
                onClick={() => setPeriodMode("semana")}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                  periodMode === "semana" ? "bg-sky-600 text-white shadow-sm shadow-sky-600/20" : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                }`}
              >
                🗓️ Por Semanas
              </button>
              <button
                type="button"
                onClick={() => setPeriodMode("mes")}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                  periodMode === "mes" ? "bg-sky-600 text-white shadow-sm shadow-sky-600/20" : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                }`}
              >
                📊 Por Meses
              </button>
              <button
                type="button"
                onClick={() => setPeriodMode("anio")}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                  periodMode === "anio" ? "bg-sky-600 text-white shadow-sm shadow-sky-600/20" : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
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
                  className="w-full bg-slate-50 border border-slate-200 font-bold text-slate-800 text-xs rounded-2xl px-3.5 py-2 appearance-none focus:outline-none focus:border-sky-500 shadow-2xs pr-9 cursor-pointer"
                >
                  {periodMode === "dia" &&
                    opcionesDias.map((op) => (
                      <option key={op.id} value={op.id}>
                        {op.label}
                      </option>
                    ))}

                  {periodMode === "semana" &&
                    opcionesSemanas.map((op) => (
                      <option key={op.id} value={op.id}>
                        {op.label}
                      </option>
                    ))}

                  {periodMode === "mes" && (
                    <>
                      <optgroup label={`📅 Año ${new Date().getFullYear()} (Meses Transcurridos)`}>
                        {opcionesMeses.listActual.map((op) => (
                          <option key={op.id} value={op.id}>
                            {op.label}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label={`📂 Año ${new Date().getFullYear() - 1} (Histórico)`}>
                        {opcionesMeses.listAnterior.map((op) => (
                          <option key={op.id} value={op.id}>
                            {op.label}
                          </option>
                        ))}
                      </optgroup>
                    </>
                  )}

                  {periodMode === "anio" &&
                    opcionesAnios.map((op) => (
                      <option key={op.id} value={op.id}>
                        {op.label}
                      </option>
                    ))}
                </select>
                <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              <button
                onClick={() => cargarDashboard(true)}
                disabled={refreshing}
                className="p-2 bg-white hover:bg-slate-50 active:scale-95 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                title="Refrescar datos del período"
              >
                <RefreshCw size={15} className={refreshing ? "animate-spin text-sky-600" : "text-slate-500"} />
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* 👷 PESTAÑA: RENDIMIENTO DE TÉCNICOS */}
      {activeMainTab === "tecnicos" && (
        <TechnicianPerformanceTab
          activeMainTab={activeMainTab}
          setActiveMainTab={setActiveMainTab}
          totalGestoresOnline={totalGestoresOnline}
        />
      )}

      {/* 📊 PESTAÑA: RESUMEN EJECUTIVO */}
      {activeMainTab === "resumen" && (
        <div className="space-y-4">
          {/* Fila de Estados Oficiales con Colores Institucionales Suaves */}
          <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white text-[#1f3864] border border-[#bdd7ee] shadow-2xs">
              <span className="w-2.5 h-2.5 rounded-full border border-[#8ea9db] bg-white inline-block"></span>
              <span>Agendadas / Asignadas:</span>
              <span className="font-mono font-black">
                {Math.max(0, totalOrdenes - (finalizadas + (stats?.kpis?.ordenes_en_proceso || 0) + canceladasObs))}
              </span>
            </span>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#e2efda] text-[#375623] border border-[#a9d18e] shadow-2xs">
              <span className="w-2.5 h-2.5 rounded-full bg-[#70ad47] inline-block"></span>
              <span>Iniciadas / Proceso:</span>
              <span className="font-mono font-black">{stats?.kpis?.ordenes_en_proceso || 0}</span>
            </span>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#deebf7] text-[#1f4e78] border border-[#bdd7ee] shadow-2xs">
              <span className="w-2.5 h-2.5 rounded-full bg-[#5b9bd5] inline-block"></span>
              <span>Finalizadas:</span>
              <span className="font-mono font-black">{finalizadas}</span>
            </span>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#fff2cc] text-[#833c0c] border border-[#ffe699] shadow-2xs">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ffc000] inline-block"></span>
              <span>Regestión / Canceladas:</span>
              <span className="font-mono font-black">{canceladasObs}</span>
            </span>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              2. TARJETAS DE KPIS PRINCIPALES (DISEÑO CLARO CORPORATIVO)
          ───────────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {/* Total Órdenes */}
            <div className="bg-white border border-slate-200/80 p-4 rounded-3xl shadow-xs relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-sky-700">Órdenes Totales</span>
                <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl lg:text-3xl font-black text-slate-900 mt-2">
                {totalOrdenes}
              </div>
              <span className="text-[10px] text-slate-500 block mt-1 capitalize">En el período seleccionado</span>
            </div>

            {/* Órdenes Finalizadas */}
            <div className="bg-white border border-[#bdd7ee]/70 p-4 rounded-3xl shadow-xs relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#1f4e78]">Finalizadas</span>
                <div className="w-7 h-7 rounded-lg bg-[#deebf7] text-[#1f4e78] flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl lg:text-3xl font-black text-[#1f4e78] mt-2">
                {finalizadas}
              </div>
              <span className="text-[10px] text-[#1f4e78] block mt-1 font-bold">
                {porcentajeEfectividad}% efectividad
              </span>
            </div>

            {/* Observadas / Canceladas */}
            <div className="bg-white border border-[#ffe699]/70 p-4 rounded-3xl shadow-xs relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#833c0c]">Observadas / Canc.</span>
                <div className="w-7 h-7 rounded-lg bg-[#fff2cc] text-[#833c0c] flex items-center justify-center">
                  <XCircle className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl lg:text-3xl font-black text-[#833c0c] mt-2">
                {canceladasObs}
              </div>
              <span className="text-[10px] text-[#833c0c] block mt-1 font-bold">
                {porcentajeCanceladas}% no liquidadas
              </span>
            </div>

            {/* Órdenes En Proceso */}
            <div className="bg-white border border-[#a9d18e]/70 p-4 rounded-3xl shadow-xs relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#375623]">En Proceso / Inic.</span>
                <div className="w-7 h-7 rounded-lg bg-[#e2efda] text-[#375623] flex items-center justify-center">
                  <Clock className="w-4 h-4 animate-pulse" />
                </div>
              </div>
              <div className="text-2xl lg:text-3xl font-black text-[#375623] mt-2">
                {stats?.kpis?.ordenes_en_proceso || 0}
              </div>
              <span className="text-[10px] text-slate-500 block mt-1">Cuadrillas en atención</span>
            </div>

            {/* Compras del Mes */}
            <div className="bg-white border border-slate-200/80 p-4 rounded-3xl shadow-xs relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Compras Mes</span>
                <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl lg:text-2xl font-black text-amber-600 mt-2 truncate">
                S/ {Number(stats?.kpis?.compras_mes || 0).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-slate-500 block mt-1">Inversión en suministros</span>
            </div>

            {/* Flota Técnicos */}
            <div className="bg-white border border-slate-200/80 p-4 rounded-3xl shadow-xs relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-sky-800">Técnicos Flota</span>
                <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                  <Truck className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl lg:text-3xl font-black text-slate-900 mt-2">
                {stats?.kpis?.total_tecnicos ?? 0}
              </div>
              <span className="text-[10px] text-slate-500 block mt-1">Cuadrillas operativas</span>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              3. SECCIÓN DE ANÁLISIS VISUAL DE ÓRDENES (DOBLE DONUT + BARRAS)
          ───────────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* 🎯 GRÁFICO 1: EFECTIVIDAD DIARIA / RATIO FINALIZADAS VS OBSERVADAS */}
            <div className="lg:col-span-6 bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#deebf7] text-[#1f4e78] flex items-center justify-center">
                    <Target className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-slate-900">Efectividad: Finalizadas vs Observadas / Canceladas</h2>
                    <p className="text-[11px] text-slate-500">Ratio de liquidación y cierre operativo de jornada</p>
                  </div>
                </div>
                <span className="text-[10px] font-extrabold text-[#1f4e78] bg-[#deebf7] border border-[#bdd7ee] px-2.5 py-1 rounded-xl">
                  {porcentajeEfectividad}% Éxito
                </span>
              </div>

              <div className="h-64 w-full relative flex items-center justify-center">
                {totalEvaluadas === 0 ? (
                  <div className="text-xs text-slate-400">Sin órdenes cerradas en este período</div>
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
                    <span className="text-3xl font-black text-slate-900 tracking-tight">{porcentajeEfectividad}%</span>
                    <span className="text-[10px] font-black text-[#1f4e78] uppercase tracking-widest mt-0.5">Efectividad</span>
                  </div>
                )}
              </div>

              {/* Leyenda y Comparativa de Liquidación */}
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                <div className="bg-[#deebf7]/80 border border-[#bdd7ee] p-3 rounded-2xl text-center">
                  <span className="text-[11px] text-[#1f4e78] font-bold block">Finalizadas (Liquidadas)</span>
                  <span className="text-xl font-black text-[#1f4e78]">{finalizadas}</span>
                  <span className="text-[10px] text-[#1f4e78] font-bold block">{porcentajeEfectividad}% de efectividad</span>
                </div>

                <div className="bg-[#fff2cc]/80 border border-[#ffe699] p-3 rounded-2xl text-center">
                  <span className="text-[11px] text-[#833c0c] font-bold block">Canceladas / Obs. / Anuladas</span>
                  <span className="text-xl font-black text-[#833c0c]">{canceladasObs}</span>
                  <span className="text-[10px] text-[#833c0c] font-bold block">{porcentajeCanceladas}% no liquidadas</span>
                </div>
              </div>
            </div>

            {/* 🍩 GRÁFICO 2: DISTRIBUCIÓN DETALLADA POR TODOS LOS ESTADOS */}
            <div className="lg:col-span-6 bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                    <PieIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-slate-900">Distribución de Órdenes por Estado</h2>
                    <p className="text-[11px] text-slate-500">Desglose de estados operativos en el período</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-xl">
                  {totalOrdenes} Total
                </span>
              </div>

              <div className="h-64 w-full relative flex items-center justify-center">
                {dataEstadosPie.length === 0 ? (
                  <div className="text-xs text-slate-400">Sin datos en este período</div>
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
                    <span className="text-2xl font-black text-slate-900">{totalOrdenes}</span>
                    <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">ÓRDENES</span>
                  </div>
                )}
              </div>

              {/* Leyenda interactiva */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-3 border-t border-slate-100">
                {dataEstadosPie.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl text-[11px]">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                    <span className="text-slate-600 font-semibold">{item.name}:</span>
                    <span className="font-black text-slate-900">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              4. GRÁFICO DE BARRAS: EVOLUCIÓN ANUAL MES A MES
          ───────────────────────────────────────────────────────────── */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-900">Evolución de Producción Anual (Total vs Finalizadas)</h2>
                  <p className="text-[11px] text-slate-500">Comparativa histórica mensual del rendimiento operativo</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs font-bold">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span className="w-3 h-3 rounded-md bg-[#cbd5e1] inline-block"></span> Total
                </span>
                <span className="flex items-center gap-1.5 text-[#1f4e78]">
                  <span className="w-3 h-3 rounded-md bg-[#5b9bd5] inline-block"></span> Finalizadas
                </span>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataMesesBar} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.8} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Bar dataKey="Total" fill="#cbd5e1" radius={[6, 6, 0, 0]} maxBarSize={30} />
                  <Bar dataKey="Finalizadas" fill="#5b9bd5" radius={[6, 6, 0, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* 🛡️ PESTAÑA 3: AUDITORÍA & PERSONAL (EN VIVO 24/7) */}
      {activeMainTab === "auditoria" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* 1. MONITOR DE PERSONAL Y GESTORES ONLINE */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-2xs">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900">Personal y Gestores en Línea</h2>
                  <p className="text-xs text-slate-500">Sesiones activas y última interacción registrada en tiempo real.</p>
                </div>
              </div>
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                {totalGestoresOnline} Conectados Ahora
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {usuariosOnline.length === 0 ? (
                <div className="col-span-full py-12 text-center text-slate-400 text-xs">
                  No hay usuarios registrados
                </div>
              ) : (
                usuariosOnline.map((u) => {
                  const isOnline = u.esta_online === 1;
                  const initials = (u.nombre_completo || "US")
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .substring(0, 2)
                    .toUpperCase();

                  return (
                    <div
                      key={u.id_usuario}
                      className="bg-slate-50/70 hover:bg-white border border-slate-200/80 rounded-2xl p-3.5 transition-all shadow-2xs hover:shadow-xs space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative shrink-0">
                            <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-800 border border-sky-200 flex items-center justify-center font-black text-xs">
                              {initials}
                            </div>
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                                isOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
                              }`}
                            />
                          </div>

                          <div className="min-w-0">
                            <h3 className="text-xs font-bold text-slate-900 truncate" title={u.nombre_completo}>
                              {u.nombre_completo}
                            </h3>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-sky-100/70 text-sky-800 border border-sky-200">
                                {u.rol_nombre || u.area || "Personal"}
                              </span>
                              {(u.distrito_conexion || u.distrito) && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-0.5 font-mono">
                                  <MapPin size={9} className="text-emerald-600" />
                                  {u.distrito_conexion || u.distrito}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                            isOnline
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-100 text-slate-400 border border-slate-200"
                          }`}
                        >
                          {isOnline ? "🟢 Online" : "⚪ Offline"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[11px] text-slate-500">
                        <span className="truncate max-w-[200px]" title={u.ultima_accion || ""}>
                          {u.ultima_accion || (isOnline ? "Inicio de sesión" : "Sin actividad reciente")}
                        </span>
                        {u.ultimo_acceso && (
                          <span className="text-[10px] font-mono text-slate-400 shrink-0 font-medium">
                            {formatearFechaHoraPE(u.ultimo_acceso)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 2. 📊 RENDIMIENTO DEL PERSONAL DE GESTIÓN (LLAMADAS, EFECTIVIDAD Y TENDENCIAS) */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100 shadow-2xs">
                  <PhoneCall className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900">Rendimiento Exclusivo: Personal de Gestión</h2>
                  <p className="text-xs text-slate-500">Métricas operativas de llamadas Inconcert, observaciones y efectividad exclusivas del Rol de Gestión.</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                  👥 {datosGestion?.porGestor?.length || 0} en Rol Gestión
                </span>
              </div>
            </div>

            {/* Mini Tarjetas de KPIs de Gestión */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
              <div className="bg-gradient-to-br from-sky-50/70 to-white p-4 rounded-2xl border border-sky-100 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-sky-700">Llamadas Inconcert</span>
                  <div className="w-7 h-7 rounded-lg bg-sky-100/80 text-sky-700 flex items-center justify-center">
                    <PhoneCall className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
                  {datosGestion?.resumen?.totalLlamadas ?? 0}
                </div>
                <span className="text-[10px] text-slate-500 block mt-1">Llamadas marcadas en sistema</span>
              </div>

              <div className="bg-gradient-to-br from-emerald-50/70 to-white p-4 rounded-2xl border border-emerald-100 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700">Contacto Efectivo</span>
                  <div className="w-7 h-7 rounded-lg bg-emerald-100/80 text-emerald-700 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
                  {datosGestion?.resumen?.totalObservaciones ?? 0}
                </div>
                <span className="text-[10px] text-slate-500 block mt-1">Observaciones con el cliente</span>
              </div>

              <div className="bg-gradient-to-br from-amber-50/70 to-white p-4 rounded-2xl border border-amber-100 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-700">Tasa de Efectividad</span>
                  <div className="w-7 h-7 rounded-lg bg-amber-100/80 text-amber-700 flex items-center justify-center">
                    <Target className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
                  {datosGestion?.resumen?.tasaEfectividadGlobal ?? 0}%
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, datosGestion?.resumen?.tasaEfectividadGlobal ?? 0)}%` }}
                  />
                </div>
              </div>

              <div className="bg-gradient-to-br from-indigo-50/70 to-white p-4 rounded-2xl border border-indigo-100 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-indigo-700">Total Gestiones</span>
                  <div className="w-7 h-7 rounded-lg bg-indigo-100/80 text-indigo-700 flex items-center justify-center">
                    <Layers className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
                  {datosGestion?.resumen?.totalInteracciones ?? 0}
                </div>
                <span className="text-[10px] text-slate-500 block mt-1">Interacciones acumuladas</span>
              </div>
            </div>

            {/* Dos Gráficos en Cuadrícula: Barras Apiladas + Gráfico de Líneas Multi-color */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-2">
              
              {/* GRÁFICO 1: BARRAS APILADAS POR GESTOR */}
              <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
                      <BarChart3 size={14} className="text-sky-600" />
                      Llamadas y Contacto por Gestor (Barras Apiladas)
                    </h3>
                    <p className="text-[11px] text-slate-500">Distribución de llamadas, observaciones y asignaciones</p>
                  </div>
                </div>

                <div className="h-64">
                  {datosGestion?.porGestor && datosGestion.porGestor.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={datosGestion.porGestor} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis
                          dataKey="usuario_nombre"
                          tick={{ fontSize: 10, fontWeight: 700, fill: "#475569" }}
                          tickFormatter={(n) => {
                            const partes = String(n || "").trim().split(" ");
                            return partes.length >= 2 ? `${partes[0]} ${partes[1].charAt(0)}.` : n;
                          }}
                        />
                        <YAxis tick={{ fontSize: 10, fontWeight: 700, fill: "#64748b" }} />
                        <RechartsTooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const d = payload[0].payload as GestorRendimiento;
                              return (
                                <div className="bg-white p-3 rounded-2xl shadow-xl border border-slate-200 text-xs space-y-1.5 z-50">
                                  <div className="font-black text-slate-900 border-b border-slate-100 pb-1">
                                    {d.usuario_nombre}
                                  </div>
                                  <div className="text-sky-700 font-semibold flex items-center justify-between gap-4">
                                    <span>Llamadas Inconcert:</span>
                                    <strong className="font-mono font-black">{d.llamadas}</strong>
                                  </div>
                                  <div className="text-emerald-700 font-semibold flex items-center justify-between gap-4">
                                    <span>Contacto Efectivo:</span>
                                    <strong className="font-mono font-black">{d.observaciones}</strong>
                                  </div>
                                  {Number(d.asignaciones || 0) > 0 && (
                                    <div className="text-amber-700 font-semibold flex items-center justify-between gap-4">
                                      <span>Asignaciones Técnico:</span>
                                      <strong className="font-mono font-black">{d.asignaciones}</strong>
                                    </div>
                                  )}
                                  <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-slate-900 font-black">
                                    <span>Total Gestiones:</span>
                                    <span className="font-mono">{d.total}</span>
                                  </div>
                                  <div className="pt-0.5 flex items-center justify-between text-emerald-600 font-extrabold">
                                    <span>Efectividad:</span>
                                    <span className="font-mono bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                      {d.efectividad}%
                                    </span>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend
                          verticalAlign="top"
                          align="right"
                          iconType="circle"
                          iconSize={8}
                          wrapperStyle={{ fontSize: 10, fontWeight: 700, paddingBottom: 8 }}
                        />
                        <Bar dataKey="llamadas" stackId="g" fill="#0284c7" name="Llamadas" radius={[0, 0, 0, 0]} maxBarSize={38} />
                        <Bar dataKey="observaciones" stackId="g" fill="#10b981" name="Contacto Efectivo" radius={[0, 0, 0, 0]} maxBarSize={38} />
                        <Bar dataKey="asignaciones" stackId="g" fill="#f59e0b" name="Asignaciones" radius={[4, 4, 0, 0]} maxBarSize={38} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 text-xs font-semibold">
                      No hay registros de llamadas en este período.
                    </div>
                  )}
                </div>
              </div>

              {/* GRÁFICO 2: EVOLUCIÓN MULTI-LÍNEA (ESTILO IMAGEN 2) */}
              <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
                      <TrendingUp size={14} className="text-amber-500" />
                      Evolución Cronológica de Contactabilidad
                    </h3>
                    <p className="text-[11px] text-slate-500">Tendencia diaria de llamadas, observaciones y gestiones totales</p>
                  </div>
                </div>

                <div className="h-64">
                  {datosGestion?.evolucion && datosGestion.evolucion.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={datosGestion.evolucion} margin={{ top: 10, right: 15, left: -20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis
                          dataKey="fecha_corta"
                          tick={{ fontSize: 10, fontWeight: 700, fill: "#475569" }}
                        />
                        <YAxis tick={{ fontSize: 10, fontWeight: 700, fill: "#64748b" }} />
                        <RechartsTooltip
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-white p-3 rounded-2xl shadow-xl border border-slate-200 text-xs space-y-1.5 z-50">
                                  <div className="font-black text-slate-900 border-b border-slate-100 pb-1">
                                    Fecha: {label}
                                  </div>
                                  <div className="text-[#f97316] font-semibold flex items-center justify-between gap-4">
                                    <span>Llamadas Inconcert:</span>
                                    <strong className="font-mono font-black">{payload[0]?.value || 0}</strong>
                                  </div>
                                  <div className="text-[#10b981] font-semibold flex items-center justify-between gap-4">
                                    <span>Contacto Efectivo:</span>
                                    <strong className="font-mono font-black">{payload[1]?.value || 0}</strong>
                                  </div>
                                  <div className="text-[#0284c7] font-semibold flex items-center justify-between gap-4">
                                    <span>Total Gestiones:</span>
                                    <strong className="font-mono font-black">{payload[2]?.value || 0}</strong>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend
                          verticalAlign="top"
                          align="right"
                          iconType="circle"
                          iconSize={8}
                          wrapperStyle={{ fontSize: 10, fontWeight: 700, paddingBottom: 8 }}
                        />
                        {/* Línea Naranja: Llamadas */}
                        <Line
                          type="monotone"
                          dataKey="llamadas_inconcert"
                          name="Llamadas Inconcert"
                          stroke="#f97316"
                          strokeWidth={3}
                          dot={{ r: 4, stroke: "#ea580c", strokeWidth: 2, fill: "#fff" }}
                          activeDot={{ r: 6, stroke: "#ea580c", strokeWidth: 2, fill: "#f97316" }}
                        />
                        {/* Línea Verde: Contacto Efectivo */}
                        <Line
                          type="monotone"
                          dataKey="observaciones_cliente"
                          name="Contacto Efectivo"
                          stroke="#10b981"
                          strokeWidth={3}
                          dot={{ r: 4, stroke: "#059669", strokeWidth: 2, fill: "#fff" }}
                          activeDot={{ r: 6, stroke: "#059669", strokeWidth: 2, fill: "#10b981" }}
                        />
                        {/* Línea Azul: Total Interacciones */}
                        <Line
                          type="monotone"
                          dataKey="total_interacciones"
                          name="Total Gestiones"
                          stroke="#0284c7"
                          strokeWidth={3}
                          dot={{ r: 4, stroke: "#0369a1", strokeWidth: 2, fill: "#fff" }}
                          activeDot={{ r: 6, stroke: "#0369a1", strokeWidth: 2, fill: "#0284c7" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 text-xs font-semibold">
                      No hay datos de evolución en este período.
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* 3. LÍNEA DE TIEMPO DE AUDITORÍA Y TRAZABILIDAD (24/7) */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-2xs">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900">Línea de Tiempo de Auditoría y Trazabilidad (24/7)</h2>
                  <p className="text-xs text-slate-500">Registro inmutable de acciones realizadas por el personal</p>
                </div>
              </div>

              {/* Filtros de Auditoría */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px]">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar en logs..."
                    value={busquedaAudit}
                    onChange={(e) => setBusquedaAudit(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <select
                  value={filtroModuloAudit}
                  onChange={(e) => setFiltroModuloAudit(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-bold focus:outline-none focus:border-sky-500 cursor-pointer"
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
            <div className="overflow-x-auto max-h-[380px] overflow-y-auto rounded-2xl border border-slate-100">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider sticky top-0 border-b border-slate-200 z-10 text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Hora / Fecha</th>
                    <th className="py-2.5 px-3">Usuario</th>
                    <th className="py-2.5 px-3">Módulo</th>
                    <th className="py-2.5 px-3">Acción</th>
                    <th className="py-2.5 px-3">Detalle / Descripción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {logsFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        No se encontraron registros de auditoría con los filtros actuales.
                      </td>
                    </tr>
                  ) : (
                    logsFiltrados.map((log) => (
                      <tr key={log.id_log} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {new Date(log.fecha_creacion).toLocaleString("es-PE", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-slate-900 block">{log.usuario_nombre}</span>
                          <span className="text-[10px] text-slate-400 block font-mono">{log.rol_nombre || log.area}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded bg-sky-50 text-[10px] font-mono font-bold text-sky-700 border border-sky-200">
                            {log.modulo}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-bold font-mono text-slate-800 text-[11px]">
                          {log.accion}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 max-w-md truncate" title={log.descripcion}>
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
      )}

    </div>
  );
};
