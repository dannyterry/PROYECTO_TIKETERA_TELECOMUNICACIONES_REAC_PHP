import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search,
  Filter,
  Download,
  RefreshCw,
  Copy,
  Check,
  Calendar,
  Layers,
  Cpu,
  Tv,
  Phone,
  FileCheck,
  Package,
  AlertCircle,
  Eye,
  SlidersHorizontal,
  X,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Tag,
  Building2,
  HardDrive
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  EquipoGeneralItem,
  EquiposGeneralesResponse,
  EquiposGeneralesFilters,
  ProductoStock
} from "../types/inventoryTypes";
import {
  getEquiposGenerales,
  actualizarEquipoGeneral
} from "../services/inventoryService";

interface GeneralEquipmentTabProps {
  productos?: ProductoStock[];
}

export const GeneralEquipmentTab: React.FC<GeneralEquipmentTabProps> = ({ productos = [] }) => {
  // Estado de datos
  const [equipos, setEquipos] = useState<EquipoGeneralItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [stats, setStats] = useState({
    total: 0,
    en_almacen: 0,
    en_tecnicos: 0,
    liquidados: 0,
    de_baja: 0
  });
  const [subtabCounts, setSubtabCounts] = useState<Record<string, number>>({});

  // Sub-pestañas activas con selección múltiple acumulativa ("pegarse": ej: MESH + TELEF)
  const [subtabsActivas, setSubtabsActivas] = useState<string[]>([]);

  // Filtros de búsqueda y parámetros
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filtroProducto, setFiltroProducto] = useState<string>("");
  const [filtroAlmacen, setFiltroAlmacen] = useState<string>("");
  const [filtroEstado, setFiltroEstado] = useState<string>("");

  // Filtros de fecha (Días, Semanas, Meses)
  const [modoFecha, setModoFecha] = useState<"todos" | "dia" | "semana" | "mes" | "rango">("todos");
  const [tipoFecha, setTipoFecha] = useState<string>("ingreso_win"); // 'ingreso_win', 'asignacion_tec', 'instalacion', 'liquidacion'
  const [fechaDesde, setFechaDesde] = useState<string>("");
  const [fechaHasta, setFechaHasta] = useState<string>("");
  const [mesSeleccionado, setMesSeleccionado] = useState<string>("");
  const [anioSeleccionado, setAnioSeleccionado] = useState<string>("2026");
  const [semanaSeleccionada, setSemanaSeleccionada] = useState<string>("");

  // Paginación
  const [paginaActual, setPaginaActual] = useState<number>(1);
  const [itemsPorPagina, setItemsPorPagina] = useState<number>(100);

  // Filas marcadas / destacadas manualmente (ej: rojo como en el Excel)
  const [filasResaltadas, setFilasResaltadas] = useState<Record<number, "red" | "cyan" | "green" | null>>({});

  // Copiado temporal en portapapeles
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

  // Sub-pestañas configuradas según modelos de equipos (estrictamente equipos)
  const miniPestanas = useMemo(() => [
    { id: "all", label: "TODOS", shortLabel: "TODOS", icon: Layers, count: stats.total || 0 },
    { id: "zte_ont", label: "1 ZTEONT", shortLabel: "ZTE ONT", icon: Cpu, count: subtabCounts.zte_ont || 0 },
    { id: "huawei_ont", label: "ONT", shortLabel: "HUAWEI ONT", icon: Cpu, count: subtabCounts.huawei_ont || 0 },
    { id: "zte_mesh", label: "ZTE MESH", shortLabel: "ZTE MESH", icon: Cpu, count: subtabCounts.zte_mesh || 0 },
    { id: "huawei_mesh", label: "1 MESH", shortLabel: "HUAWEI MESH", icon: Cpu, count: subtabCounts.huawei_mesh || 0 },
    { id: "tv_box", label: "2 TV BOX", shortLabel: "TV BOX ZTE", icon: Tv, count: subtabCounts.tv_box || 0 },
    { id: "telef", label: "TELEF", shortLabel: "FONO WIN", icon: Phone, count: subtabCounts.telef || 0 },
  ], [stats, subtabCounts]);

  // Manejador de selección múltiple ("pegarse") para mini pestañas
  const handleToggleSubtab = (id: string) => {
    setPaginaActual(1);
    if (id === "all") {
      setSubtabsActivas([]);
      return;
    }
    setSubtabsActivas(prev => {
      if (prev.includes(id)) {
        return prev.filter(item => item !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  // Cargar datos desde el backend
  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      const filters: EquiposGeneralesFilters = {
        subtab: subtabsActivas.length === 0 ? "all" : subtabsActivas.join(","),
        tipo_fecha: tipoFecha,
        limit: 2500,
      };

      if (searchTerm.trim()) filters.search = searchTerm.trim();
      if (filtroProducto) filters.id_producto = filtroProducto;
      if (filtroAlmacen) filters.almacen = filtroAlmacen;
      if (filtroEstado) filters.estado = filtroEstado;

      if (modoFecha === "mes" && mesSeleccionado) {
        filters.mes = mesSeleccionado;
        if (anioSeleccionado) filters.anio = anioSeleccionado;
      } else if (modoFecha === "semana" && semanaSeleccionada) {
        filters.semana = semanaSeleccionada;
        if (anioSeleccionado) filters.anio = anioSeleccionado;
      } else if (modoFecha === "dia" && fechaDesde) {
        filters.fecha_desde = fechaDesde;
        filters.fecha_hasta = fechaDesde;
      } else if (modoFecha === "rango") {
        if (fechaDesde) filters.fecha_desde = fechaDesde;
        if (fechaHasta) filters.fecha_hasta = fechaHasta;
      }

      const res: EquiposGeneralesResponse = await getEquiposGenerales(filters);
      if (res && res.success) {
        setEquipos(res.data || []);
        if (res.stats) {
          setStats({
            total: Number(res.stats.total) || 0,
            en_almacen: Number(res.stats.en_almacen) || 0,
            en_tecnicos: Number(res.stats.en_tecnicos) || 0,
            liquidados: Number(res.stats.liquidados) || 0,
            de_baja: Number(res.stats.de_baja) || 0,
          });
        }
        if (res.subtab_counts) {
          setSubtabCounts({
            zte_ont: Number(res.subtab_counts.zte_ont) || 0,
            huawei_ont: Number(res.subtab_counts.huawei_ont) || 0,
            zte_mesh: Number(res.subtab_counts.zte_mesh) || 0,
            huawei_mesh: Number(res.subtab_counts.huawei_mesh) || 0,
            tv_box: Number(res.subtab_counts.tv_box) || 0,
            telef: Number(res.subtab_counts.telef) || 0,
            drop_cnt: Number(res.subtab_counts.drop_cnt) || 0,
            utp_cnt: Number(res.subtab_counts.utp_cnt) || 0,
          });
        }
      } else {
        toast.error("No se pudieron cargar los equipos generales");
      }
    } catch (err: any) {
      console.error("Error al cargar equipos generales:", err);
      toast.error(err?.response?.data?.error || "Error al conectar con el servidor");
    } finally {
      setLoading(false);
    }
  }, [
    subtabsActivas,
    tipoFecha,
    searchTerm,
    filtroProducto,
    filtroAlmacen,
    filtroEstado,
    modoFecha,
    mesSeleccionado,
    anioSeleccionado,
    semanaSeleccionada,
    fechaDesde,
    fechaHasta,
  ]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // Formato rápido de fecha D-M-YY para parecerse exactamente al Excel del screenshot
  const formatExcelDate = (val?: string | null): string => {
    if (!val) return "";
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return val;
      const day = d.getDate();
      const month = d.getMonth() + 1;
      const yr = String(d.getFullYear()).slice(-2);
      return `${day}-${month}-${yr}`;
    } catch {
      return val;
    }
  };

  // Copiar al portapapeles
  const handleCopy = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiadoId(id);
    toast.success(`Copiado: ${text}`);
    setTimeout(() => setCopiadoId(null), 1500);
  };

  // Alternar resaltado de fila (rojo/cyan/normal)
  const toggleResaltado = (id: number, color: "red" | "cyan" = "red") => {
    setFilasResaltadas(prev => {
      const actual = prev[id];
      if (actual === color) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: color };
    });
  };


  // Exportar a Excel exactamente con las columnas solicitadas
  const exportarAExcel = () => {
    try {
      const dataToExport = equipos.map(item => ({
        "FECHA INGRESO WIN": formatExcelDate(item.fecha_ingreso_win),
        "NUMERO - SERIE INTERNO": item.numero_serie_interno || "",
        "S/N": item.sn || "",
        "ALMACEN TEC WIN": item.almacen_tec_win || "",
        "FECHA ING. TEC": formatExcelDate(item.fecha_ingreso_tec),
        "ALMACEN LIQ WIN": item.almacen_liq_win || "",
        "FECHA ING. LIQ": formatExcelDate(item.fecha_ingreso_liq),
        "MAC": item.mac || "",
        "FECHA ENTRG. TECNICO": formatExcelDate(item.fecha_entrega_tecnico),
        "NOMBRE TECNICO": item.nombre_tecnico_completo || item.nombre_tecnico || "",
        "FECHA DE INSTALACION": formatExcelDate(item.fecha_instalacion),
        "NOM. CLIENT": item.nom_cliente || "",
        "Nº ACTA": item.numero_acta || "",
        "EQUIPO DE BAJA": item.equipo_baja || "",
        "FECHA INGRESO ALMACEN": formatExcelDate(item.fecha_ingreso_almacen),
        "Nº GUIA": item.numero_guia || "",
        "FECHA ENTREGA ALMACEN WIN": formatExcelDate(item.fecha_entrega_almacen_win),
        "OBSERVACION EQUIPOS": item.observacion_equipos || "",
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Equipos Generales");
      const filename = `Equipos_Generales_WIN_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, filename);
      toast.success("Archivo Excel exportado con éxito");
    } catch (err) {
      console.error("Error al exportar:", err);
      toast.error("Error al generar el archivo Excel");
    }
  };

  // Filtro rápido por chips de fecha
  const setQuickDate = (tipo: "hoy" | "semana" | "mes" | "mes_ant" | "todo") => {
    const hoy = new Date();
    const hoyStr = hoy.toISOString().slice(0, 10);

    if (tipo === "todo") {
      setModoFecha("todos");
      setFechaDesde("");
      setFechaHasta("");
      setMesSeleccionado("");
    } else if (tipo === "hoy") {
      setModoFecha("dia");
      setFechaDesde(hoyStr);
      setFechaHasta(hoyStr);
    } else if (tipo === "semana") {
      setModoFecha("semana");
      // Calcular número de semana ISO aproximada
      const primerDiaAnio = new Date(hoy.getFullYear(), 0, 1);
      const pastDaysOfYear = (hoy.getTime() - primerDiaAnio.getTime()) / 86400000;
      const sem = Math.ceil((pastDaysOfYear + primerDiaAnio.getDay() + 1) / 7);
      setSemanaSeleccionada(String(sem));
      setAnioSeleccionado(String(hoy.getFullYear()));
    } else if (tipo === "mes") {
      setModoFecha("mes");
      setMesSeleccionado(String(hoy.getMonth() + 1));
      setAnioSeleccionado(String(hoy.getFullYear()));
    } else if (tipo === "mes_ant") {
      setModoFecha("mes");
      const mesAnt = hoy.getMonth() === 0 ? 12 : hoy.getMonth();
      const anioAnt = hoy.getMonth() === 0 ? hoy.getFullYear() - 1 : hoy.getFullYear();
      setMesSeleccionado(String(mesAnt));
      setAnioSeleccionado(String(anioAnt));
    }
  };

  // Paginación de items
  const totalItems = equipos.length;
  const totalPaginas = itemsPorPagina === 0 ? 1 : Math.ceil(totalItems / itemsPorPagina);
  const itemsVisibles = useMemo(() => {
    if (itemsPorPagina === 0) return equipos;
    const inicio = (paginaActual - 1) * itemsPorPagina;
    return equipos.slice(inicio, inicio + itemsPorPagina);
  }, [equipos, paginaActual, itemsPorPagina]);

  return (
    <div className="space-y-4">

      {/* ─────────────────────────────────────────────────────────────
          1. HEADER CON TARJETAS DE ESTADÍSTICAS & ACCIONES
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 md:p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="p-2 bg-amber-500/10 text-amber-700 rounded-xl border border-amber-300/40">
                <HardDrive size={20} className="text-amber-600" />
              </span>
              <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                Equipos Generales · Trazabilidad WIN
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                Grid Maestro
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Visualización y conciliación integral de equipos ONT, MESH, TV Box y Telefonía: desde almacén central, entrega a técnico, instalación y liquidación en acta WIN.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto">
            <button
              onClick={exportarAExcel}
              disabled={loading || equipos.length === 0}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              title="Descargar tabla en formato Excel (.xlsx)"
            >
              <Download size={15} />
              <span>Exportar Excel</span>
            </button>
            <button
              onClick={cargarDatos}
              disabled={loading}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-2xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <RefreshCw size={15} className={loading ? "animate-spin text-amber-600" : ""} />
              <span>Actualizar</span>
            </button>
          </div>
        </div>

        {/* Tarjetas KPI Superiores */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
          <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3 flex flex-col">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Equipos</span>
            <span className="text-lg font-black text-slate-900 mt-0.5">{stats.total.toLocaleString()}</span>
            <span className="text-[9px] text-slate-400 font-medium">Registrados en sistema</span>
          </div>

          <div className="bg-emerald-50/60 border border-emerald-200/90 rounded-xl p-3 flex flex-col">
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">En Almacén WIN</span>
            <span className="text-lg font-black text-emerald-900 mt-0.5">{stats.en_almacen.toLocaleString()}</span>
            <span className="text-[9px] text-emerald-600 font-medium">Disponibles central</span>
          </div>

          <div className="bg-sky-50/60 border border-sky-200/90 rounded-xl p-3 flex flex-col">
            <span className="text-[10px] font-bold text-sky-700 uppercase tracking-wider">En Técnicos (TEC)</span>
            <span className="text-lg font-black text-sky-900 mt-0.5">{stats.en_tecnicos.toLocaleString()}</span>
            <span className="text-[9px] text-sky-600 font-medium">En custodia campo</span>
          </div>

          <div className="bg-amber-50/60 border border-amber-200/90 rounded-xl p-3 flex flex-col">
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Liquidados (LIQ)</span>
            <span className="text-lg font-black text-amber-900 mt-0.5">{stats.liquidados.toLocaleString()}</span>
            <span className="text-[9px] text-amber-600 font-medium">Instalados en clientes</span>
          </div>

          <div className="bg-rose-50/60 border border-rose-200/90 rounded-xl p-3 flex flex-col">
            <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">Equipos de Baja</span>
            <span className="text-lg font-black text-rose-900 mt-0.5">{stats.de_baja.toLocaleString()}</span>
            <span className="text-[9px] text-rose-600 font-medium">Retirados / Fallados</span>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. MINI PESTAÑAS (SUB-TABS / FAMILIAS DE EQUIPOS - SELECCIÓN MÚLTIPLE "PEGARSE")
      ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {miniPestanas.map(tab => {
          const isSelected = tab.id === "all"
            ? subtabsActivas.length === 0
            : subtabsActivas.includes(tab.id);
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => handleToggleSubtab(tab.id)}
              className={`px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer shrink-0 border ${
                isSelected
                  ? "bg-slate-900 text-white border-slate-900 shadow-xs ring-2 ring-amber-400/40"
                  : "bg-white text-slate-700 border-slate-200/90 hover:bg-slate-50 hover:text-slate-900"
              }`}
              title={tab.id === "all" ? "Ver todos los equipos" : `Seleccionar / alternar ${tab.label}`}
            >
              <Icon size={14} className={isSelected ? "text-amber-400" : "text-slate-500"} />
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                    isSelected ? "bg-amber-400 text-slate-950" : "bg-slate-100 text-slate-700 border border-slate-200"
                  }`}
                >
                  {tab.count.toLocaleString()}
                </span>
              )}
            </button>
          );
        })}

        {subtabsActivas.length > 0 && (
          <button
            onClick={() => handleToggleSubtab("all")}
            className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200/90 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ml-1 shadow-2xs"
            title="Quitar filtros y mostrar todos los equipos"
          >
            <span>Ver Todos ({stats.total || 0})</span>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
          </button>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. BARRA DE FILTROS COMPLETOS (DÍAS, SEMANAS, MESES, SERIE/MAC)
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3">
        {/* Fila 1: Búsqueda rápida de texto (S/N, MAC, ID Equipo, Acta, etc.) + Selectores de estado */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Input de Búsqueda Multipropósito (Serie, MAC, ID Interno, Acta, etc.) */}
          <div className="md:col-span-8 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setPaginaActual(1);
              }}
              placeholder="Buscar por S/N (Serie), MAC, Serie Interna, N° Acta, N° Guía, Técnico, Cliente..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filtro por Almacén */}
          <div className="md:col-span-2">
            <select
              value={filtroAlmacen}
              onChange={e => {
                setFiltroAlmacen(e.target.value);
                setPaginaActual(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
            >
              <option value="">Almacén (Todos)</option>
              <option value="ALM">ALM · Almacén Central</option>
              <option value="TEC">TEC · En Técnicos</option>
              <option value="LIQ">LIQ · Liquidado / Cliente</option>
            </select>
          </div>

          {/* Filtro por Estado */}
          <div className="md:col-span-2">
            <select
              value={filtroEstado}
              onChange={e => {
                setFiltroEstado(e.target.value);
                setPaginaActual(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
            >
              <option value="">Estado (Todos)</option>
              <option value="DISPONIBLE">DISPONIBLE</option>
              <option value="RESERVADO">RESERVADO (En Técnico)</option>
              <option value="VENDIDO">VENDIDO (Instalado)</option>
              <option value="BAJA">BAJA</option>
            </select>
          </div>
        </div>

        {/* Fila 2: Filtros de Fecha (Días, Semanas, Meses, Años) */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Tipo de Fecha objetivo */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-500 text-[11px] flex items-center gap-1">
              <Calendar size={13} className="text-slate-400" />
              Filtrar por:
            </span>
            <select
              value={tipoFecha}
              onChange={e => setTipoFecha(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
            >
              <option value="ingreso_win">Fecha Ingreso WIN</option>
              <option value="asignacion_tec">Fecha Ingreso / Despacho TEC</option>
              <option value="instalacion">Fecha Instalación (Visita)</option>
              <option value="liquidacion">Fecha Liquidación (Acta)</option>
            </select>

            {/* Selector de Granularidad: Meses, Semanas, Días */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              <button
                onClick={() => setModoFecha("todos")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-all ${
                  modoFecha === "todos" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setModoFecha("mes")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-all ${
                  modoFecha === "mes" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Por Mes
              </button>
              <button
                onClick={() => setModoFecha("semana")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-all ${
                  modoFecha === "semana" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Por Semana
              </button>
              <button
                onClick={() => setModoFecha("dia")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-all ${
                  modoFecha === "dia" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Por Día
              </button>
              <button
                onClick={() => setModoFecha("rango")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-all ${
                  modoFecha === "rango" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Rango
              </button>
            </div>
          </div>

          {/* Controles dinámicos según el modo de fecha */}
          <div className="flex items-center gap-2 flex-wrap">
            {modoFecha === "mes" && (
              <>
                <select
                  value={mesSeleccionado}
                  onChange={e => setMesSeleccionado(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                >
                  <option value="">Seleccionar Mes</option>
                  <option value="1">Enero</option>
                  <option value="2">Febrero</option>
                  <option value="3">Marzo</option>
                  <option value="4">Abril</option>
                  <option value="5">Mayo</option>
                  <option value="6">Junio</option>
                  <option value="7">Julio</option>
                  <option value="8">Agosto</option>
                  <option value="9">Septiembre</option>
                  <option value="10">Octubre</option>
                  <option value="11">Noviembre</option>
                  <option value="12">Diciembre</option>
                </select>
                <select
                  value={anioSeleccionado}
                  onChange={e => setAnioSeleccionado(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                >
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                  <option value="2024">2024</option>
                </select>
              </>
            )}

            {modoFecha === "semana" && (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-500">Semana N°:</span>
                  <input
                    type="number"
                    min="1"
                    max="53"
                    value={semanaSeleccionada}
                    onChange={e => setSemanaSeleccionada(e.target.value)}
                    placeholder="1-52"
                    className="w-16 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                  />
                  <select
                    value={anioSeleccionado}
                    onChange={e => setAnioSeleccionado(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                  >
                    <option value="2026">2026</option>
                    <option value="2025">2025</option>
                  </select>
                </div>
              </>
            )}

            {modoFecha === "dia" && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-500">Día:</span>
                <input
                  type="date"
                  value={fechaDesde}
                  onChange={e => {
                    setFechaDesde(e.target.value);
                    setFechaHasta(e.target.value);
                  }}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                />
              </div>
            )}

            {modoFecha === "rango" && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-500">Desde:</span>
                <input
                  type="date"
                  value={fechaDesde}
                  onChange={e => setFechaDesde(e.target.value)}
                  className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                />
                <span className="text-[11px] font-bold text-slate-500">Hasta:</span>
                <input
                  type="date"
                  value={fechaHasta}
                  onChange={e => setFechaHasta(e.target.value)}
                  className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                />
              </div>
            )}

            {/* Accesos rápidos de fecha */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setQuickDate("hoy")}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-md text-[10px] font-bold text-slate-700 cursor-pointer"
              >
                Hoy
              </button>
              <button
                onClick={() => setQuickDate("semana")}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-md text-[10px] font-bold text-slate-700 cursor-pointer"
              >
                Esta Sem.
              </button>
              <button
                onClick={() => setQuickDate("mes")}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-md text-[10px] font-bold text-slate-700 cursor-pointer"
              >
                Este Mes
              </button>
              <button
                onClick={() => setQuickDate("todo")}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-md text-[10px] font-bold text-slate-700 cursor-pointer"
              >
                Limpiar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. GRID TIPO HOJA DE CÁLCULO EXCEL / SPREADSHEET
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col">
        {/* Barra superior de info del grid */}
        <div className="p-3 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-slate-700">
              Mostrando {itemsVisibles.length} de {equipos.length.toLocaleString()} filas
            </span>
            {loading && <span className="text-amber-600 font-bold animate-pulse">Cargando registros...</span>}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 font-semibold">Filas por pág:</span>
            <select
              value={itemsPorPagina}
              onChange={e => {
                setItemsPorPagina(Number(e.target.value));
                setPaginaActual(1);
              }}
              className="px-2 py-1 bg-white border border-slate-200 rounded-md text-xs font-bold text-slate-700"
            >
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="250">250</option>
              <option value="500">500</option>
              <option value="0">Todos</option>
            </select>
          </div>
        </div>

        {/* Tabla Spreadsheet con estilos idénticos al Excel */}
        <div className="overflow-x-auto max-h-[680px] overflow-y-auto relative font-sans text-xs select-text">
          <table className="w-full text-left border-collapse min-w-[2200px]">
            {/* Headers con acentos amarillos idénticos al screenshot */}
            <thead className="sticky top-0 z-20 font-black tracking-tight text-[11px] uppercase border-b-2 border-slate-300 shadow-2xs">
              <tr className="bg-slate-100 text-slate-800">
                {/* 1. FECHA INGRESO WIN (Amarillo) */}
                <th className="p-2.5 border-r border-slate-200 bg-amber-200/90 text-amber-950 whitespace-nowrap min-w-[110px] text-center">
                  FECHA INGRESO WIN
                </th>

                {/* 2. NUMERO - SERIE INTERNO (Amarillo) */}
                <th className="p-2.5 border-r border-slate-200 bg-amber-200/90 text-amber-950 whitespace-nowrap min-w-[130px]">
                  NUMERO - SERIE INTERNO
                </th>

                {/* 3. S/N */}
                <th className="p-2.5 border-r border-slate-200 bg-slate-100 text-slate-900 whitespace-nowrap min-w-[170px]">
                  S/N
                </th>

                {/* 4. ALMACEN TEC WIN (Amarillo) */}
                <th className="p-2.5 border-r border-slate-200 bg-amber-200/90 text-amber-950 whitespace-nowrap min-w-[80px] text-center">
                  ALMACEN TEC WIN
                </th>

                {/* 5. FECHA ING. TEC (Amarillo) */}
                <th className="p-2.5 border-r border-slate-200 bg-amber-200/90 text-amber-950 whitespace-nowrap min-w-[110px] text-center">
                  FECHA ING. TEC
                </th>

                {/* 6. ALMACEN LIQ WIN (Amarillo) */}
                <th className="p-2.5 border-r border-slate-200 bg-amber-200/90 text-amber-950 whitespace-nowrap min-w-[80px] text-center">
                  ALMACEN LIQ WIN
                </th>

                {/* 7. FECHA ING. LIQ (Amarillo) */}
                <th className="p-2.5 border-r border-slate-200 bg-amber-200/90 text-amber-950 whitespace-nowrap min-w-[110px] text-center">
                  FECHA ING. LIQ
                </th>

                {/* 8. MAC */}
                <th className="p-2.5 border-r border-slate-200 bg-slate-100 text-slate-900 whitespace-nowrap min-w-[150px]">
                  MAC
                </th>

                {/* 9. FECHA ENTRG. TECNICO */}
                <th className="p-2.5 border-r border-slate-200 bg-slate-100 text-slate-900 whitespace-nowrap min-w-[110px] text-center">
                  FECHA ENTRG. TECNICO
                </th>

                {/* 10. NOMBRE TECNICO */}
                <th className="p-2.5 border-r border-slate-200 bg-slate-100 text-slate-900 whitespace-nowrap min-w-[160px]">
                  NOMBRE TECNICO
                </th>

                {/* 11. FECHA DE INSTALACION */}
                <th className="p-2.5 border-r border-slate-200 bg-slate-100 text-slate-900 whitespace-nowrap min-w-[110px] text-center">
                  FECHA DE INSTALACION
                </th>

                {/* 12. NOM. CLIENT */}
                <th className="p-2.5 border-r border-slate-200 bg-slate-100 text-slate-900 whitespace-nowrap min-w-[220px]">
                  NOM. CLIENT
                </th>

                {/* 13. Nº ACTA */}
                <th className="p-2.5 border-r border-slate-200 bg-slate-100 text-slate-900 whitespace-nowrap min-w-[120px] text-center">
                  Nº ACTA
                </th>

                {/* 14. EQUIPO DE BAJA */}
                <th className="p-2.5 border-r border-slate-200 bg-slate-100 text-slate-900 whitespace-nowrap min-w-[170px]">
                  EQUIPO DE BAJA
                </th>

                {/* 15. FECHA INGRESO ALMACEN (Amarillo) */}
                <th className="p-2.5 border-r border-slate-200 bg-amber-200/90 text-amber-950 whitespace-nowrap min-w-[110px] text-center">
                  FECHA INGRESO ALMACEN
                </th>

                {/* 16. Nº GUIA (Amarillo) */}
                <th className="p-2.5 border-r border-slate-200 bg-amber-200/90 text-amber-950 whitespace-nowrap min-w-[120px] text-center">
                  Nº GUIA
                </th>

                {/* 17. FECHA ENTREGA ALMACEN WIN (Amarillo) */}
                <th className="p-2.5 border-r border-slate-200 bg-amber-200/90 text-amber-950 whitespace-nowrap min-w-[120px] text-center">
                  FECHA ENTREGA ALMACEN WIN
                </th>

                {/* 18. OBSERVACION EQUIPOS (Amarillo) */}
                <th className="p-2.5 border-r border-slate-200 bg-amber-200/90 text-amber-950 whitespace-nowrap min-w-[200px]">
                  OBSERVACION EQUIPOS
                </th>
              </tr>
            </thead>

            {/* Cuerpo de la tabla */}
            <tbody className="divide-y divide-slate-200 font-medium">
              {loading && itemsVisibles.length === 0 ? (
                <tr>
                  <td colSpan={18} className="p-12 text-center text-slate-400">
                    <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-amber-600" />
                    <span>Cargando datos del inventario...</span>
                  </td>
                </tr>
              ) : itemsVisibles.length === 0 ? (
                <tr>
                  <td colSpan={18} className="p-12 text-center text-slate-400">
                    <AlertCircle size={28} className="mx-auto mb-2 text-slate-300" />
                    <span>No se encontraron equipos con los filtros seleccionados.</span>
                  </td>
                </tr>
              ) : (
                itemsVisibles.map((item, index) => {
                  const resaltado = filasResaltadas[item.id_producto_serie];
                  const esRojo = resaltado === "red" || item.estado_serie === "BAJA";
                  const esCyan = resaltado === "cyan";

                  return (
                    <tr
                      key={item.id_producto_serie}
                      className={`transition-colors font-mono text-[11px] ${
                        esRojo
                          ? "bg-red-600 text-white hover:bg-red-700 font-bold"
                          : esCyan
                          ? "bg-cyan-100 text-cyan-950 hover:bg-cyan-200 font-bold"
                          : index % 2 === 0
                          ? "bg-white hover:bg-amber-50/50 text-slate-800"
                          : "bg-slate-50/50 hover:bg-amber-50/50 text-slate-800"
                      }`}
                    >
                      {/* 1. FECHA INGRESO WIN */}
                      <td className="p-2 border-r border-slate-200 text-center whitespace-nowrap">
                        {formatExcelDate(item.fecha_ingreso_win)}
                      </td>

                      {/* 2. NUMERO - SERIE INTERNO */}
                      <td className={`p-2 border-r border-slate-200 font-black whitespace-nowrap ${esRojo ? "text-white" : "text-amber-800"}`}>
                        {item.numero_serie_interno || (
                          <span className={esRojo ? "text-red-200" : "text-slate-300"}>—</span>
                        )}
                      </td>

                      {/* 3. S/N (Serie) con botón de copia rápida */}
                      <td className="p-2 border-r border-slate-200 whitespace-nowrap">
                        <div className="flex items-center justify-between gap-1 group">
                          <span
                            className={`font-black ${
                              esRojo
                                ? "text-white"
                                : item.sn?.startsWith("ZTE")
                                ? "text-blue-700"
                                : "text-emerald-700"
                            }`}
                          >
                            {item.sn}
                          </span>
                          <button
                            onClick={() => handleCopy(item.sn, `sn-${item.id_producto_serie}`)}
                            className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-black/10 rounded-sm transition-opacity"
                            title="Copiar S/N"
                          >
                            {copiadoId === `sn-${item.id_producto_serie}` ? (
                              <Check size={12} className={esRojo ? "text-white" : "text-emerald-600"} />
                            ) : (
                              <Copy size={12} className={esRojo ? "text-white" : "text-slate-400"} />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* 4. ALMACEN TEC WIN */}
                      <td className="p-2 border-r border-slate-200 text-center whitespace-nowrap font-bold">
                        {item.almacen_tec_win || (
                          <span className={esRojo ? "text-red-200" : "text-slate-300"}>—</span>
                        )}
                      </td>

                      {/* 5. FECHA ING. TEC */}
                      <td className="p-2 border-r border-slate-200 text-center whitespace-nowrap">
                        {formatExcelDate(item.fecha_ingreso_tec)}
                      </td>

                      {/* 6. ALMACEN LIQ WIN */}
                      <td className="p-2 border-r border-slate-200 text-center whitespace-nowrap font-bold">
                        {item.almacen_liq_win || (
                          <span className={esRojo ? "text-red-200" : "text-slate-300"}>—</span>
                        )}
                      </td>

                      {/* 7. FECHA ING. LIQ */}
                      <td className="p-2 border-r border-slate-200 text-center whitespace-nowrap">
                        {formatExcelDate(item.fecha_ingreso_liq)}
                      </td>

                      {/* 8. MAC */}
                      <td className="p-2 border-r border-slate-200 whitespace-nowrap">
                        <div className="flex items-center justify-between gap-1 group">
                          <span className={`font-semibold ${esRojo ? "text-white" : "text-slate-700"}`}>
                            {item.mac || (
                              <span className={esRojo ? "text-red-200" : "text-slate-300 italic text-[10px]"}>
                                Sin MAC
                              </span>
                            )}
                          </span>
                          {item.mac && (
                            <button
                              onClick={() => handleCopy(item.mac!, `mac-${item.id_producto_serie}`)}
                              className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-black/10 rounded-sm transition-opacity"
                              title="Copiar MAC"
                            >
                              {copiadoId === `mac-${item.id_producto_serie}` ? (
                                <Check size={12} className={esRojo ? "text-white" : "text-emerald-600"} />
                              ) : (
                                <Copy size={12} className={esRojo ? "text-white" : "text-slate-400"} />
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* 9. FECHA ENTRG. TECNICO */}
                      <td className="p-2 border-r border-slate-200 text-center whitespace-nowrap">
                        {formatExcelDate(item.fecha_entrega_tecnico)}
                      </td>

                      {/* 10. NOMBRE TECNICO */}
                      <td className="p-2 border-r border-slate-200 font-bold whitespace-nowrap">
                        <span className={esRojo ? "text-white" : "text-slate-900"}>
                          {item.nombre_tecnico_completo || item.nombre_tecnico || (
                            <span className={esRojo ? "text-red-200" : "text-slate-300"}>—</span>
                          )}
                        </span>
                      </td>

                      {/* 11. FECHA DE INSTALACION */}
                      <td className="p-2 border-r border-slate-200 text-center whitespace-nowrap">
                        {formatExcelDate(item.fecha_instalacion)}
                      </td>

                      {/* 12. NOM. CLIENT */}
                      <td className="p-2 border-r border-slate-200 whitespace-nowrap truncate max-w-[260px]" title={item.nom_cliente || ""}>
                        <span className={esRojo ? "text-white" : "text-slate-800 font-sans"}>
                          {item.nom_cliente || (
                            <span className={esRojo ? "text-red-200" : "text-slate-300"}>—</span>
                          )}
                        </span>
                      </td>

                      {/* 13. Nº ACTA */}
                      <td className="p-2 border-r border-slate-200 text-center whitespace-nowrap font-bold">
                        {item.numero_acta ? (
                          <span className={esRojo ? "text-white underline" : "text-sky-700 underline"}>
                            {item.numero_acta}
                          </span>
                        ) : (
                          <span className={esRojo ? "text-red-200" : "text-slate-300"}>—</span>
                        )}
                      </td>

                      {/* 14. EQUIPO DE BAJA */}
                      <td className="p-2 border-r border-slate-200 whitespace-nowrap">
                        <span className={esRojo ? "text-white font-bold" : "text-slate-700"}>
                          {item.equipo_baja || (
                            <span className={esRojo ? "text-red-200" : "text-slate-300"}>—</span>
                          )}
                        </span>
                      </td>

                      {/* 15. FECHA INGRESO ALMACEN */}
                      <td className="p-2 border-r border-slate-200 text-center whitespace-nowrap">
                        {formatExcelDate(item.fecha_ingreso_almacen)}
                      </td>

                      {/* 16. Nº GUIA */}
                      <td className="p-2 border-r border-slate-200 text-center whitespace-nowrap">
                        {item.numero_guia || (
                          <span className={esRojo ? "text-red-200" : "text-slate-300"}>—</span>
                        )}
                      </td>

                      {/* 17. FECHA ENTREGA ALMACEN WIN */}
                      <td className="p-2 border-r border-slate-200 text-center whitespace-nowrap">
                        {formatExcelDate(item.fecha_entrega_almacen_win)}
                      </td>

                      {/* 18. OBSERVACION EQUIPOS */}
                      <td className="p-2 border-r border-slate-200 whitespace-nowrap truncate max-w-[220px]" title={item.observacion_equipos || ""}>
                        <span className={esRojo ? "text-white font-sans text-[10px]" : "text-slate-500 font-sans text-[10px]"}>
                          {item.observacion_equipos || (
                            <span className={esRojo ? "text-red-200" : "text-slate-300"}>—</span>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            5. FOOTER CON CONTROLES DE PAGINACIÓN
        ───────────────────────────────────────────────────────────── */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 py-2.5 flex items-center justify-between text-xs">
          <div className="text-slate-500 font-semibold text-[11px]">
            Mostrando <span className="font-bold text-slate-800">{itemsVisibles.length}</span> de <span className="font-bold text-slate-800">{equipos.length.toLocaleString()}</span> registros
          </div>

          {/* Controles de Paginación */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-600">
              Página {paginaActual} de {totalPaginas || 1}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPaginaActual(prev => Math.max(prev - 1, 1))}
                disabled={paginaActual === 1 || loading}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
                title="Página anterior"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                onClick={() => setPaginaActual(prev => Math.min(prev + 1, totalPaginas))}
                disabled={paginaActual >= totalPaginas || loading}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
                title="Página siguiente"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeneralEquipmentTab;
