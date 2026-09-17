import React, { useState, useEffect, useCallback } from "react";
import { API_URL } from "../../../config/api";
import {
  Wrench,
  ShoppingBag,
  TrendingUp,
  FileSpreadsheet,
  Calendar,
  Layers,
  CheckCircle2,
  Percent,
  RefreshCw,
  ShieldAlert,
  Users,
  Scale,
  Database,
  Award,
  ArrowRight,
  Search,
} from "lucide-react";
import { MonthlyOrdersAuditModal } from "./MonthlyOrdersAuditModal";
import { WinAuditLogSection } from "./WinAuditLogSection";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ComposedChart,
  ReferenceLine,
} from "recharts";
import * as XLSX from "xlsx";

interface MetricStat {
  asignadas: number;
  finalizadas: number;
  efectividad: number;
  cumplidas: number;
  cumplimiento: number;
}

interface MesStat {
  mesNumero: number;
  mesNombre: string;
  averias: MetricStat;
  postventa: MetricStat;
}

interface TotalesAnio {
  averias: MetricStat;
  postventa: MetricStat;
}

interface CuadrillaStat {
  gestion: string;
  cantidad: number;
}

interface ModoDataset {
  totalesAnio: TotalesAnio;
  meses: MesStat[];
}

interface ApiResponse {
  success: boolean;
  anio: number;
  aniosDisponibles: number[];
  cuadrillas?: CuadrillaStat[];
  totalesAnio: TotalesAnio;
  meses: MesStat[];
  modos?: {
    oficial: ModoDataset;
    db_producto: ModoDataset;
    db_hibrido: ModoDataset;
  };
}

export type ModoCalculo = "oficial" | "db_producto" | "comparativo";

export const MonthlyEffectivenessSection: React.FC = () => {
  const [anioSeleccionado, setAnioSeleccionado] = useState<number>(new Date().getFullYear());
  const [aniosDisponibles, setAniosDisponibles] = useState<number[]>([new Date().getFullYear()]);
  const [modoMetrica, setModoMetrica] = useState<"efectividad" | "cumplimiento" | "ambas">("efectividad");
  const [modoCalculo, setModoCalculo] = useState<ModoCalculo>("oficial");
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [modalAuditoria, setModalAuditoria] = useState<{
    isOpen: boolean;
    mes: number;
    mesNombre: string;
    categoria: "AVERIAS" | "POSTVENTA" | "ALL";
  }>({
    isOpen: false,
    mes: 1,
    mesNombre: "Enero",
    categoria: "ALL",
  });

  const abrirAuditoria = (mesNum: number, mesNom: string, cat: "AVERIAS" | "POSTVENTA" | "ALL" = "ALL") => {
    setModalAuditoria({
      isOpen: true,
      mes: mesNum,
      mesNombre: mesNom,
      categoria: cat,
    });
  };

  const cargarDatos = useCallback(async (year: number) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/dashboard/efectividad-mensual-averias-postventa?anio=${year}`);
      if (!res.ok) throw new Error("Error al consultar efectividad mensual");
      const json: ApiResponse = await res.json();
      if (json && json.success) {
        setData(json);
        if (json.aniosDisponibles && json.aniosDisponibles.length > 0) {
          setAniosDisponibles(json.aniosDisponibles);
        }
      }
    } catch (err) {
      console.error("Error al cargar efectividad mensual Averias vs Postventa:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos(anioSeleccionado);
  }, [anioSeleccionado, cargarDatos]);

  // Obtener datasets activos según modo
  const datasetOficial: ModoDataset = data?.modos?.oficial || {
    totalesAnio: data?.totalesAnio || {
      averias: { asignadas: 0, finalizadas: 0, efectividad: 0, cumplidas: 0, cumplimiento: 0 },
      postventa: { asignadas: 0, finalizadas: 0, efectividad: 0, cumplidas: 0, cumplimiento: 0 },
    },
    meses: data?.meses || [],
  };

  const datasetDbProducto: ModoDataset = data?.modos?.db_hibrido || data?.modos?.db_producto || datasetOficial;

  const datasetActivo: ModoDataset =
    modoCalculo === "db_producto" ? datasetDbProducto : datasetOficial;

  const isEfectividad = modoMetrica === "efectividad";
  const isCumplimiento = modoMetrica === "cumplimiento";
  const isComparativo = modoCalculo === "comparativo";

  // Preparar datos para el gráfico combinado (filtrando meses futuros sin actividad para evitar caída a 0%)
  const chartData = (datasetActivo.meses || [])
    .filter((m) => m.averias.asignadas > 0 || m.postventa.asignadas > 0)
    .map((m) => {
      const isCurrentMonth = m.mesNumero === (new Date().getMonth() + 1) && (data?.anio || anioSeleccionado) === new Date().getFullYear();
      return {
        mes: m.mesNombre.substring(0, 3),
        nombreCompleto: m.mesNombre,
        isCurrentMonth,
        asigAv: m.averias.asignadas,
        finAv: isCumplimiento ? m.averias.cumplidas : m.averias.finalizadas,
        asigPv: m.postventa.asignadas,
        finPv: isCumplimiento ? m.postventa.cumplidas : m.postventa.finalizadas,
        "% Ef. Averías": m.averias.efectividad,
        "% Ef. Postventa": m.postventa.efectividad,
        "% Cumpl. Averías": m.averias.cumplimiento,
        "% Cumpl. Postventa": m.postventa.cumplimiento,
      };
    });

  // Exportar reporte consolidado a Excel
  const handleExportExcel = () => {
    if (!data) return;

    const consolidatedHeaders = [
      "Mes",
      "Asig. Averías",
      "Fin. Averías",
      "% Ef. Averías",
      "Cumplidas Averías",
      "% Cumpl. Averías",
      "Asig. Postventa",
      "Fin. Postventa",
      "% Ef. Postventa",
      "Cumplidas Postventa",
      "% Cumpl. Postventa",
    ];

    const generateRows = (ds: ModoDataset) => [
      ...ds.meses.map((m) => [
        m.mesNombre,
        m.averias.asignadas,
        m.averias.finalizadas,
        `${m.averias.efectividad}%`,
        m.averias.cumplidas,
        `${m.averias.cumplimiento}%`,
        m.postventa.asignadas,
        m.postventa.finalizadas,
        `${m.postventa.efectividad}%`,
        m.postventa.cumplidas,
        `${m.postventa.cumplimiento}%`,
      ]),
      [
        `TOTAL ${data.anio}`,
        ds.totalesAnio.averias.asignadas,
        ds.totalesAnio.averias.finalizadas,
        `${ds.totalesAnio.averias.efectividad}%`,
        ds.totalesAnio.averias.cumplidas,
        `${ds.totalesAnio.averias.cumplimiento}%`,
        ds.totalesAnio.postventa.asignadas,
        ds.totalesAnio.postventa.finalizadas,
        `${ds.totalesAnio.postventa.efectividad}%`,
        ds.totalesAnio.postventa.cumplidas,
        `${ds.totalesAnio.postventa.cumplimiento}%`,
      ],
    ];

    const wb = XLSX.utils.book_new();

    // Hoja 1: Oficial WIN
    const wsOficial = XLSX.utils.aoa_to_sheet([
      [`REPORTE DE EFECTIVIDAD Y CUMPLIMIENTO: OFICIAL WIN / HÍBRIDO (${data.anio})`],
      [],
      consolidatedHeaders,
      ...generateRows(datasetOficial),
    ]);
    XLSX.utils.book_append_sheet(wb, wsOficial, `Oficial_WIN_${data.anio}`);

    // Hoja 2: BD Producto Fénix
    const wsProducto = XLSX.utils.aoa_to_sheet([
      [`REPORTE DE EFECTIVIDAD Y CUMPLIMIENTO: AGRUPADO POR COLUMNA PRODUCTO (${data.anio})`],
      [],
      consolidatedHeaders,
      ...generateRows(datasetDbProducto),
    ]);
    XLSX.utils.book_append_sheet(wb, wsProducto, `BD_Producto_${data.anio}`);

    XLSX.writeFile(wb, `Efectividad_Averias_vs_Postventa_${data.anio}.xlsx`);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs space-y-6">
      {/* ── HEADER CON SELECTORES (AÑO, METODOLOGÍA Y MÉTRICA) ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shadow-2xs">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                {isCumplimiento ? "Cumplimiento Operativo" : "Efectividad Operativa"}: Averías vs Postventa
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                Año {anioSeleccionado}
              </span>
              {modoCalculo === "oficial" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                  <Award size={11} className="text-amber-600" />
                  Oficial WIN (Híbrido)
                </span>
              )}
              {modoCalculo === "db_producto" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-900 border border-emerald-200">
                  <Database size={11} className="text-emerald-600" />
                  BD Real (Columna Producto)
                </span>
              )}
              {modoCalculo === "comparativo" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-900 border border-indigo-200">
                  <Scale size={11} className="text-indigo-600" />
                  Modo Comparativa Side-by-Side
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isCumplimiento
                ? "Mide el cumplimiento global (órdenes atendidas/liquidadas y canceladas ajenas a la contrata / imputables al cliente)."
                : "Mide el ratio neto de efectividad (órdenes 100% finalizadas y liquidadas respecto al total asignado)."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Selector de Metodología de Cálculo: Oficial WIN vs BD Producto vs Comparativa */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setModoCalculo("oficial")}
              className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                modoCalculo === "oficial"
                  ? "bg-white text-amber-950 shadow-xs font-black"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="Cierres auditados oficiales de actas WIN con cálculo híbrido inteligente"
            >
              <Award size={13} className={modoCalculo === "oficial" ? "text-amber-600" : "text-slate-400"} />
              <span>Oficial WIN</span>
            </button>
            <button
              type="button"
              onClick={() => setModoCalculo("db_producto")}
              className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                modoCalculo === "db_producto"
                  ? "bg-white text-emerald-950 shadow-xs font-black"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="Cálculo 100% dinámico agrupando estrictamente por la columna producto de la base de datos"
            >
              <Database size={13} className={modoCalculo === "db_producto" ? "text-emerald-600" : "text-slate-400"} />
              <span>BD Producto</span>
            </button>
            <button
              type="button"
              onClick={() => setModoCalculo("comparativo")}
              className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                modoCalculo === "comparativo"
                  ? "bg-indigo-600 text-white shadow-xs font-black"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="Comparar ambas metodologías lado a lado para auditar diferencias"
            >
              <Scale size={13} className={modoCalculo === "comparativo" ? "text-white" : "text-slate-400"} />
              <span>⚖️ Comparar</span>
            </button>
          </div>

          {/* Selector de Métrica: Efectividad vs Cumplimiento */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setModoMetrica("efectividad")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                isEfectividad
                  ? "bg-white text-indigo-900 shadow-xs font-black"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Efectividad
            </button>
            <button
              type="button"
              onClick={() => setModoMetrica("cumplimiento")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                isCumplimiento
                  ? "bg-white text-indigo-900 shadow-xs font-black"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Cumplimiento
            </button>
          </div>

          {/* Selector de Año */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl shadow-2xs">
            <Calendar size={14} className="text-slate-500" />
            <span className="text-xs font-bold text-slate-600">Año:</span>
            <select
              value={anioSeleccionado}
              onChange={(e) => setAnioSeleccionado(parseInt(e.target.value, 10))}
              className="bg-transparent text-xs font-black text-slate-900 outline-none cursor-pointer"
            >
              {aniosDisponibles.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => cargarDatos(anioSeleccionado)}
            disabled={loading}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors cursor-pointer shadow-2xs"
            title="Recargar datos"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>

          {/* Botón Exportar a Excel */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm shadow-emerald-600/20 cursor-pointer"
            title="Descargar reporte comparativo en Excel (.xlsx)"
          >
            <FileSpreadsheet size={15} />
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>

      {/* ── CUADRO DE CUADRILLAS POR GESTIÓN ── */}
      <div className="flex flex-wrap items-center gap-4 bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200/80">
        <div className="inline-block rounded-xl overflow-hidden border border-rose-300 shadow-2xs bg-white">
          <table className="text-xs border-collapse">
            <thead>
              <tr className="bg-[#9c2525] text-white text-[11px] font-black uppercase tracking-wider">
                <th className="py-1.5 px-4 text-left border-r border-rose-800">GESTIÓN</th>
                <th className="py-1.5 px-4 text-center">CANTIDAD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rose-100 text-slate-800 font-bold text-[11.5px]">
              {(data?.cuadrillas || [
                { gestion: "AVERIAS", cantidad: 12 },
                { gestion: "POST VENTA", cantidad: 2 },
                { gestion: "PEXT", cantidad: 4 },
              ]).map((c, idx) => (
                <tr key={idx} className="hover:bg-rose-50/50">
                  <td className="py-1.5 px-4 border-r border-rose-200 uppercase tracking-wide">
                    {c.gestion}
                  </td>
                  <td className="py-1.5 px-4 text-center font-mono font-black text-rose-950 text-xs">
                    {c.cantidad}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-xs text-slate-500 max-w-lg">
          <span className="font-bold text-slate-800 block">📊 Distribución Operativa de Cuadrillas:</span>
          Muestra la dotación activa de cuadrillas en campo distribuidas por línea de gestión (Averías, Postventa y Planta Externa / PEXT).
        </div>
      </div>

      {/* ── SECCIÓN 1: VISTA NORMAL (OFICIAL O BD PRODUCTO) ── */}
      {!isComparativo ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* ══ TABLA 1: AVERIAS ══ */}
          <div className="bg-white rounded-2xl border border-sky-200 shadow-2xs overflow-hidden flex flex-col justify-between">
            <div className="p-3.5 bg-sky-50/70 border-b border-sky-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-sky-100 text-sky-800 rounded-lg">
                  <Wrench size={16} />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-sky-950 uppercase tracking-wide">
                    {isCumplimiento ? "CUMPLIMIENTO AVERIAS" : "EFECTIVIDAD AVERIAS"}
                  </h3>
                  <span className="text-[10px] font-bold text-sky-700">
                    {modoCalculo === "oficial" ? "Fuente: Oficial WIN / Híbrido" : "Fuente: BD ordenes.producto"}
                  </span>
                </div>
              </div>
              <span className="text-xs font-bold text-sky-800 font-mono">
                Año {data?.anio || anioSeleccionado}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-separate border-spacing-0">
                <thead>
                  <tr className="bg-sky-100/70 text-sky-950 text-[11px] font-black uppercase">
                    <th className="py-2 px-3 border-b border-sky-200">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-xs border border-sky-800 bg-white"></span>
                        {data?.anio || anioSeleccionado}
                      </span>
                    </th>
                    <th className="py-2 px-3 text-center border-b border-sky-200">Asignadas</th>
                    <th className="py-2 px-3 text-center border-b border-sky-200">
                      {isCumplimiento ? "Cumplidas" : "Finalizadas"}
                    </th>
                    <th className="py-2 px-3 text-right border-b border-sky-200 min-w-[110px]">
                      {isCumplimiento ? "% Cumplimiento" : "% Efectividad"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(datasetActivo.meses || []).map((m) => {
                    const tieneDatos = m.averias.asignadas > 0;
                    const valorNumerico = isCumplimiento ? m.averias.cumplidas : m.averias.finalizadas;
                    const porcentaje = isCumplimiento ? m.averias.cumplimiento : m.averias.efectividad;

                    return (
                      <tr
                        key={m.mesNumero}
                        onClick={() => tieneDatos && abrirAuditoria(m.mesNumero, m.mesNombre, "AVERIAS")}
                        className={`transition-colors group ${
                          tieneDatos
                            ? "hover:bg-sky-50/70 cursor-pointer"
                            : "opacity-50 cursor-default"
                        }`}
                        title={tieneDatos ? `Ver órdenes auditadas de Averías en ${m.mesNombre}` : undefined}
                      >
                        <td className="py-2 px-3.5 border-b border-slate-100 font-bold text-slate-800 text-[11.5px] flex items-center justify-between">
                          <span>{m.mesNombre}</span>
                          {tieneDatos && (
                            <span className="opacity-0 group-hover:opacity-100 text-sky-600 transition-opacity">
                              <Search size={12} />
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center border-b border-slate-100 font-mono font-medium text-slate-700">
                          {tieneDatos ? m.averias.asignadas : "-"}
                        </td>
                        <td className="py-2 px-3 text-center border-b border-slate-100 font-mono font-bold text-sky-900">
                          {tieneDatos ? valorNumerico : "-"}
                        </td>
                        <td className="py-2 px-3 text-right border-b border-slate-100">
                          {tieneDatos ? (
                            <div className="flex items-center justify-end gap-2">
                              <span className="px-2 py-0.5 rounded text-[11px] font-black font-mono shadow-2xs bg-sky-100/90 text-sky-900 border border-sky-200">
                                {porcentaje}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-300 font-mono">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-sky-100/90 text-sky-950 font-black text-xs border-t-2 border-sky-300">
                    <td className="py-2.5 px-3 uppercase tracking-wider">
                      TOTAL AÑO {data?.anio || anioSeleccionado}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-sm">
                      {datasetActivo.totalesAnio.averias.asignadas}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-sm text-sky-900">
                      {isCumplimiento
                        ? datasetActivo.totalesAnio.averias.cumplidas
                        : datasetActivo.totalesAnio.averias.finalizadas}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span className="px-2.5 py-1 rounded-md text-xs font-black font-mono shadow-xs bg-sky-600 text-white">
                        {isCumplimiento
                          ? datasetActivo.totalesAnio.averias.cumplimiento
                          : datasetActivo.totalesAnio.averias.efectividad}%
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ══ TABLA 2: POSTVENTA ══ */}
          <div className="bg-white rounded-2xl border border-indigo-200 shadow-2xs overflow-hidden flex flex-col justify-between">
            <div className="p-3.5 bg-indigo-50/70 border-b border-indigo-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-100 text-indigo-800 rounded-lg">
                  <ShoppingBag size={16} />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-indigo-950 uppercase tracking-wide">
                    {isCumplimiento ? "CUMPLIMIENTO POSTVENTA" : "EFECTIVIDAD POSTVENTA"}
                  </h3>
                  <span className="text-[10px] font-bold text-indigo-700">
                    {modoCalculo === "oficial" ? "Fuente: Oficial WIN / Híbrido" : "Fuente: BD ordenes.producto"}
                  </span>
                </div>
              </div>
              <span className="text-xs font-bold text-indigo-800 font-mono">
                Año {data?.anio || anioSeleccionado}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-separate border-spacing-0">
                <thead>
                  <tr className="bg-indigo-100/70 text-indigo-950 text-[11px] font-black uppercase">
                    <th className="py-2 px-3 border-b border-indigo-200">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-xs border border-indigo-800 bg-white"></span>
                        {data?.anio || anioSeleccionado}
                      </span>
                    </th>
                    <th className="py-2 px-3 text-center border-b border-indigo-200">Asignadas</th>
                    <th className="py-2 px-3 text-center border-b border-indigo-200">
                      {isCumplimiento ? "Cumplidas" : "Finalizadas"}
                    </th>
                    <th className="py-2 px-3 text-right border-b border-indigo-200 min-w-[110px]">
                      {isCumplimiento ? "% Cumplimiento" : "% Efectividad"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(datasetActivo.meses || []).map((m) => {
                    const tieneDatos = m.postventa.asignadas > 0;
                    const valorNumerico = isCumplimiento ? m.postventa.cumplidas : m.postventa.finalizadas;
                    const porcentaje = isCumplimiento ? m.postventa.cumplimiento : m.postventa.efectividad;

                    return (
                      <tr
                        key={m.mesNumero}
                        onClick={() => tieneDatos && abrirAuditoria(m.mesNumero, m.mesNombre, "POSTVENTA")}
                        className={`transition-colors group ${
                          tieneDatos
                            ? "hover:bg-indigo-50/70 cursor-pointer"
                            : "opacity-50 cursor-default"
                        }`}
                        title={tieneDatos ? `Ver órdenes auditadas de Postventa en ${m.mesNombre}` : undefined}
                      >
                        <td className="py-2 px-3.5 border-b border-slate-100 font-bold text-slate-800 text-[11.5px] flex items-center justify-between">
                          <span>{m.mesNombre}</span>
                          {tieneDatos && (
                            <span className="opacity-0 group-hover:opacity-100 text-indigo-600 transition-opacity">
                              <Search size={12} />
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center border-b border-slate-100 font-mono font-medium text-slate-700">
                          {tieneDatos ? m.postventa.asignadas : "-"}
                        </td>
                        <td className="py-2 px-3 text-center border-b border-slate-100 font-mono font-bold text-indigo-900">
                          {tieneDatos ? valorNumerico : "-"}
                        </td>
                        <td className="py-2 px-3 text-right border-b border-slate-100">
                          {tieneDatos ? (
                            <div className="flex items-center justify-end gap-2">
                              <span className="px-2 py-0.5 rounded text-[11px] font-black font-mono shadow-2xs bg-indigo-100/90 text-indigo-900 border border-indigo-200">
                                {porcentaje}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-300 font-mono">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-indigo-100/90 text-indigo-950 font-black text-xs border-t-2 border-indigo-300">
                    <td className="py-2.5 px-3 uppercase tracking-wider">
                      TOTAL AÑO {data?.anio || anioSeleccionado}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-sm">
                      {datasetActivo.totalesAnio.postventa.asignadas}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-sm text-indigo-900">
                      {isCumplimiento
                        ? datasetActivo.totalesAnio.postventa.cumplidas
                        : datasetActivo.totalesAnio.postventa.finalizadas}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span className="px-2.5 py-1 rounded-md text-xs font-black font-mono shadow-xs bg-indigo-600 text-white">
                        {isCumplimiento
                          ? datasetActivo.totalesAnio.postventa.cumplimiento
                          : datasetActivo.totalesAnio.postventa.efectividad}%
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* ── SECCIÓN 2: VISTA COMPARATIVA LADO A LADO (OFICIAL WIN VS BD PRODUCTO) ── */
        <div className="space-y-6">
          <div className="bg-indigo-50/60 border border-indigo-200 p-4 rounded-2xl flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2.5">
              <Scale className="w-5 h-5 text-indigo-700 shrink-0" />
              <div>
                <h4 className="text-xs sm:text-sm font-black text-indigo-950">
                  Auditoría Comparativa: Oficial WIN vs Base de Datos Cruda (ordenes.producto)
                </h4>
                <p className="text-[11.5px] text-indigo-800">
                  Compara los valores del acta oficial con el conteo directo por la columna producto de Fénix. La etiqueta <span className="font-bold text-emerald-700 font-mono">Diff</span> indica la variación neta.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs font-bold">
              <span className="flex items-center gap-1 text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded-md">
                <Award size={12} className="text-amber-700" /> Oficial WIN
              </span>
              <span className="flex items-center gap-1 text-emerald-900 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                <Database size={12} className="text-emerald-700" /> BD Producto
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* ══ COMPARATIVA AVERIAS ══ */}
            <div className="bg-white rounded-2xl border border-sky-200 shadow-2xs overflow-hidden">
              <div className="p-3 bg-sky-50 border-b border-sky-100 flex items-center justify-between">
                <h3 className="text-xs sm:text-sm font-black text-sky-950 uppercase flex items-center gap-2">
                  <Wrench size={15} /> Comparativa Averías ({isCumplimiento ? "Cumplimiento" : "Efectividad"})
                </h3>
                <span className="text-xs font-bold text-sky-800 font-mono">Año {data?.anio || anioSeleccionado}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-sky-100/80 text-sky-950 text-[10.5px] font-black uppercase">
                      <th className="py-2 px-2.5 border-b border-sky-200">Mes</th>
                      <th className="py-2 px-2 text-center border-b border-sky-200 bg-amber-50/50">Ofic. Asig</th>
                      <th className="py-2 px-2 text-center border-b border-sky-200 bg-emerald-50/50">BD Asig</th>
                      <th className="py-2 px-2 text-center border-b border-sky-200 bg-amber-50/50">Ofic. Fin</th>
                      <th className="py-2 px-2 text-center border-b border-sky-200 bg-emerald-50/50">BD Fin</th>
                      <th className="py-2 px-2 text-right border-b border-sky-200">Ofic. %</th>
                      <th className="py-2 px-2 text-right border-b border-sky-200">BD %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datasetOficial.meses.map((mOfic, idx) => {
                      const mProd = datasetDbProducto.meses[idx] || mOfic;
                      const oficAsig = mOfic.averias.asignadas;
                      const prodAsig = mProd.averias.asignadas;
                      const oficFin = isCumplimiento ? mOfic.averias.cumplidas : mOfic.averias.finalizadas;
                      const prodFin = isCumplimiento ? mProd.averias.cumplidas : mProd.averias.finalizadas;
                      const oficPct = isCumplimiento ? mOfic.averias.cumplimiento : mOfic.averias.efectividad;
                      const prodPct = isCumplimiento ? mProd.averias.cumplimiento : mProd.averias.efectividad;

                      const diffPct = parseFloat((prodPct - oficPct).toFixed(2));

                      const tieneDatos = oficAsig > 0 || prodAsig > 0;

                      return (
                        <tr
                          key={mOfic.mesNumero}
                          onClick={() => tieneDatos && abrirAuditoria(mOfic.mesNumero, mOfic.mesNombre, "AVERIAS")}
                          className={`transition-colors group ${
                            tieneDatos
                              ? "hover:bg-sky-50/70 cursor-pointer"
                              : "opacity-50 cursor-default"
                          }`}
                          title={tieneDatos ? `Ver órdenes auditadas de Averías en ${mOfic.mesNombre}` : undefined}
                        >
                          <td className="py-1.5 px-2.5 border-b border-slate-100 font-bold text-slate-800 text-[11px] flex items-center justify-between">
                            <span>{mOfic.mesNombre}</span>
                            {tieneDatos && (
                              <span className="opacity-0 group-hover:opacity-100 text-sky-600 transition-opacity">
                                <Search size={11} />
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 px-2 text-center border-b border-slate-100 font-mono font-bold text-amber-950 bg-amber-50/30">
                            {oficAsig > 0 ? oficAsig : "-"}
                          </td>
                          <td className="py-1.5 px-2 text-center border-b border-slate-100 font-mono font-bold text-emerald-950 bg-emerald-50/30">
                            {prodAsig > 0 ? prodAsig : "-"}
                          </td>
                          <td className="py-1.5 px-2 text-center border-b border-slate-100 font-mono font-bold text-amber-950 bg-amber-50/30">
                            {oficFin > 0 ? oficFin : "-"}
                          </td>
                          <td className="py-1.5 px-2 text-center border-b border-slate-100 font-mono font-bold text-emerald-950 bg-emerald-50/30">
                            {prodFin > 0 ? prodFin : "-"}
                          </td>
                          <td className="py-1.5 px-2 text-right border-b border-slate-100 font-mono font-bold text-amber-950">
                            {oficAsig > 0 ? `${oficPct}%` : "-"}
                          </td>
                          <td className="py-1.5 px-2 text-right border-b border-slate-100">
                            {prodAsig > 0 ? (
                              <span className={`inline-block px-1.5 py-0.2 rounded font-mono font-bold text-[10.5px] ${
                                diffPct === 0
                                  ? "bg-slate-100 text-slate-800"
                                  : diffPct > 0
                                    ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                                    : "bg-rose-100 text-rose-900 border border-rose-300"
                              }`}>
                                {prodPct}% {diffPct !== 0 && `(${diffPct > 0 ? `+${diffPct}` : diffPct}%)`}
                              </span>
                            ) : (
                              <span className="text-slate-300 font-mono">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-sky-100/90 text-sky-950 font-black text-xs border-t-2 border-sky-300">
                      <td className="py-2 px-2.5 uppercase">TOTAL</td>
                      <td className="py-2 px-2 text-center font-mono bg-amber-100/50">
                        {datasetOficial.totalesAnio.averias.asignadas}
                      </td>
                      <td className="py-2 px-2 text-center font-mono bg-emerald-100/50">
                        {datasetDbProducto.totalesAnio.averias.asignadas}
                      </td>
                      <td className="py-2 px-2 text-center font-mono bg-amber-100/50">
                        {isCumplimiento
                          ? datasetOficial.totalesAnio.averias.cumplidas
                          : datasetOficial.totalesAnio.averias.finalizadas}
                      </td>
                      <td className="py-2 px-2 text-center font-mono bg-emerald-100/50">
                        {isCumplimiento
                          ? datasetDbProducto.totalesAnio.averias.cumplidas
                          : datasetDbProducto.totalesAnio.averias.finalizadas}
                      </td>
                      <td className="py-2 px-2 text-right font-mono">
                        {isCumplimiento
                          ? datasetOficial.totalesAnio.averias.cumplimiento
                          : datasetOficial.totalesAnio.averias.efectividad}%
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-emerald-950">
                        {isCumplimiento
                          ? datasetDbProducto.totalesAnio.averias.cumplimiento
                          : datasetDbProducto.totalesAnio.averias.efectividad}%
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* ══ COMPARATIVA POSTVENTA ══ */}
            <div className="bg-white rounded-2xl border border-indigo-200 shadow-2xs overflow-hidden">
              <div className="p-3 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
                <h3 className="text-xs sm:text-sm font-black text-indigo-950 uppercase flex items-center gap-2">
                  <ShoppingBag size={15} /> Comparativa Postventa ({isCumplimiento ? "Cumplimiento" : "Efectividad"})
                </h3>
                <span className="text-xs font-bold text-indigo-800 font-mono">Año {data?.anio || anioSeleccionado}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-indigo-100/80 text-indigo-950 text-[10.5px] font-black uppercase">
                      <th className="py-2 px-2.5 border-b border-indigo-200">Mes</th>
                      <th className="py-2 px-2 text-center border-b border-indigo-200 bg-amber-50/50">Ofic. Asig</th>
                      <th className="py-2 px-2 text-center border-b border-indigo-200 bg-emerald-50/50">BD Asig</th>
                      <th className="py-2 px-2 text-center border-b border-indigo-200 bg-amber-50/50">Ofic. Fin</th>
                      <th className="py-2 px-2 text-center border-b border-indigo-200 bg-emerald-50/50">BD Fin</th>
                      <th className="py-2 px-2 text-right border-b border-indigo-200">Ofic. %</th>
                      <th className="py-2 px-2 text-right border-b border-indigo-200">BD %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datasetOficial.meses.map((mOfic, idx) => {
                      const mProd = datasetDbProducto.meses[idx] || mOfic;
                      const oficAsig = mOfic.postventa.asignadas;
                      const prodAsig = mProd.postventa.asignadas;
                      const oficFin = isCumplimiento ? mOfic.postventa.cumplidas : mOfic.postventa.finalizadas;
                      const prodFin = isCumplimiento ? mProd.postventa.cumplidas : mProd.postventa.finalizadas;
                      const oficPct = isCumplimiento ? mOfic.postventa.cumplimiento : mOfic.postventa.efectividad;
                      const prodPct = isCumplimiento ? mProd.postventa.cumplimiento : mProd.postventa.efectividad;

                      const diffPct = parseFloat((prodPct - oficPct).toFixed(2));

                      const tieneDatos = oficAsig > 0 || prodAsig > 0;

                      return (
                        <tr
                          key={mOfic.mesNumero}
                          onClick={() => tieneDatos && abrirAuditoria(mOfic.mesNumero, mOfic.mesNombre, "POSTVENTA")}
                          className={`transition-colors group ${
                            tieneDatos
                              ? "hover:bg-indigo-50/70 cursor-pointer"
                              : "opacity-50 cursor-default"
                          }`}
                          title={tieneDatos ? `Ver órdenes auditadas de Postventa en ${mOfic.mesNombre}` : undefined}
                        >
                          <td className="py-1.5 px-2.5 border-b border-slate-100 font-bold text-slate-800 text-[11px] flex items-center justify-between">
                            <span>{mOfic.mesNombre}</span>
                            {tieneDatos && (
                              <span className="opacity-0 group-hover:opacity-100 text-indigo-600 transition-opacity">
                                <Search size={11} />
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 px-2 text-center border-b border-slate-100 font-mono font-bold text-amber-950 bg-amber-50/30">
                            {oficAsig > 0 ? oficAsig : "-"}
                          </td>
                          <td className="py-1.5 px-2 text-center border-b border-slate-100 font-mono font-bold text-emerald-950 bg-emerald-50/30">
                            {prodAsig > 0 ? prodAsig : "-"}
                          </td>
                          <td className="py-1.5 px-2 text-center border-b border-slate-100 font-mono font-bold text-amber-950 bg-amber-50/30">
                            {oficFin > 0 ? oficFin : "-"}
                          </td>
                          <td className="py-1.5 px-2 text-center border-b border-slate-100 font-mono font-bold text-emerald-950 bg-emerald-50/30">
                            {prodFin > 0 ? prodFin : "-"}
                          </td>
                          <td className="py-1.5 px-2 text-right border-b border-slate-100 font-mono font-bold text-amber-950">
                            {oficAsig > 0 ? `${oficPct}%` : "-"}
                          </td>
                          <td className="py-1.5 px-2 text-right border-b border-slate-100">
                            {prodAsig > 0 ? (
                              <span className={`inline-block px-1.5 py-0.2 rounded font-mono font-bold text-[10.5px] ${
                                diffPct === 0
                                  ? "bg-slate-100 text-slate-800"
                                  : diffPct > 0
                                    ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                                    : "bg-rose-100 text-rose-900 border border-rose-300"
                              }`}>
                                {prodPct}% {diffPct !== 0 && `(${diffPct > 0 ? `+${diffPct}` : diffPct}%)`}
                              </span>
                            ) : (
                              <span className="text-slate-300 font-mono">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-indigo-100/90 text-indigo-950 font-black text-xs border-t-2 border-indigo-300">
                      <td className="py-2 px-2.5 uppercase">TOTAL</td>
                      <td className="py-2 px-2 text-center font-mono bg-amber-100/50">
                        {datasetOficial.totalesAnio.postventa.asignadas}
                      </td>
                      <td className="py-2 px-2 text-center font-mono bg-emerald-100/50">
                        {datasetDbProducto.totalesAnio.postventa.asignadas}
                      </td>
                      <td className="py-2 px-2 text-center font-mono bg-amber-100/50">
                        {isCumplimiento
                          ? datasetOficial.totalesAnio.postventa.cumplidas
                          : datasetOficial.totalesAnio.postventa.finalizadas}
                      </td>
                      <td className="py-2 px-2 text-center font-mono bg-emerald-100/50">
                        {isCumplimiento
                          ? datasetDbProducto.totalesAnio.postventa.cumplidas
                          : datasetDbProducto.totalesAnio.postventa.finalizadas}
                      </td>
                      <td className="py-2 px-2 text-right font-mono">
                        {isCumplimiento
                          ? datasetOficial.totalesAnio.postventa.cumplimiento
                          : datasetOficial.totalesAnio.postventa.efectividad}%
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-emerald-950">
                        {isCumplimiento
                          ? datasetDbProducto.totalesAnio.postventa.cumplimiento
                          : datasetDbProducto.totalesAnio.postventa.efectividad}%
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── GRÁFICO COMBINADO: TENDENCIA MENSUAL (%) ── */}
      <div className="bg-slate-50/70 rounded-2xl border border-slate-200/80 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-200/60">
          <div>
            <h3 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-2">
              <Percent size={16} className="text-indigo-600" />
              Tendencia Mensual: % de {isCumplimiento ? "Cumplimiento" : "Efectividad"}
            </h3>
            <p className="text-[11px] text-slate-500">
              Evolución mensual entre Averías y Postventa ({isCumplimiento ? "Cumplimiento Operativo" : "Efectividad de Liquidación"}).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3.5 text-xs font-bold">
            <span className="flex items-center gap-1.5 text-sky-700">
              <span className="w-3 h-3 rounded-full bg-sky-500 inline-block shadow-2xs"></span>
              {isCumplimiento ? "% Cump. Averías" : "% Ef. Averías"}
            </span>
            <span className="flex items-center gap-1.5 text-indigo-700">
              <span className="w-3 h-3 rounded-full bg-indigo-600 inline-block shadow-2xs"></span>
              {isCumplimiento ? "% Cump. Postventa" : "% Ef. Postventa"}
            </span>
            <span className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 text-[10.5px]">
              <span className="w-3 h-0.5 border-t-2 border-dashed border-emerald-600 inline-block"></span>
              Meta WIN (80%)
            </span>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 15, right: 25, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.8} />
              <XAxis dataKey="mes" stroke="#64748b" fontSize={11} tickLine={false} />
              <YAxis domain={[0, 100]} stroke="#64748b" fontSize={11} tickLine={false} unit="%" ticks={[0, 25, 50, 75, 80, 100]} />
              
              {/* Línea de Meta 80% */}
              <ReferenceLine
                y={80}
                stroke="#10b981"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: "Meta 80%",
                  fill: "#059669",
                  fontSize: 10,
                  fontWeight: 700,
                  position: "insideTopRight",
                }}
              />

              <RechartsTooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0]?.payload;
                    if (!d) return null;
                    return (
                      <div className="bg-white/95 backdrop-blur-md p-3 rounded-xl border border-slate-200 shadow-xl text-xs space-y-2 min-w-[190px]">
                        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
                          <span className="font-black text-slate-900">{d.nombreCompleto} {data?.anio || anioSeleccionado}</span>
                          {d.isCurrentMonth && (
                            <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[9.5px] font-black rounded-full border border-emerald-300 animate-pulse">
                              EN VIVO
                            </span>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-3">
                            <span className="flex items-center gap-1.5 font-bold text-sky-700">
                              <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                              Averías:
                            </span>
                            <div className="text-right font-mono">
                              <span className="font-black text-sky-950">{isCumplimiento ? d["% Cumpl. Averías"] : d["% Ef. Averías"]}%</span>
                              <span className="text-[10px] text-slate-500 ml-1">({d.finAv}/{d.asigAv})</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="flex items-center gap-1.5 font-bold text-indigo-700">
                              <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                              Postventa:
                            </span>
                            <div className="text-right font-mono">
                              <span className="font-black text-indigo-950">{isCumplimiento ? d["% Cumpl. Postventa"] : d["% Ef. Postventa"]}%</span>
                              <span className="text-[10px] text-slate-500 ml-1">({d.finPv}/{d.asigPv})</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-100 text-[10.5px] text-emerald-700 font-bold">
                            <span>🎯 Meta WIN:</span>
                            <span className="font-mono">80.00%</span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />

              <Line
                type="monotone"
                dataKey={isCumplimiento ? "% Cumpl. Averías" : "% Ef. Averías"}
                name={isCumplimiento ? "% Cumplimiento Averías" : "% Efectividad Averías"}
                stroke="#0284c7"
                strokeWidth={3}
                dot={{ r: 4, fill: "#0284c7", strokeWidth: 2, stroke: "#fff" }}
                activeDot={{ r: 6, stroke: "#0284c7", strokeWidth: 2 }}
              />
              <Line
                type="monotone"
                dataKey={isCumplimiento ? "% Cumpl. Postventa" : "% Ef. Postventa"}
                name={isCumplimiento ? "% Cumplimiento Postventa" : "% Efectividad Postventa"}
                stroke="#6366f1"
                strokeWidth={3}
                dot={{ r: 4, fill: "#6366f1", strokeWidth: 2, stroke: "#fff" }}
                activeDot={{ r: 6, stroke: "#6366f1", strokeWidth: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── BITÁCORA DE AUDITORÍA Y EXCEPCIONES TÉCNICAS WIN ── */}
      <WinAuditLogSection anio={data?.anio || anioSeleccionado} />

      {/* ── MODAL DRILL-DOWN: AUDITORÍA DE ÓRDENES POR MES ── */}
      <MonthlyOrdersAuditModal
        isOpen={modalAuditoria.isOpen}
        onClose={() => setModalAuditoria((prev) => ({ ...prev, isOpen: false }))}
        anio={data?.anio || anioSeleccionado}
        mes={modalAuditoria.mes}
        mesNombre={modalAuditoria.mesNombre}
        categoriaInicial={modalAuditoria.categoria}
      />
    </div>
  );
};
