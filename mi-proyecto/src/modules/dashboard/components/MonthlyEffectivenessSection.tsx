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
} from "lucide-react";
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

interface ApiResponse {
  success: boolean;
  anio: number;
  aniosDisponibles: number[];
  cuadrillas?: CuadrillaStat[];
  totalesAnio: TotalesAnio;
  meses: MesStat[];
}

export const MonthlyEffectivenessSection: React.FC = () => {
  const [anioSeleccionado, setAnioSeleccionado] = useState<number>(new Date().getFullYear());
  const [aniosDisponibles, setAniosDisponibles] = useState<number[]>([new Date().getFullYear()]);
  const [modoMetrica, setModoMetrica] = useState<"efectividad" | "cumplimiento" | "ambas">("efectividad");
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<ApiResponse | null>(null);

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

  // Preparar datos para el gráfico combinado
  const chartData = (data?.meses || []).map((m) => ({
    mes: m.mesNombre.substring(0, 3),
    nombreCompleto: m.mesNombre,
    "% Ef. Averías": m.averias.efectividad,
    "% Ef. Postventa": m.postventa.efectividad,
    "% Cumpl. Averías": m.averias.cumplimiento,
    "% Cumpl. Postventa": m.postventa.cumplimiento,
  }));

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

    const consolidatedRows = data.meses.map((m) => [
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
    ]);

    const consolidatedTotal = [
      `TOTAL ${data.anio}`,
      data.totalesAnio.averias.asignadas,
      data.totalesAnio.averias.finalizadas,
      `${data.totalesAnio.averias.efectividad}%`,
      data.totalesAnio.averias.cumplidas,
      `${data.totalesAnio.averias.cumplimiento}%`,
      data.totalesAnio.postventa.asignadas,
      data.totalesAnio.postventa.finalizadas,
      `${data.totalesAnio.postventa.efectividad}%`,
      data.totalesAnio.postventa.cumplidas,
      `${data.totalesAnio.postventa.cumplimiento}%`,
    ];

    const ws = XLSX.utils.aoa_to_sheet([
      [`REPORTE DE EFECTIVIDAD Y CUMPLIMIENTO: AVERÍAS VS POSTVENTA (${data.anio})`],
      [],
      consolidatedHeaders,
      ...consolidatedRows,
      consolidatedTotal,
    ]);

    ws["!cols"] = [
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 18 },
      { wch: 18 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Rendimiento_${data.anio}`);
    XLSX.writeFile(wb, `Efectividad_y_Cumplimiento_${data.anio}.xlsx`);
  };

  const isEfectividad = modoMetrica === "efectividad";
  const isCumplimiento = modoMetrica === "cumplimiento";

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs space-y-6">
      {/* ── HEADER CON SELECTORES (AÑO Y MÉTRICA: EFECTIVIDAD / CUMPLIMIENTO) ── */}
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
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isCumplimiento
                ? "Mide el cumplimiento global (órdenes atendidas/liquidadas y canceladas ajenas a la contrata / imputables al cliente)."
                : "Mide el ratio neto de efectividad (órdenes 100% finalizadas y liquidadas respecto al total asignado)."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
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

      {/* ── CUADRO DE CUADRILLAS POR GESTIÓN (IDÉNTICO A WIN) ── */}
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

      {/* ── SECCIÓN DE LAS 2 TABLAS ADAPTABLES (EFECTIVIDAD O CUMPLIMIENTO) ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* ══ TABLA 1: AVERIAS (EFECTIVIDAD / CUMPLIMIENTO) ══ */}
        <div className="bg-white rounded-2xl border border-sky-200 shadow-2xs overflow-hidden flex flex-col justify-between">
          <div className="p-3.5 bg-sky-50/70 border-b border-sky-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-sky-100 text-sky-800 rounded-lg">
                <Wrench size={16} />
              </div>
              <h3 className="text-xs sm:text-sm font-black text-sky-950 uppercase tracking-wide">
                {isCumplimiento ? "CUMPLIMIENTO AVERIAS" : "EFECTIVIDAD AVERIAS"}
              </h3>
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
                {(data?.meses || []).map((m) => {
                  const tieneDatos = m.averias.asignadas > 0;
                  const valorNumerico = isCumplimiento ? m.averias.cumplidas : m.averias.finalizadas;
                  const porcentaje = isCumplimiento ? m.averias.cumplimiento : m.averias.efectividad;

                  return (
                    <tr
                      key={m.mesNumero}
                      className={`hover:bg-sky-50/40 transition-colors ${
                        !tieneDatos ? "opacity-50" : ""
                      }`}
                    >
                      <td className="py-2 px-3.5 border-b border-slate-100 font-bold text-slate-800 text-[11.5px]">
                        {m.mesNombre}
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
              {data && (
                <tfoot>
                  <tr className="bg-sky-100/90 text-sky-950 font-black text-xs border-t-2 border-sky-300">
                    <td className="py-2.5 px-3 uppercase tracking-wider">
                      TOTAL AÑO {data.anio}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-sm">
                      {data.totalesAnio.averias.asignadas}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-sm text-sky-900">
                      {isCumplimiento
                        ? data.totalesAnio.averias.cumplidas
                        : data.totalesAnio.averias.finalizadas}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span className="px-2.5 py-1 rounded-md text-xs font-black font-mono shadow-xs bg-sky-600 text-white">
                        {isCumplimiento
                          ? data.totalesAnio.averias.cumplimiento
                          : data.totalesAnio.averias.efectividad}%
                      </span>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* ══ TABLA 2: POSTVENTA (EFECTIVIDAD / CUMPLIMIENTO) ══ */}
        <div className="bg-white rounded-2xl border border-indigo-200 shadow-2xs overflow-hidden flex flex-col justify-between">
          <div className="p-3.5 bg-indigo-50/70 border-b border-indigo-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-100 text-indigo-800 rounded-lg">
                <ShoppingBag size={16} />
              </div>
              <h3 className="text-xs sm:text-sm font-black text-indigo-950 uppercase tracking-wide">
                {isCumplimiento ? "CUMPLIMIENTO POSTVENTA" : "EFECTIVIDAD POSTVENTA"}
              </h3>
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
                {(data?.meses || []).map((m) => {
                  const tieneDatos = m.postventa.asignadas > 0;
                  const valorNumerico = isCumplimiento ? m.postventa.cumplidas : m.postventa.finalizadas;
                  const porcentaje = isCumplimiento ? m.postventa.cumplimiento : m.postventa.efectividad;

                  return (
                    <tr
                      key={m.mesNumero}
                      className={`hover:bg-indigo-50/40 transition-colors ${
                        !tieneDatos ? "opacity-50" : ""
                      }`}
                    >
                      <td className="py-2 px-3.5 border-b border-slate-100 font-bold text-slate-800 text-[11.5px]">
                        {m.mesNombre}
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
              {data && (
                <tfoot>
                  <tr className="bg-indigo-100/90 text-indigo-950 font-black text-xs border-t-2 border-indigo-300">
                    <td className="py-2.5 px-3 uppercase tracking-wider">
                      TOTAL AÑO {data.anio}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-sm">
                      {data.totalesAnio.postventa.asignadas}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-sm text-indigo-900">
                      {isCumplimiento
                        ? data.totalesAnio.postventa.cumplidas
                        : data.totalesAnio.postventa.finalizadas}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span className="px-2.5 py-1 rounded-md text-xs font-black font-mono shadow-xs bg-indigo-600 text-white">
                        {isCumplimiento
                          ? data.totalesAnio.postventa.cumplimiento
                          : data.totalesAnio.postventa.efectividad}%
                      </span>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      {/* ── GRÁFICO COMBINADO: TENDENCIA MENSUAL (%) SEGÚN LA MÉTRICA ── */}
      <div className="bg-slate-50/70 rounded-2xl border border-slate-200/80 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-200/60">
          <div>
            <h3 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-2">
              <Percent size={16} className="text-indigo-600" />
              Tendencia Mensual: % de {isCumplimiento ? "Cumplimiento" : "Efectividad"}
            </h3>
            <p className="text-[11px] text-slate-500">
              Evolución comparativa por mes entre Averías y Postventa ({isCumplimiento ? "Cumplimiento Operativo" : "Efectividad de Liquidación"}).
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-bold">
            <span className="flex items-center gap-1.5 text-sky-700">
              <span className="w-3 h-3 rounded-full bg-sky-500 inline-block"></span>
              {isCumplimiento ? "% Cump. Averías" : "% Ef. Averías"}
            </span>
            <span className="flex items-center gap-1.5 text-indigo-700">
              <span className="w-3 h-3 rounded-full bg-indigo-600 inline-block"></span>
              {isCumplimiento ? "% Cump. Postventa" : "% Ef. Postventa"}
            </span>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.8} />
              <XAxis dataKey="mes" stroke="#64748b" fontSize={11} tickLine={false} />
              <YAxis domain={[0, 100]} stroke="#64748b" fontSize={11} tickLine={false} unit="%" />
              <RechartsTooltip
                formatter={(value: any, name: any) => [`${value}%`, name]}
                contentStyle={{
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                  fontSize: "12px",
                  fontWeight: "bold",
                }}
              />
              <Line
                type="monotone"
                dataKey={isCumplimiento ? "% Cumpl. Averías" : "% Ef. Averías"}
                name={isCumplimiento ? "% Cumplimiento Averías" : "% Efectividad Averías"}
                stroke="#0284c7"
                strokeWidth={3}
                dot={{ r: 4, fill: "#0284c7" }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey={isCumplimiento ? "% Cumpl. Postventa" : "% Ef. Postventa"}
                name={isCumplimiento ? "% Cumplimiento Postventa" : "% Efectividad Postventa"}
                stroke="#6366f1"
                strokeWidth={3}
                dot={{ r: 4, fill: "#6366f1" }}
                activeDot={{ r: 6 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
