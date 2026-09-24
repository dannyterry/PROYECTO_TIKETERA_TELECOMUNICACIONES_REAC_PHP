import React, { useState, useEffect, useMemo } from "react";
import {
  Activity,
  Search,
  Filter,
  Download,
  RefreshCw,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  FileCheck,
  Calendar,
  Layers,
  Package,
  Truck,
  Copy,
  Check,
  Building2,
  FileSpreadsheet,
  AlertCircle
} from "lucide-react";
import * as XLSX from "xlsx";
import { KardexMovimientoItem, KardexKPIs, ProductoStock } from "../types/inventoryTypes";
import { getKardexMovimientos } from "../services/inventoryService";

interface Props {
  productos?: ProductoStock[];
}

export const KardexOverviewTab: React.FC<Props> = ({ productos = [] }) => {
  const [movimientos, setMovimientos] = useState<KardexMovimientoItem[]>([]);
  const [kpis, setKpis] = useState<KardexKPIs>({
    totalMovimientos: 0,
    totalEntradas: 0,
    totalDespachos: 0,
    totalDevoluciones: 0,
    totalConsumidoOrdenes: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [search, setSearch] = useState<string>("");
  const [tipoFiltro, setTipoFiltro] = useState<string>("TODOS");
  const [subtipoFiltro, setSubtipoFiltro] = useState<string>("TODOS");
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("TODAS");
  const [productoFiltro, setProductoFiltro] = useState<string>("TODOS");
  const [fechaDesde, setFechaDesde] = useState<string>("");
  const [fechaHasta, setFechaHasta] = useState<string>("");

  // Paginación
  const [paginaActual, setPaginaActual] = useState<number>(1);
  const [itemsPorPagina, setItemsPorPagina] = useState<number>(50);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

  // Cargar datos
  const cargarKardex = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {};
      if (fechaDesde) params.fechaDesde = fechaDesde;
      if (fechaHasta) params.fechaHasta = fechaHasta;
      if (tipoFiltro !== "TODOS") params.tipo = tipoFiltro;
      if (subtipoFiltro !== "TODOS") params.subtipo = subtipoFiltro;
      if (productoFiltro !== "TODOS") params.idProducto = Number(productoFiltro);
      if (search.trim()) params.search = search.trim();

      const res = await getKardexMovimientos(params);
      if (res.success) {
        setMovimientos(res.movimientos || []);
        if (res.kpis) setKpis(res.kpis);
      } else {
        setError(res.error || "Error al cargar movimientos de Kardex.");
      }
    } catch (err: any) {
      console.error("Error al cargar Kardex:", err);
      setError(err.message || "Error al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarKardex();
  }, [tipoFiltro, subtipoFiltro, productoFiltro, fechaDesde, fechaHasta]);

  // Lista única de categorías
  const categoriasUnicas = useMemo(() => {
    const setCats = new Set<string>();
    productos.forEach((p) => {
      if (p.categoria) setCats.add(p.categoria.toUpperCase());
    });
    return Array.from(setCats).sort();
  }, [productos]);

  // Filtrado local adicional para búsqueda y categoría
  const movimientosFiltrados = useMemo(() => {
    return movimientos.filter((m) => {
      if (categoriaFiltro !== "TODAS" && (m.categoria || "").toUpperCase() !== categoriaFiltro) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchProd = (m.producto_nombre || "").toLowerCase().includes(q);
        const matchCod = (m.producto_codigo || "").toLowerCase().includes(q);
        const matchRef = (m.referencia || "").toLowerCase().includes(q);
        const matchSn = (m.numero_serie || "").toLowerCase().includes(q);
        const matchCat = (m.categoria || "").toLowerCase().includes(q);
        if (!matchProd && !matchCod && !matchRef && !matchSn && !matchCat) return false;
      }
      return true;
    });
  }, [movimientos, categoriaFiltro, search]);

  // Paginación
  const totalPaginas = Math.ceil(movimientosFiltrados.length / itemsPorPagina) || 1;
  const movimientosPaginados = useMemo(() => {
    const inicio = (paginaActual - 1) * itemsPorPagina;
    return movimientosFiltrados.slice(inicio, inicio + itemsPorPagina);
  }, [movimientosFiltrados, paginaActual, itemsPorPagina]);

  const copiarTexto = (txt: string, idKey: string) => {
    navigator.clipboard.writeText(txt);
    setCopiadoId(idKey);
    setTimeout(() => setCopiadoId(null), 2000);
  };

  // Exportar a Excel
  const exportarExcel = () => {
    try {
      const dataToExport = movimientosFiltrados.map((m, idx) => ({
        "N°": idx + 1,
        "ID Registro": m.id_unico,
        "Fecha & Hora": new Date(m.fecha).toLocaleString("es-PE", { timeZone: "America/Lima" }),
        "Tipo Movimiento": m.tipo,
        "Operación / Subtipo":
          m.subtipo === "COMPRA_INGRESO"
            ? "Compra / Entrada Almacén"
            : m.subtipo === "DESPACHO_TECNICO"
            ? "Despacho a Técnico (Salida)"
            : m.subtipo === "DEVOLUCION_TECNICO"
            ? "Devolución a Almacén (Retorno)"
            : m.subtipo === "LIQUIDACION_ORDEN"
            ? "Consumo en Orden de Trabajo"
            : m.subtipo,
        "Código Producto": m.producto_codigo || "-",
        "Producto": m.producto_nombre,
        "Categoría": m.categoria,
        "Cantidad": m.cantidad,
        "Unidad": m.es_drop ? "Metros" : "Unidades",
        "N° de Serie": m.numero_serie || "-",
        "Referencia / Documento / Detalle": m.referencia,
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Kardex_Movimientos");

      const fechaStr = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `Kardex_General_Movimientos_${fechaStr}.xlsx`);
    } catch (e) {
      console.error("Error al exportar Kardex a Excel:", e);
      alert("Error al generar el archivo Excel de Kardex.");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-800">
      {/* ─────────────────────────────────────────────────────────────
          1. HEADER CON TITULO Y ACCIONES
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-800 text-white flex items-center justify-center shadow-md shadow-indigo-100">
              <Activity size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                  Kardex General de Movimientos & Trazabilidad
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-wide">
                  En Vivo
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Bitácora global unificada: Ingresos por Compras, Despachos a Cuadrillas, Devoluciones a Almacén y Consumos en Órdenes.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={cargarKardex}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            title="Refrescar movimientos"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Actualizar</span>
          </button>

          <button
            onClick={exportarExcel}
            disabled={movimientosFiltrados.length === 0}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-sm cursor-pointer disabled:opacity-50"
          >
            <FileSpreadsheet size={15} />
            <span>Exportar Excel ({movimientosFiltrados.length})</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. KPI CARDS RESUMEN
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Total Movimientos */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Movimientos</span>
            <Activity size={16} className="text-indigo-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">
            {kpis.totalMovimientos.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500 font-medium mt-0.5">Operaciones registradas</div>
        </div>

        {/* Entradas / Compras */}
        <div className="bg-white p-4 rounded-2xl border border-emerald-100 bg-emerald-50/20 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-600">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Entradas / Compras</span>
            <ArrowDownLeft size={16} />
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-700">
            +{kpis.totalEntradas.toLocaleString()}
          </div>
          <div className="text-[10px] text-emerald-600/80 font-medium mt-0.5">Ingresos a Almacén Central</div>
        </div>

        {/* Despachos a Técnicos */}
        <div className="bg-white p-4 rounded-2xl border border-blue-100 bg-blue-50/20 shadow-2xs">
          <div className="flex items-center justify-between text-blue-600">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Despachos a Técnicos</span>
            <Truck size={16} />
          </div>
          <div className="mt-2 text-2xl font-black text-blue-700">
            -{kpis.totalDespachos.toLocaleString()}
          </div>
          <div className="text-[10px] text-blue-600/80 font-medium mt-0.5">Entregado a cuadrillas</div>
        </div>

        {/* Devoluciones a Almacén */}
        <div className="bg-white p-4 rounded-2xl border border-amber-100 bg-amber-50/20 shadow-2xs">
          <div className="flex items-center justify-between text-amber-600">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Devuelto a Almacén</span>
            <RotateCcw size={16} />
          </div>
          <div className="mt-2 text-2xl font-black text-amber-700">
            +{kpis.totalDevoluciones.toLocaleString()}
          </div>
          <div className="text-[10px] text-amber-600/80 font-medium mt-0.5">Retornos de cuadrillas</div>
        </div>

        {/* Consumo en Órdenes */}
        <div className="bg-white p-4 rounded-2xl border border-purple-100 bg-purple-50/20 shadow-2xs">
          <div className="flex items-center justify-between text-purple-600">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Consumo en Órdenes</span>
            <FileCheck size={16} />
          </div>
          <div className="mt-2 text-2xl font-black text-purple-700">
            -{kpis.totalConsumidoOrdenes.toLocaleString()}
          </div>
          <div className="text-[10px] text-purple-600/80 font-medium mt-0.5">Descargado en clientes</div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. BARRA DE FILTROS AVANZADOS
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-3.5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Buscador */}
          <div className="md:col-span-4 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Buscar producto, serie, orden, técnico o referencia..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
            />
          </div>

          {/* Filtro Subtipo / Operación */}
          <div className="md:col-span-3">
            <select
              value={subtipoFiltro}
              onChange={(e) => {
                setSubtipoFiltro(e.target.value);
                setPaginaActual(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:outline-none cursor-pointer"
            >
              <option value="TODOS">⚡ Todas las Operaciones</option>
              <option value="COMPRA_INGRESO">📥 Compras / Ingresos a Almacén</option>
              <option value="DESPACHO_TECNICO">🚚 Despachos a Técnicos (Salida)</option>
              <option value="DEVOLUCION_TECNICO">↩️ Devoluciones a Almacén (Retorno)</option>
              <option value="LIQUIDACION_ORDEN">🛠️ Consumo en Órdenes de Campo</option>
              <option value="AJUSTE_INVENTARIO">⚙️ Ajustes de Inventario</option>
            </select>
          </div>

          {/* Filtro Categoría */}
          <div className="md:col-span-2">
            <select
              value={categoriaFiltro}
              onChange={(e) => {
                setCategoriaFiltro(e.target.value);
                setPaginaActual(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:outline-none cursor-pointer"
            >
              <option value="TODAS">🏷️ Todas las Categorías</option>
              {categoriasUnicas.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Rango de Fechas */}
          <div className="md:col-span-3 flex items-center gap-1.5">
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => {
                setFechaDesde(e.target.value);
                setPaginaActual(1);
              }}
              className="w-1/2 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
              title="Fecha Desde"
            />
            <span className="text-slate-400 text-xs font-bold">-</span>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => {
                setFechaHasta(e.target.value);
                setPaginaActual(1);
              }}
              className="w-1/2 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
              title="Fecha Hasta"
            />
          </div>
        </div>

        {/* Píldoras rápidas de filtrado */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
          <span className="text-[11px] font-bold text-slate-400 mr-1">Filtro rápido:</span>
          {[
            { id: "TODOS", label: "Todos los registros" },
            { id: "COMPRA_INGRESO", label: "📥 Compras" },
            { id: "DESPACHO_TECNICO", label: "🚚 Despachos" },
            { id: "DEVOLUCION_TECNICO", label: "↩️ Devoluciones" },
            { id: "LIQUIDACION_ORDEN", label: "🛠️ Órdenes Campo" },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => {
                setSubtipoFiltro(pill.id);
                setPaginaActual(1);
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                subtipoFiltro === pill.id
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {pill.label}
            </button>
          ))}

          {(fechaDesde || fechaHasta || search || categoriaFiltro !== "TODAS" || subtipoFiltro !== "TODOS") && (
            <button
              onClick={() => {
                setSearch("");
                setTipoFiltro("TODOS");
                setSubtipoFiltro("TODOS");
                setCategoriaFiltro("TODAS");
                setProductoFiltro("TODOS");
                setFechaDesde("");
                setFechaHasta("");
                setPaginaActual(1);
              }}
              className="ml-auto text-[11px] text-rose-600 hover:text-rose-800 font-bold underline cursor-pointer"
            >
              Limpiar todos los filtros
            </button>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. TABLA GRID DE MOVIMIENTOS
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-16 text-center space-y-3">
            <RefreshCw className="animate-spin text-indigo-600 mx-auto" size={32} />
            <div className="text-sm font-bold text-slate-700">Cargando bitácora de movimientos...</div>
            <p className="text-xs text-slate-400">Unificando compras, despachos, devoluciones y órdenes.</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center space-y-3">
            <AlertCircle className="text-rose-500 mx-auto" size={32} />
            <div className="text-sm font-bold text-rose-700">{error}</div>
            <button
              onClick={cargarKardex}
              className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800"
            >
              Reintentar
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-400 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3.5 w-12 text-center">#</th>
                    <th className="py-3 px-3.5 whitespace-nowrap">Fecha & Hora</th>
                    <th className="py-3 px-3.5 text-center">Operación</th>
                    <th className="py-3 px-3.5">Producto</th>
                    <th className="py-3 px-3.5">Categoría</th>
                    <th className="py-3 px-3.5 text-center">Cantidad</th>
                    <th className="py-3 px-3.5">Serie / Código</th>
                    <th className="py-3 px-3.5">Referencia / Comprobante / Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {movimientosPaginados.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                        No se encontraron movimientos registrados con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    movimientosPaginados.map((m, idx) => {
                      const numGlobal = (paginaActual - 1) * itemsPorPagina + idx + 1;
                      const dateObj = new Date(m.fecha);
                      const fechaFormatted = dateObj.toLocaleDateString("es-PE", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        timeZone: "America/Lima",
                      });
                      const horaFormatted = dateObj.toLocaleTimeString("es-PE", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        timeZone: "America/Lima",
                      });

                      // Badge de Operación
                      let badge = (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-100 text-slate-700 border border-slate-200">
                          {m.tipo}
                        </span>
                      );

                      if (m.subtipo === "COMPRA_INGRESO") {
                        badge = (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <ArrowDownLeft size={11} className="text-emerald-600" />
                            COMPRA / INGRESO
                          </span>
                        );
                      } else if (m.subtipo === "DESPACHO_TECNICO") {
                        badge = (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-50 text-blue-800 border border-blue-200">
                            <Truck size={11} className="text-blue-600" />
                            DESPACHO CUADRILLA
                          </span>
                        );
                      } else if (m.subtipo === "DEVOLUCION_TECNICO") {
                        badge = (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-300">
                            <RotateCcw size={11} className="text-amber-600" />
                            DEVOLUCIÓN A ALMACÉN
                          </span>
                        );
                      } else if (m.subtipo === "LIQUIDACION_ORDEN") {
                        badge = (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-purple-50 text-purple-800 border border-purple-200">
                            <FileCheck size={11} className="text-purple-600" />
                            CONSUMO EN ORDEN
                          </span>
                        );
                      }

                      return (
                        <tr key={m.id_unico} className="hover:bg-slate-50/80 transition-colors">
                          {/* # */}
                          <td className="py-3 px-3.5 text-center text-slate-400 font-mono text-[11px]">
                            {numGlobal}
                          </td>

                          {/* Fecha & Hora */}
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <div className="font-bold text-slate-900">{fechaFormatted}</div>
                            <div className="text-[10px] font-mono text-slate-400">{horaFormatted}</div>
                          </td>

                          {/* Operación */}
                          <td className="py-3 px-3.5 text-center whitespace-nowrap">
                            {badge}
                          </td>

                          {/* Producto */}
                          <td className="py-3 px-3.5">
                            <div className="font-bold text-slate-900">{m.producto_nombre}</div>
                            {m.producto_codigo && (
                              <span className="text-[10px] font-mono text-slate-400">
                                {m.producto_codigo}
                              </span>
                            )}
                          </td>

                          {/* Categoría */}
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              {m.categoria}
                            </span>
                          </td>

                          {/* Cantidad */}
                          <td className="py-3 px-3.5 text-center font-mono font-bold whitespace-nowrap">
                            <span
                              className={
                                m.tipo === "ENTRADA"
                                  ? "text-emerald-700 font-black"
                                  : "text-slate-800"
                              }
                            >
                              {m.tipo === "ENTRADA" ? "+" : "-"}
                              {m.cantidad} {m.es_drop ? "m" : "und"}
                            </span>
                          </td>

                          {/* Serie */}
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            {m.numero_serie ? (
                              <button
                                onClick={() => copiarTexto(m.numero_serie!, m.id_unico)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-[11px] font-bold cursor-pointer transition-all border border-slate-200"
                                title="Copiar número de serie"
                              >
                                <span>{m.numero_serie}</span>
                                {copiadoId === m.id_unico ? (
                                  <Check size={11} className="text-emerald-600" />
                                ) : (
                                  <Copy size={11} className="text-slate-400" />
                                )}
                              </button>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>

                          {/* Referencia */}
                          <td className="py-3 px-3.5 text-slate-600 font-medium max-w-xs truncate" title={m.referencia}>
                            {m.referencia}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            <div className="p-4 bg-slate-50/80 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="text-slate-500 font-medium">
                Mostrando <strong className="text-slate-900">{movimientosPaginados.length}</strong> de{" "}
                <strong className="text-slate-900">{movimientosFiltrados.length}</strong> movimientos
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
                  disabled={paginaActual === 1}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                >
                  Anterior
                </button>
                <span className="font-bold text-slate-700 text-xs px-2">
                  Página {paginaActual} de {totalPaginas}
                </span>
                <button
                  onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
                  disabled={paginaActual === totalPaginas}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
