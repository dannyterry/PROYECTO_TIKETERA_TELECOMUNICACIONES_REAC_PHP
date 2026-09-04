import React, { useState, useEffect, useMemo } from "react";
import {
  FileCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Check,
  X,
  Calendar,
  Sparkles,
  Zap,
  TrendingUp,
  Package,
  Layers,
  Activity,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  ArrowUpDown,
  MapPin,
  FileText,
  User,
  Info
} from "lucide-react";
import {
  LiquidacionOrdenAudit,
  TecnicoLiqAuditResumen,
  MaterialLiquidadoAudit
} from "../types/inventoryTypes";
import {
  getLiquidacionesOrdenesAudit,
  aprobarLiquidacionOrden,
  rechazarLiquidacionOrden,
  aprobarMasivoLiquidaciones
} from "../services/inventoryService";

export const OrderLiquidationsAuditTab: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [tecnicos, setTecnicos] = useState<TecnicoLiqAuditResumen[]>([]);
  const [liquidaciones, setLiquidaciones] = useState<LiquidacionOrdenAudit[]>([]);

  // Filtros
  const getTodayStr = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const [fechaPreset, setFechaPreset] = useState<"hoy" | "ayer" | "semana" | "custom">("hoy");
  const [fechaDesde, setFechaDesde] = useState<string>(getTodayStr());
  const [fechaHasta, setFechaHasta] = useState<string>(getTodayStr());
  const [tecnicoFiltro, setTecnicoFiltro] = useState<string>("todos");
  const [estadoFiltro, setEstadoFiltro] = useState<string>("todos");
  const [busqueda, setBusqueda] = useState<string>("");

  // Modal de Detalle / Auditoría
  const [modalLiq, setModalLiq] = useState<LiquidacionOrdenAudit | null>(null);
  const [procesandoAccion, setProcesandoAccion] = useState<boolean>(false);
  const [motivoRechazo, setMotivoRechazo] = useState<string>("");
  const [mostrandoRechazoInput, setMostrandoRechazoInput] = useState<boolean>(false);

  // Modal de confirmación para aprobación masiva
  const [modalMasivoAbierto, setModalMasivoAbierto] = useState<boolean>(false);

  // Cargar datos
  const cargarDatos = async () => {
    setLoading(true);
    try {
      const res = await getLiquidacionesOrdenesAudit({
        desde: fechaDesde,
        hasta: fechaHasta,
        id_trabajador: tecnicoFiltro !== "todos" ? tecnicoFiltro : undefined,
        estado: estadoFiltro !== "todos" ? estadoFiltro : undefined
      });
      if (res.success) {
        setTecnicos(res.tecnicos || []);
        setLiquidaciones(res.liquidaciones || []);
      }
    } catch (err) {
      console.error("Error al cargar auditoría de liquidaciones:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [fechaDesde, fechaHasta, tecnicoFiltro, estadoFiltro]);

  // Manejador de presets de fecha
  const aplicarPresetFecha = (preset: "hoy" | "ayer" | "semana") => {
    setFechaPreset(preset);
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");

    if (preset === "hoy") {
      const h = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      setFechaDesde(h);
      setFechaHasta(h);
    } else if (preset === "ayer") {
      d.setDate(d.getDate() - 1);
      const a = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      setFechaDesde(a);
      setFechaHasta(a);
    } else if (preset === "semana") {
      const h = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      d.setDate(d.getDate() - 7);
      const ini = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      setFechaDesde(ini);
      setFechaHasta(h);
    }
  };

  // Filtrado en memoria
  const liquidacionesFiltradas = useMemo(() => {
    return liquidaciones.filter((liq) => {
      if (tecnicoFiltro !== "todos" && String(liq.id_trabajador) !== tecnicoFiltro) {
        return false;
      }
      if (estadoFiltro !== "todos" && liq.estado_liquidacion !== estadoFiltro) {
        return false;
      }
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase().trim();
        const matchNum = (liq.numero_orden || "").toLowerCase().includes(q);
        const matchCli = (liq.cliente || "").toLowerCase().includes(q);
        const matchActa = (liq.numero_acta || "").toLowerCase().includes(q);
        const matchTec = (liq.tecnico || "").toLowerCase().includes(q);
        if (!matchNum && !matchCli && !matchActa && !matchTec) return false;
      }
      return true;
    });
  }, [liquidaciones, tecnicoFiltro, estadoFiltro, busqueda]);

  // Métricas para KPI Cards
  const kpis = useMemo(() => {
    const total = liquidaciones.length;
    const aprobadas = liquidaciones.filter((l) => l.estado_liquidacion === "Aprobada").length;
    const pendientes = liquidaciones.filter((l) => l.estado_liquidacion === "Pendiente").length;
    const conAlerta = liquidaciones.filter((l) => l.es_alerta).length;
    const costoTotal = liquidaciones.reduce((acc, l) => acc + (parseFloat(String(l.total_costo)) || 0), 0);
    const elegiblesAprobacionMasiva = liquidaciones.filter(
      (l) => l.estado_liquidacion === "Pendiente" && !l.es_alerta
    );

    return { total, aprobadas, pendientes, conAlerta, costoTotal, elegiblesAprobacionMasiva };
  }, [liquidaciones]);

  // Acciones individuales
  const handleAprobar = async (idLiq: number) => {
    setProcesandoAccion(true);
    try {
      const res = await aprobarLiquidacionOrden(idLiq);
      if (res.success) {
        await cargarDatos();
        setModalLiq(null);
      }
    } catch (err) {
      console.error("Error al aprobar liquidación:", err);
    } finally {
      setProcesandoAccion(false);
    }
  };

  const handleRechazar = async (idLiq: number) => {
    if (!motivoRechazo.trim()) {
      alert("Por favor ingrese el motivo del rechazo.");
      return;
    }
    setProcesandoAccion(true);
    try {
      const res = await rechazarLiquidacionOrden(idLiq, motivoRechazo.trim());
      if (res.success) {
        await cargarDatos();
        setModalLiq(null);
        setMotivoRechazo("");
        setMostrandoRechazoInput(false);
      }
    } catch (err) {
      console.error("Error al rechazar liquidación:", err);
    } finally {
      setProcesandoAccion(false);
    }
  };

  const handleAprobarMasivo = async () => {
    const ids = kpis.elegiblesAprobacionMasiva.map((l) => l.id_liquidacion);
    if (ids.length === 0) return;
    setProcesandoAccion(true);
    try {
      const res = await aprobarMasivoLiquidaciones(ids);
      if (res.success) {
        await cargarDatos();
        setModalMasivoAbierto(false);
      }
    } catch (err) {
      console.error("Error en aprobación masiva:", err);
    } finally {
      setProcesandoAccion(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ─────────────────────────────────────────────────────────────
          1. KPI CARDS DEL DÍA / FILTRO
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Liquidadas */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Órdenes Liquidadas</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl md:text-3xl font-black text-slate-900 font-mono">{kpis.total}</span>
              <span className="text-xs text-slate-400 font-medium">actas</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200/60">
            <FileCheck size={22} />
          </div>
        </div>

        {/* Auto-Aprobadas / Conformes */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Aprobadas / Conformes</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl md:text-3xl font-black text-emerald-600 font-mono">{kpis.aprobadas}</span>
              <span className="text-xs text-emerald-600/80 font-medium">validadas</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200/60">
            <ShieldCheck size={22} />
          </div>
        </div>

        {/* En Alerta / Observadas */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Con Alerta / Excesos</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl md:text-3xl font-black text-amber-500 font-mono">{kpis.conAlerta}</span>
              <span className="text-xs text-amber-600 font-semibold">&gt;500m o múltiples ONT</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center border border-amber-200/60">
            <AlertTriangle size={22} />
          </div>
        </div>

        {/* Costo Total en Materiales */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Costo Consumido</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl md:text-3xl font-black text-indigo-700 font-mono">
                S/ {kpis.costoTotal.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-200/60">
            <TrendingUp size={22} />
          </div>
        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. BARRA DE HERRAMIENTAS, FILTROS Y APROBACIÓN MASIVA
      ───────────────────────────────────────────────────────────── */}
      <div className="p-5 bg-white rounded-3xl border border-slate-200/90 shadow-xs space-y-4">
        
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          {/* Presets de Fecha */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200">
            <button
              onClick={() => aplicarPresetFecha("hoy")}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                fechaPreset === "hoy"
                  ? "bg-white text-slate-900 shadow-2xs font-extrabold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Hoy
            </button>
            <button
              onClick={() => aplicarPresetFecha("ayer")}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                fechaPreset === "ayer"
                  ? "bg-white text-slate-900 shadow-2xs font-extrabold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Ayer
            </button>
            <button
              onClick={() => aplicarPresetFecha("semana")}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                fechaPreset === "semana"
                  ? "bg-white text-slate-900 shadow-2xs font-extrabold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Últimos 7 días
            </button>
          </div>

          {/* Rango de Fechas Manual */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs font-semibold text-slate-600">
              <Calendar size={14} className="text-slate-400" />
              <span>Desde:</span>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => {
                  setFechaDesde(e.target.value);
                  setFechaPreset("custom");
                }}
                className="px-2.5 py-1 rounded-xl border border-slate-300 text-xs font-medium text-slate-800 bg-white"
              />
            </div>
            <div className="flex items-center gap-1 text-xs font-semibold text-slate-600">
              <span>Hasta:</span>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => {
                  setFechaHasta(e.target.value);
                  setFechaPreset("custom");
                }}
                className="px-2.5 py-1 rounded-xl border border-slate-300 text-xs font-medium text-slate-800 bg-white"
              />
            </div>
          </div>

          {/* Botón de Aprobación Masiva */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => setModalMasivoAbierto(true)}
              disabled={kpis.elegiblesAprobacionMasiva.length === 0}
              className={`px-4 py-2 rounded-2xl font-bold text-xs inline-flex items-center gap-2 transition-all cursor-pointer ${
                kpis.elegiblesAprobacionMasiva.length > 0
                  ? "bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white shadow-md shadow-emerald-600/20 scale-[1.01]"
                  : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
              }`}
            >
              <Zap size={14} />
              <span>Aprobar Conformes en Lote ({kpis.elegiblesAprobacionMasiva.length})</span>
            </button>

            <button
              onClick={cargarDatos}
              disabled={loading}
              className="p-2 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition-all cursor-pointer"
              title="Refrescar datos"
            >
              <RefreshCw size={15} className={loading ? "animate-spin text-blue-600" : ""} />
            </button>
          </div>

        </div>

        {/* Fila de Filtros Secundarios (Buscador, Técnico, Estado) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
          
          {/* Buscador */}
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por Orden, Cliente, Acta..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-2xl border border-slate-300 text-xs font-medium text-slate-900 bg-slate-50/50 focus:bg-white focus:border-blue-500 transition-all"
            />
          </div>

          {/* Filtro por Técnico */}
          <div>
            <select
              value={tecnicoFiltro}
              onChange={(e) => setTecnicoFiltro(e.target.value)}
              className="w-full px-3 py-2 rounded-2xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white"
            >
              <option value="todos">-- Todos los Técnicos ({tecnicos.length}) --</option>
              {tecnicos.map((t) => (
                <option key={t.id_trabajador} value={String(t.id_trabajador)}>
                  {t.cuadrilla ? `${t.cuadrilla} - ` : ""}{t.tecnico} ({t.total_ordenes} ord / {t.total_liquidaciones} liq)
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Estado */}
          <div>
            <select
              value={estadoFiltro}
              onChange={(e) => setEstadoFiltro(e.target.value)}
              className="w-full px-3 py-2 rounded-2xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white"
            >
              <option value="todos">-- Todos los Estados --</option>
              <option value="Pendiente">🟡 Pendientes / Por Auditar</option>
              <option value="Aprobada">🟢 Aprobadas / Conformes</option>
              <option value="Rechazada">🔴 Rechazadas</option>
            </select>
          </div>

        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. SPLIT VIEW: MAESTRO TÉCNICOS & DETALLE ÓRDENES
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* COLUMNA IZQUIERDA: RESUMEN DE TÉCNICOS (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200/90 shadow-xs p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <User size={16} className="text-slate-500" />
              <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
                Técnicos ({tecnicos.length})
              </h3>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">Consumo acumulado</span>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {tecnicos.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-400">
                No hay técnicos con órdenes registradas en este rango.
              </div>
            ) : (
              tecnicos.map((t) => {
                const esActivo = tecnicoFiltro === String(t.id_trabajador);
                const tienePendientes = t.total_pendientes > 0;

                return (
                  <div
                    key={t.id_trabajador}
                    onClick={() => setTecnicoFiltro(esActivo ? "todos" : String(t.id_trabajador))}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      esActivo
                        ? "bg-indigo-50/70 border-indigo-300 shadow-2xs"
                        : "bg-slate-50/50 hover:bg-slate-50 border-slate-200/70"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                        {t.tecnico.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <span className="font-extrabold text-xs text-slate-900 block truncate">
                          {t.tecnico}
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5 text-[11px]">
                          {t.cuadrilla && (
                            <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold text-[10px] border border-indigo-200 truncate max-w-[130px]" title={t.cuadrilla}>
                              {t.cuadrilla}
                            </span>
                          )}
                          <span className="text-slate-500 font-medium font-mono">
                            DNI: {t.tecnico_dni || "Sin DNI"}
                          </span>
                          <span className="text-slate-400 font-medium">
                            • {t.total_ordenes} ord
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-mono font-bold text-xs text-slate-900 block">
                        S/ {parseFloat(String(t.total_costo)).toFixed(2)}
                      </span>
                      <div className="flex items-center gap-1 justify-end mt-0.5">
                        <span className="px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-800 font-bold text-[10px]">
                          {t.total_liquidaciones} liq
                        </span>
                        {tienePendientes && (
                          <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold text-[10px]">
                            {t.total_pendientes} pend
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* COLUMNA DERECHA: TABLA DE ÓRDENES LIQUIDADAS (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200/90 shadow-xs p-5 space-y-4">
          
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
                Auditoría de Actas y Órdenes ({liquidacionesFiltradas.length})
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Valida los materiales, metrajes de drop y series instaladas por los técnicos.
              </p>
            </div>
            {tecnicoFiltro !== "todos" && (
              <button
                onClick={() => setTecnicoFiltro("todos")}
                className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
              >
                ✕ Ver todos los técnicos
              </button>
            )}
          </div>

          {loading ? (
            <div className="text-center py-16 text-xs text-slate-400">
              <RefreshCw size={24} className="animate-spin text-blue-600 mx-auto mb-2" />
              <span>Cargando auditoría de liquidaciones...</span>
            </div>
          ) : liquidacionesFiltradas.length === 0 ? (
            <div className="text-center py-16 text-xs text-slate-400">
              No se encontraron órdenes liquidadas con los filtros actuales.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider bg-slate-50/50">
                    <th className="py-2.5 px-3">Orden & Fecha</th>
                    <th className="py-2.5 px-3">Cliente & Técnico</th>
                    <th className="py-2.5 px-3">Acta Física</th>
                    <th className="py-2.5 px-3">Fibra Drop</th>
                    <th className="py-2.5 px-3 text-center">Estado</th>
                    <th className="py-2.5 px-3 text-right">Costo</th>
                    <th className="py-2.5 px-3 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {liquidacionesFiltradas.map((l) => {
                    const esAprobada = l.estado_liquidacion === "Aprobada";
                    const esPendiente = l.estado_liquidacion === "Pendiente";
                    const esRechazada = l.estado_liquidacion === "Rechazada";

                    return (
                      <tr
                        key={l.id_liquidacion}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          l.es_alerta ? "bg-amber-50/30" : ""
                        }`}
                      >
                        {/* Orden & Fecha */}
                        <td className="py-3 px-3">
                          <span className="font-mono font-bold text-slate-900 block">
                            #{l.numero_orden}
                          </span>
                          <span className="text-[11px] text-slate-500 block">
                            {l.fecha_liquidacion ? l.fecha_liquidacion.split(" ")[0] : "-"}
                          </span>
                        </td>

                        {/* Cliente & Técnico */}
                        <td className="py-3 px-3">
                          <span className="font-bold text-slate-900 block truncate max-w-[180px]" title={l.cliente}>
                            {l.cliente}
                          </span>
                          <span className="text-[11px] text-indigo-700 font-semibold block truncate max-w-[180px]">
                            {l.tecnico}
                          </span>
                        </td>

                        {/* Acta */}
                        <td className="py-3 px-3 font-mono font-semibold text-slate-700">
                          {l.numero_acta || "-"}
                        </td>

                        {/* Fibra Drop & Comparativa Fénix */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-slate-900 text-xs">
                              {l.drop_total_metros}m
                            </span>
                            {l.es_alerta && (
                              <span
                                className="w-4 h-4 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-[10px]"
                                title={l.motivo_alerta}
                              >
                                !
                              </span>
                            )}
                          </div>
                          {l.drop_metro_inicio && l.drop_metro_fin ? (
                            <span className="text-[10px] text-slate-500 font-mono block">
                              {l.drop_metro_inicio} → {l.drop_metro_fin}
                            </span>
                          ) : null}
                          {l.metraje_fenix && (
                            <span className="text-[10px] text-emerald-700 font-semibold block">
                              Fénix: {l.metraje_fenix}m
                            </span>
                          )}
                        </td>

                        {/* Estado */}
                        <td className="py-3 px-3 text-center">
                          {esAprobada && (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px] inline-flex items-center gap-1">
                              <Check size={11} /> Aprobada
                            </span>
                          )}
                          {esPendiente && (
                            <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-extrabold text-[10px] inline-flex items-center gap-1">
                              <Clock size={11} /> Pendiente
                            </span>
                          )}
                          {esRechazada && (
                            <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 font-extrabold text-[10px] inline-flex items-center gap-1">
                              <X size={11} /> Rechazada
                            </span>
                          )}
                        </td>

                        {/* Costo */}
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                          S/ {parseFloat(String(l.total_costo)).toFixed(2)}
                        </td>

                        {/* Acción */}
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setModalLiq(l);
                              setMostrandoRechazoInput(false);
                              setMotivoRechazo("");
                            }}
                            className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs inline-flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <Eye size={13} />
                            <span>Auditar</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. MODAL DE AUDITORÍA DETALLADA DE LA LIQUIDACIÓN
      ───────────────────────────────────────────────────────────── */}
      {modalLiq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header Modal */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 flex items-center justify-between shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-indigo-500/30 border border-indigo-400/40 text-[11px] font-bold font-mono">
                    Orden #{modalLiq.numero_orden}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md bg-white/10 text-[11px] font-semibold">
                    Acta: {modalLiq.numero_acta || "Sin Acta"}
                  </span>
                </div>
                <h3 className="text-base font-black tracking-tight text-white">
                  Auditoría de Liquidación Técnica WIN
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalLiq(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Contenido Scrollable */}
            <div className="p-6 overflow-y-auto space-y-5">

              {/* Banner de Alerta si aplica */}
              {modalLiq.es_alerta && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300/80 flex items-start gap-3">
                  <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-extrabold text-xs text-amber-900 block">
                      Liquidación Marcada para Revisión
                    </span>
                    <p className="text-xs text-amber-800 mt-0.5 font-medium">
                      {modalLiq.motivo_alerta}
                    </p>
                  </div>
                </div>
              )}

              {/* Ficha de Cliente y Técnico */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">Cliente</span>
                  <span className="font-bold text-slate-900 text-xs block mt-0.5">{modalLiq.cliente}</span>
                  <span className="text-slate-600 text-[11px] block mt-0.5 flex items-center gap-1">
                    <MapPin size={11} className="text-slate-400 shrink-0" />
                    {modalLiq.direccion}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">Técnico Responsable</span>
                  <span className="font-bold text-indigo-700 text-xs block mt-0.5">{modalLiq.tecnico}</span>
                  <span className="text-slate-600 font-mono text-[11px] block mt-0.5">
                    DNI: {modalLiq.tecnico_dni || "No registrado"}
                  </span>
                </div>
              </div>

              {/* Tarjeta de Fibra Drop y Mediciones */}
              <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Medición de Fibra Drop & CTO
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-indigo-500/30 text-indigo-300 text-[10px] font-mono font-bold">
                    Límite para este trabajo: {modalLiq.max_drop_permitido || 120}m
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center pt-1">
                  <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-[10px] text-slate-400 block font-medium">Carrete Inicio</span>
                    <span className="font-mono font-black text-sm text-white">{modalLiq.drop_metro_inicio || "-"}m</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-[10px] text-slate-400 block font-medium">Carrete Fin</span>
                    <span className="font-mono font-black text-sm text-white">{modalLiq.drop_metro_fin || "-"}m</span>
                  </div>
                  <div className="p-2 rounded-xl bg-indigo-500/20 border border-indigo-400/40">
                    <span className="text-[10px] text-indigo-300 block font-bold">Total Consumido</span>
                    <span className="font-mono font-black text-sm text-indigo-200">{modalLiq.drop_total_metros}m</span>
                  </div>
                </div>

                {modalLiq.cto && (
                  <div className="text-[11px] text-slate-400 pt-1 flex items-center justify-between">
                    <span>CTO: <strong className="text-white font-mono">{modalLiq.cto}</strong></span>
                    <span>Puerto: <strong className="text-white font-mono">{modalLiq.puerto || "-"}</strong></span>
                  </div>
                )}
              </div>

              {/* Desglose de Materiales y Equipos */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
                    Materiales e Insumos Declarados ({modalLiq.materiales?.length || 0})
                  </span>
                  <span className="font-mono font-black text-xs text-indigo-700">
                    Total: S/ {parseFloat(String(modalLiq.total_costo)).toFixed(2)}
                  </span>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="py-2 px-3">Producto / Equipo</th>
                        <th className="py-2 px-3">Serie / Metraje</th>
                        <th className="py-2 px-3 text-center">Cant.</th>
                        <th className="py-2 px-3 text-right">P. Unit</th>
                        <th className="py-2 px-3 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {modalLiq.materiales?.map((mat, mIdx) => (
                        <tr key={mIdx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-semibold text-slate-900">
                            {mat.nombre_producto}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600 text-[11px]">
                            {mat.numero_serie ? (
                              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">
                                {mat.numero_serie}
                              </span>
                            ) : mat.drop_inicio ? (
                              <span>{mat.drop_inicio} → {mat.drop_fin}</span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-900">
                            {mat.cantidad}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-500 font-mono">
                            S/ {parseFloat(String(mat.precio_compra)).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-mono">
                            S/ {parseFloat(String(mat.costo)).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Observaciones del técnico */}
              {modalLiq.observaciones_tecnico && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <span className="font-bold text-slate-700 block text-[10px] uppercase">Nota del Técnico</span>
                  <p className="text-slate-600 mt-0.5 italic">{modalLiq.observaciones_tecnico}</p>
                </div>
              )}

              {/* Cuadro de texto para motivo de rechazo */}
              {mostrandoRechazoInput && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-2 animate-fade-in">
                  <span className="font-extrabold text-xs text-rose-900 block">
                    Motivo del Rechazo de la Liquidación:
                  </span>
                  <textarea
                    rows={2}
                    placeholder="Escriba la razón del rechazo (ej. metraje excesivo sin justificación, falta serie de ONT)..."
                    value={motivoRechazo}
                    onChange={(e) => setMotivoRechazo(e.target.value)}
                    className="w-full p-2 rounded-xl border border-rose-300 text-xs text-slate-900 bg-white"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setMostrandoRechazoInput(false)}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRechazar(modalLiq.id_liquidacion)}
                      disabled={procesandoAccion}
                      className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer"
                    >
                      Confirmar Rechazo
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* Footer con Acciones */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setModalLiq(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 cursor-pointer"
              >
                Cerrar
              </button>

              <div className="flex items-center gap-2">
                {!mostrandoRechazoInput && modalLiq.estado_liquidacion !== "Rechazada" && (
                  <button
                    type="button"
                    onClick={() => setMostrandoRechazoInput(true)}
                    disabled={procesandoAccion}
                    className="px-4 py-2 rounded-xl border border-rose-300 hover:bg-rose-50 text-rose-700 font-bold text-xs transition-all cursor-pointer"
                  >
                    Rechazar
                  </button>
                )}

                {modalLiq.estado_liquidacion !== "Aprobada" && (
                  <button
                    type="button"
                    onClick={() => handleAprobar(modalLiq.id_liquidacion)}
                    disabled={procesandoAccion}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs inline-flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <Check size={14} />
                    <span>Aprobar Liquidación</span>
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          5. MODAL DE CONFIRMACIÓN APROBACIÓN MASIVA
      ───────────────────────────────────────────────────────────── */}
      {modalMasivoAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md p-6 space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
              <Zap size={28} />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-900">
                ¿Aprobar {kpis.elegiblesAprobacionMasiva.length} liquidaciones conformes?
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Se marcarán como <strong>Aprobadas</strong> todas las órdenes pendientes que cumplen con las reglas estándar y no tienen alertas.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setModalMasivoAbierto(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAprobarMasivo}
                disabled={procesandoAccion}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Check size={14} />
                <span>Confirmar Aprobación</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default OrderLiquidationsAuditTab;
