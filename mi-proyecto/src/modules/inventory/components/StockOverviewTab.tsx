import React, { useState, useEffect } from "react";
import {
  Package,
  Layers,
  Search,
  Truck,
  AlertTriangle,
  CheckCircle2,
  QrCode,
  ArrowDownRight,
  TrendingDown,
  Building2,
  Send,
  Wrench,
  Shirt,
  Car,
  Boxes,
  FileText,
  Eye,
  X,
  Sparkles,
  ClipboardList,
  Check,
  Clock,
  Calendar,
  Copy,
  RefreshCw,
} from "lucide-react";
import {
  ProductoStock,
  StockTecnicoDetalle,
  SerieTecnicoDetalle,
  ActaTecnicoResumen,
  ProductoSeriesResumen,
} from "../types/inventoryTypes";
import { QuickDispatchModal } from "./QuickDispatchModal";
import { getActasTecnicos, getProductoSeries, actualizarEstadoSerie } from "../services/inventoryService";

interface Props {
  productos: ProductoStock[];
  stockPorTecnico: StockTecnicoDetalle[];
  seriesTecnicos: SerieTecnicoDetalle[];
  loading: boolean;
  onRefresh?: () => void;
}

export const StockOverviewTab: React.FC<Props> = ({
  productos,
  stockPorTecnico,
  seriesTecnicos,
  loading,
  onRefresh,
}) => {
  const [subTab, setSubTab] = useState<"central" | "tecnicos" | "actas">("central");
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("Todas");
  const [tecnicoSeleccionado, setTecnicoSeleccionado] = useState<string>("Todos");

  // Auditoría de Actas por Técnico
  const [actasTecnicos, setActasTecnicos] = useState<ActaTecnicoResumen[]>([]);
  const [cargandoActas, setCargandoActas] = useState(false);
  const [modalDetalleActas, setModalDetalleActas] = useState<{
    isOpen: boolean;
    tecnico: ActaTecnicoResumen | null;
  }>({
    isOpen: false,
    tecnico: null,
  });

  // Modal de Despacho Rápido
  const [modalDespacho, setModalDespacho] = useState<{
    isOpen: boolean;
    producto: ProductoStock | null;
  }>({
    isOpen: false,
    producto: null,
  });

  // Modal de Auditoría de Series Individuales de un Equipo
  const [modalSeries, setModalSeries] = useState<{
    isOpen: boolean;
    producto: ProductoStock | null;
  }>({
    isOpen: false,
    producto: null,
  });
  const [detalleSeries, setDetalleSeries] = useState<any | null>(null);
  const [cargandoSeries, setCargandoSeries] = useState(false);
  const [filtroSerieTexto, setFiltroSerieTexto] = useState("");
  const [filtroSerieTab, setFiltroSerieTab] = useState<"todas" | "almacen" | "tecnicos" | "defectuosos">("todas");
  const [copiadoSerie, setCopiadoSerie] = useState<string | null>(null);
  const [serieEditandoEstado, setSerieEditandoEstado] = useState<number | null>(null);
  const [modoVistaSeries, setModoVistaSeries] = useState<"cards" | "table">("table");
  const [filtroTecnicoModal, setFiltroTecnicoModal] = useState<string>("todos");
  const [filtroFechaDesde, setFiltroFechaDesde] = useState<string>("");
  const [filtroFechaHasta, setFiltroFechaHasta] = useState<string>("");

  // Filtros de fecha para la pestaña de Stock en Camionetas (Móviles)
  const [filtroFechaMovilDesde, setFiltroFechaMovilDesde] = useState<string>("");
  const [filtroFechaMovilHasta, setFiltroFechaMovilHasta] = useState<string>("");

  // Modal de Series de Equipos asignadas a un Técnico específico
  const [modalSeriesTecnico, setModalSeriesTecnico] = useState<{
    isOpen: boolean;
    item: StockTecnicoDetalle | null;
  }>({
    isOpen: false,
    item: null,
  });
  const [filtroSerieTecnicoTexto, setFiltroSerieTecnicoTexto] = useState("");

  const abrirModalSeries = (prod: ProductoStock) => {
    setModalSeries({ isOpen: true, producto: prod });
    setCargandoSeries(true);
    setFiltroSerieTexto("");
    setFiltroSerieTab("todas");
    setFiltroTecnicoModal("todos");
    setFiltroFechaDesde("");
    setFiltroFechaHasta("");
    setSerieEditandoEstado(null);
    getProductoSeries(prod.id_producto)
      .then((data) => setDetalleSeries(data))
      .catch(console.error)
      .finally(() => setCargandoSeries(false));
  };

  const copiarSerie = (serie: string) => {
    navigator.clipboard.writeText(serie);
    setCopiadoSerie(serie);
    setTimeout(() => setCopiadoSerie(null), 2000);
  };

  const handleCambiarEstadoSerie = async (idSerie: number, nuevoEstado: string) => {
    try {
      await actualizarEstadoSerie(idSerie, nuevoEstado);
      if (modalSeries.producto) {
        const data = await getProductoSeries(modalSeries.producto.id_producto);
        setDetalleSeries(data);
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      console.error("Error al actualizar estado de la serie:", err);
    }
  };

  const categoriasOficiales = [
    "Todas",
    "EQUIPOS",
    "MATERIALES",
    "HERRAMIENTAS",
    "UNIFORMES",
    "VEHICULO",
    "ACTAS / GUÍAS",
  ];
  const tecnicosUnicos = Array.from(new Set(stockPorTecnico.map((s) => s.tecnico_nombre)));

  const cargarActas = () => {
    setCargandoActas(true);
    getActasTecnicos()
      .then((data) => setActasTecnicos(data || []))
      .catch(console.error)
      .finally(() => setCargandoActas(false));
  };

  useEffect(() => {
    cargarActas();
  }, []);

  const esCatActa = (cat: string) => {
    const c = (cat || "").toUpperCase();
    return c.includes("TALONARIO") || c.includes("ACTA") || c.includes("GUIA");
  };

  const productosFiltrados = productos.filter((p) => {
    const txt = filtroTexto.toLowerCase();
    const matchTxt = !txt || p.nombre.toLowerCase().includes(txt) || p.codigo.toLowerCase().includes(txt);
    const matchCat =
      filtroCategoria === "Todas" ||
      (filtroCategoria === "ACTAS / GUÍAS"
        ? esCatActa(p.categoria) || p.nombre.toUpperCase().includes("ACTA") || p.nombre.toUpperCase().includes("GUIA")
        : p.categoria && p.categoria.toUpperCase() === filtroCategoria.toUpperCase());
    return matchTxt && matchCat;
  });

  const stockTecnicosFiltrado = stockPorTecnico.filter((st) => {
    const txt = filtroTexto.toLowerCase();
    const matchTxt =
      !txt ||
      st.producto_nombre.toLowerCase().includes(txt) ||
      st.tecnico_nombre.toLowerCase().includes(txt) ||
      st.cuadrilla.toLowerCase().includes(txt);
    const matchTec = tecnicoSeleccionado === "Todos" || st.tecnico_nombre === tecnicoSeleccionado;
    const matchCat =
      filtroCategoria === "Todas" ||
      (filtroCategoria === "ACTAS / GUÍAS"
        ? esCatActa(st.categoria) || st.producto_nombre.toUpperCase().includes("ACTA") || st.producto_nombre.toUpperCase().includes("GUIA")
        : st.categoria && st.categoria.toUpperCase() === filtroCategoria.toUpperCase());
    const matchFechaDesde = !filtroFechaMovilDesde || (st.fecha_entrega && st.fecha_entrega.slice(0, 10) >= filtroFechaMovilDesde);
    const matchFechaHasta = !filtroFechaMovilHasta || (st.fecha_entrega && st.fecha_entrega.slice(0, 10) <= filtroFechaMovilHasta);
    return matchTxt && matchTec && matchCat && matchFechaDesde && matchFechaHasta;
  });

  const actasTecnicosFiltrados = actasTecnicos.filter((at) => {
    const txt = filtroTexto.toLowerCase();
    const matchTxt =
      !txt ||
      at.tecnico_nombre.toLowerCase().includes(txt) ||
      at.cuadrilla.toLowerCase().includes(txt) ||
      at.vehiculo_placa.toLowerCase().includes(txt) ||
      at.rangos.some((r) => r.toLowerCase().includes(txt)) ||
      at.actas.some((a) => a.numero_serie.toLowerCase().includes(txt) || (a.orden_numero && a.orden_numero.toLowerCase().includes(txt)));
    const matchTec = tecnicoSeleccionado === "Todos" || at.tecnico_nombre === tecnicoSeleccionado;
    return matchTxt && matchTec;
  });

  // Helper para saber si un producto es Drop (Metraje)
  const esProductoDrop = (p: any) => {
    const nom = (p.nombre || p.producto_nombre || "").toUpperCase();
    const cod = (p.codigo || "").toUpperCase();
    const uni = (p.unidad || "").toUpperCase();
    return Boolean(p.es_drop) || nom.includes("CABLE DROP") || nom.includes("DROP") || cod.includes("DROP") || uni === "MTR" || uni === "METRO";
  };

  // Helper para normalizar grupo de categoría
  const getCatGrupo = (catRaw?: string) => {
    const c = (catRaw || "").toUpperCase().trim();
    if (c.includes("EQUIPO")) return "EQUIPOS";
    if (c.includes("HERRAMIENTA")) return "HERRAMIENTAS";
    if (c.includes("UNIFORME") || c.includes("EPP")) return "UNIFORMES";
    if (c.includes("VEHICULO")) return "VEHICULO";
    if (c.includes("ACTA") || c.includes("GUIA") || c.includes("TALONARIO")) return "ACTAS";
    return "MATERIALES";
  };

  // 1. Métricas Desglosadas Almacén Central
  const dropCentralMetros = productos
    .filter((p) => esProductoDrop(p))
    .reduce((acc, p) => acc + Number(p.stock_central || 0), 0);

  const materialesCentralUnd = productos
    .filter((p) => getCatGrupo(p.categoria) === "MATERIALES" && !esProductoDrop(p))
    .reduce((acc, p) => acc + Number(p.stock_central || 0), 0);

  const equiposCentralUnd = productos
    .filter((p) => getCatGrupo(p.categoria) === "EQUIPOS")
    .reduce((acc, p) => acc + Number(p.stock_central || 0), 0);

  const herramientasCentralUnd = productos
    .filter((p) => getCatGrupo(p.categoria) === "HERRAMIENTAS")
    .reduce((acc, p) => acc + Number(p.stock_central || 0), 0);

  const uniformesCentralUnd = productos
    .filter((p) => getCatGrupo(p.categoria) === "UNIFORMES")
    .reduce((acc, p) => acc + Number(p.stock_central || 0), 0);

  const totalUnidadesFisicasCentral =
    materialesCentralUnd + equiposCentralUnd + herramientasCentralUnd + uniformesCentralUnd;

  // 2. Métricas Desglosadas Móviles / Técnicos
  const dropEnCarrosMetros = productos
    .filter((p) => esProductoDrop(p))
    .reduce((acc, p) => acc + Number(p.stock_en_tecnicos || 0), 0);

  const materialesEnCarrosUnd = productos
    .filter((p) => getCatGrupo(p.categoria) === "MATERIALES" && !esProductoDrop(p))
    .reduce((acc, p) => acc + Number(p.stock_en_tecnicos || 0), 0);

  const equiposEnCarrosUnd = productos
    .filter((p) => getCatGrupo(p.categoria) === "EQUIPOS")
    .reduce((acc, p) => acc + Number(p.stock_en_tecnicos || 0), 0);

  const herramientasEnCarrosUnd = productos
    .filter((p) => getCatGrupo(p.categoria) === "HERRAMIENTAS")
    .reduce((acc, p) => acc + Number(p.stock_en_tecnicos || 0), 0);

  const totalUnidadesFisicasEnCarros =
    materialesEnCarrosUnd + equiposEnCarrosUnd + herramientasEnCarrosUnd;

  const alertasBajoStock = productos.filter((p) => Number(p.stock_central) <= Number(p.stock_minimo)).length;
  const totalActasAsignadasFromStock = productos
    .filter((p) => esCatActa(p.categoria) || p.nombre.toUpperCase().includes("ACTA") || p.nombre.toUpperCase().includes("GUIA"))
    .reduce((acc, p) => acc + Number(p.stock_en_tecnicos || 0), 0);

  const totalActasAsignadasGlobal = actasTecnicos.length > 0
    ? actasTecnicos.reduce((acc, a) => acc + Number(a.total_asignadas || 0), 0)
    : totalActasAsignadasFromStock;

  const totalActasLiquidadasGlobal = actasTecnicos.reduce((acc, a) => acc + Number(a.total_usadas || 0), 0);
  const totalActasDisponiblesGlobal = actasTecnicos.length > 0
    ? actasTecnicos.reduce((acc, a) => acc + Number(a.total_disponibles || 0), 0)
    : Math.max(0, totalActasAsignadasFromStock - totalActasLiquidadasGlobal);

  const getCatBadge = (cat: string) => {
    const c = (cat || "").toUpperCase();
    if (c.includes("TALONARIO") || c.includes("ACTA") || c.includes("GUIA")) {
      return { text: "Actas / Guías (Talonarios)", bg: "bg-amber-50 text-amber-900 border-amber-300 font-bold" };
    }
    switch (c) {
      case "EQUIPOS":
        return { text: "Equipos (ONT/Mesh)", bg: "bg-emerald-50 text-emerald-800 border-emerald-200" };
      case "MATERIALES":
        return { text: "Materiales", bg: "bg-indigo-50 text-indigo-800 border-indigo-200" };
      case "HERRAMIENTAS":
        return { text: "Herramientas", bg: "bg-amber-50 text-amber-900 border-amber-200" };
      case "UNIFORMES":
        return { text: "Uniformes / EPP", bg: "bg-purple-50 text-purple-800 border-purple-200" };
      case "VEHICULO":
        return { text: "Vehículo", bg: "bg-cyan-50 text-cyan-800 border-cyan-200" };
      default:
        return { text: cat || "General", bg: "bg-slate-100 text-slate-700 border-slate-200" };
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* ─────────────────────────────────────────────────────────────
          1. TARJETAS KPI DE RESUMEN DE ALMACÉN
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Almacén Central */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                Almacén Central
              </span>
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black shrink-0">
                <Building2 size={19} />
              </div>
            </div>

            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl font-black text-slate-900 font-mono">
                {totalUnidadesFisicasCentral.toLocaleString()}
              </h3>
              <span className="text-[11px] text-indigo-600 font-bold">und. físicas</span>
            </div>
          </div>

          {/* Tarjeta Destacada de Cable Drop */}
          <div className="p-2.5 bg-indigo-50/90 rounded-2xl border border-indigo-100 flex items-center justify-between text-xs">
            <span className="font-bold text-indigo-950 flex items-center gap-1.5">
              <Package size={14} className="text-indigo-600 shrink-0" />
              Cable Drop:
            </span>
            <span className="font-black font-mono text-indigo-700">{dropCentralMetros.toLocaleString()} m</span>
          </div>

          {/* Desglose por Categorías */}
          <div className="grid grid-cols-2 gap-1.5 pt-1 text-[10px] font-bold text-slate-600 border-t border-slate-100">
            <span className="truncate bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
              📦 Insumos: <strong className="text-slate-900 font-mono">{materialesCentralUnd}</strong>
            </span>
            <span className="truncate bg-emerald-50/70 text-emerald-900 px-2 py-1 rounded-lg border border-emerald-100">
              💻 Equipos: <strong className="font-mono">{equiposCentralUnd}</strong>
            </span>
            <span className="truncate bg-amber-50/70 text-amber-900 px-2 py-1 rounded-lg border border-amber-100">
              🔧 Herram.: <strong className="font-mono">{herramientasCentralUnd}</strong>
            </span>
            <span className="truncate bg-purple-50/70 text-purple-900 px-2 py-1 rounded-lg border border-purple-100">
              🦺 EPP/Unif.: <strong className="font-mono">{uniformesCentralUnd}</strong>
            </span>
          </div>
        </div>

        {/* KPI 2: Stock Móvil en Técnicos */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                Stock en Móviles (Carros)
              </span>
              <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center font-black shrink-0">
                <Truck size={19} />
              </div>
            </div>

            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl font-black text-slate-900 font-mono">
                {totalUnidadesFisicasEnCarros.toLocaleString()}
              </h3>
              <span className="text-[11px] text-cyan-600 font-bold">und. en técnicos</span>
            </div>
          </div>

          {/* Tarjeta Destacada de Cable Drop */}
          <div className="p-2.5 bg-cyan-50/90 rounded-2xl border border-cyan-100 flex items-center justify-between text-xs">
            <span className="font-bold text-cyan-950 flex items-center gap-1.5">
              <Package size={14} className="text-cyan-600 shrink-0" />
              Cable Drop:
            </span>
            <span className="font-black font-mono text-cyan-700">{dropEnCarrosMetros.toLocaleString()} m</span>
          </div>

          {/* Desglose por Categorías */}
          <div className="grid grid-cols-2 gap-1.5 pt-1 text-[10px] font-bold text-slate-600 border-t border-slate-100">
            <span className="truncate bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
              📦 Insumos: <strong className="text-slate-900 font-mono">{materialesEnCarrosUnd}</strong>
            </span>
            <span className="truncate bg-emerald-50/70 text-emerald-900 px-2 py-1 rounded-lg border border-emerald-100">
              💻 Equipos: <strong className="font-mono">{equiposEnCarrosUnd}</strong>
            </span>
            <span className="truncate bg-amber-50/70 text-amber-900 px-2 py-1 rounded-lg border border-amber-100 col-span-2">
              🔧 Herramientas: <strong className="font-mono">{herramientasEnCarrosUnd}</strong>
            </span>
          </div>
        </div>

        {/* KPI 3: Actas / Guías Asignadas */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                Actas / Guías Asignadas
              </span>
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-black shrink-0">
                <FileText size={19} />
              </div>
            </div>

            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl font-black text-amber-900 font-mono">
                {totalActasAsignadasGlobal}
              </h3>
              <span className="text-[11px] text-amber-700 font-bold">actas emitidas</span>
            </div>
          </div>

          <div className="p-2.5 bg-amber-50/90 rounded-2xl border border-amber-200/80 space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-amber-900 font-bold">Disponibles en mano:</span>
              <strong className="font-mono text-emerald-700 font-black">{totalActasDisponiblesGlobal}</strong>
            </div>
            <div className="flex items-center justify-between text-[11px] text-amber-800">
              <span>Liquidadas en órdenes:</span>
              <strong className="font-mono">{totalActasLiquidadasGlobal}</strong>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSubTab("actas")}
            className="w-full py-1.5 bg-amber-100/70 hover:bg-amber-200/70 text-amber-900 font-bold text-[10px] rounded-xl transition-all cursor-pointer text-center"
          >
            📋 Ver Auditoría de Talonarios →
          </button>
        </div>

        {/* KPI 4: Alertas de Stock Mínimo */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                Alertas de Stock
              </span>
              <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-black shrink-0">
                <AlertTriangle size={19} />
              </div>
            </div>

            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl font-black text-rose-600 font-mono">
                {alertasBajoStock}
              </h3>
              <span className="text-[11px] text-rose-700 font-bold">por reponer</span>
            </div>
          </div>

          <div className="p-2.5 bg-rose-50/80 rounded-2xl border border-rose-100 text-xs text-rose-900 font-medium">
            {alertasBajoStock > 0 ? (
              <span>⚠️ Hay productos con stock central menor al umbral mínimo.</span>
            ) : (
              <span className="text-emerald-700 font-bold">✓ Todos los productos tienen stock saludable.</span>
            )}
          </div>

          <div className="text-[10px] font-bold text-slate-400 pt-1 text-center">
            {productos.length} productos registrados en catálogo
          </div>
        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. FILTROS, CATEGORÍAS & SWITCH DE VISTA
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
        
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Switch Central vs Técnicos vs Actas */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              onClick={() => setSubTab("central")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                subTab === "central" ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Building2 size={15} />
              Almacén Central ({productos.length})
            </button>
            <button
              onClick={() => setSubTab("tecnicos")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                subTab === "tecnicos" ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Truck size={15} />
              Stock en Móviles ({stockPorTecnico.length})
            </button>
            <button
              onClick={() => {
                setSubTab("actas");
                cargarActas();
              }}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                subTab === "actas" ? "bg-amber-500 text-white shadow-md shadow-amber-500/25" : "text-amber-900 hover:bg-amber-100"
              }`}
            >
              <FileText size={15} />
              Control de Actas & Guías ({totalActasAsignadasGlobal})
            </button>
          </div>

          {/* Buscador */}
          <div className="flex items-center gap-3">
            <div className="relative min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
                placeholder={subTab === "actas" ? "Buscar por número de acta (ej: 04235), técnico..." : "Buscar por nombre, código o serie..."}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
              />
            </div>

            {subTab !== "central" && (
              <select
                value={tecnicoSeleccionado}
                onChange={(e) => setTecnicoSeleccionado(e.target.value)}
                className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer"
              >
                <option value="Todos">👥 Todos los Técnicos</option>
                {tecnicosUnicos.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Chips / Pestañas de las Categorías Oficiales */}
        {subTab !== "actas" && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 border-t border-slate-100">
            <span className="text-xs font-bold text-slate-400 mr-1 shrink-0">Categoría:</span>
            {categoriasOficiales.map((cat) => {
              const isSelected = filtroCategoria === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFiltroCategoria(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/80"
                  }`}
                >
                  {cat === "Todas" && <Boxes size={13} />}
                  {cat === "EQUIPOS" && <QrCode size={13} />}
                  {cat === "MATERIALES" && <Layers size={13} />}
                  {cat === "HERRAMIENTAS" && <Wrench size={13} />}
                  {cat === "UNIFORMES" && <Shirt size={13} />}
                  {cat === "VEHICULO" && <Car size={13} />}
                  {cat === "ACTAS / GUÍAS" && <FileText size={13} />}
                  <span>{cat}</span>
                </button>
              );
            })}
          </div>
        )}

      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. TABLAS DE INVENTARIO
      ───────────────────────────────────────────────────────────── */}
      {subTab === "central" ? (
        /* VISTA: ALMACÉN CENTRAL */
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-400 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Código / Producto</th>
                <th className="py-3.5 px-4">Categoría</th>
                <th className="py-3.5 px-4 text-center">Control</th>
                <th className="py-3.5 px-4 text-right">Stock Central</th>
                <th className="py-3.5 px-4 text-right">En Carros</th>
                <th className="py-3.5 px-4 text-right">Total Empresa</th>
                <th className="py-3.5 px-4 text-center">Estado</th>
                <th className="py-3.5 px-4 text-center">Acción Rápida</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {productosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-xs font-bold">
                    No se encontraron productos en esta categoría o búsqueda.
                  </td>
                </tr>
              ) : (
                productosFiltrados.map((p) => {
                  const stockTotal = Number(p.stock_central) + Number(p.stock_en_tecnicos);
                  const esCritico = Number(p.stock_central) <= Number(p.stock_minimo);
                  const catInfo = getCatBadge(p.categoria);
                  const esActaProd = esCatActa(p.categoria) || p.nombre.toUpperCase().includes("ACTA") || p.nombre.toUpperCase().includes("GUIA");

                  return (
                    <tr key={p.id_producto} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-slate-900">{p.nombre}</div>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 mt-0.5">
                          <span className="font-black text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            {p.codigo}
                          </span>
                          {p.fecha_ingreso && (
                            <span className="flex items-center gap-1 text-slate-400 font-sans">
                              <Calendar size={11} className="text-slate-400" />
                              <span>Ingreso: {new Date(p.fecha_ingreso).toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" })}</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${catInfo.bg}`}>
                          {catInfo.text}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {esActaProd ? (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200">
                            Talonario / Correlativo
                          </span>
                        ) : p.maneja_serie ? (
                          <button
                            type="button"
                            onClick={() => abrirModalSeries(p)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 hover:scale-105 transition-all cursor-pointer shadow-2xs group"
                            title="Clic para ver todas las series de este equipo (Almacén vs Técnicos)"
                          >
                            <QrCode size={12} className="text-emerald-700 group-hover:scale-110 transition-transform" />
                            <span>Ver Series ({p.series_disponibles || 0} disp.) 🏷️</span>
                          </button>
                        ) : p.es_drop ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800">
                            Metraje (Drop)
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500">Insumo Unitario</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-black font-mono text-sm text-slate-900">
                        {p.stock_central}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold font-mono text-cyan-700">
                        {p.stock_en_tecnicos}
                      </td>
                      <td className="py-3.5 px-4 text-right font-black font-mono text-slate-900">
                        {stockTotal}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {esCritico ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                            <AlertTriangle size={12} />
                            Reponer
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 size={12} />
                            Óptimo
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setModalDespacho({ isOpen: true, producto: p })}
                            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-[11px] flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                            title="Asignar y transferir material a la camioneta del técnico"
                          >
                            <Send size={11} />
                            <span>Despachar</span>
                          </button>
                          {Boolean(p.maneja_serie) && (
                            <button
                              type="button"
                              onClick={() => abrirModalSeries(p)}
                              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl font-bold text-[11px] transition-all cursor-pointer shadow-2xs"
                              title="Ver listado de series individuales"
                            >
                              <QrCode size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : subTab === "tecnicos" ? (
        /* VISTA: STOCK EN PODER DE TÉCNICOS */
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-black text-slate-900 flex items-center gap-2">
                <Truck size={16} className="text-cyan-600" />
                Control de Stock, Series y Talonarios en Móviles (Carros)
              </h4>
              <p className="text-[11px] text-slate-500 font-medium">
                Auditoría en tiempo real de números de serie, correlativos de actas y materiales asignados por técnico.
              </p>
            </div>

            {/* Filtro de Rango de Fechas de Entrega */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs text-xs">
                <Calendar size={13} className="text-cyan-600 shrink-0" />
                <span className="text-[11px] font-bold text-slate-500">Entrega:</span>
                <input
                  type="date"
                  value={filtroFechaMovilDesde}
                  onChange={(e) => setFiltroFechaMovilDesde(e.target.value)}
                  className="border-0 bg-transparent text-xs font-mono font-semibold p-0 text-slate-700 focus:ring-0"
                  title="Fecha desde"
                />
                <span className="text-slate-400 font-bold">-</span>
                <input
                  type="date"
                  value={filtroFechaMovilHasta}
                  onChange={(e) => setFiltroFechaMovilHasta(e.target.value)}
                  className="border-0 bg-transparent text-xs font-mono font-semibold p-0 text-slate-700 focus:ring-0"
                  title="Fecha hasta"
                />
                {(filtroFechaMovilDesde || filtroFechaMovilHasta) && (
                  <button
                    type="button"
                    onClick={() => {
                      setFiltroFechaMovilDesde("");
                      setFiltroFechaMovilHasta("");
                    }}
                    className="text-[11px] text-rose-600 hover:text-rose-800 font-bold ml-1 cursor-pointer"
                    title="Limpiar filtro de fechas"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Botón rápido: Hoy */}
              <button
                type="button"
                onClick={() => {
                  const hoy = new Date().toISOString().slice(0, 10);
                  setFiltroFechaMovilDesde(hoy);
                  setFiltroFechaMovilHasta(hoy);
                }}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  filtroFechaMovilDesde === new Date().toISOString().slice(0, 10) && filtroFechaMovilHasta === new Date().toISOString().slice(0, 10)
                    ? "bg-cyan-600 text-white border-cyan-600 shadow-2xs"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                📅 Entregas de Hoy
              </button>
            </div>
          </div>

          {(() => {
            const mostrarColumnaSeries =
              filtroCategoria === "Todas" || filtroCategoria === "EQUIPOS" || filtroCategoria === "ACTAS / GUÍAS";

            return (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-400 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">Técnico Conductor</th>
                    <th className="py-3.5 px-4">Cuadrilla / Vehículo</th>
                    <th className="py-3.5 px-4">Material / Equipo</th>
                    <th className="py-3.5 px-4">Categoría</th>
                    <th className="py-3.5 px-4">Fecha Entrega</th>
                    {mostrarColumnaSeries && <th className="py-3.5 px-4">Series / Rangos Asignados</th>}
                    <th className="py-3.5 px-4 text-right">Cantidad en Carro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stockTecnicosFiltrado.length === 0 ? (
                    <tr>
                      <td colSpan={mostrarColumnaSeries ? 7 : 6} className="py-12 text-center text-slate-400 text-xs font-bold">
                        No hay asignaciones registradas para el filtro seleccionado.
                      </td>
                    </tr>
                  ) : (
                    stockTecnicosFiltrado.map((st, idx) => {
                      const catUpper = (st.categoria || "").toUpperCase();
                      const esActa =
                        esCatActa(st.categoria) ||
                        catUpper.includes("ACTA") ||
                        catUpper.includes("TALONARIO") ||
                        st.producto_nombre.toUpperCase().includes("ACTA") ||
                        st.producto_nombre.toUpperCase().includes("GUIA");

                      const esEquipo =
                        catUpper.includes("EQUIPO") ||
                        (!catUpper.includes("HERRAMIENTA") &&
                          !catUpper.includes("MATERIAL") &&
                          !catUpper.includes("UNIFORME") &&
                          !catUpper.includes("EPP") &&
                          !catUpper.includes("OFICINA") &&
                          !catUpper.includes("VEHICULO") &&
                          (st.producto_nombre.toUpperCase().includes("ONT") ||
                            st.producto_nombre.toUpperCase().includes("MESH") ||
                            st.producto_nombre.toUpperCase().includes("DECO") ||
                            st.producto_nombre.toUpperCase().includes("ROUTER")));

                      const tieneRangos = Array.isArray(st.rangos) && st.rangos.length > 0;
                      const catInfo = getCatBadge(st.categoria);

                      return (
                        <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            {st.tecnico_nombre}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="text-[11px] font-bold text-slate-700 block">{st.cuadrilla || "S/C"}</span>
                            <span className="text-[10px] font-mono text-cyan-700 font-bold">{st.vehiculo_placa}</span>
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-800">
                            {st.producto_nombre}
                            {st.producto_codigo && (
                              <span className="text-[10px] font-mono text-slate-400 font-normal block">
                                {st.producto_codigo}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${catInfo.bg}`}>
                              {catInfo.text}
                            </span>
                          </td>

                          {/* COLUMNA: FECHA DE ENTREGA AL TÉCNICO */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {st.fecha_entrega ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-mono text-[10px] font-semibold border border-slate-200">
                                <Clock size={11} className="text-cyan-600 shrink-0" />
                                <span>
                                  {new Date(st.fecha_entrega).toLocaleDateString("es-PE", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">No registrada</span>
                            )}
                          </td>

                          {/* COLUMNA CONDICIONAL: SERIES / RANGOS (SOLO ACTAS Y EQUIPOS) */}
                          {mostrarColumnaSeries && (
                            <td className="py-3.5 px-4">
                              {esActa && tieneRangos ? (
                                <div className="space-y-1">
                                  {st.rangos?.map((rango, rIdx) => (
                                    <div
                                      key={rIdx}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs font-mono font-bold shadow-2xs"
                                    >
                                      <FileText size={13} className="text-amber-600 shrink-0" />
                                      <span>{rango}</span>
                                    </div>
                                  ))}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const matchedTec = actasTecnicos.find((a) => a.id_trabajador === st.id_trabajador);
                                      if (matchedTec) {
                                        setModalDetalleActas({ isOpen: true, tecnico: matchedTec });
                                      } else {
                                        setSubTab("actas");
                                      }
                                    }}
                                    className="block text-[10px] text-amber-700 hover:text-amber-900 font-bold hover:underline cursor-pointer mt-0.5"
                                  >
                                    📋 Ver talonario completo ({st.stock} actas) →
                                  </button>
                                </div>
                              ) : esEquipo ? (
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setModalSeriesTecnico({ isOpen: true, item: st });
                                      setFiltroSerieTecnicoTexto("");
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs group"
                                    title="Ver todas las series asignadas al técnico para este modelo"
                                  >
                                    <QrCode size={13} className="text-emerald-700" />
                                    <span>Ver Series ({st.stock} und)</span>
                                    <Eye size={12} className="text-emerald-600 opacity-60 group-hover:opacity-100" />
                                  </button>
                                  {st.total_liquidadas && st.total_liquidadas > 0 ? (
                                    <span className="text-[10px] font-bold text-slate-400">
                                      ({st.total_liquidadas} instaladas)
                                    </span>
                                  ) : null}
                                </div>
                              ) : (
                                <span className="text-slate-300 font-bold text-xs">—</span>
                              )}
                            </td>
                          )}

                          {/* CANTIDAD EN CARRO */}
                          <td className="py-3.5 px-4 text-right font-black font-mono text-sm text-cyan-800">
                            {st.stock} {st.es_drop ? "m" : "und"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            );
          })()}
        </div>
      ) : (
        /* VISTA: 📋 CONTROL & AUDITORÍA DE ACTAS / GUÍAS ASIGNADAS */
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden space-y-4">
          
          <div className="p-4 bg-gradient-to-r from-amber-50/80 to-orange-50/50 border-b border-amber-200/80 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                <FileText size={16} className="text-amber-600" />
                Auditoría de Actas Físicas de Servicio Técnico WIN
              </span>
              <p className="text-[11px] text-amber-900 font-medium">
                Control de correlativos entregados a técnicos, actas liquidadas en campo y talonarios en mano.
              </p>
            </div>

            <button
              type="button"
              onClick={cargarActas}
              className="px-3 py-1.5 bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            >
              <span>Actualizar Talonarios</span>
            </button>
          </div>

          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-400 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Técnico Conductor</th>
                <th className="py-3.5 px-4">Cuadrilla / Móvil</th>
                <th className="py-3.5 px-4">Rango de Actas Asignadas</th>
                <th className="py-3.5 px-4 text-center">Total Entregadas</th>
                <th className="py-3.5 px-4 text-center">Liquidadas (Usadas)</th>
                <th className="py-3.5 px-4 text-center">Disponibles en Mano</th>
                <th className="py-3.5 px-4 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {actasTecnicosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-xs font-bold">
                    No se encontraron talonarios de actas para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                actasTecnicosFiltrados.map((tec) => (
                  <tr key={tec.id_trabajador} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-extrabold text-slate-900">{tec.tecnico_nombre}</div>
                      <span className="text-[10px] text-slate-400">{tec.telefono ? `Tel: ${tec.telefono}` : "Sin teléfono"}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-[11px] font-bold text-slate-700 block">{tec.cuadrilla}</span>
                      <span className="text-[10px] font-mono text-cyan-700 font-bold">{tec.vehiculo_placa}</span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                      {tec.rangos.map((r, i) => (
                        <span key={i} className="inline-block px-2 py-0.5 bg-amber-50 border border-amber-200 rounded-md text-[11px] text-amber-900 mr-1 mb-1">
                          {r}
                        </span>
                      ))}
                    </td>
                    <td className="py-3.5 px-4 text-center font-black font-mono text-sm text-slate-900">
                      {tec.total_asignadas}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200">
                        {tec.total_usadas} usadas
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {tec.total_disponibles} en mano
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => setModalDetalleActas({ isOpen: true, tecnico: tec })}
                        className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-[11px] inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <Eye size={12} />
                        <span>Ver Hojas ({tec.actas.length})</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Despacho Rápido */}
      {modalDespacho.isOpen && modalDespacho.producto && (
        <QuickDispatchModal
          isOpen={modalDespacho.isOpen}
          onClose={() => setModalDespacho({ isOpen: false, producto: null })}
          producto={modalDespacho.producto}
          onDespachoRealizado={() => {
            if (onRefresh) onRefresh();
            cargarActas();
          }}
        />
      )}

      {/* Modal Detalle Individual de Actas del Técnico */}
      {modalDetalleActas.isOpen && modalDetalleActas.tecnico && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 md:p-6 animate-fade-in">
          <div className="bg-white rounded-3xl p-5 md:p-6 max-w-3xl w-full shadow-2xl border border-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-black shadow-md shadow-amber-500/25">
                  <FileText size={20} />
                </div>
                <div>
                  <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider bg-amber-50 px-2 py-0.5 rounded-md">
                    Talonario de Actas Físicas
                  </span>
                  <h3 className="text-base font-black text-slate-900 mt-0.5">
                    {modalDetalleActas.tecnico.tecnico_nombre} ({modalDetalleActas.tecnico.cuadrilla})
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModalDetalleActas({ isOpen: false, tecnico: null })}
                className="p-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Resumen de Talonarios y Rangos */}
            <div className="p-3.5 bg-amber-50/80 rounded-2xl border border-amber-200 space-y-2">
              <span className="text-[11px] font-black text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                <ClipboardList size={14} className="text-amber-700" />
                <span>Talonarios & Rangos Asignados a la Cuadrilla:</span>
              </span>
              <div className="flex flex-wrap gap-2">
                {modalDetalleActas.tecnico.rangos.map((r, idx) => (
                  <span key={idx} className="px-3 py-1.5 bg-white border border-amber-300 rounded-xl font-mono text-xs font-black text-amber-950 shadow-2xs flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span>Talonario: <strong>{r}</strong></span>
                  </span>
                ))}
              </div>
            </div>

            {/* Resumen KPI */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Asignadas</span>
                <span className="text-lg font-black text-slate-900 font-mono">
                  {modalDetalleActas.tecnico.total_asignadas}
                </span>
              </div>
              <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200 text-center">
                <span className="text-[10px] font-bold text-blue-700 uppercase block">Liquidadas en Campo</span>
                <span className="text-lg font-black text-blue-900 font-mono">
                  {modalDetalleActas.tecnico.total_usadas}
                </span>
              </div>
              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-center">
                <span className="text-[10px] font-bold text-emerald-700 uppercase block">Disponibles en Mano</span>
                <span className="text-lg font-black text-emerald-950 font-mono">
                  {modalDetalleActas.tecnico.total_disponibles}
                </span>
              </div>
            </div>

            {/* Cuadrícula de Actas Individuales */}
            <div className="space-y-2 pt-1 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 block">
                  Inspección de Hojas Individuales ({modalDetalleActas.tecnico.actas.length}):
                </span>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-60 overflow-y-auto p-1 bg-slate-50/50 rounded-2xl border border-slate-200/60">
                {modalDetalleActas.tecnico.actas.map((acta, idx) => {
                  const esUsada = acta.estado === "Usada";
                  return (
                    <div
                      key={idx}
                      className={`p-2 rounded-xl border text-center font-mono text-xs transition-all ${
                        esUsada
                          ? "bg-slate-100 border-slate-200 text-slate-400 line-through"
                          : "bg-white border-emerald-200 text-emerald-950 font-black shadow-2xs"
                      }`}
                    >
                      <div className="font-bold">{acta.numero_serie}</div>
                      <span className={`text-[9px] font-sans block mt-0.5 ${
                        esUsada ? "text-blue-600 font-bold" : "text-emerald-700"
                      }`}>
                        {esUsada
                          ? acta.orden_numero ? `OT #${acta.orden_numero}` : "Liquidada"
                          : "En Mano"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setModalDetalleActas({ isOpen: false, tecnico: null })}
                className="px-5 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs cursor-pointer hover:bg-slate-800 transition-all"
              >
                Cerrar Auditoría
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL DE AUDITORÍA Y CONSULTA DE SERIES DEL EQUIPO (PANORÁMICO)
      ───────────────────────────────────────────────────────────── */}
      {modalSeries.isOpen && modalSeries.producto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-6xl shadow-2xl border border-slate-100 space-y-4 animate-scale-up max-h-[92vh] flex flex-col">
            
            {/* Header del Modal */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3 shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <QrCode size={18} />
                  </span>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      Series Registradas: {modalSeries.producto.nombre}
                    </h3>
                    <p className="text-xs text-slate-400 font-mono">
                      Código Modelo: <strong className="text-slate-700">{modalSeries.producto.codigo}</strong> • Categoría: <strong className="text-indigo-600 font-sans">{modalSeries.producto.categoria || "EQUIPOS"}</strong>
                    </p>
                  </div>
                </div>
              </div>

              {/* Selector de Modo de Vista & Botón Cerrar */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setModoVistaSeries("table")}
                    className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      modoVistaSeries === "table" ? "bg-white text-indigo-900 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                    }`}
                    title="Vista Tabla / Grid Compacto"
                  >
                    <Layers size={13} />
                    <span>Tabla Compacta</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoVistaSeries("cards")}
                    className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      modoVistaSeries === "cards" ? "bg-white text-indigo-900 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                    }`}
                    title="Vista Tarjetas"
                  >
                    <Package size={13} />
                    <span>Tarjetas</span>
                  </button>
                </div>

                <button
                  onClick={() => setModalSeries({ isOpen: false, producto: null })}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Métricas Resumen de Series */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
              <div className="p-2.5 bg-emerald-50/80 rounded-2xl border border-emerald-200 text-center space-y-0.5">
                <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider block">
                  🏢 Disponibles
                </span>
                <span className="text-lg font-black text-emerald-950 font-mono">
                  {detalleSeries?.disponibles_almacen ?? "..."}
                </span>
                <span className="text-[9px] text-emerald-600 block font-medium">Óptimos en almacén</span>
              </div>

              <div className="p-2.5 bg-sky-50/80 rounded-2xl border border-sky-200 text-center space-y-0.5">
                <span className="text-[10px] font-black text-sky-800 uppercase tracking-wider block">
                  🚚 En Cuadrillas
                </span>
                <span className="text-lg font-black text-sky-950 font-mono">
                  {detalleSeries?.asignadas_tecnicos ?? "..."}
                </span>
                <span className="text-[9px] text-sky-600 block font-medium">En camionetas</span>
              </div>

              <div className="p-2.5 bg-rose-50/80 rounded-2xl border border-rose-200 text-center space-y-0.5">
                <span className="text-[10px] font-black text-rose-800 uppercase tracking-wider block">
                  ⚠️ Defectuosos
                </span>
                <span className="text-lg font-black text-rose-950 font-mono">
                  {detalleSeries?.defectuosos ?? 0}
                </span>
                <span className="text-[9px] text-rose-600 block font-medium">Garantía / Avería</span>
              </div>

              <div className="p-2.5 bg-slate-100/80 rounded-2xl border border-slate-200 text-center space-y-0.5">
                <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">
                  📊 Total Series
                </span>
                <span className="text-lg font-black text-slate-900 font-mono">
                  {detalleSeries?.total_series ?? "..."}
                </span>
                <span className="text-[9px] text-slate-500 block font-medium">Global empresa</span>
              </div>
            </div>

            {/* Barra de Filtros Avanzados (Ubicación, Técnico, Fechas, Búsqueda) */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 shrink-0">
              
              {/* Tabs de Filtro de Ubicación */}
              <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setFiltroSerieTab("todas")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    filtroSerieTab === "todas" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Todas ({detalleSeries?.total_series || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroSerieTab("almacen")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    filtroSerieTab === "almacen" ? "bg-emerald-600 text-white shadow-2xs" : "text-emerald-800 hover:bg-emerald-50"
                  }`}
                >
                  <Building2 size={11} />
                  Almacén ({detalleSeries?.disponibles_almacen || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroSerieTab("tecnicos")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    filtroSerieTab === "tecnicos" ? "bg-sky-600 text-white shadow-2xs" : "text-sky-800 hover:bg-sky-50"
                  }`}
                >
                  <Truck size={11} />
                  En Técnicos ({detalleSeries?.asignadas_tecnicos || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroSerieTab("defectuosos")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    filtroSerieTab === "defectuosos" ? "bg-rose-600 text-white shadow-2xs" : "text-rose-800 hover:bg-rose-50"
                  }`}
                >
                  <AlertTriangle size={11} />
                  Defectuosos ({detalleSeries?.defectuosos || 0})
                </button>
              </div>

              {/* Filtro por Técnico si hay asignaciones */}
              {(() => {
                const tecnicosEnEsteEquipo = Array.from(
                  new Set(
                    (detalleSeries?.series || [])
                      .map((s: any) => s.tecnico_nombre)
                      .filter(Boolean)
                  )
                ).sort() as string[];

                return (
                  tecnicosEnEsteEquipo.length > 0 && (
                    <select
                      value={filtroTecnicoModal}
                      onChange={(e) => setFiltroTecnicoModal(e.target.value)}
                      className="p-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white cursor-pointer"
                    >
                      <option value="todos">👤 Todos los Técnicos ({tecnicosEnEsteEquipo.length})</option>
                      {tecnicosEnEsteEquipo.map((tec: string) => (
                        <option key={tec} value={tec}>
                          {tec}
                        </option>
                      ))}
                    </select>
                  )
                );
              })()}

              {/* Filtro por Rango de Fechas */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl text-xs">
                <Calendar size={13} className="text-slate-400 shrink-0" />
                <span className="text-[11px] font-bold text-slate-500">Fecha:</span>
                <input
                  type="date"
                  value={filtroFechaDesde}
                  onChange={(e) => setFiltroFechaDesde(e.target.value)}
                  className="bg-transparent border-0 text-xs font-mono font-medium p-0 text-slate-700 focus:ring-0"
                  title="Fecha desde"
                />
                <span className="text-slate-400 font-bold">-</span>
                <input
                  type="date"
                  value={filtroFechaHasta}
                  onChange={(e) => setFiltroFechaHasta(e.target.value)}
                  className="bg-transparent border-0 text-xs font-mono font-medium p-0 text-slate-700 focus:ring-0"
                  title="Fecha hasta"
                />
                {(filtroFechaDesde || filtroFechaHasta) && (
                  <button
                    type="button"
                    onClick={() => {
                      setFiltroFechaDesde("");
                      setFiltroFechaHasta("");
                    }}
                    className="text-[10px] text-rose-600 hover:text-rose-800 font-bold ml-1 cursor-pointer"
                    title="Limpiar fechas"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Input Buscador */}
              <div className="relative min-w-[200px] flex-1 sm:flex-initial">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="text"
                  value={filtroSerieTexto}
                  onChange={(e) => setFiltroSerieTexto(e.target.value)}
                  placeholder="Buscar serie, código, técnico, placa..."
                  className="w-full pl-8.5 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            {/* Contenedor Principal: Tabla Compacta o Tarjetas */}
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              {cargandoSeries ? (
                <div className="py-16 text-center text-slate-400 text-xs font-bold flex items-center justify-center gap-2">
                  <RefreshCw size={16} className="animate-spin text-emerald-600" />
                  <span>Cargando series registradas del equipo...</span>
                </div>
              ) : !detalleSeries || detalleSeries.series.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs font-bold border border-dashed border-slate-200 rounded-2xl">
                  No hay series registradas para este producto actualmente.
                </div>
              ) : (() => {
                const seriesFiltradas = detalleSeries.series.filter((s: any) => {
                  // Filtro por tab de ubicación
                  if (filtroSerieTab === "almacen" && s.estado_serie !== "DISPONIBLE") return false;
                  if (filtroSerieTab === "tecnicos" && !s.id_trabajador) return false;
                  if (filtroSerieTab === "defectuosos" && s.estado_serie !== "DEFECTUOSO") return false;

                  // Filtro por técnico específico
                  if (filtroTecnicoModal !== "todos" && s.tecnico_nombre !== filtroTecnicoModal) return false;

                  // Filtro por fechas
                  const fechaAValidar = (s.fecha_asignacion || s.fecha_ingreso || "").slice(0, 10);
                  if (filtroFechaDesde && fechaAValidar && fechaAValidar < filtroFechaDesde) return false;
                  if (filtroFechaHasta && fechaAValidar && fechaAValidar > filtroFechaHasta) return false;

                  // Filtro por texto
                  if (!filtroSerieTexto) return true;
                  const q = filtroSerieTexto.toLowerCase();
                  return (
                    s.numero_serie.toLowerCase().includes(q) ||
                    (s.codigo_serie || "").toLowerCase().includes(q) ||
                    (s.tecnico_nombre || "").toLowerCase().includes(q) ||
                    (s.tecnico_cuadrilla || "").toLowerCase().includes(q) ||
                    (s.vehiculo_placa || "").toLowerCase().includes(q)
                  );
                });

                if (seriesFiltradas.length === 0) {
                  return (
                    <div className="py-12 text-center text-slate-400 text-xs font-bold border border-dashed border-slate-200 rounded-2xl">
                      No se encontraron series que coincidan con la búsqueda o filtros aplicados.
                    </div>
                  );
                }

                // VISTA 1: TABLA COMPACTA (ALTO VOLUMEN)
                if (modoVistaSeries === "table") {
                  return (
                    <div className="border border-slate-200 rounded-2xl overflow-y-auto max-h-[420px] shadow-2xs">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 sticky top-0 z-10 text-slate-500 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">#</th>
                            <th className="py-2.5 px-3">Código Serie</th>
                            <th className="py-2.5 px-3">Serie de Fábrica</th>
                            <th className="py-2.5 px-3">Estado</th>
                            <th className="py-2.5 px-3">Ubicación / Técnico</th>
                            <th className="py-2.5 px-3">Cuadrilla / Placa</th>
                            <th className="py-2.5 px-3">Fecha Ingreso</th>
                            <th className="py-2.5 px-3">Fecha Entrega</th>
                            <th className="py-2.5 px-3 text-center">Copiar</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {seriesFiltradas.map((s: any, idx: number) => {
                            const esAlmacen = s.estado_serie === "DISPONIBLE";
                            const esDefectuoso = s.estado_serie === "DEFECTUOSO";
                            const esTecnico = Boolean(s.id_trabajador);

                            return (
                              <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                                <td className="py-2 px-3 font-mono text-slate-400 text-[11px] font-bold">
                                  {idx + 1}
                                </td>
                                <td className="py-2 px-3">
                                  {s.codigo_serie ? (
                                    <span className="font-mono font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200 text-[11px]">
                                      🏷️ {s.codigo_serie}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 font-mono text-[10px]">-</span>
                                  )}
                                </td>
                                <td className="py-2 px-3 font-mono font-black text-slate-900 text-[11px]">
                                  {s.numero_serie}
                                </td>
                                <td className="py-2 px-3">
                                  {esAlmacen ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      🏢 Disponible
                                    </span>
                                  ) : esDefectuoso ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                                      ⚠️ Defectuoso
                                    </span>
                                  ) : esTecnico ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                                      🚚 En Camioneta
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-slate-500">{s.estado_serie}</span>
                                  )}
                                </td>
                                <td className="py-2 px-3 font-bold text-slate-800">
                                  {esTecnico ? (
                                    <span className="flex items-center gap-1 text-sky-900">
                                      <Truck size={12} className="text-sky-600 shrink-0" />
                                      <span>{s.tecnico_nombre}</span>
                                    </span>
                                  ) : (
                                    <span className="text-emerald-800 font-medium">🏢 Almacén Central</span>
                                  )}
                                </td>
                                <td className="py-2 px-3 font-mono text-[11px] text-slate-600">
                                  {s.tecnico_cuadrilla || s.vehiculo_placa ? (
                                    <span>
                                      {s.tecnico_cuadrilla ? `Cuadrilla ${s.tecnico_cuadrilla}` : ""} {s.vehiculo_placa ? `(${s.vehiculo_placa})` : ""}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">-</span>
                                  )}
                                </td>
                                <td className="py-2 px-3 whitespace-nowrap text-slate-500 font-mono text-[10px]">
                                  {s.fecha_ingreso ? (
                                    new Date(s.fecha_ingreso).toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" })
                                  ) : (
                                    "-"
                                  )}
                                </td>
                                <td className="py-2 px-3 whitespace-nowrap text-slate-500 font-mono text-[10px]">
                                  {s.fecha_asignacion ? (
                                    <span className="text-sky-800 font-bold">
                                      {new Date(s.fecha_asignacion).toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                  ) : (
                                    "-"
                                  )}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => copiarSerie(s.numero_serie)}
                                    className="p-1 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-slate-100 transition-all cursor-pointer"
                                    title="Copiar serie"
                                  >
                                    {copiadoSerie === s.numero_serie ? (
                                      <Check size={14} className="text-emerald-600" />
                                    ) : (
                                      <Copy size={14} />
                                    )}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                }

                // VISTA 2: TARJETAS VISUALES
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-[420px] overflow-y-auto p-1">
                    {seriesFiltradas.map((s: any, idx: number) => {
                      const esAlmacen = s.estado_serie === "DISPONIBLE";
                      const esDefectuoso = s.estado_serie === "DEFECTUOSO";
                      const esTecnico = Boolean(s.id_trabajador);

                      return (
                        <div
                          key={idx}
                          className={`p-3 rounded-2xl border transition-all flex flex-col justify-between space-y-2 ${
                            esDefectuoso
                              ? "bg-rose-50/50 border-rose-200 hover:border-rose-400"
                              : esAlmacen
                              ? "bg-emerald-50/40 border-emerald-200 hover:border-emerald-400"
                              : esTecnico
                              ? "bg-sky-50/40 border-sky-200 hover:border-sky-400"
                              : "bg-slate-50 border-slate-200"
                          }`}
                        >
                          {/* Código Correlativo de Serie y Serie de Fábrica */}
                          <div className="flex items-start justify-between gap-1.5">
                            <div className="min-w-0 flex-1">
                              {s.codigo_serie && (
                                <span className="inline-block text-[10px] font-black font-mono px-1.5 py-0.5 bg-indigo-100 text-indigo-800 rounded-md border border-indigo-200 mb-1">
                                  🏷️ {s.codigo_serie}
                                </span>
                              )}
                              <span className="font-mono font-black text-xs text-slate-900 tracking-wide block truncate" title={s.numero_serie}>
                                {s.numero_serie}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => copiarSerie(s.numero_serie)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-white transition-all cursor-pointer"
                                title="Copiar número de serie"
                              >
                                {copiadoSerie === s.numero_serie ? (
                                  <Check size={14} className="text-emerald-600" />
                                ) : (
                                  <Copy size={14} />
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Ubicación y Estado */}
                          <div className="pt-1.5 border-t border-slate-200/60 text-[11px] space-y-1.5">
                            {esAlmacen ? (
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setSerieEditandoEstado(serieEditandoEstado === s.id_producto_serie ? null : s.id_producto_serie)}
                                    className="flex items-center gap-1.5 text-emerald-800 font-extrabold hover:text-emerald-950 transition-colors cursor-pointer group truncate"
                                    title="Toca para cambiar estado"
                                  >
                                    <Building2 size={12} className="text-emerald-600 shrink-0" />
                                    <span className="truncate">Almacén Central (Disponible)</span>
                                    <span className="text-[9px] text-slate-400 group-hover:text-slate-600">✏️</span>
                                  </button>
                                </div>

                                {serieEditandoEstado === s.id_producto_serie && (
                                  <div className="p-2 bg-white rounded-xl border border-slate-200 shadow-lg space-y-1 animate-scale-up">
                                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Cambiar Estado:</span>
                                    <div className="flex flex-col gap-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          handleCambiarEstadoSerie(s.id_producto_serie, "DEFECTUOSO");
                                          setSerieEditandoEstado(null);
                                        }}
                                        className="text-left px-2 py-1 rounded-lg text-[10px] font-bold text-rose-700 hover:bg-rose-50 cursor-pointer flex items-center gap-1.5"
                                      >
                                        <AlertTriangle size={11} className="text-rose-600" />
                                        <span>Reportar Defectuoso / Avería</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          handleCambiarEstadoSerie(s.id_producto_serie, "BAJA");
                                          setSerieEditandoEstado(null);
                                        }}
                                        className="text-left px-2 py-1 rounded-lg text-[10px] font-bold text-slate-600 hover:bg-slate-100 cursor-pointer flex items-center gap-1.5"
                                      >
                                        <span>❌ Dar de Baja</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setSerieEditandoEstado(null)}
                                        className="text-center text-[9px] text-slate-400 hover:text-slate-600 pt-0.5"
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : esDefectuoso ? (
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setSerieEditandoEstado(serieEditandoEstado === s.id_producto_serie ? null : s.id_producto_serie)}
                                    className="flex items-center gap-1.5 text-rose-800 font-extrabold hover:text-rose-950 transition-colors cursor-pointer group truncate"
                                    title="Toca para cambiar estado"
                                  >
                                    <AlertTriangle size={12} className="text-rose-600 shrink-0" />
                                    <span className="truncate">Defectuoso (Avería / Garantía)</span>
                                    <span className="text-[9px] text-slate-400 group-hover:text-slate-600">✏️</span>
                                  </button>
                                </div>

                                {serieEditandoEstado === s.id_producto_serie && (
                                  <div className="p-2 bg-white rounded-xl border border-slate-200 shadow-lg space-y-1 animate-scale-up">
                                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Cambiar Estado:</span>
                                    <div className="flex flex-col gap-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          handleCambiarEstadoSerie(s.id_producto_serie, "DISPONIBLE");
                                          setSerieEditandoEstado(null);
                                        }}
                                        className="text-left px-2 py-1 rounded-lg text-[10px] font-bold text-emerald-700 hover:bg-emerald-50 cursor-pointer flex items-center gap-1.5"
                                      >
                                        <Check size={11} className="text-emerald-600" />
                                        <span>Restablecer a Disponible / Reparado</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setSerieEditandoEstado(null)}
                                        className="text-center text-[9px] text-slate-400 hover:text-slate-600 pt-0.5"
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : esTecnico ? (
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1 text-sky-950 font-black truncate">
                                  <Truck size={12} className="text-sky-600 shrink-0" />
                                  <span className="truncate">{s.tecnico_nombre}</span>
                                </div>
                                {(s.tecnico_cuadrilla || s.vehiculo_placa) && (
                                  <div className="text-[10px] text-sky-700 font-mono font-semibold pl-4">
                                    {s.tecnico_cuadrilla ? `Cuadrilla: ${s.tecnico_cuadrilla}` : ""} {s.vehiculo_placa ? `• Placa: ${s.vehiculo_placa}` : ""}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-500 font-medium">{s.estado_serie}</span>
                            )}
                          </div>

                          {/* FECHAS: INGRESO AL ALMACÉN Y ENTREGA AL TÉCNICO */}
                          <div className="pt-2 border-t border-slate-100/80 text-[10px] space-y-1">
                            {s.fecha_ingreso && (
                              <div className="flex items-center gap-1.5 text-slate-500 font-mono">
                                <Calendar size={11} className="text-slate-400 shrink-0" />
                                <span>
                                  Ingreso: <strong className="text-slate-700 font-semibold">{new Date(s.fecha_ingreso).toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</strong>
                                </span>
                              </div>
                            )}
                            {esTecnico && s.fecha_asignacion && (
                              <div className="flex items-center gap-1.5 text-sky-800 font-mono font-bold bg-sky-50 px-2 py-0.5 rounded-lg border border-sky-200">
                                <Clock size={11} className="text-sky-600 shrink-0" />
                                <span>
                                  Entregado: {new Date(s.fecha_asignacion).toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Footer del Modal */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 shrink-0">
              <span className="text-[11px] text-slate-400 font-medium">
                💡 Consejo: Alterna entre <strong>Tabla Compacta</strong> (para buscar rápido entre cientos de series) o <strong>Tarjetas</strong> según tu preferencia.
              </span>
              <button
                type="button"
                onClick={() => setModalSeries({ isOpen: false, producto: null })}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs cursor-pointer transition-all shadow-xs"
              >
                Cerrar Consulta
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: SERIES DE EQUIPOS ASIGNADAS AL TÉCNICO POR MODELO
      ───────────────────────────────────────────────────────────── */}
      {modalSeriesTecnico.isOpen && modalSeriesTecnico.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in font-sans">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xl w-full max-w-2xl space-y-4 animate-scale-up max-h-[90vh] flex flex-col">
            
            {/* Cabecera */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black shadow-2xs">
                  <QrCode size={22} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Series de {modalSeriesTecnico.item.producto_nombre}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-semibold flex items-center gap-2 mt-0.5">
                    <span>👤 Técnico: <strong className="text-slate-800">{modalSeriesTecnico.item.tecnico_nombre}</strong></span>
                    <span>•</span>
                    <span className="text-cyan-700 font-mono font-bold">
                      Cuadrilla: {modalSeriesTecnico.item.cuadrilla || "S/C"} ({modalSeriesTecnico.item.vehiculo_placa})
                    </span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModalSeriesTecnico({ isOpen: false, item: null })}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Resumen & Acciones */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-3 text-xs font-bold">
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg flex items-center gap-1">
                  🟢 {modalSeriesTecnico.item.series_disponibles?.length || modalSeriesTecnico.item.stock} en Camioneta
                </span>
                {modalSeriesTecnico.item.total_liquidadas && modalSeriesTecnico.item.total_liquidadas > 0 ? (
                  <span className="px-2.5 py-1 bg-slate-200 text-slate-700 rounded-lg">
                    📦 {modalSeriesTecnico.item.total_liquidadas} Liquidadas en Órdenes
                  </span>
                ) : null}
              </div>

              {/* Botón Copiar Todas las Series */}
              {modalSeriesTecnico.item.series_disponibles && modalSeriesTecnico.item.series_disponibles.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const all = (modalSeriesTecnico.item?.series_disponibles || []).join("\n");
                    navigator.clipboard.writeText(all);
                    setCopiadoSerie("TODAS_TEC");
                    setTimeout(() => setCopiadoSerie(null), 2000);
                  }}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all"
                >
                  <Copy size={13} className="text-slate-600" />
                  <span>{copiadoSerie === "TODAS_TEC" ? "✅ ¡Series Copiadas!" : "Copiar Todas las Series"}</span>
                </button>
              )}
            </div>

            {/* Buscador de Series */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                value={filtroSerieTecnicoTexto}
                onChange={(e) => setFiltroSerieTecnicoTexto(e.target.value)}
                placeholder="Buscar por número de serie..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
              />
            </div>

            {/* Listado de Tarjetas de Series */}
            <div className="overflow-y-auto flex-1 max-h-[340px] p-1">
              {(() => {
                const todasLasSeries = modalSeriesTecnico.item.series_disponibles || [];
                const filtradas = todasLasSeries.filter((sn) =>
                  sn.toLowerCase().includes(filtroSerieTecnicoTexto.toLowerCase())
                );

                if (filtradas.length === 0) {
                  return (
                    <div className="py-10 text-center text-slate-400 text-xs font-bold border border-dashed border-slate-200 rounded-2xl">
                      {filtroSerieTecnicoTexto
                        ? "No se encontraron series que coincidan con la búsqueda."
                        : "El técnico no tiene series activas asignadas para este modelo."}
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {filtradas.map((sn, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-emerald-50/50 hover:bg-emerald-50 border border-emerald-200 hover:border-emerald-400 rounded-2xl transition-all flex items-center justify-between gap-2 shadow-2xs"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <QrCode size={16} className="text-emerald-700 shrink-0" />
                          <span className="font-mono font-black text-xs text-slate-900 truncate">
                            {sn}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => copiarSerie(sn)}
                          className="p-1.5 bg-white hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-lg cursor-pointer transition-all shrink-0"
                          title="Copiar serie"
                        >
                          {copiadoSerie === sn ? (
                            <Check size={13} className="text-emerald-600" />
                          ) : (
                            <Copy size={13} className="text-emerald-600" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-[11px] text-slate-400 font-medium">
                💡 Clic en el icono de copiar para usar el número de serie en activaciones o liquidaciones.
              </span>
              <button
                type="button"
                onClick={() => setModalSeriesTecnico({ isOpen: false, item: null })}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs cursor-pointer transition-all shadow-xs"
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

