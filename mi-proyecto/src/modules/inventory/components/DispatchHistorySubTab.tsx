import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Truck,
  Package,
  Barcode,
  Users,
  Calendar,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Printer,
  X,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Tag,
  Layers,
  Car,
  MapPin,
  ShieldCheck,
  ChevronDown,
  Download,
  BookOpen,
  Sparkles,
  CheckSquare,
} from "lucide-react";
import {
  DespachoHistorialItem,
  DespachoHistorialKPIs,
} from "../types/inventoryTypes";
import { getDespachosHistorial, getActasHistorial } from "../services/inventoryService";
import axios from "axios";
import { API_URL } from "../../../config/api";

interface Props {
  onNuevoDespacho?: () => void;
  tecnicos?: any[];
}

export const DispatchHistorySubTab: React.FC<Props> = ({ onNuevoDespacho, tecnicos = [] }) => {
  // Pestaña activa dentro del historial
  const [vista, setVista] = useState<"despachos" | "actas">("despachos");

  // Lista interna de técnicos (reactiva con auto-fetch si no se pasa por props)
  const [listaTecnicos, setListaTecnicos] = useState<any[]>(tecnicos);

  useEffect(() => {
    if (tecnicos && tecnicos.length > 0) {
      setListaTecnicos(tecnicos);
    } else {
      axios
        .get(`${API_URL}/api/almacen/tecnicos-disponibles`)
        .then((res) => {
          if (res.data?.success && Array.isArray(res.data.tecnicos) && res.data.tecnicos.length > 0) {
            setListaTecnicos(res.data.tecnicos);
          } else {
            axios.get(`${API_URL}/api/movilidad/tecnicos`).then((r) => {
              if (Array.isArray(r.data)) setListaTecnicos(r.data);
            });
          }
        })
        .catch(() => {
          axios.get(`${API_URL}/api/movilidad/tecnicos`).then((r) => {
            if (Array.isArray(r.data)) setListaTecnicos(r.data);
          });
        });
    }
  }, [tecnicos]);

  // 1. Estado para Despachos Generales
  const [despachos, setDespachos] = useState<DespachoHistorialItem[]>([]);
  const [kpis, setKpis] = useState<DespachoHistorialKPIs>({
    totalDespachos: 0,
    totalItemsEntregados: 0,
    totalSeriesEntregadas: 0,
    tecnicosUnicos: 0,
  });
  const [loading, setLoading] = useState(true);

  // 2. Estado para Historial & Control de Actas
  const [actasItems, setActasItems] = useState<any[]>([]);
  const [actasKpis, setActasKpis] = useState({
    totalTecnicos: 0,
    totalActasAsignadas: 0,
    totalDisponibles: 0,
    totalUsadas: 0,
    totalDevueltas: 0,
  });
  const [loadingActas, setLoadingActas] = useState(false);
  const [estadoActasFiltro, setEstadoActasFiltro] = useState<string>("todos");

  // Filtros Generales
  const [busqueda, setBusqueda] = useState("");
  const [tecnicoFiltro, setTecnicoFiltro] = useState<string>("todos");
  const [fechaPreset, setFechaPreset] = useState<"todos" | "hoy" | "ayer" | "semana" | "custom">("todos");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  // Modales
  const [despachoModal, setDespachoModal] = useState<DespachoHistorialItem | null>(null);
  const [seriesModal, setSeriesModal] = useState<{ open: boolean; titulo: string; series: string[] }>({
    open: false,
    titulo: "",
    series: [],
  });
  const [actasModal, setActasModal] = useState<{ open: boolean; tecnico: any | null }>({
    open: false,
    tecnico: null,
  });

  const printRef = useRef<HTMLDivElement>(null);

  // Cargar Despachos Generales
  const cargarHistorial = async () => {
    try {
      setLoading(true);
      const res = await getDespachosHistorial({
        fechaDesde: fechaDesde || undefined,
        fechaHasta: fechaHasta || undefined,
        id_trabajador: tecnicoFiltro !== "todos" ? tecnicoFiltro : undefined,
        busqueda: busqueda.trim() || undefined,
      });

      if (res && res.success) {
        setDespachos(res.despachos || []);
        if (res.kpis) setKpis(res.kpis);
      }
    } catch (error) {
      console.error("Error al cargar historial de despachos:", error);
    } finally {
      setLoading(false);
    }
  };

  // Cargar Historial de Actas Entregadas a Técnicos
  const cargarHistorialActas = async () => {
    try {
      setLoadingActas(true);
      const res = await getActasHistorial({
        fechaDesde: fechaDesde || undefined,
        fechaHasta: fechaHasta || undefined,
        id_trabajador: tecnicoFiltro !== "todos" ? tecnicoFiltro : undefined,
        busqueda: busqueda.trim() || undefined,
        estado: estadoActasFiltro !== "todos" ? estadoActasFiltro : undefined,
      });

      if (res && res.success) {
        setActasItems(res.items || []);
        if (res.kpis) setActasKpis(res.kpis);
      }
    } catch (error) {
      console.error("Error al cargar historial de actas:", error);
    } finally {
      setLoadingActas(false);
    }
  };

  useEffect(() => {
    if (vista === "despachos") {
      cargarHistorial();
    } else {
      cargarHistorialActas();
    }
  }, [vista, fechaDesde, fechaHasta, tecnicoFiltro, estadoActasFiltro]);

  // Presets de fecha
  const aplicarPreset = (preset: "todos" | "hoy" | "ayer" | "semana") => {
    setFechaPreset(preset);
    const now = new Date();
    const hoyStr = now.toISOString().slice(0, 10);

    if (preset === "todos") {
      setFechaDesde("");
      setFechaHasta("");
    } else if (preset === "hoy") {
      setFechaDesde(hoyStr);
      setFechaHasta(hoyStr);
    } else if (preset === "ayer") {
      const ayer = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const ayerStr = ayer.toISOString().slice(0, 10);
      setFechaDesde(ayerStr);
      setFechaHasta(ayerStr);
    } else if (preset === "semana") {
      const semana = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setFechaDesde(semana.toISOString().slice(0, 10));
      setFechaHasta(hoyStr);
    }
  };

  // Filtrado local por búsqueda para Despachos
  const despachosFiltrados = useMemo(() => {
    if (!busqueda.trim()) return despachos;
    const q = busqueda.toLowerCase().trim();
    return despachos.filter((d) => {
      const cod = (d.codigo_despacho || "").toLowerCase();
      const tec = (d.tecnico_nombre || "").toLowerCase();
      const dni = (d.tecnico_dni || "").toLowerCase();
      const cua = (d.cuadrilla || "").toLowerCase();
      const pla = (d.vehiculo_placa || "").toLowerCase();
      const obs = (d.observaciones || "").toLowerCase();
      const des = (d.despachador_nombre || "").toLowerCase();
      const mat = d.detalles?.some((det) =>
        (det.producto_nombre || "").toLowerCase().includes(q) ||
        (det.producto_codigo || "").toLowerCase().includes(q) ||
        det.series?.some((s) => s.toLowerCase().includes(q))
      );

      return cod.includes(q) || tec.includes(q) || dni.includes(q) || cua.includes(q) || pla.includes(q) || obs.includes(q) || des.includes(q) || mat;
    });
  }, [despachos, busqueda]);

  // Filtrado local para Actas
  const actasFiltradas = useMemo(() => {
    if (!busqueda.trim()) return actasItems;
    const q = busqueda.toLowerCase().trim();
    return actasItems.filter((i) => {
      const tec = (i.tecnico_nombre || "").toLowerCase();
      const dni = (i.tecnico_dni || "").toLowerCase();
      const cua = (i.cuadrilla || "").toLowerCase();
      const pla = (i.vehiculo_placa || "").toLowerCase();
      const ran = (i.rangos_texto || "").toLowerCase();
      const hasSer = i.series?.some((s: any) => (s.numero_serie || "").toLowerCase().includes(q));

      return tec.includes(q) || dni.includes(q) || cua.includes(q) || pla.includes(q) || ran.includes(q) || hasSer;
    });
  }, [actasItems, busqueda]);

  // Helper para imprimir acta
  const imprimirActa = () => {
    window.print();
  };

  // Formato de fecha y hora
  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return "-";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return (
        d.toLocaleDateString("es-PE", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }) +
        " " +
        d.toLocaleTimeString("es-PE", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* ─────────────────────────────────────────────────────────────
          SELECTOR DE VISTA PRINCIPAL (DESPACHOS GENERALES vs HISTORIAL DE ACTAS)
      ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-slate-200/90 shadow-xs">
        <div>
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <BookOpen size={18} className="text-cyan-600" />
            Trazabilidad & Auditoría de Almacén
          </h3>
          <p className="text-[11px] text-slate-500 font-medium">
            Consulta salidas de almacén por comprobante o el control histórico de talonarios de actas asignados a técnicos.
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200">
          <button
            type="button"
            onClick={() => setVista("despachos")}
            className={`px-4 py-2 rounded-xl font-bold text-xs inline-flex items-center gap-2 transition-all cursor-pointer ${
              vista === "despachos"
                ? "bg-white text-slate-900 shadow-2xs font-black"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Truck size={14} className={vista === "despachos" ? "text-cyan-600" : ""} />
            <span>📦 Despachos Generales</span>
          </button>

          <button
            type="button"
            onClick={() => setVista("actas")}
            className={`px-4 py-2 rounded-xl font-bold text-xs inline-flex items-center gap-2 transition-all cursor-pointer ${
              vista === "actas"
                ? "bg-white text-amber-950 shadow-2xs font-black"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <FileText size={14} className={vista === "actas" ? "text-amber-600" : ""} />
            <span>📋 Historial de Actas Entregadas</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          VISTA 1: DESPACHOS GENERALES (COMPROBANTES DSP-XXXX)
      ───────────────────────────────────────────────────────────── */}
      {vista === "despachos" && (
        <div className="space-y-6 animate-fade-in">
          
          {/* KPIS DE DESPACHOS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 bg-white rounded-3xl border border-slate-200/90 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Total Despachos
                </span>
                <span className="text-2xl font-black text-slate-900 font-mono block mt-1">
                  {kpis.totalDespachos}
                </span>
                <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                  Comprobantes registrados
                </span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0">
                <Truck size={22} />
              </div>
            </div>

            <div className="p-5 bg-white rounded-3xl border border-slate-200/90 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Insumos & Materiales
                </span>
                <span className="text-2xl font-black text-indigo-600 font-mono block mt-1">
                  {kpis.totalItemsEntregados.toLocaleString()}
                </span>
                <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                  Unidades entregadas
                </span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Package size={22} />
              </div>
            </div>

            <div className="p-5 bg-white rounded-3xl border border-slate-200/90 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Equipos & Actas
                </span>
                <span className="text-2xl font-black text-emerald-600 font-mono block mt-1">
                  {kpis.totalSeriesEntregadas.toLocaleString()}
                </span>
                <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                  Series y correlativos
                </span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Barcode size={22} />
              </div>
            </div>

            <div className="p-5 bg-white rounded-3xl border border-slate-200/90 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Técnicos Atendidos
                </span>
                <span className="text-2xl font-black text-amber-600 font-mono block mt-1">
                  {kpis.tecnicosUnicos}
                </span>
                <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                  Móviles abastecidas
                </span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Users size={22} />
              </div>
            </div>
          </div>

          {/* FILTROS DESPACHOS */}
          <div className="p-5 bg-white rounded-3xl border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => aplicarPreset("todos")}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                    fechaPreset === "todos" ? "bg-white text-slate-900 shadow-2xs font-extrabold" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => aplicarPreset("hoy")}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                    fechaPreset === "hoy" ? "bg-white text-slate-900 shadow-2xs font-extrabold" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Hoy
                </button>
                <button
                  type="button"
                  onClick={() => aplicarPreset("ayer")}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                    fechaPreset === "ayer" ? "bg-white text-slate-900 shadow-2xs font-extrabold" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Ayer
                </button>
                <button
                  type="button"
                  onClick={() => aplicarPreset("semana")}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                    fechaPreset === "semana" ? "bg-white text-slate-900 shadow-2xs font-extrabold" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Últimos 7 días
                </button>
              </div>

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

              <div className="flex items-center gap-2">
                {onNuevoDespacho && (
                  <button
                    type="button"
                    onClick={onNuevoDespacho}
                    className="px-4 py-2 rounded-2xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs inline-flex items-center gap-2 shadow-xs cursor-pointer"
                  >
                    <Truck size={14} />
                    <span>Nuevo Despacho</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={cargarHistorial}
                  disabled={loading}
                  className="p-2 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition-all cursor-pointer"
                  title="Refrescar historial"
                >
                  <RefreshCw size={15} className={loading ? "animate-spin text-cyan-600" : ""} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por Comprobante, Técnico, DNI, Cuadrilla, Placa o Serie..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-2xl border border-slate-300 text-xs font-medium text-slate-900 bg-slate-50/50 focus:bg-white focus:border-cyan-500 transition-all"
                />
              </div>

              <div>
                <select
                  value={tecnicoFiltro}
                  onChange={(e) => setTecnicoFiltro(e.target.value)}
                  className="w-full px-3 py-2 rounded-2xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white"
                >
                  <option value="todos">-- Todos los Técnicos ({listaTecnicos.length}) --</option>
                  {listaTecnicos.map((t) => {
                    const idVal = String(t.id_trabajador || t.id_tecnico || t.id_usuario);
                    const name = t.nombre_completo || t.tecnico || `${t.nombres || ""} ${t.apellidos || ""}`.trim();
                    const placa = t.vehiculo_placa || t.placa;
                    return (
                      <option key={idVal} value={idVal}>
                        {t.cuadrilla ? `${t.cuadrilla} - ` : ""}{name} {placa ? `(${placa})` : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          </div>

          {/* TABLA DE DESPACHOS */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-cyan-600" />
                <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                  Auditoría Oficial de Despachos ({despachosFiltrados.length})
                </h4>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                Trazabilidad con fecha y hora exacta ante reclamos
              </span>
            </div>

            {loading ? (
              <div className="py-20 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
                <RefreshCw size={24} className="animate-spin text-cyan-600" />
                <span>Cargando historial oficial de despachos...</span>
              </div>
            ) : despachosFiltrados.length === 0 ? (
              <div className="py-20 text-center text-xs text-slate-400 space-y-2">
                <Truck size={32} className="mx-auto text-slate-300" />
                <p className="font-semibold text-slate-600">No se encontraron despachos con los filtros seleccionados.</p>
                <p className="text-[11px] text-slate-400">Intenta cambiar el rango de fechas o el técnico seleccionado.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-extrabold uppercase text-[10px] tracking-wider bg-slate-50/50">
                      <th className="py-3 px-4">Comprobante / N°</th>
                      <th className="py-3 px-4">Fecha & Hora Entrega</th>
                      <th className="py-3 px-4">Técnico Receptor & Cuadrilla</th>
                      <th className="py-3 px-4">Materiales / Insumos</th>
                      <th className="py-3 px-4 text-center">Talonarios / Actas</th>
                      <th className="py-3 px-4 text-center">Equipos ONT / Mesh</th>
                      <th className="py-3 px-4">Despachado Por</th>
                      <th className="py-3 px-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {despachosFiltrados.map((d) => {
                      const insumos = d.detalles?.filter((det) => {
                        const esAct = (det.producto_nombre || "").toUpperCase().includes("ACTA") || (det.categoria || "").toUpperCase().includes("ACTA");
                        return (!det.series || det.series.length === 0) && !esAct;
                      }) || [];

                      const actasDetalles = d.detalles?.filter((det) => {
                        const esAct = (det.producto_nombre || "").toUpperCase().includes("ACTA") || (det.categoria || "").toUpperCase().includes("ACTA");
                        const seriesAct = det.series?.some(s => s.includes("-") && !s.startsWith("48575443") && !s.startsWith("ZTE"));
                        return esAct || seriesAct;
                      }) || [];

                      const equiposDetalles = d.detalles?.filter((det) => {
                        const esAct = (det.producto_nombre || "").toUpperCase().includes("ACTA") || (det.categoria || "").toUpperCase().includes("ACTA");
                        return det.series && det.series.length > 0 && !esAct;
                      }) || [];

                      const totalActasDespacho = actasDetalles.reduce((acc, det) => acc + (det.series?.length || det.cantidad || 0), 0);
                      const totalEquiposDespacho = equiposDetalles.reduce((acc, det) => acc + (det.series?.length || 0), 0);

                      return (
                        <tr key={d.id_despacho} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4">
                            <span className="font-mono font-bold text-slate-900 block">
                              {d.codigo_despacho}
                            </span>
                            <span className="text-[10px] font-semibold text-cyan-700 bg-cyan-50 px-1.5 py-0.5 rounded border border-cyan-200 inline-block mt-0.5">
                              {d.tipo_despacho || "DOTACIÓN"}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 text-slate-800 font-mono text-[11px] font-bold border border-slate-200">
                              <Clock size={12} className="text-cyan-600 shrink-0" />
                              <span>{formatDateTime(d.fecha_despacho || d.fecha_creacion)}</span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="font-bold text-slate-900 block truncate max-w-[180px]" title={d.tecnico_nombre}>
                              {d.tecnico_nombre}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[11px]">
                              {d.cuadrilla && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[10px] border border-slate-200 truncate max-w-[120px]">
                                  {d.cuadrilla}
                                </span>
                              )}
                              <span className="text-cyan-700 font-mono font-bold text-[10px]">
                                {d.vehiculo_placa || "Sin Placa"}
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            {insumos.length === 0 ? (
                              <span className="text-slate-400 text-[11px] italic">Sin insumos adicionales</span>
                            ) : (
                              <div className="space-y-0.5 max-w-[220px]">
                                {insumos.slice(0, 3).map((ins, iIdx) => (
                                  <div key={iIdx} className="text-[11px] text-slate-700 truncate">
                                    <strong className="font-mono text-slate-900">{ins.cantidad}x</strong> {ins.producto_nombre}
                                  </div>
                                ))}
                                {insumos.length > 3 && (
                                  <span className="text-[10px] text-slate-400 font-semibold">
                                    + {insumos.length - 3} materiales más...
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Talonario / Actas Asignadas */}
                          <td className="py-3.5 px-4 text-center">
                            {totalActasDespacho > 0 ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const allActas: string[] = [];
                                  actasDetalles.forEach((aDet) => {
                                    if (aDet.series && aDet.series.length > 0) {
                                      aDet.series.forEach((s: string) => allActas.push(`Acta: ${s}`));
                                    } else {
                                      allActas.push(`Actas registradas: ${aDet.cantidad} und`);
                                    }
                                  });
                                  setSeriesModal({
                                    open: true,
                                    titulo: `Talonario de Actas (${totalActasDespacho} und) - ${d.tecnico_nombre}`,
                                    series: allActas,
                                  });
                                }}
                                className="px-2.5 py-1 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 font-mono font-bold text-[11px] border border-amber-300 inline-flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
                              >
                                <FileText size={12} className="text-amber-600" />
                                <span>{totalActasDespacho} actas</span>
                              </button>
                            ) : (
                              <span className="text-slate-300 text-[11px]">—</span>
                            )}
                          </td>

                          {/* Equipos Serializados (ONT / Mesh) */}
                          <td className="py-3.5 px-4 text-center">
                            {totalEquiposDespacho > 0 ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const allS: string[] = [];
                                  equiposDetalles.forEach((sDet) => {
                                    sDet.series.forEach((s: string) => allS.push(`${sDet.producto_nombre}: ${s}`));
                                  });
                                  setSeriesModal({
                                    open: true,
                                    titulo: `Equipos ONT / Mesh (${totalEquiposDespacho}) - ${d.tecnico_nombre}`,
                                    series: allS,
                                  });
                                }}
                                className="px-2.5 py-1 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 font-mono font-bold text-[11px] border border-purple-200 inline-flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
                              >
                                <Barcode size={12} className="text-purple-600" />
                                <span>{totalEquiposDespacho} equipos</span>
                              </button>
                            ) : (
                              <span className="text-slate-300 text-[11px]">—</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="text-slate-700 font-medium text-[11px] block">
                              {d.despachador_nombre || "Almacén Central"}
                            </span>
                            {d.observaciones && (
                              <span className="text-[10px] text-slate-400 block truncate max-w-[140px]" title={d.observaciones}>
                                {d.observaciones}
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setDespachoModal(d)}
                                className="p-1.5 rounded-xl border border-slate-200 hover:bg-cyan-50 hover:text-cyan-700 text-slate-600 transition-colors cursor-pointer"
                                title="Ver Acta y Detalle Completo"
                              >
                                <Eye size={14} />
                              </button>
                            </div>
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
      )}

      {/* ─────────────────────────────────────────────────────────────
          VISTA 2: CONTROL & HISTORIAL DE ACTAS ENTREGADAS A TÉCNICOS
      ───────────────────────────────────────────────────────────── */}
      {vista === "actas" && (
        <div className="space-y-6 animate-fade-in">
          
          {/* KPIS DE ACTAS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 bg-white rounded-3xl border border-slate-200/90 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Total Actas Asignadas
                </span>
                <span className="text-2xl font-black text-slate-900 font-mono block mt-1">
                  {actasKpis.totalActasAsignadas.toLocaleString()}
                </span>
                <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                  En {actasKpis.totalTecnicos} técnicos de flota
                </span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <FileText size={22} />
              </div>
            </div>

            <div className="p-5 bg-white rounded-3xl border border-slate-200/90 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Disponibles en Móvil
                </span>
                <span className="text-2xl font-black text-emerald-600 font-mono block mt-1">
                  {actasKpis.totalDisponibles.toLocaleString()}
                </span>
                <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                  Listas para liquidar
                </span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 size={22} />
              </div>
            </div>

            <div className="p-5 bg-white rounded-3xl border border-slate-200/90 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Usadas / Liquidadas
                </span>
                <span className="text-2xl font-black text-blue-600 font-mono block mt-1">
                  {actasKpis.totalUsadas.toLocaleString()}
                </span>
                <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                  En órdenes concluidas
                </span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <CheckSquare size={22} />
              </div>
            </div>

            <div className="p-5 bg-white rounded-3xl border border-slate-200/90 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Devueltas a Almacén
                </span>
                <span className="text-2xl font-black text-amber-700 font-mono block mt-1">
                  {actasKpis.totalDevueltas.toLocaleString()}
                </span>
                <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                  Disponibles para 2do Uso
                </span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-100/70 text-amber-800 flex items-center justify-center shrink-0">
                <Sparkles size={22} />
              </div>
            </div>
          </div>

          {/* FILTROS DE CONTROL DE ACTAS */}
          <div className="p-5 bg-white rounded-3xl border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Filtro por estado de las actas */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setEstadoActasFiltro("todos")}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                    estadoActasFiltro === "todos" ? "bg-white text-slate-900 shadow-2xs font-extrabold" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Todas las Asignaciones
                </button>
                <button
                  type="button"
                  onClick={() => setEstadoActasFiltro("con_stock")}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                    estadoActasFiltro === "con_stock" ? "bg-white text-emerald-800 shadow-2xs font-extrabold" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  🟢 Con Actas en Auto
                </button>
                <button
                  type="button"
                  onClick={() => setEstadoActasFiltro("usadas")}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                    estadoActasFiltro === "usadas" ? "bg-white text-blue-800 shadow-2xs font-extrabold" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  🔵 Con Actas Liquidadas
                </button>
                <button
                  type="button"
                  onClick={() => setEstadoActasFiltro("devueltas")}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                    estadoActasFiltro === "devueltas" ? "bg-white text-amber-900 shadow-2xs font-extrabold" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  🟠 Con Actas Devueltas
                </button>
              </div>

              <div className="flex items-center gap-2">
                {onNuevoDespacho && (
                  <button
                    type="button"
                    onClick={onNuevoDespacho}
                    className="px-4 py-2 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs inline-flex items-center gap-2 shadow-xs cursor-pointer"
                  >
                    <FileText size={14} />
                    <span>Asignar Actas a Técnico</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={cargarHistorialActas}
                  disabled={loadingActas}
                  className="p-2 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition-all cursor-pointer"
                  title="Refrescar actas"
                >
                  <RefreshCw size={15} className={loadingActas ? "animate-spin text-amber-600" : ""} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por Técnico, DNI, Cuadrilla, Placa o Rango Correlativo..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-2xl border border-slate-300 text-xs font-medium text-slate-900 bg-slate-50/50 focus:bg-white focus:border-amber-500 transition-all"
                />
              </div>

              <div>
                <select
                  value={tecnicoFiltro}
                  onChange={(e) => setTecnicoFiltro(e.target.value)}
                  className="w-full px-3 py-2 rounded-2xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white"
                >
                  <option value="todos">-- Todos los Técnicos ({listaTecnicos.length}) --</option>
                  {listaTecnicos.map((t) => {
                    const idVal = String(t.id_trabajador || t.id_tecnico || t.id_usuario);
                    const name = t.nombre_completo || t.tecnico || `${t.nombres || ""} ${t.apellidos || ""}`.trim();
                    const placa = t.vehiculo_placa || t.placa;
                    return (
                      <option key={idVal} value={idVal}>
                        {t.cuadrilla ? `${t.cuadrilla} - ` : ""}{name} {placa ? `(${placa})` : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          </div>

          {/* TABLA DE HISTORIAL DE ACTAS */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="p-4 bg-amber-50/70 border-b border-amber-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-amber-700" />
                <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                  Control & Asignación de Talonarios de Actas ({actasFiltradas.length} Técnicos)
                </h4>
              </div>
              <span className="text-[11px] text-amber-900 font-semibold">
                Registro oficial de correlativos entregados a cada cuadrilla
              </span>
            </div>

            {loadingActas ? (
              <div className="py-20 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
                <RefreshCw size={24} className="animate-spin text-amber-600" />
                <span>Cargando historial de actas entregadas...</span>
              </div>
            ) : actasFiltradas.length === 0 ? (
              <div className="py-20 text-center text-xs text-slate-400 space-y-2">
                <FileText size={32} className="mx-auto text-amber-300" />
                <p className="font-semibold text-slate-600">No se encontraron registros de actas con los filtros seleccionados.</p>
                <p className="text-[11px] text-slate-400">Selecciona otro técnico o cambia el estado del filtro.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-amber-200/70 text-slate-500 font-extrabold uppercase text-[10px] tracking-wider bg-amber-50/30">
                      <th className="py-3 px-4">Técnico Receptor & Cuadrilla</th>
                      <th className="py-3 px-4">Fecha Asignación</th>
                      <th className="py-3 px-4">Rangos de Actas Entregados</th>
                      <th className="py-3 px-4 text-center">Total Asignadas</th>
                      <th className="py-3 px-4 text-center">En Auto (Disp.)</th>
                      <th className="py-3 px-4 text-center">Usadas (Liquid.)</th>
                      <th className="py-3 px-4 text-center">Devueltas</th>
                      <th className="py-3 px-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {actasFiltradas.map((item) => (
                      <tr key={item.id_trabajador} className="hover:bg-amber-50/40 transition-colors">
                        
                        {/* Técnico Receptor */}
                        <td className="py-3.5 px-4">
                          <span className="font-extrabold text-slate-900 block truncate max-w-[200px]" title={item.tecnico_nombre}>
                            {item.tecnico_nombre}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[11px]">
                            {item.cuadrilla && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[10px] border border-slate-200">
                                {item.cuadrilla}
                              </span>
                            )}
                            <span className="text-cyan-700 font-mono font-bold text-[10px]">
                              {item.vehiculo_placa || "Sin Placa"}
                            </span>
                          </div>
                        </td>

                        {/* Fecha Asignación */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 text-slate-800 font-mono text-[11px] font-bold border border-slate-200">
                            <Clock size={12} className="text-amber-600 shrink-0" />
                            <span>{formatDateTime(item.fecha_asignacion)}</span>
                          </div>
                        </td>

                        {/* Rangos Correlativos */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1 max-w-[320px]">
                            {item.rangos?.map((rango: string, rIdx: number) => (
                              <span
                                key={rIdx}
                                className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-950 font-mono font-bold text-[10px] border border-amber-300/80 shadow-2xs"
                              >
                                {rango}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Total Asignadas */}
                        <td className="py-3.5 px-4 text-center font-mono font-black text-slate-900 text-sm">
                          {item.total_actas}
                        </td>

                        {/* En Auto / Disponibles */}
                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl font-mono font-black text-xs border ${
                            item.disponibles_carro > 0
                              ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                              : "bg-slate-100 text-slate-400 border-slate-200"
                          }`}>
                            {item.disponibles_carro} und
                          </span>
                        </td>

                        {/* Usadas / Liquidadas */}
                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl font-mono font-black text-xs border ${
                            item.usadas_liquidaciones > 0
                              ? "bg-blue-50 text-blue-800 border-blue-300"
                              : "bg-slate-100 text-slate-400 border-slate-200"
                          }`}>
                            {item.usadas_liquidaciones} und
                          </span>
                        </td>

                        {/* Devueltas a Almacén */}
                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl font-mono font-black text-xs border ${
                            item.devueltas_almacen > 0
                              ? "bg-amber-100 text-amber-900 border-amber-300"
                              : "bg-slate-100 text-slate-400 border-slate-200"
                          }`}>
                            {item.devueltas_almacen} und
                          </span>
                        </td>

                        {/* Acciones */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => setActasModal({ open: true, tecnico: item })}
                            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-xs cursor-pointer transition-all hover:scale-[1.02]"
                            title="Ver desglose completo de números de actas"
                          >
                            <Eye size={13} />
                            <span>Ver Series</span>
                          </button>
                        </td>

                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: DETALLE & ACTA OFICIAL DE ENTREGA DE DESPACHO
      ───────────────────────────────────────────────────────────── */}
      {despachoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]">
            
            <div className="bg-gradient-to-r from-slate-900 via-cyan-950 to-slate-900 text-white p-5 flex items-center justify-between shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-cyan-500/30 border border-cyan-400/40 text-[11px] font-bold font-mono">
                    {despachoModal.codigo_despacho}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md bg-white/10 text-[11px] font-semibold">
                    {despachoModal.tipo_despacho || "DOTACIÓN"}
                  </span>
                </div>
                <h3 className="text-base font-black tracking-tight text-white">
                  Acta Oficial de Despacho y Entrega a Personal
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={imprimirActa}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="Imprimir Acta Oficial"
                >
                  <Printer size={14} />
                  <span>Imprimir</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDespachoModal(null)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div ref={printRef} className="p-6 overflow-y-auto space-y-5 text-xs">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">Técnico Receptor</span>
                  <span className="font-extrabold text-slate-900 text-xs block mt-0.5">{despachoModal.tecnico_nombre}</span>
                  <span className="text-slate-600 font-mono text-[11px] block mt-0.5">
                    DNI: {despachoModal.tecnico_dni || "No registrado"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">Cuadrilla & Vehículo</span>
                  <span className="font-bold text-slate-800 text-xs block mt-0.5">{despachoModal.cuadrilla || "Sin Cuadrilla"}</span>
                  <span className="text-cyan-700 font-mono font-bold text-[11px] block mt-0.5">
                    Placa: {despachoModal.vehiculo_placa || "Sin Placa"}
                  </span>
                </div>

                <div className="sm:col-span-2 pt-2 border-t border-slate-200/60 flex flex-wrap items-center justify-between text-[11px] text-slate-600 font-mono gap-2">
                  <span>
                    ⏱️ Fecha y Hora de Entrega: <strong className="text-slate-900">{formatDateTime(despachoModal.fecha_despacho)}</strong>
                  </span>
                  <span>
                    👤 Despachado por: <strong className="text-slate-900">{despachoModal.despachador_nombre || "Almacén Central"}</strong>
                  </span>
                </div>
              </div>

              {despachoModal.observaciones && (
                <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl text-[11px] text-amber-900">
                  <span className="font-bold block">Observaciones / Motivo:</span>
                  <p className="mt-0.5">{despachoModal.observaciones}</p>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
                    Detalle de Productos Entregados ({despachoModal.detalles?.length || 0})
                  </span>
                  <span className="font-mono font-bold text-xs text-slate-500">
                    Total: {despachoModal.total_items} unidades
                  </span>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">Producto / Insumo</th>
                        <th className="py-2.5 px-3">Categoría</th>
                        <th className="py-2.5 px-3 text-center">Cantidad</th>
                        <th className="py-2.5 px-3">Series Asignadas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {despachoModal.detalles?.map((det, dIdx) => (
                        <tr key={dIdx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-semibold text-slate-900">
                            {det.producto_nombre}
                            {det.producto_codigo && (
                              <span className="text-[10px] font-mono text-slate-400 block font-normal">
                                {det.producto_codigo}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                            {det.categoria || "General"}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-extrabold text-slate-900">
                            {det.cantidad} {det.es_drop ? "m" : "und"}
                          </td>
                          <td className="py-2.5 px-3 text-[11px]">
                            {det.series && det.series.length > 0 ? (
                              <div className="flex flex-wrap gap-1 max-w-[280px]">
                                {det.series.map((s, sIdx) => (
                                  <span
                                    key={sIdx}
                                    className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 font-mono font-bold text-[10px] border border-emerald-200"
                                  >
                                    {s}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400 font-mono">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-200 text-center">
                <div className="space-y-1">
                  <div className="border-b border-slate-400 h-14 mx-auto w-4/5" />
                  <span className="font-extrabold text-slate-900 block text-[11px]">
                    {despachoModal.tecnico_nombre}
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    Firma Técnico Receptor (DNI: {despachoModal.tecnico_dni || "—"})
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="border-b border-slate-400 h-14 mx-auto w-4/5" />
                  <span className="font-extrabold text-slate-900 block text-[11px]">
                    {despachoModal.despachador_nombre || "Responsable Almacén"}
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    Firma & Sello Despacho Almacén
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-500 font-medium">
                Comprobante legal de asignación de dotación.
              </span>
              <button
                type="button"
                onClick={() => setDespachoModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs cursor-pointer transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: DESGLOSE COMPLETO DE ACTAS POR TÉCNICO
      ───────────────────────────────────────────────────────────── */}
      {actasModal.open && actasModal.tecnico && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 bg-gradient-to-r from-amber-950 via-amber-900 to-amber-950 text-white flex items-center justify-between">
              <div>
                <span className="font-black text-sm flex items-center gap-2">
                  <FileText size={17} className="text-amber-400" />
                  Control de Series de Actas: {actasModal.tecnico.tecnico_nombre}
                </span>
                <span className="text-[11px] text-amber-200 font-medium block">
                  {actasModal.tecnico.cuadrilla} • Placa: {actasModal.tecnico.vehiculo_placa}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActasModal({ open: false, tecnico: null })}
                className="text-amber-200 hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Resumen Superior */}
            <div className="p-4 bg-amber-50/50 border-b border-amber-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700">Total: <strong>{actasModal.tecnico.total_actas}</strong></span>
                <span>•</span>
                <span className="font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                  🟢 Disponibles: {actasModal.tecnico.disponibles_carro}
                </span>
                <span className="font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                  🔵 Usadas: {actasModal.tecnico.usadas_liquidaciones}
                </span>
                <span className="font-bold text-amber-800 bg-amber-200 px-2 py-0.5 rounded">
                  🟠 Devueltas: {actasModal.tecnico.devueltas_almacen}
                </span>
              </div>
            </div>

            {/* Lista de Series de Actas */}
            <div className="p-4 overflow-y-auto space-y-2 text-xs flex-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {actasModal.tecnico.series?.map((s: any, idx: number) => {
                  const esDisp = s.estado === "Asignada";
                  const esUsada = s.estado === "Usada" || s.estado === "Liquidada";
                  const esDev = s.estado === "Devuelta";

                  return (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-xl border flex items-center justify-between font-mono text-xs font-bold ${
                        esDisp
                          ? "bg-emerald-50/60 border-emerald-300 text-emerald-950"
                          : esUsada
                          ? "bg-blue-50/60 border-blue-300 text-blue-950"
                          : "bg-amber-50/60 border-amber-300 text-amber-950"
                      }`}
                    >
                      <span>{s.numero_serie}</span>
                      <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                        esDisp
                          ? "bg-emerald-200 text-emerald-900"
                          : esUsada
                          ? "bg-blue-200 text-blue-900"
                          : "bg-amber-200 text-amber-900"
                      }`}>
                        {esDisp ? "En Auto" : esUsada ? "Liquidada" : "Devuelta"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 text-right">
              <button
                type="button"
                onClick={() => setActasModal({ open: false, tecnico: null })}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RÁPIDO PARA VER SERIES */}
      {seriesModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-2xs animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <span className="font-bold text-xs flex items-center gap-1.5">
                <Barcode size={15} className="text-emerald-400" />
                {seriesModal.titulo}
              </span>
              <button
                type="button"
                onClick={() => setSeriesModal({ open: false, titulo: "", series: [] })}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-1 text-xs">
              {seriesModal.series.map((s, idx) => (
                <div key={idx} className="p-2 rounded-xl bg-slate-50 font-mono text-[11px] text-slate-800 border border-slate-200 flex items-center justify-between">
                  <span>{s}</span>
                  <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                </div>
              ))}
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-200 text-right">
              <button
                type="button"
                onClick={() => setSeriesModal({ open: false, titulo: "", series: [] })}
                className="px-3 py-1.5 rounded-xl bg-slate-900 text-white font-bold text-xs cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
